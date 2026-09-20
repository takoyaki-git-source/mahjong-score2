import { createClient } from '@/lib/supabase/server'
import { resolvePeriod, yearPeriodEnd, type PeriodParams } from '@/lib/period'
import type { PlayerRating, PlayerStats, SeatStats } from '@/lib/types'
import SiteHeader from '@/components/SiteHeader'
import PeriodSelector from '@/components/PeriodSelector'
import LastNSelector from '@/components/LastNSelector'
import Leaderboard from '@/components/Leaderboard'
import SeatStatsTable from '@/components/SeatStatsTable'

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
  const [{ data, error }, { data: yearRows }, { data: ratingRows }, { data: seatStatsData }] = await Promise.all([
    lastN
      ? supabase.rpc('player_stats_for_last_n', { p_n: lastN })
      : supabase.rpc('player_stats_for_period', { p_start: period!.start, p_end: period!.end }),
    supabase.rpc('available_years'),
    supabase.rpc('player_current_ratings', { p_as_of: ratingAsOf }),
    // 座席別成績(全員合算)はプレイヤーごとの直近N半荘という概念と相性が悪いため
    // p_start/p_endのみ対応。直近N半荘モードでは全期間(null/null)を渡す。
    supabase.rpc('seat_stats_for_period', { p_start: period?.start ?? null, p_end: period?.end ?? null }),
  ])
  const seatStats = (seatStatsData ?? []) as SeatStats[]
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

        <section className="mt-10">
          <h2 className="mb-1 font-display text-lg font-bold">座席別成績</h2>
          <p className="mb-3 text-xs text-foreground-soft">
            プレイヤーを問わず、開始時の座席(自風)ごとに全員分を合算した成績です。起家(東家)が統計的に有利かどうかなどの分析用。
            {lastN && '直近N半荘モードでは対応できないため、全期間の集計を表示しています。'}
          </p>
          <SeatStatsTable stats={seatStats} />
        </section>
      </main>
    </>
  )
}
