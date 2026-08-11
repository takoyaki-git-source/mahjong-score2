import Link from 'next/link'
import type { PeriodParams } from '@/lib/period'

const PRESETS = [
  { key: 'all', label: '全期間' },
  { key: '1y', label: '直近1年' },
  { key: 'ytd', label: '今年' },
] as const

export default function PeriodSelector({
  basePath,
  current,
}: {
  basePath: string
  current: PeriodParams
}) {
  const isCustom = Boolean(current.start || current.end)
  const activePeriod = isCustom ? null : (current.period ?? 'all')

  const linkClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${
      active
        ? 'border-foreground bg-foreground text-background'
        : 'border-black/15 dark:border-white/20'
    }`

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Link key={p.key} href={`${basePath}?period=${p.key}`} className={linkClass(activePeriod === p.key)}>
          {p.label}
        </Link>
      ))}
      <form method="get" action={basePath} className="flex items-center gap-1 text-sm">
        <input
          type="date"
          name="start"
          defaultValue={current.start ?? ''}
          className="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
        />
        <span>〜</span>
        <input
          type="date"
          name="end"
          defaultValue={current.end ?? ''}
          className="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
        />
        <button
          type="submit"
          className={`rounded border px-2 py-1 ${
            isCustom ? 'border-foreground' : 'border-black/15 dark:border-white/20'
          }`}
        >
          指定
        </button>
      </form>
    </div>
  )
}
