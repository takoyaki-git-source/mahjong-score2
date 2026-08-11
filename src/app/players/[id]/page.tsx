import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePeriod, type PeriodParams } from '@/lib/period'
import { dateOnly } from '@/lib/format'
import type { PlayerStats, MatchupStats, PlayerYakumanStats } from '@/lib/types'
import SiteHeader from '@/components/SiteHeader'
import PeriodSelector from '@/components/PeriodSelector'

type YakumanDetail = {
  event_id: number
  yakuman_type: string
  game: { played_at: string } | null
  target: { player_id: number; name: string } | null
}

function pct(v: number | null) {
  return v == null ? '-' : `${(v * 100).toFixed(1)}%`
}

function pctCount(v: number | null, count: number | null, unit: '回' | '日' = '回') {
  if (v == null) return '-'
  return `${(v * 100).toFixed(1)}% (${count ?? 0}${unit})`
}

function pt(v: number | null) {
  if (v == null) return '-'
  return `${v > 0 ? '+' : ''}${v}`
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <p className="text-xs text-foreground-soft">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<PeriodParams>
}) {
  const { id } = await params
  const playerId = Number(id)
  const sp = await searchParams
  const { start, end, label } = resolvePeriod(sp)

  const supabase = await createClient()

  const { data: player } = await supabase
    .from('players')
    .select('player_id, name')
    .eq('player_id', playerId)
    .maybeSingle()

  if (!player) return notFound()

  const [
    { data: statsData },
    { data: matchupsData },
    { data: yakumanData },
    { data: yakumanDetailData },
    { data: yearRows },
  ] = await Promise.all([
    supabase.rpc('player_stats_for_period', { p_start: start, p_end: end }).eq('player_id', playerId),
    supabase
      .rpc('matchup_stats_for_period', { p_start: start, p_end: end })
      .eq('player_a', playerId)
      .order('games', { ascending: false }),
    supabase.rpc('player_yakuman_stats_for_period', { p_start: start, p_end: end }).eq('player_id', playerId),
    supabase
      .from('yakuman_events')
      .select(
        `
          event_id,
          yakuman_type,
          game:games!yakuman_events_game_id_fkey(played_at),
          target:players!yakuman_events_target_player_id_fkey(player_id, name)
        `
      )
      .eq('player_id', playerId),
    supabase.rpc('available_years'),
  ])

  const statsRows = (statsData ?? []) as PlayerStats[]
  const matchups = (matchupsData ?? []) as MatchupStats[]
  const yakumanRows = (yakumanData ?? []) as PlayerYakumanStats[]
  const years = (yearRows ?? []).map((r: { year: number }) => r.year)
  const stats = statsRows[0]
  const yakuman = yakumanRows[0]

  const yakumanDetails = ((yakumanDetailData ?? []) as unknown as YakumanDetail[])
    .filter((y) => {
      const played = y.game?.played_at
      if (!played) return false
      if (start && played < start) return false
      if (end && played > end) return false
      return true
    })
    .sort((a, b) => (b.game?.played_at ?? '').localeCompare(a.game?.played_at ?? ''))

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Link href="/" className="mb-4 inline-block text-sm text-foreground-soft hover:text-foreground">
          ← 成績一覧へ戻る
        </Link>
        <h1 className="mb-1 font-display text-2xl font-bold">{player.name}</h1>
        <p className="mb-6 text-sm text-foreground-soft">
          {label}
          {start && end && ` (${start} 〜 ${end})`}
        </p>

        <PeriodSelector basePath={`/players/${playerId}`} current={sp} years={years} />

        {!stats ? (
          <p className="text-sm text-foreground-soft">この期間の対局データはありません。</p>
        ) : (
          <div className="space-y-10">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="半荘数" value={stats.games} />
              <StatCard label="総pt" value={pt(stats.total_score)} />
              <StatCard label="平均pt" value={stats.avg_score} />
              <StatCard label="平均着順" value={stats.avg_rank} />
              <StatCard label="1位率" value={pctCount(stats.first_rate, stats.first_count)} />
              <StatCard label="2位率" value={pctCount(stats.second_rate, stats.second_count)} />
              <StatCard label="3位率" value={pctCount(stats.third_rate, stats.third_count)} />
              <StatCard label="4位率" value={pctCount(stats.fourth_rate, stats.fourth_count)} />
              <StatCard
                label="連対率"
                value={pctCount(stats.rentai_rate, stats.first_count + stats.second_count)}
              />
              <StatCard label="トビ率" value={pctCount(stats.tobi_rate, stats.tobi_count)} />
              <StatCard label="最高pt" value={pt(stats.max_score)} />
              <StatCard label="最低pt" value={pt(stats.min_score)} />
              <StatCard label="最終対局日" value={stats.last_played} />
            </section>

            <section>
              <h2 className="mb-3 font-display text-lg font-bold">連続記録</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="連続トップ" value={stats.max_top_streak} />
                <StatCard label="連続ラス" value={stats.max_last_streak} />
                <StatCard label="連続ノートップ" value={stats.max_no_top_streak} />
                <StatCard label="連続ノーラス" value={stats.max_no_last_streak} />
              </div>
            </section>

            <section>
              <h2 className="mb-3 font-display text-lg font-bold">日別集計</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="参加日数" value={stats.play_days} />
                <StatCard label="日別最高pt" value={pt(stats.best_day)} />
                <StatCard label="日別最低pt" value={pt(stats.worst_day)} />
                <StatCard label="プラス日数率" value={pctCount(stats.plus_rate, stats.plus_days, '日')} />
              </div>
            </section>

            {yakuman && yakuman.yakuman_count > 0 && (
              <section>
                <h2 className="mb-3 font-display text-lg font-bold">役満</h2>
                <p className="mb-3 text-sm text-foreground-soft">
                  {yakuman.yakuman_count}回 (発生率 {pct(yakuman.yakuman_rate)})
                </p>
                <ul className="space-y-2">
                  {yakumanDetails.map((y) => (
                    <li
                      key={y.event_id}
                      className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{y.yakuman_type}</span>
                      <span className="text-foreground-soft">{dateOnly(y.game?.played_at)}</span>
                      <span className="ml-auto text-foreground-soft">
                        {y.target ? (
                          <>
                            放銃:{' '}
                            <Link href={`/players/${y.target.player_id}`} className="text-foreground hover:text-accent hover:underline">
                              {y.target.name}
                            </Link>
                          </>
                        ) : (
                          'ツモ'
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="mb-3 font-display text-lg font-bold">対戦相手別成績</h2>
              {matchups && matchups.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-foreground-soft">
                        <th className="py-2.5 pr-3 pl-4">相手</th>
                        <th className="py-2.5 pr-3 text-right">対局数</th>
                        <th className="py-2.5 pr-3 text-right">自分の平均着順</th>
                        <th className="py-2.5 pr-3 text-right">相手の平均着順</th>
                        <th className="py-2.5 pr-3 text-right">自分のトップ率</th>
                        <th className="py-2.5 pr-4 text-right">自分のラス率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchups.map((m) => (
                        <tr key={m.player_b} className="border-b border-line/70 last:border-b-0">
                          <td className="py-2.5 pr-3 pl-4">
                            <Link href={`/players/${m.player_b}`} className="hover:text-accent hover:underline">
                              {m.name_b}
                            </Link>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{m.games}</td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{m.avg_rank_a}</td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{m.avg_rank_b}</td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{pct(m.top_rate_a)}</td>
                          <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{pct(m.last_rate_a)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-foreground-soft">データがありません。</p>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  )
}
