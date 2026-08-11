import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PlayerManager from './PlayerManager'
import RuleManager from './RuleManager'

export default async function SettingsPage() {
  const supabase = await createClient()

  const [{ data: players, error: playersError }, { data: rules, error: rulesError }] = await Promise.all([
    supabase.from('players').select('player_id, name').order('name'),
    supabase.from('mahjong_rules').select('*').order('rule_id'),
  ])

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">設定</h1>
        <Link href="/admin" className="text-sm underline">
          半荘入力へ戻る
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">プレイヤー</h2>
        {playersError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            取得に失敗しました: {playersError.message}
          </p>
        ) : (
          <PlayerManager players={players ?? []} />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">ルール</h2>
        {rulesError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            取得に失敗しました: {rulesError.message}
          </p>
        ) : (
          <RuleManager rules={rules ?? []} />
        )}
      </section>
    </main>
  )
}
