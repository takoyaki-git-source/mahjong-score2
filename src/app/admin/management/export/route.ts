import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// PostgREST caps a single request at 1000 rows by default, and results
// alone has 3000+ rows, so page through with .range() until a page comes
// back short.
async function fetchAll(supabase: SupabaseServerClient, table: string, orderBy: string) {
  const pageSize = 1000
  let from = 0
  const all: Record<string, unknown>[] = []

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy)
      .range(from, from + pageSize - 1)

    if (error) throw new Error(`${table}: ${error.message}`)

    all.push(...(data ?? []))
    if (!data || data.length < pageSize) break
    from += pageSize
  }

  return all
}

export async function GET() {
  const supabase = await createClient()

  try {
    const [players, mahjongRules, games, results, yakumanEvents] = await Promise.all([
      fetchAll(supabase, 'players', 'player_id'),
      fetchAll(supabase, 'mahjong_rules', 'rule_id'),
      fetchAll(supabase, 'games', 'game_id'),
      fetchAll(supabase, 'results', 'result_id'),
      fetchAll(supabase, 'yakuman_events', 'event_id'),
    ])

    const payload = {
      exported_at: new Date().toISOString(),
      players,
      mahjong_rules: mahjongRules,
      games,
      results,
      yakuman_events: yakumanEvents,
    }

    const filename = `mahjong-score2-export-${new Date().toISOString().slice(0, 10)}.json`

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
