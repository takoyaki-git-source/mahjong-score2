'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export type RuleValues = {
  rule_name: string
  base_score: string
  oka: string
  uma_1: string
  uma_2: string
  uma_3: string
  uma_4: string
  tobi_penalty: string
  tobi_reward: string
}

export const emptyRuleValues: RuleValues = {
  rule_name: '',
  base_score: '25000',
  oka: '20',
  uma_1: '10',
  uma_2: '5',
  uma_3: '-5',
  uma_4: '-10',
  tobi_penalty: '-10',
  tobi_reward: '10',
}

type Props = {
  ruleId?: number
  initial: RuleValues
  onSaved: () => void
  onCancel?: () => void
}

export default function RuleForm({ ruleId, initial, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<RuleValues>(initial)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(key: keyof RuleValues, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const payload = {
      rule_name: form.rule_name,
      base_score: Number(form.base_score),
      oka: Number(form.oka),
      uma_1: Number(form.uma_1),
      uma_2: Number(form.uma_2),
      uma_3: Number(form.uma_3),
      uma_4: Number(form.uma_4),
      tobi_penalty: Number(form.tobi_penalty),
      tobi_reward: Number(form.tobi_reward),
    }

    const supabase = createClient()
    const { error: saveError } = ruleId
      ? await supabase.from('mahjong_rules').update(payload).eq('rule_id', ruleId)
      : await supabase.from('mahjong_rules').insert(payload)

    setSubmitting(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    onSaved()
  }

  const inputClass =
    'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">ルール名</label>
        <input
          type="text"
          required
          value={form.rule_name}
          onChange={(e) => update('rule_name', e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">開始点</label>
          <input
            type="number"
            step={100}
            value={form.base_score}
            onChange={(e) => update('base_score', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">オカ(1位ボーナス)</label>
          <input
            type="number"
            value={form.oka}
            onChange={(e) => update('oka', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium">ウマ(1位/2位/3位/4位)</span>
        <div className="grid grid-cols-4 gap-2">
          {(['uma_1', 'uma_2', 'uma_3', 'uma_4'] as const).map((key, i) => (
            <input
              key={key}
              type="number"
              aria-label={`ウマ${i + 1}位`}
              value={form[key]}
              onChange={(e) => update(key, e.target.value)}
              className={inputClass}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">トビ賞(飛ばした側)</label>
          <input
            type="number"
            value={form.tobi_reward}
            onChange={(e) => update('tobi_reward', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">トビ罰(飛んだ側)</label>
          <input
            type="number"
            value={form.tobi_penalty}
            onChange={(e) => update('tobi_penalty', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {submitting ? '保存中…' : '保存する'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent hover:text-accent"
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  )
}
