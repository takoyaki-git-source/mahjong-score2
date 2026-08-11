import { unlock } from './actions'

type EnterParams = { next?: string; error?: string }

export default async function EnterPage({
  searchParams,
}: {
  searchParams: Promise<EnterParams>
}) {
  const sp = await searchParams
  const next = typeof sp.next === 'string' && sp.next.startsWith('/') ? sp.next : '/'
  const hasError = sp.error === '1'

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 font-display text-2xl font-bold">麻雀成績</h1>
      <p className="mb-6 text-sm text-foreground-soft">合言葉を入力してください</p>
      <form action={unlock} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <input
          type="password"
          name="password"
          autoFocus
          required
          placeholder="合言葉"
          className="rounded-md border border-line bg-surface px-3 py-2 text-foreground outline-none focus:border-accent"
        />
        {hasError && <p className="text-sm text-accent">合言葉が違います</p>}
        <button
          type="submit"
          className="rounded-md bg-accent px-3 py-2 font-medium text-background hover:opacity-90"
        >
          入る
        </button>
      </form>
    </div>
  )
}
