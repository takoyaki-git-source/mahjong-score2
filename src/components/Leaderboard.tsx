'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { PlayerStats } from '@/lib/types'
import TileBadge from './TileBadge'

type ColumnKey =
  | 'name'
  | 'games'
  | 'total_score'
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
  { key: 'total_score', label: '総pt', dir: 'higher', format: (s) => pt(s.total_score) },
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
    case 'total_score':
      return s.total_score
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

export default function Leaderboard({ stats }: { stats: PlayerStats[] }) {
  const [sortKey, setSortKey] = useState<ColumnKey>('total_score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [minGames, setMinGames] = useState(0)

  function toggleSort(key: ColumnKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    const col = COLUMNS.find((c) => c.key === key)
    setSortDir(key === 'name' || col?.dir === 'lower' ? 'asc' : 'desc')
  }

  const visibleStats = useMemo(
    () => stats.filter((s) => s.games >= minGames),
    [stats, minGames]
  )

  // 平均ptの首位を出す。ただし対局数が極端に少ないと運の影響が大きく出やすいので、
  // その期間の参加者の半荘数の中央値の半分未満(最低5半荘)の人は対象から除外する。
  // 除外した結果0人になる場合は元の集団にフォールバックする。
  const champion = useMemo(() => {
    if (visibleStats.length === 0) return null
    const gamesSorted = [...visibleStats].map((s) => s.games).sort((a, b) => a - b)
    const mid = Math.floor(gamesSorted.length / 2)
    const median =
      gamesSorted.length % 2 === 0 ? (gamesSorted[mid - 1] + gamesSorted[mid]) / 2 : gamesSorted[mid]
    const threshold = Math.max(5, median / 2)
    const eligible = visibleStats.filter((s) => s.games >= threshold)
    const pool = eligible.length > 0 ? eligible : visibleStats
    return [...pool].sort((a, b) => b.avg_score - a.avg_score)[0] ?? null
  }, [visibleStats])

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
      {champion && (
        <div className="mb-8 flex items-center gap-4 rounded-xl border border-gold/40 bg-surface px-5 py-4">
          <TileBadge rank={1} size="lg" />
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-foreground-soft">この期間の平均pt首位</p>
            <Link
              href={`/players/${champion.player_id}`}
              className="font-display text-2xl font-bold hover:text-accent"
            >
              {champion.name}
            </Link>
            <p className="text-xs text-foreground-soft">{champion.games}半荘</p>
          </div>
          <p className="ml-auto shrink-0 font-mono text-2xl font-semibold tabular-nums text-gold">
            {pt(champion.avg_score)}
            <span className="ml-1 text-sm font-sans font-normal text-foreground-soft">pt/半荘</span>
          </p>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 text-sm">
        <label htmlFor="min_games" className="text-foreground-soft">
          最低半荘数
        </label>
        <input
          id="min_games"
          type="number"
          min={0}
          value={minGames}
          onChange={(e) => setMinGames(Math.max(0, Number(e.target.value) || 0))}
          className="w-20 rounded-md border border-line bg-surface px-2 py-1 font-mono"
        />
        <span className="text-foreground-soft">
          以上({visibleStats.length}/{stats.length}人を表示)
        </span>
      </div>

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
                      <Link href={`/players/${s.player_id}`} className="font-sans hover:text-accent hover:underline">
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
