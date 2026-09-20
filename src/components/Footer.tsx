import Link from 'next/link'
import { latestVersion } from '@/lib/changelog'

export default function Footer() {
  const version = latestVersion()

  return (
    <footer className="mt-auto border-t border-line px-4 py-4 text-center text-xs text-foreground-soft">
      <Link
        href="/changelog"
        className="underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent"
      >
        {version ?? 'v-'} ・ 更新履歴
      </Link>
    </footer>
  )
}
