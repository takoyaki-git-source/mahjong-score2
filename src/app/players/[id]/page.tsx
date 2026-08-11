import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePeriod, type PeriodParams } from '@/lib/period'
import type { PlayerStats, MatchupStats, PlayerYakumanStats } from '@/lib/types'
import PeriodSelector from '@/components/PeriodSelector'

function pct(v: number | null) {
  return v == null ? '-' : `${(v * 100).toFixed(1)}%`
}

function pt(v: number | null) {
  if (v == null) return '-'
  return `${v > 0 ? '+' : ''}${v}`
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

  const [{ data: statsData }, { data: matchupsData }, { data: yakumanData }] = await Promise.all([
    supabase.rpc('player_stats_for_period', { p_start: start, p_end: end }).eq('player_id', playerId),
    supabase
      .rpc('matchup_stats_for_period', { p_start: start, p_end: end })
      .eq('player_a', playerId)
      .order('games', { ascending: false }),
    supabase.rpc('player_yakuman_stats_for_period', { p_start: start, p_end: end }).eq('player_id', playerId),
  ])

  const statsRows = (statsData ?? []) as PlayerStats[]
  const matchups = (matchupsData ?? []) as MatchupStats[]
  const yakumanRows = (yakumanData ?? []) as PlayerYakumanStats[]
  const stats = statsRows[0]
  const yakuman = yakumanRows[0]

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/" className="mb-4 inline-block text-sm underline">
        ← 成績一覧へ戻る
      </Link>
      <h1 className="mb-1 text-xl font-semibold">{player.name}</h1>
      <p className="mb-4 text-sm text-black/60 dark:text-white/60">
        {label}
        {start && end && ` (${start} 〜 ${end})`}
      </p>

      <PeriodSelector basePath={`/players/${playerId}`} current={sp} />

      {!stats ? (
        <p className="text-sm text-black/50 dark:text-white/50">この期間の対局データはありません。</p>
      ) : (
        <div className="space-y-8">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['半荘数', stats.games],
              ['総pt', pt(stats.total_score)],
              ['平均pt', stats.avg_score],
              ['平均着順', stats.avg_rank],
              ['1位率', pct(stats.first_rate)],
              ['2位率', pct(stats.second_rate)],
              ['3位率', pct(stats.third_rate)],
              ['4位率', pct(stats.fourth_rate)],
              ['連対率', pct(stats.rentai_rate)],
              ['トビ率', pct(stats.tobi_rate)],
              ['最高pt', pt(stats.max_score)],
              ['最低pt', pt(stats.min_score)],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="rounded-md border border-black/10 p-3 text-sm dark:border-white/15"
              >
                <p className="text-black/50 dark:text-white/50">{label}</p>
                <p className="text-lg font-medium">{value}</p>
              </div>
            ))}
          </section>

          <section>
            <h2 className="mb-2 text-lg font-medium">連続記録</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['連続トップ', stats.max_top_streak],
                ['連続ラス', stats.max_last_streak],
                ['連続ノートップ', stats.max_no_top_streak],
                ['連続ノーラス', stats.max_no_last_streak],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="rounded-md border border-black/10 p-3 text-sm dark:border-white/15"
                >
                  <p className="text-black/50 dark:text-white/50">{label}</p>
                  <p className="text-lg font-medium">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-medium">日別集計</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['参加日数', stats.play_days],
                ['日別最高pt', pt(stats.best_day)],
                ['日別最低pt', pt(stats.worst_day)],
                ['プラス日数率', pct(stats.plus_rate)],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="rounded-md border border-black/10 p-3 text-sm dark:border-white/15"
                >
                  <p className="text-black/50 dark:text-white/50">{label}</p>
                  <p className="text-lg font-medium">{value}</p>
                </div>
              ))}
            </div>
          </section>

          {yakuman && yakuman.yakuman_count > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-medium">役満</h2>
              <p className="text-sm">
                {yakuman.yakuman_count}回 (発生率 {pct(yakuman.yakuman_rate)})
              </p>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-lg font-medium">対戦相手別成績</h2>
            {matchups && matchups.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-left dark:border-white/15">
                      <th className="py-2 pr-3">相手</th>
                      <th className="py-2 pr-3 text-right">対局数</th>
                      <th className="py-2 pr-3 text-right">自分の平均着順</th>
                      <th className="py-2 pr-3 text-right">相手の平均着順</th>
                      <th className="py-2 pr-3 text-right">自分のトップ率</th>
                      <th className="py-2 pr-3 text-right">自分のラス率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchups.map((m) => (
                      <tr key={m.player_b} className="border-b border-black/5 dark:border-white/10">
                        <td className="py-2 pr-3">
                          <Link href={`/players/${m.player_b}`} className="underline">
                            {m.name_b}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-right">{m.games}</td>
                        <td className="py-2 pr-3 text-right">{m.avg_rank_a}</td>
                        <td className="py-2 pr-3 text-right">{m.avg_rank_b}</td>
                        <td className="py-2 pr-3 text-right">{pct(m.top_rate_a)}</td>
                        <td className="py-2 pr-3 text-right">{pct(m.last_rate_a)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-black/50 dark:text-white/50">データがありません。</p>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
