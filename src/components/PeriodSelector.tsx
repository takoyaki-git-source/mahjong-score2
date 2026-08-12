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
  years = [],
  defaultPeriod = 'ytd',
}: {
  basePath: string
  current: PeriodParams
  years?: number[]
  defaultPeriod?: string
}) {
  const isCustom = Boolean(current.start || current.end)
  const activePeriod = isCustom ? null : (current.period ?? defaultPeriod)

  const pillClass = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm transition-colors ${
      active ? 'bg-accent text-background' : 'text-foreground-soft hover:text-foreground'
    }`

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-full border border-line bg-surface p-1">
        {PRESETS.map((p) => (
          <Link key={p.key} href={`${basePath}?period=${p.key}`} className={pillClass(activePeriod === p.key)}>
            {p.label}
          </Link>
        ))}
      </div>
      {years.length > 0 && (
        <div className="inline-flex flex-wrap rounded-full border border-line bg-surface p-1">
          {years.map((y) => (
            <Link key={y} href={`${basePath}?period=${y}`} className={pillClass(activePeriod === String(y))}>
              {y}
            </Link>
          ))}
        </div>
      )}
      <form method="get" action={basePath} className="flex items-center gap-1.5 text-sm">
        <input
          type="date"
          name="start"
          defaultValue={current.start ?? ''}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-foreground"
        />
        <span className="text-foreground-soft">〜</span>
        <input
          type="date"
          name="end"
          defaultValue={current.end ?? ''}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-foreground"
        />
        <button
          type="submit"
          className={`rounded-md border px-3 py-1.5 transition-colors ${
            isCustom
              ? 'border-accent text-accent'
              : 'border-line text-foreground-soft hover:text-foreground'
          }`}
        >
          指定
        </button>
      </form>
    </div>
  )
}
