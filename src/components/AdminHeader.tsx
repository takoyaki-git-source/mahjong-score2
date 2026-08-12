import Link from 'next/link'
import LogoutButton from '@/app/admin/LogoutButton'

export default function AdminHeader({ active }: { active: 'input' | 'management' }) {
  const linkClass = (isActive: boolean) =>
    isActive ? 'text-accent' : 'text-foreground-soft hover:text-foreground'

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-lg font-bold tracking-wide">
          麻雀成績
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/admin" className={linkClass(active === 'input')}>
            半荘入力
          </Link>
          <Link href="/admin/management" className={linkClass(active === 'management')}>
            管理
          </Link>
          <Link href="/" className="text-foreground-soft hover:text-foreground">
            成績を見る
          </Link>
          <LogoutButton />
        </nav>
      </div>
    </header>
  )
}
