import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/components/SiteHeader'

const jaCollator = new Intl.Collator('ja')

// 成績一覧(/)からも名前クリックで個人ページへ行けるが、期間フィルタや
// ソート済みの統計テーブルを経由する必要があり「特定の人のページにすぐ
// 飛びたい」用途には遠回り。統計無しで五十音順に名前だけを並べた
// 軽い入り口ページ。
export default async function PlayersPage() {
  const supabase = await createClient()
  const { data: players, error } = await supabase.from('players').select('player_id, name')

  const sortedPlayers = [...(players ?? [])].sort((a, b) => jaCollator.compare(a.name, b.name))

  return (
    <>
      <SiteHeader active="players" />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="mb-1 font-display text-2xl font-bold">プレイヤー一覧</h1>
        <p className="mb-6 text-sm text-foreground-soft">名前から個人詳細ページへ移動できます。</p>

        {error && <p className="text-sm text-accent">取得に失敗しました: {error.message}</p>}

        {!error && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sortedPlayers.map((p) => (
              <Link
                key={p.player_id}
                href={`/players/${p.player_id}`}
                className="rounded-xl border border-line bg-surface px-4 py-3 font-display text-base font-bold underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
