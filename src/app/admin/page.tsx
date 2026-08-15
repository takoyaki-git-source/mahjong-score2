import { createClient } from '@/lib/supabase/server'
import AdminHeader from '@/components/AdminHeader'
import GameForm from './GameForm'

const jaCollator = new Intl.Collator('ja')

export default async function AdminPage() {
  const supabase = await createClient()
  const [
    { data: players, error: playersError },
    { data: rules, error: rulesError },
    { data: recentGames, error: recentError },
    { data: totalGames, error: totalError },
  ] = await Promise.all([
    supabase.from('players').select('player_id, name'),
    supabase.from('mahjong_rules').select('rule_id, rule_name, base_score').order('rule_id'),
    supabase.from('player_recent_year_games').select('player_id, recent_games'),
    supabase.from('player_base_stats').select('player_id, games'),
  ])
  const error = playersError ?? rulesError ?? recentError ?? totalError

  const recentById = new Map((recentGames ?? []).map((r) => [r.player_id, r.recent_games]))
  const totalById = new Map((totalGames ?? []).map((r) => [r.player_id, r.games]))

  // 参加者プルダウンの並び順: 直近1年の参加数 → 累計参加数 → 五十音順(近似)
  const sortedPlayers = [...(players ?? [])].sort((a, b) => {
    const recentDiff = (recentById.get(b.player_id) ?? 0) - (recentById.get(a.player_id) ?? 0)
    if (recentDiff !== 0) return recentDiff
    const totalDiff = (totalById.get(b.player_id) ?? 0) - (totalById.get(a.player_id) ?? 0)
    if (totalDiff !== 0) return totalDiff
    return jaCollator.compare(a.name, b.name)
  })

  return (
    <>
      <AdminHeader active="input" />
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <h1 className="mb-6 font-display text-xl font-bold">半荘入力</h1>

        {error && <p className="text-sm text-accent">データの取得に失敗しました: {error.message}</p>}

        {!error && <GameForm players={sortedPlayers} rules={rules ?? []} />}
      </main>
    </>
  )
}
