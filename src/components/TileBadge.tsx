export default function TileBadge({
  rank,
  size = 'md',
}: {
  rank: number
  size?: 'sm' | 'md' | 'lg'
}) {
  const dims =
    size === 'sm' ? 'h-6 w-6 text-xs' : size === 'lg' ? 'h-12 w-12 text-xl' : 'h-9 w-9 text-base'
  const tone =
    rank === 1
      ? 'border-gold bg-gold/15 text-gold'
      : rank === 2
        ? 'border-silver bg-silver/15 text-silver'
        : rank === 3
          ? 'border-bronze bg-bronze/15 text-bronze'
          : 'border-line bg-surface text-foreground-soft'

  return (
    <span
      className={`inline-flex ${dims} shrink-0 items-center justify-center rounded-[7px] border font-display font-bold ${tone}`}
    >
      {rank}
    </span>
  )
}
