import clsx from 'clsx';
import 'katex/dist/katex.min.css';
import type { ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { cleanMarkdown } from '@/lib/sanitize';

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins: any[] = [[rehypeKatex, { throwOnError: false, strict: 'ignore' }]];

const linkComponents: Components = {
  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
};

/** Paragraphs become spans so inline markdown can sit inside <p>, <li>, <td>, headings and buttons. */
const inlineComponents: Components = {
  ...linkComponents,
  p: ({ children }) => <span className="md-p">{children}</span>,
};

export function Markdown({ children, className, inline }: { children: string | undefined | null; className?: string; inline?: boolean }) {
  const text = cleanMarkdown(children);
  if (!text) return null;
  if (inline) {
    return (
      <span className={clsx('md-content md-inline', className)}>
        <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={inlineComponents}>{text}</ReactMarkdown>
      </span>
    );
  }
  return (
    <div className={clsx('md-content prose prose-slate max-w-none prose-headings:font-bold prose-a:text-brand-700 prose-p:leading-relaxed prose-li:my-0.5', className)}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={linkComponents}>{text}</ReactMarkdown>
    </div>
  );
}

/** Inline markdown (bold, italics, math) for short AI-generated strings. */
export function Md({ children, className }: { children: string | undefined | null; className?: string }) {
  return <Markdown inline className={className}>{children}</Markdown>;
}

export function BulletList({ items, className }: { items: string[]; className?: string }): ReactNode {
  if (!items?.length) return null;
  return (
    <ul className={clsx('space-y-2', className)}>
      {items.map((x, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
          <span className="min-w-0"><Md>{x}</Md></span>
        </li>
      ))}
    </ul>
  );
}
