import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/components/SiteHeader'
import TileBadge from '@/components/TileBadge'

type GameRow = {
  game_id: string
  results: {
    player_id: number
    rank: number
    final_score: number
    seat_order: number
    player: { name: string } | null
  }[]
}

type YakumanRow = {
  event_id: number
  yakuman_type: string
  winner: { player_id: number; name: string } | null
  target: { player_id: number; name: string } | null
}

function pt(v: number) {
  return `${v > 0 ? '+' : ''}${v}`
}

export default async function DailyPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()

  let date = sp.date ?? null
  if (!date) {
    const { data: latest } = await supabase
      .from('games')
      .select('played_at')
      .order('played_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    date = latest?.played_at ? latest.played_at.slice(0, 10) : null
  }

  if (!date) {
    return (
      <>
        <SiteHeader active="daily" />
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <h1 className="mb-1 font-display text-2xl font-bold">日別成績</h1>
          <p className="text-sm text-foreground-soft">対局データがありません。</p>
        </main>
      </>
    )
  }

  const [{ data: gamesData, error }, { data: prevRow }, { data: nextRow }, { data: allDatesData }] =
    await Promise.all([
      supabase
        .from('games')
        .select('game_id, results(player_id, rank, final_score, seat_order, player:players(name))')
        .eq('played_at', date)
        .order('game_id'),
      supabase
        .from('games')
        .select('played_at')
        .lt('played_at', date)
        .order('played_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('games')
        .select('played_at')
        .gt('played_at', date)
        .order('played_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from('games').select('played_at').order('played_at', { ascending: false }),
    ])

  // 対局が実際にあった日だけを選択肢にする(空振りする日付を選べてもしょうがないため)
  const dayCounts = new Map<string, number>()
  for (const row of allDatesData ?? []) {
    const d = row.played_at.slice(0, 10)
    dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1)
  }
  const daysByYear = new Map<string, [string, number][]>()
  for (const [d, c] of dayCounts) {
    const year = d.slice(0, 4)
    if (!daysByYear.has(year)) daysByYear.set(year, [])
    daysByYear.get(year)!.push([d, c])
  }

  const games = ((gamesData ?? []) as unknown as GameRow[]).map((g) => ({
    ...g,
    results: [...g.results].sort((a, b) => a.seat_order - b.seat_order),
  }))
  const gameIds = games.map((g) => g.game_id)
  const prevDate = prevRow?.played_at ? prevRow.played_at.slice(0, 10) : null
  const nextDate = nextRow?.played_at ? nextRow.played_at.slice(0, 10) : null

  const { data: yakumanData } =
    gameIds.length > 0
      ? await supabase
          .from('yakuman_events')
          .select(
            `
              event_id,
              yakuman_type,
              winner:players!yakuman_events_player_id_fkey(player_id, name),
              target:players!yakuman_events_target_player_id_fkey(player_id, name)
            `
          )
          .in('game_id', gameIds)
      : { data: [] as YakumanRow[] }
  const yakumanRows = (yakumanData ?? []) as unknown as YakumanRow[]

  // その日の合計ptで順位付け(列の並び順・ヒーローカードの両方に使う)
  const totals = new Map<number, { name: string; total: number }>()
  for (const g of games) {
    for (const r of g.results) {
      const cur = totals.get(r.player_id) ?? { name: r.player?.name ?? '?', total: 0 }
      cur.total += r.final_score
      totals.set(r.player_id, cur)
    }
  }
  const ranking = [...totals.entries()]
    .map(([player_id, v]) => ({ player_id, name: v.name, total: v.total }))
    .sort((a, b) => b.total - a.total)
  const columnOrder = ranking.map((r) => r.player_id)
  const bestTotal = ranking[0]?.total
  const worstTotal = ranking[ranking.length - 1]?.total

  return (
    <>
      <SiteHeader active="daily" />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="mb-1 font-display text-2xl font-bold">日別成績</h1>
        <p className="mb-6 text-sm text-foreground-soft">{date}</p>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-line bg-surface p-1">
            {prevDate ? (
              <Link
                href={`/daily?date=${prevDate}`}
                className="rounded-full px-3 py-1.5 text-sm text-foreground-soft hover:text-foreground"
              >
                ← 前の対局日
              </Link>
            ) : (
              <span className="px-3 py-1.5 text-sm text-foreground-soft/40">← 前の対局日</span>
            )}
            {nextDate ? (
              <Link
                href={`/daily?date=${nextDate}`}
                className="rounded-full px-3 py-1.5 text-sm text-foreground-soft hover:text-foreground"
              >
                次の対局日 →
              </Link>
            ) : (
              <span className="px-3 py-1.5 text-sm text-foreground-soft/40">次の対局日 →</span>
            )}
          </div>
          <form method="get" action="/daily" className="flex items-center gap-1.5 text-sm">
            <select
              name="date"
              defaultValue={date}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-foreground"
            >
              {[...daysByYear.entries()].map(([year, days]) => (
                <optgroup key={year} label={`${year}年`}>
                  {days.map(([d, c]) => (
                    <option key={d} value={d}>
                      {d}({c}半荘)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md border border-line px-3 py-1.5 text-foreground-soft transition-colors hover:text-foreground"
            >
              表示
            </button>
          </form>
        </div>

        {error && <p className="text-sm text-accent">取得に失敗しました: {error.message}</p>}

        {!error && games.length === 0 && (
          <p className="text-sm text-foreground-soft">この日の対局データはありません。</p>
        )}

        {!error && games.length > 0 && (
          <>
            <div className="mb-8 grid gap-3 sm:grid-cols-4">
              {ranking.slice(0, 4).map((r, i) => (
                <div
                  key={r.player_id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <TileBadge rank={i + 1} size="lg" />
                  <div className="min-w-0">
                    <Link
                      href={`/players/${r.player_id}`}
                      className="block truncate font-display text-lg font-bold underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
                    >
                      {r.name}
                    </Link>
                    <p className="font-mono text-sm tabular-nums text-foreground-soft">{pt(r.total)}pt</p>
                  </div>
                </div>
              ))}
            </div>

            {yakumanRows.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 font-display text-lg font-bold">役満</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {yakumanRows.map((y) => (
                    <li
                      key={y.event_id}
                      className="rounded-xl border border-line border-l-[3px] border-l-gold bg-surface p-4"
                    >
                      <p className="font-display text-lg font-bold leading-snug">{y.yakuman_type}</p>
                      <p className="mt-2 text-sm">
                        {y.winner ? (
                          <Link
                            href={`/players/${y.winner.player_id}`}
                            className="font-medium underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
                          >
                            {y.winner.name}
                          </Link>
                        ) : (
                          '-'
                        )}
                        <span className="text-foreground-soft">
                          {' '}
                          が和了、
                          {y.target ? (
                            <>
                              {' '}
                              <Link
                                href={`/players/${y.target.player_id}`}
                                className="font-medium text-foreground underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
                              >
                                {y.target.name}
                              </Link>{' '}
                              の放銃
                            </>
                          ) : (
                            ' ツモ和了'
                          )}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="py-2.5 pr-3 pl-4">#</th>
                    {ranking.map((r) => (
                      <th key={r.player_id} className="py-2.5 pr-3 text-right">
                        <Link
                          href={`/players/${r.player_id}`}
                          className="underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
                        >
                          {r.name}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {games.map((g, i) => {
                    const cells = columnOrder.map(
                      (pid) => g.results.find((r) => r.player_id === pid)?.final_score ?? null
                    )
                    const numeric = cells.filter((v): v is number => v != null)
                    const max = numeric.length > 1 ? Math.max(...numeric) : null
                    const min = numeric.length > 1 ? Math.min(...numeric) : null
                    return (
                      <tr key={g.game_id} className="border-b border-line/70">
                        <td className="py-2 pr-3 pl-4 text-foreground-soft">{i + 1}</td>
                        {cells.map((v, ci) => (
                          <td
                            key={ci}
                            className={`py-2 pr-3 text-right font-mono tabular-nums ${
                              v != null && v === max
                                ? 'bg-accent-2/10 text-accent-2 font-semibold'
                                : v != null && v === min
                                  ? 'bg-accent/10 text-accent'
                                  : ''
                            }`}
                          >
                            {v == null ? '-' : pt(v)}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line font-semibold">
                    <td className="py-2.5 pr-3 pl-4">計</td>
                    {ranking.map((r) => (
                      <td
                        key={r.player_id}
                        className={`py-2.5 pr-3 text-right font-mono tabular-nums ${
                          r.total === bestTotal ? 'text-accent-2' : r.total === worstTotal ? 'text-accent' : ''
                        }`}
                      >
                        {pt(r.total)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  )
}
