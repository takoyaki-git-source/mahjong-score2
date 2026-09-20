'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// SiteHeader/AdminHeaderの共通ナビラッパー。広い画面ではchildrenを横並びで
// 表示し、狭い画面(sm未満)ではハンバーガーボタン+ドロップダウンパネルに
// 折りたたむ。ThemeToggle追加でリンク数が増え、スマホ幅で1行に収まらず
// 崩れていた問題への対応。
export default function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <nav className="hidden items-center gap-5 text-sm sm:flex">{children}</nav>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="メニュー"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-lg text-foreground-soft hover:text-foreground sm:hidden"
      >
        {open ? '✕' : '☰'}
      </button>
      {open && (
        <nav className="absolute right-0 top-full z-20 mt-2 flex w-52 flex-col items-start gap-3 rounded-lg border border-line bg-surface p-3 text-sm shadow-lg sm:hidden">
          {children}
        </nav>
      )}
    </div>
  )
}
