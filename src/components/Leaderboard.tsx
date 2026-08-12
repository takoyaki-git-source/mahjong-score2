'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { PlayerStats } from '@/lib/types'
import TileBadge from './TileBadge'

type ColumnKey =
  | 'name'
  | 'games'
  | 'avg_score'
  | 'avg_rank'
  | 'first_rate'
  | 'rentai_rate'
  | 'tobi_rate'
  | 'plus_rate'
  | 'last_played'

type Column = {
  key: ColumnKey
  label: string
  dir: 'higher' | 'lower' | 'neutral'
  align?: 'left' | 'right'
  format: (s: PlayerStats) => string
}

const MIN_PLAY_DAYS = 2

function pct(v: number | null) {
  return v == null ? '-' : `${(v * 100).toFixed(1)}%`
}

function pt(v: number | null) {
  if (v == null) return '-'
  return `${v > 0 ? '+' : ''}${v}`
}

const jaCollator = new Intl.Collator('ja')

const COLUMNS: Column[] = [
  { key: 'name', label: '名前', dir: 'neutral', align: 'left', format: (s) => s.name },
  { key: 'games', label: '半荘数', dir: 'neutral', format: (s) => String(s.games) },
  { key: 'avg_score', label: '平均pt', dir: 'higher', format: (s) => pt(s.avg_score) },
  { key: 'avg_rank', label: '平均着順', dir: 'lower', format: (s) => String(s.avg_rank) },
  { key: 'first_rate', label: '1位率', dir: 'higher', format: (s) => pct(s.first_rate) },
  { key: 'rentai_rate', label: '連対率', dir: 'higher', format: (s) => pct(s.rentai_rate) },
  { key: 'tobi_rate', label: 'トビ率', dir: 'lower', format: (s) => pct(s.tobi_rate) },
  { key: 'plus_rate', label: 'プラス日数率', dir: 'higher', format: (s) => pct(s.plus_rate) },
  { key: 'last_played', label: '最終対局日', dir: 'neutral', format: (s) => s.last_played },
]

function valueOf(s: PlayerStats, key: ColumnKey): number | string | null {
  switch (key) {
    case 'name':
      return s.name
    case 'games':
      return s.games
    case 'avg_score':
      return s.avg_score
    case 'avg_rank':
      return s.avg_rank
    case 'first_rate':
      return s.first_rate
    case 'rentai_rate':
      return s.rentai_rate
    case 'tobi_rate':
      return s.tobi_rate
    case 'plus_rate':
      return s.plus_rate
    case 'last_played':
      return s.last_played
  }
}

