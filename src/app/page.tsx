import { createClient } from '@/lib/supabase/server'
import { resolvePeriod, yearPeriodEnd, type PeriodParams } from '@/lib/period'
import type { PlayerRating, PlayerStats } from '@/lib/types'
import SiteHeader from '@/components/SiteHeader'
import PeriodSelector from '@/components/PeriodSelector'
import LastNSelector from '@/components/LastNSelector'
import Leaderboard from '@/components/Leaderboard'

type HomeSearchParams = PeriodParams & { last_n?: string }

export default async function Home({ searchParams }: { searchParams: Promise<HomeSearchParams> }) {
  const sp = await searchParams
  const lastNRaw = sp.last_n ? Number(sp.last_n) : null
  const lastN = lastNRaw != null && Number.isFinite(lastNRaw) && lastNRaw > 0 ? Math.floor(lastNRaw) : null
  const period = lastN ? null : resolvePeriod(sp)
  // 年単位ボタン(period=2020等)で絞り込んだ場合のみ、その年末時点のRatingを表示する。
  // それ以外の期間指定は「現在値からしか計算しようがない」ためRatingには適用しない。
  const ratingAsOf = period ? yearPeriodEnd(period) : null

  const supabase = await createClient()
  const [{ data, error }, { data: yearRows }, { data: ratingRows }] = await Promise.all([
    lastN
      ? supabase.rpc('player_stats_for_last_n', { p_n: lastN })
      : supabase.rpc('player_stats_for_period', { p_start: period!.start, p_end: period!.end }),
    supabase.rpc('available_years'),
    supabase.rpc('player_current_ratings', { p_as_of: ratingAsOf }),
  ])
  const ratingByPlayer = new Map((((ratingRows ?? []) as PlayerRating[])).map((r) => [r.player_id, r.rating]))
  const stats = ((data ?? []) as PlayerStats[]).map((s) => ({
    ...s,
    rating: ratingByPlayer.get(s.player_id) ?? null,
  }))
  const years = (yearRows ?? []).map((r: { year: number }) => r.year)

  const label = lastN ? `直近${lastN}半荘` : period!.label
  const rangeSuffix = !lastN && period!.start && period!.end ? ` (${period!.start} 〜 ${period!.end})` : ''

  return (
    <>
      <SiteHeader active="leaderboard" />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="mb-1 font-display text-2xl font-bold">成績一覧</h1>
        <p className="mb-6 text-sm text-foreground-soft">
          {label}
          {rangeSuffix}
        </p>

        <PeriodSelector basePath="/" current={lastN ? { period: '__last_n__' } : sp} years={years} />
        <LastNSelector basePath="/" activeN={lastN} />

        {error && <p className="text-sm text-accent">取得に失敗しました: {error.message}</p>}

        {!error && stats.length === 0 && (
          <p className="text-sm text-foreground-soft">
            {lastN ? '対局データがありません。' : 'この期間の対局データはありません。'}
          </p>
        )}

        {!error && stats.length > 0 && (
          <Leaderboard stats={stats} requireMinPlayDays={!lastN} ratingAsOfYear={ratingAsOf?.slice(0, 4) ?? null} />
        )}
      </main>
    </>
  )
}
