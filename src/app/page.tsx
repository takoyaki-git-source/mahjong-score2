import { createClient } from '@/lib/supabase/server'
import { resolvePeriod, type PeriodParams } from '@/lib/period'
import type { PlayerStats } from '@/lib/types'
import SiteHeader from '@/components/SiteHeader'
import PeriodSelector from '@/components/PeriodSelector'
import Leaderboard from '@/components/Leaderboard'

export default async function Home({ searchParams }: { searchParams: Promise<PeriodParams> }) {
  const sp = await searchParams
  const { start, end, label } = resolvePeriod(sp)

  const supabase = await createClient()
  const [{ data, error }, { data: yearRows }] = await Promise.all([
    supabase.rpc('player_stats_for_period', { p_start: start, p_end: end }),
    supabase.rpc('available_years'),
  ])
  const stats = (data ?? []) as PlayerStats[]
  const years = (yearRows ?? []).map((r: { year: number }) => r.year)

  return (
    <>
      <SiteHeader active="leaderboard" />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="mb-1 font-display text-2xl font-bold">成績一覧</h1>
        <p className="mb-6 text-sm text-foreground-soft">
          {label}
          {start && end && ` (${start} 〜 ${end})`}
        </p>

        <PeriodSelector basePath="/" current={sp} years={years} />

        {error && <p className="text-sm text-accent">取得に失敗しました: {error.message}</p>}

        {!error && stats.length === 0 && (
          <p className="text-sm text-foreground-soft">この期間の対局データはありません。</p>
        )}

        {!error && stats.length > 0 && <Leaderboard stats={stats} />}
      </main>
    </>
  )
}