export default function Leaderboard({
  stats,
  requireMinPlayDays = true,
}: {
  stats: PlayerStats[]
  requireMinPlayDays?: boolean
}) {
  const [sortKey, setSortKey] = useState<ColumnKey>('avg_score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [applyCutoffToTable, setApplyCutoffToTable] = useState(false)

  function toggleSort(key: ColumnKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    const col = COLUMNS.find((c) => c.key === key)
    setSortDir(key === 'name' || col?.dir === 'lower' ? 'asc' : 'desc')
  }

  // 足切り基準: 対局数が極端に少ないと運の影響が大きく出やすいので、
  // 「参加者の半荘数の中央値の半分未満(最低5半荘)」の人を除外する。
  // 期間指定モードでは、さらに「参加2日未満」の人も除外する(直近N半荘モードは
  // 1日にまとめて何十半荘も打つ運用のため、参加日数はこのモードでは意味を持たない)。
  // 除外した結果0人になる場合は全員にフォールバックする。ヒーロー(上位3人)は常にこの基準を使う。
  const { threshold, eligible } = useMemo(() => {
    if (stats.length === 0) return { threshold: 0, eligible: [] as PlayerStats[] }
    const gamesSorted = [...stats].map((s) => s.games).sort((a, b) => a - b)
    const mid = Math.floor(gamesSorted.length / 2)
    const median =
      gamesSorted.length % 2 === 0 ? (gamesSorted[mid - 1] + gamesSorted[mid]) / 2 : gamesSorted[mid]
    const t = Math.max(5, Math.ceil(median / 2))
    const filtered = stats.filter((s) => s.games >= t && (!requireMinPlayDays || s.play_days >= MIN_PLAY_DAYS))
    return { threshold: t, eligible: filtered.length > 0 ? filtered : stats }
  }, [stats, requireMinPlayDays])

  const podium = useMemo(
    () => [...eligible].sort((a, b) => b.avg_score - a.avg_score).slice(0, 3),
    [eligible]
  )

  const visibleStats = applyCutoffToTable ? eligible : stats

  const cutoffLabel = `${threshold}半荘以上${requireMinPlayDays ? `・参加${MIN_PLAY_DAYS}日以上` : ''}`

  const sorted = useMemo(() => {
    const copy = [...visibleStats]
    copy.sort((a, b) => {
      const va = valueOf(a, sortKey)
      const vb = valueOf(b, sortKey)
      let cmp: number
      if (typeof va === 'string' || typeof vb === 'string') {
        cmp = jaCollator.compare(String(va ?? ''), String(vb ?? ''))
      } else {
        cmp = (va ?? -Infinity) - (vb ?? -Infinity)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [visibleStats, sortKey, sortDir])

  const bestWorst = useMemo(() => {
    const result: Partial<Record<ColumnKey, { best: number; worst: number }>> = {}
    for (const col of COLUMNS) {
      if (col.dir === 'neutral') continue
      const values = visibleStats
        .map((s) => valueOf(s, col.key))
        .filter((v): v is number => typeof v === 'number')
      if (values.length < 2) continue
      const max = Math.max(...values)
      const min = Math.min(...values)
      if (max === min) continue
      result[col.key] = col.dir === 'higher' ? { best: max, worst: min } : { best: min, worst: max }
    }
    return result
  }, [visibleStats])

  function cellClass(col: Column, s: PlayerStats) {
    const bw = bestWorst[col.key]
    if (!bw) return ''
    const v = valueOf(s, col.key)
    if (typeof v !== 'number') return ''
    if (v === bw.best) return 'bg-accent-2/10 text-accent-2 font-semibold'
    if (v === bw.worst) return 'bg-accent/10 text-accent'
    return ''
  }

  return (
    <div>
      {podium.length > 0 && (
        <div className="mb-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {podium.map((p, i) => (
              <div
                key={p.player_id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
              >
                <TileBadge rank={i + 1} size="lg" />
                <div className="min-w-0">
                  <Link
                    href={`/players/${p.player_id}`}
                    className="block truncate font-display text-lg font-bold underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
                  >
                    {p.name}
                  </Link>
                  <p className="font-mono text-sm tabular-nums text-foreground-soft">
                    {pt(p.avg_score)}pt/半荘 ({p.games}半荘)
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-foreground-soft">
            平均pt上位。足切り: {cutoffLabel}
          </p>
        </div>
      )}

      <label className="mb-4 flex items-center gap-2 text-sm text-foreground-soft">
        <input
          type="checkbox"
          checked={applyCutoffToTable}
          onChange={(e) => setApplyCutoffToTable(e.target.checked)}
          className="accent-accent"
        />
        下の表とハイライトにも足切り({cutoffLabel})を適用する
      </label>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-3 pr-3 pl-4">#</th>
              {COLUMNS.map((col) => (
                <th key={col.key} className={`py-3 pr-3 ${col.align === 'left' ? 'text-left' : 'text-right'}`}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 text-foreground-soft hover:text-foreground"
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-accent">{sortDir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.player_id} className="border-b border-line/70 last:border-b-0">
                <td className="py-2.5 pr-3 pl-4">
                  <TileBadge rank={i + 1} size="sm" />
                </td>
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`py-2.5 pr-3 font-mono tabular-nums ${
                      col.align === 'left' ? 'text-left font-sans' : 'text-right'
                    } ${cellClass(col, s)}`}
                  >
                    {col.key === 'name' ? (
                      <Link
                        href={`/players/${s.player_id}`}
                        className="font-sans underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
                      >
                        {s.name}
                      </Link>
                    ) : (
                      col.format(s)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
