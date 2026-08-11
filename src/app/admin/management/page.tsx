import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PlayerManager from './PlayerManager'
import RuleManager from './RuleManager'

export default async function ManagementPage() {
  const supabase = await createClient()

  const [{ data: players, error: playersError }, { data: rules, error: rulesError }] = await Promise.all([
    supabase.from('players').select('player_id, name').order('name'),
    supabase.from('mahjong_rules').select('*').order('rule_id'),
  ])

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">管理</h1>
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

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">ルール</h2>
        {rulesError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            取得に失敗しました: {rulesError.message}
          </p>
        ) : (
          <RuleManager rules={rules ?? []} />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">データのエクスポート</h2>
        <p className="mb-3 text-sm text-black/60 dark:text-white/60">
          全プレイヤー・ルール・半荘・結果・役満記録をJSONファイルとしてダウンロードします(Supabase以外にもバックアップを持っておきたい場合用)。
        </p>
        <a
          href="/admin/management/export"
          className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          エクスポート(JSON)
        </a>
      </section>
    </main>
  )
}
