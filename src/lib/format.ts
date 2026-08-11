export function dateOnly(v: string | null | undefined) {
  if (!v) return '-'
  return v.slice(0, 10)
}
