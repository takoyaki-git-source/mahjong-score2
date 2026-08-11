import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { resolvePeriod, type PeriodParams } from '@/lib/period'
import type { PlayerStats } from '@/lib/types'
import PeriodSelector from '@/components/PeriodSelector'

function pct(v: number | null) {
  return v == null ? '-' : `${(v * 100).toFixed(1)}%`
}

export default async function Home({ searchParams }: { searchParams: Promise<PeriodParams> }) {
  const sp = await searchParams
  const { start, end, label } = resolvePeriod(sp)

  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('player_stats_for_period', { p_start: start, p_end: end })
    .order('total_score', { ascending: false })
  const stats = (data ?? []) as PlayerStats[]

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-xl font-semibold">成績一覧</h1>
      <p className="mb-4 text-sm text-black/60 dark:text-white/60">
        {label}
        {start && end && ` (${start} 〜 ${end})`}
      </p>

      <PeriodSelector basePath="/" current={sp} />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">取得に失敗しました: {error.message}</p>
      )}

      {!error && stats.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">この期間の対局データはありません。</p>
      )}

      {!error && stats.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left dark:border-white/15">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">名前</th>
                <th className="py-2 pr-3 text-right">半荘数</th>
                <th className="py-2 pr-3 text-right">総pt</th>
                <th className="py-2 pr-3 text-right">平均pt</th>
                <th className="py-2 pr-3 text-right">平均着順</th>
                <th className="py-2 pr-3 text-right">1位率</th>
                <th className="py-2 pr-3 text-right">連対率</th>
                <th className="py-2 pr-3 text-right">トビ率</th>
                <th className="py-2 pr-3 text-right">プラス日数率</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={s.player_id} className="border-b border-black/5 dark:border-white/10">
                  <td className="py-2 pr-3">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/players/${s.player_id}`} className="underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right">{s.games}</td>
                  <td
                    className={`py-2 pr-3 text-right ${s.total_score < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
                  >
                    {s.total_score > 0 ? '+' : ''}
                    {s.total_score}
                  </td>
                  <td className="py-2 pr-3 text-right">{s.avg_score}</td>
                  <td className="py-2 pr-3 text-right">{s.avg_rank}</td>
                  <td className="py-2 pr-3 text-right">{pct(s.first_rate)}</td>
                  <td className="py-2 pr-3 text-right">{pct(s.rentai_rate)}</td>
                  <td className="py-2 pr-3 text-right">{pct(s.tobi_rate)}</td>
                  <td className="py-2 pr-3 text-right">{pct(s.plus_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
