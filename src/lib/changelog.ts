import { readFileSync } from 'fs'
import path from 'path'

export function readChangelog(): string {
  return readFileSync(path.join(process.cwd(), 'docs/changelog.md'), 'utf-8')
}

// changelog.mdの先頭の "## vX.X.X" 見出しをバージョン表記として使う。
// バージョン番号を別ファイルに二重管理しないための措置。
export function latestVersion(): string | null {
  const match = readChangelog().match(/^##\s+(v\S+)/m)
  return match ? match[1] : null
}
