import Link from 'next/link'

export default function SiteHeader({ active }: { active?: 'leaderboard' | 'yakuman' }) {
  const linkClass = (isActive: boolean) =>
    isActive ? 'text-accent' : 'text-foreground-soft hover:text-foreground'

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-lg font-bold tracking-wide">
          麻雀成績
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/" className={linkClass(active === 'leaderboard')}>
            成績一覧
          </Link>
          <Link href="/yakuman" className={linkClass(active === 'yakuman')}>
            役満記録
          </Link>
        </nav>
      </div>
    </header>
  )
}
