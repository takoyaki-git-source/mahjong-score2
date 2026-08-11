'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Player = { player_id: number; name: string }

export default function PlayerManager({ players }: { players: Player[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError('名前を入力してください')
      return
    }
    if (players.some((p) => p.name === trimmed)) {
      setError('同じ名前のプレイヤーが既に登録されています')
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { error: insertError } = await supabase.from('players').insert({ name: trimmed })
    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setName('')
    router.refresh()
  }

  const inputClass =
    'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40'

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2">
        {players.map((p) => (
          <li
            key={p.player_id}
            className="rounded-full border border-black/10 px-3 py-1 text-sm dark:border-white/15"
          >
            {p.name}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="new_player_name" className="mb-1 block text-sm font-medium">
            新しいプレイヤー名
          </label>
          <input
            id="new_player_name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {submitting ? '追加中…' : '追加'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
