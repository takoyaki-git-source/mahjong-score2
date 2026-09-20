import type { Components } from 'react-markdown'

// docs/配下のMarkdownをそのまま表示するページ(/rules, /changelog)で共通利用する
// react-markdownのコンポーネントマッピング。手書きJSXで構造を複製すると編集の
// たびに二重メンテが必要になるため、Markdownを直接レンダリングする方式にしている。
export const docsMarkdownComponents: Components = {
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
