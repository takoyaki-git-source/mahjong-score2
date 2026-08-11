'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { PlayerStats } from '@/lib/types'

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
    if (v === bw.best) return 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 font-medium'
    if (v === bw.worst) return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
    return ''
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <label htmlFor="min_games" className="text-black/60 dark:text-white/60">
          最低半荘数
        </label>
        <input
          id="min_games"
          type="number"
          min={0}
          value={minGames}
          onChange={(e) => setMinGames(Math.max(0, Number(e.target.value) || 0))}
          className="w-20 rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
        />
        <span className="text-black/40 dark:text-white/40">
          以上({visibleStats.length}/{stats.length}人を表示)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/15">
              <th className="py-2 pr-3">#</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`py-2 pr-3 ${col.align === 'left' ? 'text-left' : 'text-right'}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    {col.label}
                    {sortKey === col.key && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.player_id} className="border-b border-black/5 dark:border-white/10">
                <td className="py-2 pr-3">{i + 1}</td>
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`py-2 pr-3 ${col.align === 'left' ? 'text-left' : 'text-right'} ${cellClass(col, s)}`}
                  >
                    {col.key === 'name' ? (
                      <Link href={`/players/${s.player_id}`} className="underline">
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
