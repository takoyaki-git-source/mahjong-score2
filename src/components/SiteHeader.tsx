import Link from 'next/link'
import MobileNav from './MobileNav'
import ThemeToggle from './ThemeToggle'

export default function SiteHeader({
  active,
}: {
  active?: 'leaderboard' | 'daily' | 'yakuman' | 'hands' | 'rules'
}) {
  const linkClass = (isActive: boolean) =>
    isActive ? 'text-accent' : 'text-foreground-soft hover:text-foreground'

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-lg font-bold tracking-wide">
          麻雀成績
        </Link>
        <MobileNav>
          <Link href="/" className={linkClass(active === 'leaderboard')}>
            成績一覧
          </Link>
          <Link href="/daily" className={linkClass(active === 'daily')}>
            日別成績
          </Link>
          <Link href="/yakuman" className={linkClass(active === 'yakuman')}>
            役満記録
          </Link>
          <Link href="/hands" className={linkClass(active === 'hands')}>
            アガリ役
          </Link>
          <Link href="/rules" className={linkClass(active === 'rules')}>
            ルール
          </Link>
          <Link href="/admin" className="text-foreground-soft hover:text-foreground">
            入力
          </Link>
          <ThemeToggle />
        </MobileNav>
      </div>
    </header>
  )
}
