import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePeriod, type PeriodParams } from '@/lib/period'
import { dateOnly } from '@/lib/format'
import type { PlayerStats, MatchupStats, PlayerRatingHistoryPoint } from '@/lib/types'
import SiteHeader from '@/components/SiteHeader'
import PeriodSelector from '@/components/PeriodSelector'
import LastNSelector from '@/components/LastNSelector'
import TrendChart from '@/components/TrendChart'

type YakumanDetail = {
  event_id: number
  game_id: string
  yakuman_type: string
  game: { played_at: string } | null
  target: { player_id: number; name: string } | null
}

type ResultRow = {
  game_id: string
  final_score: number
  rank: number
  game: { played_at: string } | null
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

function StatCard({
  label,
  value,
  caption,
}: {
  label: string
  value: React.ReactNode
  caption?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <p className="text-xs text-foreground-soft">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p>
      {caption && <p className="mt-0.5 text-xs text-foreground-soft">{caption}</p>}
    </div>
  )
}

// 日付が特定できる箇所から、その日の日別成績ページへ飛べるようにするリンク。
function DailyLink({ date }: { date: string }) {
  return (
    <Link
      href={`/daily?date=${date}`}
      className="underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
    >
      {date}
    </Link>
  )
}

function findMaxStreak(rows: { date: string; match: boolean }[]) {
  let bestLen = 0
  let bestStart = -1
  let bestEnd = -1
  let curLen = 0
  let curStart = -1
  rows.forEach((r, i) => {
    if (r.match) {
      if (curLen === 0) curStart = i
      curLen++
      if (curLen > bestLen) {
        bestLen = curLen
        bestStart = curStart
        bestEnd = i
      }
    } else {
      curLen = 0
    }
  })
  if (bestLen === 0) return null
  return { length: bestLen, startDate: rows[bestStart].date, endDate: rows[bestEnd].date }
}

function streakCaption(s: { length: number; startDate: string; endDate: string } | null) {
  if (!s) return undefined
  return (
    <>
      <DailyLink date={s.startDate} />
      {s.startDate !== s.endDate && (
        <>
          〜<DailyLink date={s.endDate} />
        </>
      )}
      {`(${s.length}半荘)`}
    </>
  )
}

type PlayerSearchParams = PeriodParams & { last_n?: string }

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<PlayerSearchParams>
}) {
  const { id } = await params
  const playerId = Number(id)
  const sp = await searchParams
  const lastNRaw = sp.last_n ? Number(sp.last_n) : null
  const lastN = lastNRaw != null && Number.isFinite(lastNRaw) && lastNRaw > 0 ? Math.floor(lastNRaw) : null
  // このページのデフォルト期間は成績一覧と違い「全期間」(個人の通算成績を見る用途のため)。
  const period = lastN ? null : resolvePeriod(sp, 'all')
  const start = period?.start ?? null
  const end = period?.end ?? null
  const label = lastN ? `直近${lastN}半荘` : period!.label

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
    { data: yakumanDetailData },
    { data: yearRows },
    { data: resultRowsData },
    { data: ratingHistoryData },
  ] = await Promise.all([
    lastN
      ? supabase.rpc('player_stats_for_last_n', { p_n: lastN }).eq('player_id', playerId)
      : supabase.rpc('player_stats_for_period', { p_start: start, p_end: end }).eq('player_id', playerId),
    lastN
      ? supabase
          .rpc('matchup_stats_for_last_n', { p_player_id: playerId, p_n: lastN })
          .order('games', { ascending: false })
      : supabase
          .rpc('matchup_stats_for_period', { p_start: start, p_end: end })
          .eq('player_a', playerId)
          .order('games', { ascending: false }),
    // 役満・半荘ごとの明細は期間・直近N半荘のどちらでも使えるよう常に全件取得し、
    // 下でgame_id基準の「対象半荘の集合」によってJS側で絞り込む。
    supabase
      .from('yakuman_events')
      .select(
        `
          event_id,
          game_id,
          yakuman_type,
          game:games!yakuman_events_game_id_fkey(played_at),
          target:players!yakuman_events_target_player_id_fkey(player_id, name)
        `
      )
      .eq('player_id', playerId),
    supabase.rpc('available_years'),
    supabase.from('results').select('game_id, final_score, rank, game:games(played_at)').eq('player_id', playerId),
    // レーティングは常に全期間・全対局を通した逐次計算値のため、この画面の期間指定/直近N半荘は適用しない。
    // p_player_idはSQL関数側で絞り込む(PostgREST側の.eq()フィルタだと一度全プレイヤー分を
    // 計算・シリアライズしてから絞り込む形になり、ペイロードが不必要に肥大化して遅かったため)。
    supabase.rpc('player_rating_history', { p_player_id: playerId }).order('game_id', { ascending: true }),
  ])

  const statsRows = (statsData ?? []) as PlayerStats[]
  const matchups = (matchupsData ?? []) as MatchupStats[]
  const years = (yearRows ?? []).map((r: { year: number }) => r.year)
  const stats = statsRows[0]

  const ratingHistory = (ratingHistoryData ?? []) as PlayerRatingHistoryPoint[]
  const ratingSeries = ratingHistory.map((r) => ({
    date: r.played_at.slice(0, 10),
    value: Math.round(r.rating_after * 10) / 10,
  }))
  const currentRating = ratingHistory.length > 0 ? ratingHistory[ratingHistory.length - 1].rating_after : null

  // 過去最高Rating(初期値1500を起点に、実際に更新した対局があればその時点を記録)
  let peakRating = 1500
  let peakRatingDate: string | null = null
  for (const r of ratingHistory) {
    if (r.rating_after > peakRating) {
      peakRating = r.rating_after
      peakRatingDate = r.played_at
    }
  }

  // 対象半荘の絞り込み: 期間指定は日付範囲、直近N半荘はgame_id基準の末尾N件。
  // どちらも「game_idの昇順」を対局の時系列として扱う(game_idはYYYYMMDD_連番形式のため)。
  const allResultRows = ((resultRowsData ?? []) as unknown as ResultRow[])
    .slice()
    .sort((a, b) => a.game_id.localeCompare(b.game_id))
  const resultRows = lastN
    ? allResultRows.slice(-lastN)
    : allResultRows.filter((r) => {
        const played = r.game?.played_at
        if (!played) return false
        if (start && played < start) return false
        if (end && played > end) return false
        return true
      })
  const windowGameIds = new Set(resultRows.map((r) => r.game_id))

  const yakumanDetails = ((yakumanDetailData ?? []) as unknown as YakumanDetail[])
    .filter((y) => windowGameIds.has(y.game_id))
    .sort((a, b) => (b.game?.played_at ?? '').localeCompare(a.game?.played_at ?? ''))
  const yakumanCount = yakumanDetails.length
  const yakumanRate = stats && stats.games > 0 ? yakumanCount / stats.games : null

  let cumulative = 0
  const cumulativeSeries = resultRows.map((r) => {
    cumulative += r.final_score
    return { date: r.game!.played_at.slice(0, 10), value: cumulative }
  })

  // 直近20半荘の移動平均(データがそれ未満の序盤はその時点までの累積平均)。
  // 対局数が多い人ほど累積平均は終盤ほぼ動かなくなり「最近の調子」が見えなくなるため。
  const MOVING_WINDOW = 20
  const movingAvgPtSeries = resultRows.map((r, i) => {
    const windowRows = resultRows.slice(Math.max(0, i - MOVING_WINDOW + 1), i + 1)
    const avg = windowRows.reduce((sum, w) => sum + w.final_score, 0) / windowRows.length
    return { date: r.game!.played_at.slice(0, 10), value: Math.round(avg * 10) / 10 }
  })
  const movingAvgRankSeries = resultRows.map((r, i) => {
    const windowRows = resultRows.slice(Math.max(0, i - MOVING_WINDOW + 1), i + 1)
    const avg = windowRows.reduce((sum, w) => sum + w.rank, 0) / windowRows.length
    return { date: r.game!.played_at.slice(0, 10), value: Math.round(avg * 100) / 100 }
  })

  // 最高/最低ptが出た日
  const maxScoreGame = resultRows.reduce<ResultRow | null>(
    (best, r) => (best === null || r.final_score > best.final_score ? r : best),
    null
  )
  const minScoreGame = resultRows.reduce<ResultRow | null>(
    (best, r) => (best === null || r.final_score < best.final_score ? r : best),
    null
  )

  // 日別の合計ptと、最高/最低だった日
  const dailyTotals = new Map<string, number>()
  for (const r of resultRows) {
    const date = r.game!.played_at.slice(0, 10)
    dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + r.final_score)
  }
  const dailyEntries = [...dailyTotals.entries()]
  const bestDayEntry = dailyEntries.reduce<[string, number] | null>(
    (best, e) => (best === null || e[1] > best[1] ? e : best),
    null
  )
  const worstDayEntry = dailyEntries.reduce<[string, number] | null>(
    (best, e) => (best === null || e[1] < best[1] ? e : best),
    null
  )

  // 連続記録(トップ/ラス/ノートップ/ノーラス)の開始日・終了日・半荘数
  const streakRows = resultRows.map((r) => ({ date: r.game!.played_at.slice(0, 10), rank: r.rank }))
  const topStreak = findMaxStreak(streakRows.map((r) => ({ date: r.date, match: r.rank === 1 })))
  const lastStreak = findMaxStreak(streakRows.map((r) => ({ date: r.date, match: r.rank === 4 })))
  const noTopStreak = findMaxStreak(streakRows.map((r) => ({ date: r.date, match: r.rank !== 1 })))
  const noLastStreak = findMaxStreak(streakRows.map((r) => ({ date: r.date, match: r.rank !== 4 })))

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
          {!lastN && start && end && ` (${start} 〜 ${end})`}
        </p>

        <PeriodSelector
          basePath={`/players/${playerId}`}
          current={lastN ? { period: '__last_n__' } : sp}
          years={years}
          defaultPeriod="all"
        />
        <LastNSelector basePath={`/players/${playerId}`} activeN={lastN} />

        {currentRating != null && (
          <section className="mb-10">
            <h2 className="mb-3 font-display text-lg font-bold">Rating</h2>
            <p className="mb-3 text-xs text-foreground-soft">
              天鳳風レーティング(段位戦)。期間指定の影響を受けず、全対局を通した現在値です。
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="現在のRating"
                  value={Math.round(currentRating)}
                  caption={`全${ratingHistory.length}戦`}
                />
                <StatCard
                  label="過去最高Rating"
                  value={Math.round(peakRating)}
                  caption={peakRatingDate ? <>(<DailyLink date={peakRatingDate.slice(0, 10)} />)</> : undefined}
                />
              </div>
              <TrendChart
                title="レーティング推移(半荘単位)"
                data={ratingSeries}
                color="var(--gold)"
                format="rating"
                xMode="sequence"
              />
            </div>
          </section>
        )}

        {!stats ? (
          <p className="text-sm text-foreground-soft">
            {lastN ? '対局データがありません。' : 'この期間の対局データはありません。'}
          </p>
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
              <StatCard
                label="最高pt"
                value={pt(stats.max_score)}
                caption={
                  maxScoreGame ? <>(<DailyLink date={maxScoreGame.game!.played_at.slice(0, 10)} />)</> : undefined
                }
              />
              <StatCard
                label="最低pt"
                value={pt(stats.min_score)}
                caption={
                  minScoreGame ? <>(<DailyLink date={minScoreGame.game!.played_at.slice(0, 10)} />)</> : undefined
                }
              />
              <StatCard label="最終対局日" value={<DailyLink date={stats.last_played} />} />
            </section>

            <section>
              <h2 className="mb-3 font-display text-lg font-bold">推移</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <TrendChart title="累計pt推移" data={cumulativeSeries} color="var(--accent-2)" format="pt" />
                <TrendChart
                  title={`平均pt(直近${MOVING_WINDOW}半荘)`}
                  data={movingAvgPtSeries}
                  color="var(--accent-2)"
                  format="pt"
                />
                <TrendChart
                  title={`平均着順(直近${MOVING_WINDOW}半荘)`}
                  data={movingAvgRankSeries}
                  color="var(--gold)"
                  higherIsBetter={false}
                  format="rank"
                />
              </div>
            </section>

            <section>
              <h2 className="mb-3 font-display text-lg font-bold">連続記録</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="連続トップ" value={stats.max_top_streak} caption={streakCaption(topStreak)} />
                <StatCard label="連続ラス" value={stats.max_last_streak} caption={streakCaption(lastStreak)} />
                <StatCard
                  label="連続ノートップ"
                  value={stats.max_no_top_streak}
                  caption={streakCaption(noTopStreak)}
                />
                <StatCard
                  label="連続ノーラス"
                  value={stats.max_no_last_streak}
                  caption={streakCaption(noLastStreak)}
                />
              </div>
            </section>

            <section>
              <h2 className="mb-3 font-display text-lg font-bold">日別集計</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="参加日数" value={stats.play_days} />
                <StatCard
                  label="日別最高pt"
                  value={pt(stats.best_day)}
                  caption={bestDayEntry ? <>(<DailyLink date={bestDayEntry[0]} />)</> : undefined}
                />
                <StatCard
                  label="日別最低pt"
                  value={pt(stats.worst_day)}
                  caption={worstDayEntry ? <>(<DailyLink date={worstDayEntry[0]} />)</> : undefined}
                />
                <StatCard label="プラス日数率" value={pctCount(stats.plus_rate, stats.plus_days, '日')} />
              </div>
            </section>

            {yakumanCount > 0 && (
              <section>
                <h2 className="mb-3 font-display text-lg font-bold">役満</h2>
                <p className="mb-3 text-sm text-foreground-soft">
                  {yakumanCount}回 (発生率 {pct(yakumanRate)})
                </p>
                <ul className="space-y-2">
                  {yakumanDetails.map((y) => (
                    <li
                      key={y.event_id}
                      className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{y.yakuman_type}</span>
                      <span className="text-foreground-soft">
                        {y.game?.played_at ? <DailyLink date={dateOnly(y.game.played_at)} /> : '-'}
                      </span>
                      <span className="ml-auto text-foreground-soft">
                        {y.target ? (
                          <>
                            放銃:{' '}
                            <Link
                              href={`/players/${y.target.player_id}`}
                              className="text-foreground underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
                            >
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
                            <Link
                              href={`/players/${m.player_b}`}
                              className="underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
                            >
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
