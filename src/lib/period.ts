export type PeriodParams = { period?: string; start?: string; end?: string }

export type ResolvedPeriod = { start: string | null; end: string | null; label: string }

export function resolvePeriod(sp: PeriodParams): ResolvedPeriod {
  if (sp.start || sp.end) {
    return { start: sp.start ?? null, end: sp.end ?? null, label: 'カスタム期間' }
  }

  const period = sp.period ?? 'all'
  const end = new Date()
  const start = new Date(end)

  if (period === '1y') {
    start.setFullYear(start.getFullYear() - 1)
    return { start: toISODate(start), end: toISODate(end), label: '直近1年' }
  }
  if (period === 'ytd') {
    start.setMonth(0, 1)
    return { start: toISODate(start), end: toISODate(end), label: '今年' }
  }
  if (/^\d{4}$/.test(period)) {
    return { start: `${period}-01-01`, end: `${period}-12-31`, label: `${period}年` }
  }

  return { start: null, end: null, label: '全期間' }
}

function toISODate(d: Date) {
  const tzOffsetMs = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10)
}
