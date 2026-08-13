import { readFileSync } from 'fs'
import path from 'path'
import ReactMarkdown, { type Components } from 'react-markdown'
import SiteHeader from '@/components/SiteHeader'

// docs/rule.md をそのまま表示する。手書きJSXで構造を複製すると今後の編集の
// たびに二重メンテが必要になるため、Markdownを直接レンダリングする方式にした
// (docs/yaku.mdの/rulesページはリストが単純だったため手書きJSXのまま)。
const components: Components = {
  h1: ({ children }) => <h1 className="mb-1 font-display text-2xl font-bold">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="mt-8 mb-3 font-display text-lg font-bold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mt-5 mb-2 font-semibold">{children}</h3>,
  p: ({ children }) => <p className="mb-2 text-sm leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
}

export default function GameRulesPage() {
  const content = readFileSync(path.join(process.cwd(), 'docs/rule.md'), 'utf-8')

  return (
    <>
      <SiteHeader active="rules" />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-xl border border-line bg-surface px-5 py-4">
          <ReactMarkdown components={components}>{content}</ReactMarkdown>
        </div>
      </main>
    </>
  )
}
