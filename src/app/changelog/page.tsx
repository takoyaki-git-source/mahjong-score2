import ReactMarkdown from 'react-markdown'
import SiteHeader from '@/components/SiteHeader'
import { docsMarkdownComponents } from '@/components/markdownComponents'
import { readChangelog } from '@/lib/changelog'

export default function ChangelogPage() {
  const content = readChangelog()

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-xl border border-line bg-surface px-5 py-4">
          <ReactMarkdown components={docsMarkdownComponents}>{content}</ReactMarkdown>
        </div>
      </main>
    </>
  )
}
