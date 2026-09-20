import type { SeatStats } from '@/lib/types'

const SEAT_LABELS: Record<number, string> = { 1: '東家(起家)', 2: '南家', 3: '西家', 4: '北家' }

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function pt(v: number) {
  return `${v > 0 ? '+' : ''}${v}`
}

// プレイヤーを問わず、開始時の座席(自風)ごとに全員分を合算した成績。
// 起家(東家)が統計的に有利かどうかを見るための集計(seat_stats_for_period)。
export default function SeatStatsTable({ stats }: { stats: SeatStats[] }) {
  if (stats.length === 0) {
    return (
      <p className="text-sm text-foreground-soft">
        この期間に座席が記録された半荘がありません(座席の記録があるのは新しい入力分のみです)。
      </p>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-foreground-soft">
              <th className="py-2.5 pr-3 pl-4">座席</th>
              <th className="py-2.5 pr-3 text-right">半荘数</th>
              <th className="py-2.5 pr-3 text-right">平均pt</th>
              <th className="py-2.5 pr-3 text-right">平均着順</th>
              <th className="py-2.5 pr-3 text-right">1位率</th>
              <th className="py-2.5 pr-4 text-right">ラス率</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.seat_order} className="border-b border-line/70 last:border-b-0">
                <td className="py-2.5 pr-3 pl-4">{SEAT_LABELS[s.seat_order]}</td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{s.games}</td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{pt(s.avg_score)}</td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{s.avg_rank}</td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{pct(s.first_rate)}</td>
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{pct(s.last_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-foreground-soft">
        プレイヤーを問わず座席ごとに全員分を合算した集計です。座席の記録があるのは新しい入力分のみのため、まだサンプル数が少ない点に注意してください。
      </p>
    </>
  )
}
