import { createClient } from '@/lib/supabase/server'
import GameForm from './GameForm'
import LogoutButton from './LogoutButton'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: players, error } = await supabase
    .from('players')
    .select('player_id, name')
    .order('name')

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">半荘入力</h1>
        <LogoutButton />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          プレイヤー一覧の取得に失敗しました: {error.message}
        </p>
      )}

      {!error && <GameForm players={players ?? []} />}
    </main>
  )
}
