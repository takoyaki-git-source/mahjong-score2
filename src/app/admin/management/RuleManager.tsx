'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RuleForm, { emptyRuleValues, type RuleValues } from './RuleForm'

type Rule = {
  rule_id: number
  rule_name: string
  base_score: number
  oka: number
  uma_1: number
  uma_2: number
  uma_3: number
  uma_4: number
  tobi_penalty: number
  tobi_reward: number
}

function toValues(rule: Rule): RuleValues {
  return {
    rule_name: rule.rule_name,
    base_score: String(rule.base_score),
    oka: String(rule.oka),
    uma_1: String(rule.uma_1),
    uma_2: String(rule.uma_2),
    uma_3: String(rule.uma_3),
    uma_4: String(rule.uma_4),
    tobi_penalty: String(rule.tobi_penalty),
    tobi_reward: String(rule.tobi_reward),
  }
}

export default function RuleManager({ rules }: { rules: Rule[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

  function handleSaved() {
    setEditingId(null)
    setAdding(false)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {rules.map((rule) => (
          <li key={rule.rule_id} className="rounded-lg border border-line bg-surface p-3">
            {editingId === rule.rule_id ? (
              <RuleForm
                ruleId={rule.rule_id}
                initial={toValues(rule)}
                onSaved={handleSaved}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium">{rule.rule_name}</p>
                  <p className="font-mono text-foreground-soft">
                    開始点{rule.base_score} / オカ{rule.oka} / ウマ {rule.uma_1}・{rule.uma_2}・
                    {rule.uma_3}・{rule.uma_4} / トビ賞{rule.tobi_reward}・罰{rule.tobi_penalty}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingId(rule.rule_id)}
                  className="shrink-0 text-sm text-foreground-soft hover:text-accent"
                >
                  編集
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="rounded-lg border border-line bg-surface p-3">
          <RuleForm initial={emptyRuleValues} onSaved={handleSaved} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent hover:text-accent"
        >
          + 新しいルールを追加
        </button>
      )}
    </div>
  )
}
