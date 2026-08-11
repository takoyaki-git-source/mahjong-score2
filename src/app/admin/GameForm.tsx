'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Player = { player_id: number; name: string }
type Rule = { rule_id: number; rule_name: string }
type Mode = 'raw' | 'points'
type PreviewRow = { player_id: number; rank: number; final_score: number }
type YakumanEntry = { playerId: string; type: string; targetId: string }

const SEAT_COUNT = 4

const YAKUMAN_SUGGESTIONS = [
  '国士無双',
  '国士無双十三面待ち',
  '四暗刻',
  '四暗刻単騎',
  '大三元',
  '小四喜',
  '大四喜',
  '字一色',
  '清老頭',
  '緑一色',
  '九蓮宝燈',
  '純正九蓮宝燈',
  '四槓子',
  '天和',
  '地和',
]

function todayLocalISODate() {
  const now = new Date()
  const tzOffsetMs = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10)
}

export default function GameForm({ players, rules }: { players: Player[]; rules: Rule[] }) {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('raw')
  const [playedAt, setPlayedAt] = useState(todayLocalISODate())
  const [ruleId, setRuleId] = useState(rules[0] ? String(rules[0].rule_id) : '')
  const [rows, setRows] = useState(
    Array.from({ length: SEAT_COUNT }, () => ({ playerId: '', value: '' }))
  )
  const [tobiBy, setTobiBy] = useState('')
  const [yakumanEntries, setYakumanEntries] = useState<YakumanEntry[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastGameId, setLastGameId] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const valueSum = rows.reduce((sum, r) => sum + (Number(r.value) || 0), 0)
  const selectedPlayerIds = rows.map((r) => r.playerId).filter(Boolean)
  const rowsComplete =
    rows.every((r) => r.playerId && r.value !== '') && new Set(selectedPlayerIds).size === SEAT_COUNT

  function updateRow(i: number, patch: Partial<{ playerId: string; value: string }>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setPreview(null)
  }

  function addYakumanEntry() {
    setYakumanEntries((prev) => [...prev, { playerId: '', type: '', targetId: '' }])
  }

  function updateYakumanEntry(i: number, patch: Partial<YakumanEntry>) {
    setYakumanEntries((prev) => prev.map((y, idx) => (idx === i ? { ...y, ...patch } : y)))
  }

  function removeYakumanEntry(i: number) {
    setYakumanEntries((prev) => prev.filter((_, idx) => idx !== i))
  }

  // 素点モードのみ: 入力が揃ったら compute_game_results をデバウンス呼び出しして
  // 登録前にウマ・オカ・トビ計算後のポイントをプレビュー表示する。
  useEffect(() => {
    if (mode !== 'raw' || !rowsComplete || !ruleId) {
      setPreview(null)
      return
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true)
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc('compute_game_results', {
        p_rule_id: Number(ruleId),
        p_player1: Number(rows[0].playerId),
        p_score1: Number(rows[0].value),
        p_seat1: 1,
        p_player2: Number(rows[1].playerId),
        p_score2: Number(rows[1].value),
        p_seat2: 2,
        p_player3: Number(rows[2].playerId),
        p_score3: Number(rows[2].value),
        p_seat3: 3,
        p_player4: Number(rows[3].playerId),
        p_score4: Number(rows[3].value),
        p_seat4: 4,
        p_tobi_target: null,
        p_tobi_by: tobiBy ? Number(tobiBy) : null,
      })
      setPreviewLoading(false)
      setPreview(rpcError ? null : (data as PreviewRow[]))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, rowsComplete, ruleId, rows[0].playerId, rows[0].value, rows[1].playerId, rows[1].value, rows[2].playerId, rows[2].value, rows[3].playerId, rows[3].value, tobiBy])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLastGameId(null)

    if (!ruleId) {
      setError('ルールを選択してください')
      return
    }
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
    if (yakumanEntries.some((y) => (y.playerId && !y.type.trim()) || (!y.playerId && y.type.trim()))) {
      setError('役満は和了者と役満名の両方を入力してください')
      return
    }

    const yakumanPayload = yakumanEntries
      .filter((y) => y.playerId && y.type.trim())
      .map((y) => ({
        player_id: Number(y.playerId),
        yakuman_type: y.type.trim(),
        target_player_id: y.targetId ? Number(y.targetId) : null,
      }))

    setSubmitting(true)
    const supabase = createClient()
    const rpcName = mode === 'raw' ? 'submit_game' : 'submit_game_points'
    const valueParamPrefix = mode === 'raw' ? 'p_score' : 'p_points'
    const { data, error: rpcError } = await supabase.rpc(rpcName, {
      p_played_at: playedAt,
      p_rule_id: Number(ruleId),
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
      p_yakuman: yakumanPayload,
    })
    setSubmitting(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setLastGameId(data as string)
    setRows(Array.from({ length: SEAT_COUNT }, () => ({ playerId: '', value: '' })))
    setTobiBy('')
    setYakumanEntries([])
    setPreview(null)
    router.refresh()
  }

  const inputClass =
    'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent'

  function playerName(id: number) {
    return players.find((p) => p.player_id === id)?.name ?? `#${id}`
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <div>
        <span className="mb-1 block text-sm font-medium">入力モード</span>
        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          <button
            type="button"
            onClick={() => switchMode('raw')}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              mode === 'raw' ? 'bg-accent text-background' : 'text-foreground-soft hover:text-foreground'
            }`}
          >
            素点(自動計算)
          </button>
          <button
            type="button"
            onClick={() => switchMode('points')}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              mode === 'points' ? 'bg-accent text-background' : 'text-foreground-soft hover:text-foreground'
            }`}
          >
            ポイント(計算済み)
          </button>
        </div>
        <p className="mt-1 text-xs text-foreground-soft">
          {mode === 'raw'
            ? '半荘終了時の素点を入力すると、ウマ・オカ・トビを自動計算します。'
            : 'すでにウマ・オカ・トビ計算済みの最終ポイントをそのまま記録します(自動計算は行いません)。'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        <div>
          <label htmlFor="rule_id" className="mb-1 block text-sm font-medium">
            適用ルール
          </label>
          <select
            id="rule_id"
            required
            value={ruleId}
            onChange={(e) => setRuleId(e.target.value)}
            className={inputClass}
          >
            {rules.length === 0 && <option value="">ルール未登録</option>}
            {rules.map((r) => (
              <option key={r.rule_id} value={r.rule_id}>
                {r.rule_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">
                {i + 1}人目{i === 0 && <span className="text-foreground-soft">(起家)</span>}
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

      <p className="text-sm text-foreground-soft">
        合計: {valueSum.toLocaleString()}{mode === 'raw' ? '点' : 'pt'}
        {mode === 'raw' && valueSum !== 0 && valueSum !== 100000 && (
          <span className="text-gold"> (通常は100,000点になるはずです)</span>
        )}
        {mode === 'points' && valueSum !== 0 && (
          <span className="text-gold"> (通常は合計0になるはずです)</span>
        )}
      </p>

      {mode === 'raw' && rowsComplete && (
        <div className="rounded-lg border border-line bg-surface p-3 text-sm">
          <p className="mb-2 font-medium">
            プレビュー{previewLoading && <span className="text-foreground-soft">(計算中…)</span>}
          </p>
          {preview ? (
            <ul className="space-y-1 font-mono tabular-nums">
              {[...preview]
                .sort((a, b) => a.rank - b.rank)
                .map((p) => (
                  <li key={p.player_id} className="flex justify-between">
                    <span className="font-sans">
                      {p.rank}位 {playerName(p.player_id)}
                    </span>
                    <span className={p.final_score < 0 ? 'text-accent' : 'text-accent-2'}>
                      {p.final_score > 0 ? '+' : ''}
                      {p.final_score}pt
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            !previewLoading && <p className="text-foreground-soft">-</p>
          )}
        </div>
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

      <div>
        <span className="mb-1 block text-sm font-medium">役満(任意)</span>
        <datalist id="yakuman_suggestions">
          {YAKUMAN_SUGGESTIONS.map((y) => (
            <option key={y} value={y} />
          ))}
        </datalist>
        <div className="space-y-3">
          {yakumanEntries.map((entry, i) => (
            <div key={i} className="flex items-end gap-2 rounded-md border border-line p-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-foreground-soft">和了者</label>
                <select
                  value={entry.playerId}
                  onChange={(e) => updateYakumanEntry(i, { playerId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">選択</option>
                  {players
                    .filter((p) => selectedPlayerIds.includes(String(p.player_id)))
                    .map((p) => (
                      <option key={p.player_id} value={p.player_id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-foreground-soft">役満</label>
                <input
                  type="text"
                  list="yakuman_suggestions"
                  value={entry.type}
                  onChange={(e) => updateYakumanEntry(i, { type: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-foreground-soft">放銃者(任意)</label>
                <select
                  value={entry.targetId}
                  onChange={(e) => updateYakumanEntry(i, { targetId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">ツモ</option>
                  {players
                    .filter(
                      (p) =>
                        selectedPlayerIds.includes(String(p.player_id)) &&
                        String(p.player_id) !== entry.playerId
                    )
                    .map((p) => (
                      <option key={p.player_id} value={p.player_id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeYakumanEntry(i)}
                className="shrink-0 rounded-md border border-line px-2 py-2 text-xs text-foreground-soft hover:text-foreground"
              >
                削除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addYakumanEntry}
          className="mt-2 rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
        >
          + 役満を追加
        </button>
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}
      {lastGameId && <p className="text-sm text-accent-2">登録しました({lastGameId})</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting ? '登録中…' : '登録する'}
      </button>
    </form>
  )
}
