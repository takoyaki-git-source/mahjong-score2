export type PeriodParams = { period?: string; start?: string; end?: string }

export type ResolvedPeriod = { start: string | null; end: string | null; label: string }

export function resolvePeriod(sp: PeriodParams, defaultPeriod: string = 'ytd'): ResolvedPeriod {
  if (sp.start || sp.end) {
    return { start: sp.start ?? null, end: sp.end ?? null, label: 'カスタム期間' }
  }

  const period = sp.period ?? defaultPeriod
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

// 年単位ボタン(period=2020等)で絞り込んだ場合のみ、その年末の日付を返す。
// それ以外(全期間/直近1年/今年/カスタム)はRatingの「現在値」表示を変えないためnull。
export function yearPeriodEnd(period: ResolvedPeriod): string | null {
  return /^\d{4}年$/.test(period.label) ? period.end : null
}

function toISODate(d: Date) {
  const tzOffsetMs = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10)
}
