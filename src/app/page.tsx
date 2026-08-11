import { createClient } from '@/lib/supabase/server'
import { resolvePeriod, type PeriodParams } from '@/lib/period'
import type { PlayerStats } from '@/lib/types'
import PeriodSelector from '@/components/PeriodSelector'
import Leaderboard from '@/components/Leaderboard'

export default async function Home({ searchParams }: { searchParams: Promise<PeriodParams> }) {
  const sp = await searchParams
  const { start, end, label } = resolvePeriod(sp)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('player_stats_for_period', { p_start: start, p_end: end })
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

      {!error && stats.length > 0 && <Leaderboard stats={stats} />}
    </main>
  )
}
