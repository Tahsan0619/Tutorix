import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { cleanMarkdown } from '@/lib/sanitize';

/**
 * Clean, print-grade rendering of a tool's markdown export. Used off-screen to produce PDF and Word files,
 * so it contains no interactive UI (buttons, hidden answers, flip cards), only the content.
 */
export function ExportDocument({ title, subtitle, markdown, math = 'html', branded = true }: {
  title: string; subtitle?: string; markdown: string; math?: 'html' | 'mathml'; branded?: boolean;
}) {
  const body = cleanMarkdown(markdown);
  const hasOwnTitle = /^#\s/.test(body);
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <article className="export-doc">
      {branded && (
        <header className="export-header">
          <img src="/logo.png" alt="" width={30} height={30} />
          <div className="export-brand">
            <strong>Tutorix</strong>
            {subtitle && <span>{subtitle}</span>}
          </div>
          <time>{date}</time>
        </header>
      )}
      {!hasOwnTitle && <h1>{title}</h1>}
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { output: math, throwOnError: false, strict: 'ignore' }]]}>
        {body}
      </ReactMarkdown>
    </article>
  );
}
