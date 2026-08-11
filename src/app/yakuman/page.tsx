import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { dateOnly } from '@/lib/format'

type YakumanRow = {
  event_id: number
  yakuman_type: string
  game: { played_at: string } | null
  winner: { player_id: number; name: string } | null
  target: { player_id: number; name: string } | null
}

export default async function YakumanPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('yakuman_events').select(
    `
      event_id,
      yakuman_type,
      game:games!yakuman_events_game_id_fkey(played_at),
      winner:players!yakuman_events_player_id_fkey(player_id, name),
      target:players!yakuman_events_target_player_id_fkey(player_id, name)
    `
  )

  const rows = ((data ?? []) as unknown as YakumanRow[])
    .slice()
    .sort((a, b) => (b.game?.played_at ?? '').localeCompare(a.game?.played_at ?? ''))

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="mb-4 inline-block text-sm underline">
        ← 成績一覧へ戻る
      </Link>
      <h1 className="mb-4 text-xl font-semibold">役満記録</h1>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">取得に失敗しました: {error.message}</p>
      )}

      {!error && rows.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">まだ役満の記録はありません。</p>
      )}

      {!error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left dark:border-white/15">
                <th className="py-2 pr-3">日付</th>
                <th className="py-2 pr-3">役満</th>
                <th className="py-2 pr-3">和了者</th>
                <th className="py-2 pr-3">放銃者</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.event_id} className="border-b border-black/5 dark:border-white/10">
                  <td className="py-2 pr-3">{dateOnly(r.game?.played_at)}</td>
                  <td className="py-2 pr-3">{r.yakuman_type}</td>
                  <td className="py-2 pr-3">
                    {r.winner ? (
                      <Link href={`/players/${r.winner.player_id}`} className="underline">
                        {r.winner.name}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {r.target ? (
                      <Link href={`/players/${r.target.player_id}`} className="underline">
                        {r.target.name}
                      </Link>
                    ) : (
                      'ツモ'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
