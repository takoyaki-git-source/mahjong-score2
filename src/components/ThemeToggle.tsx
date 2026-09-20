'use client'

import { useEffect, useState } from 'react'

type ThemeValue = 'system' | 'light' | 'dark' | 'hatsu' | 'chun'

const THEMES: { value: ThemeValue; label: string }[] = [
  { value: 'system', label: '端末に合わせる' },
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
  { value: 'hatsu', label: '發' },
  { value: 'chun', label: '中' },
]

// 各テーマのbackground色。<meta name="theme-color">(ブラウザのアドレスバー等の色)を
// テーマ切り替えに追随させるために使う。CSS側の実際の配色はglobals.cssが正。
const THEME_COLORS: Record<Exclude<ThemeValue, 'system'>, string> = {
  light: '#f1e9d8',
  dark: '#1a1c17',
  hatsu: '#eef1de',
  chun: '#f6e8e0',
}

const STORAGE_KEY = 'theme'

function isThemeValue(v: string | null): v is ThemeValue {
  return v != null && THEMES.some((t) => t.value === v)
}

function applyMetaThemeColor(theme: ThemeValue) {
  const resolved: Exclude<ThemeValue, 'system'> =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved])
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeValue>('system')

  // レイアウトのブロッキングスクリプトが先にdata-theme/localStorageを反映済みなので、
  // ここではマウント後にセレクトの表示値をそれに合わせるだけ(初回描画のチラつき防止)。
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isThemeValue(stored)) setTheme(stored)
  }, [])

  useEffect(() => {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
    applyMetaThemeColor(theme)

    if (theme !== 'system') return
    // 「端末に合わせる」選択中はOS側のダーク/ライト切り替えにもtheme-colorを追随させる
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyMetaThemeColor('system')
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [theme])

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    if (!isThemeValue(next)) return
    setTheme(next)
    if (next === 'system') {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, next)
    }
  }

  return (
    <select
      value={theme}
      onChange={handleChange}
      aria-label="テーマ"
      className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-foreground-soft outline-none focus:border-accent"
    >
      {THEMES.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  )
}
