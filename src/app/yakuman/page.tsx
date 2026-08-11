import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { dateOnly } from '@/lib/format'
import SiteHeader from '@/components/SiteHeader'

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
    <>
      <SiteHeader active="yakuman" />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="mb-1 font-display text-2xl font-bold">役満記録</h1>
        <p className="mb-8 text-sm text-foreground-soft">役満が出るたびに、ここに記録される。全{rows.length}件。</p>

        {error && <p className="text-sm text-accent">取得に失敗しました: {error.message}</p>}

        {!error && rows.length === 0 && (
          <p className="text-sm text-foreground-soft">まだ役満の記録はありません。</p>
        )}

        {!error && rows.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.map((r) => (
              <li
                key={r.event_id}
                className="rounded-xl border border-line border-l-[3px] border-l-gold bg-surface p-4"
              >
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold leading-snug">{r.yakuman_type}</p>
                  <p className="mt-1 text-sm text-foreground-soft">{dateOnly(r.game?.played_at)}</p>
                  <p className="mt-2 text-sm">
                    {r.winner ? (
                      <Link
                        href={`/players/${r.winner.player_id}`}
                        className="font-medium underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
                      >
                        {r.winner.name}
                      </Link>
                    ) : (
                      '-'
                    )}
                    <span className="text-foreground-soft">
                      {' '}
                      が和了、
                      {r.target ? (
                        <>
                          {' '}
                          <Link
                            href={`/players/${r.target.player_id}`}
                            className="font-medium text-foreground underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
                          >
                            {r.target.name}
                          </Link>{' '}
                          の放銃
                        </>
                      ) : (
                        ' ツモ和了'
                      )}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
