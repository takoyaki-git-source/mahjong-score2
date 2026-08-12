import Link from 'next/link'

const PRESET_NS = [10, 30, 50, 100] as const

export default function LastNSelector({
  basePath,
  activeN,
}: {
  basePath: string
  activeN: number | null
}) {
  const pillClass = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm transition-colors ${
      active ? 'bg-accent text-background' : 'text-foreground-soft hover:text-foreground'
    }`

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <span className="text-sm text-foreground-soft">直近N半荘</span>
      <div className="inline-flex rounded-full border border-line bg-surface p-1">
        {PRESET_NS.map((n) => (
          <Link key={n} href={`${basePath}?last_n=${n}`} className={pillClass(activeN === n)}>
            {n}
          </Link>
        ))}
      </div>
      <form method="get" action={basePath} className="flex items-center gap-1.5 text-sm">
        <input
          type="number"
          name="last_n"
          min={1}
          placeholder="任意の数"
          defaultValue={activeN && !PRESET_NS.includes(activeN as (typeof PRESET_NS)[number]) ? activeN : ''}
          className="w-24 rounded-md border border-line bg-surface px-2 py-1.5 text-foreground"
        />
        <button
          type="submit"
          className={`rounded-md border px-3 py-1.5 transition-colors ${
            activeN && !PRESET_NS.includes(activeN as (typeof PRESET_NS)[number])
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
