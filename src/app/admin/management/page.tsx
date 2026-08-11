import { createClient } from '@/lib/supabase/server'
import AdminHeader from '@/components/AdminHeader'
import PlayerManager from './PlayerManager'
import RuleManager from './RuleManager'

export default async function ManagementPage() {
  const supabase = await createClient()

  const [{ data: players, error: playersError }, { data: rules, error: rulesError }] = await Promise.all([
    supabase.from('players').select('player_id, name').order('name'),
    supabase.from('mahjong_rules').select('*').order('rule_id'),
  ])

  return (
    <>
      <AdminHeader active="management" />
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <h1 className="mb-6 font-display text-xl font-bold">管理</h1>

        <section className="mb-10">
          <h2 className="mb-3 font-display text-lg font-bold">プレイヤー</h2>
          {playersError ? (
            <p className="text-sm text-accent">取得に失敗しました: {playersError.message}</p>
          ) : (
            <PlayerManager players={players ?? []} />
          )}
        </section>

        <section className="mb-10">
          <h2 className="mb-3 font-display text-lg font-bold">ルール</h2>
          {rulesError ? (
            <p className="text-sm text-accent">取得に失敗しました: {rulesError.message}</p>
          ) : (
            <RuleManager rules={rules ?? []} />
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-bold">データのエクスポート</h2>
          <p className="mb-3 text-sm text-foreground-soft">
            全プレイヤー・ルール・半荘・結果・役満記録をJSONファイルとしてダウンロードします(Supabase以外にもバックアップを持っておきたい場合用)。
          </p>
          <a
            href="/admin/management/export"
            className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            エクスポート(JSON)
          </a>
        </section>
      </main>
    </>
  )
}
