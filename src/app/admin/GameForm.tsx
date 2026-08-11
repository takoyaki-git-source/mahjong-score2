'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Player = { player_id: number; name: string }
type Mode = 'raw' | 'points'

const SEAT_COUNT = 4

function todayLocalISODate() {
  const now = new Date()
  const tzOffsetMs = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10)
}

export default function GameForm({ players }: { players: Player[] }) {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('raw')
  const [playedAt, setPlayedAt] = useState(todayLocalISODate())
  const [rows, setRows] = useState(
    Array.from({ length: SEAT_COUNT }, () => ({ playerId: '', value: '' }))
  )
  const [tobiBy, setTobiBy] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastGameId, setLastGameId] = useState<string | null>(null)

  const valueSum = rows.reduce((sum, r) => sum + (Number(r.value) || 0), 0)
  const selectedPlayerIds = rows.map((r) => r.playerId).filter(Boolean)

  function updateRow(i: number, patch: Partial<{ playerId: string; value: string }>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLastGameId(null)

    if (rows.some((r) => !r.playerId)) {
      setError('4人分のプレイヤーを選択してください')
      return
    }
    if (new Set(selectedPlayerIds).size !== SEAT_COUNT) {
      setError('同じプレイヤーが重複しています')
      return
    }
    if (rows.some((r) => r.value === '')) {
      setError(mode === 'raw' ? '4人分の点数を入力してください' : '4人分のポイントを入力してください')
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const rpcName = mode === 'raw' ? 'submit_game' : 'submit_game_points'
    const valueParamPrefix = mode === 'raw' ? 'p_score' : 'p_points'
    const { data, error: rpcError } = await supabase.rpc(rpcName, {
      p_played_at: playedAt,
      p_player1: Number(rows[0].playerId),
      [`${valueParamPrefix}1`]: Number(rows[0].value),
      p_seat1: 1,
      p_player2: Number(rows[1].playerId),
      [`${valueParamPrefix}2`]: Number(rows[1].value),
      p_seat2: 2,
      p_player3: Number(rows[2].playerId),
      [`${valueParamPrefix}3`]: Number(rows[2].value),
      p_seat3: 3,
      p_player4: Number(rows[3].playerId),
      [`${valueParamPrefix}4`]: Number(rows[3].value),
      p_seat4: 4,
      p_tobi_target: null,
      p_tobi_by: tobiBy ? Number(tobiBy) : null,
    })
    setSubmitting(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setLastGameId(data as string)
    setRows(Array.from({ length: SEAT_COUNT }, () => ({ playerId: '', value: '' })))
    setTobiBy('')
    router.refresh()
  }

  const inputClass =
    'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40'

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <div>
        <span className="mb-1 block text-sm font-medium">入力モード</span>
        <div className="inline-flex rounded-md border border-black/15 p-0.5 dark:border-white/20">
          <button
            type="button"
            onClick={() => switchMode('raw')}
            className={`rounded px-3 py-1.5 text-sm ${
              mode === 'raw'
                ? 'bg-foreground text-background'
                : 'text-black/60 dark:text-white/60'
            }`}
          >
            素点(自動計算)
          </button>
          <button
            type="button"
            onClick={() => switchMode('points')}
            className={`rounded px-3 py-1.5 text-sm ${
              mode === 'points'
                ? 'bg-foreground text-background'
                : 'text-black/60 dark:text-white/60'
            }`}
          >
            ポイント(計算済み)
          </button>
        </div>
        <p className="mt-1 text-xs text-black/50 dark:text-white/50">
          {mode === 'raw'
            ? '半荘終了時の素点を入力すると、ウマ・オカ・トビを自動計算します。'
            : 'すでにウマ・オカ・トビ計算済みの最終ポイントをそのまま記録します(自動計算は行いません)。'}
        </p>
      </div>

      <div>
        <label htmlFor="played_at" className="mb-1 block text-sm font-medium">
          対局日
        </label>
        <input
          id="played_at"
          type="date"
          required
          value={playedAt}
          onChange={(e) => setPlayedAt(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">
                {i + 1}人目{i === 0 && <span className="text-black/50 dark:text-white/50">(起家)</span>}
              </label>
              <select
                required
                value={row.playerId}
                onChange={(e) => updateRow(i, { playerId: e.target.value })}
                className={inputClass}
              >
                <option value="">選択してください</option>
                {players.map((p) => (
                  <option key={p.player_id} value={p.player_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="mb-1 block text-sm font-medium">
                {mode === 'raw' ? '点数' : 'ポイント'}
              </label>
              <input
                type="number"
                required
                step={mode === 'raw' ? 100 : 1}
                value={row.value}
                onChange={(e) => updateRow(i, { value: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        ))}
      </div>

      {mode === 'raw' && (
        <p className="text-sm text-black/60 dark:text-white/60">
          合計: {valueSum.toLocaleString()}点
          {valueSum !== 0 && valueSum !== 100000 && (
            <span className="text-amber-600 dark:text-amber-400"> (通常は100,000点になるはずです)</span>
          )}
        </p>
      )}

      <div>
        <label htmlFor="tobi_by" className="mb-1 block text-sm font-medium">
          トビ加害(任意、誰の手で飛ばしたか)
        </label>
        <select
          id="tobi_by"
          value={tobiBy}
          onChange={(e) => setTobiBy(e.target.value)}
          className={inputClass}
        >
          <option value="">なし</option>
          {players
            .filter((p) => selectedPlayerIds.includes(String(p.player_id)))
            .map((p) => (
              <option key={p.player_id} value={p.player_id}>
                {p.name}
              </option>
            ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {lastGameId && (
        <p className="text-sm text-green-600 dark:text-green-400">
          登録しました({lastGameId})
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting ? '登録中…' : '登録する'}
      </button>
    </form>
  )
}
