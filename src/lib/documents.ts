import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ExportDocument } from '@/components/ExportDocument';
import { downloadWord } from './export';

interface DocArgs { title: string; subtitle?: string; markdown: string; filename: string }

/** A4 with 12 mm side margins leaves 186 mm ≈ 703 CSS px of content width. */
const CONTENT_WIDTH_PX = 703;

async function renderOffscreen(args: DocArgs, math: 'html' | 'mathml', branded: boolean) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${CONTENT_WIDTH_PX}px;background:#fff;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(createElement(ExportDocument, { title: args.title, subtitle: args.subtitle, markdown: args.markdown, math, branded })));
  await document.fonts?.ready;
  await Promise.all([...host.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  const cleanup = () => { root.unmount(); host.remove(); };
  return { el: host.firstElementChild as HTMLElement, cleanup };
}

/** Keeps each heading on the same page as the block that follows it (when that block is reasonably small). */
function keepHeadingsWithNext(doc: HTMLElement) {
  for (const h of [...doc.querySelectorAll<HTMLElement>(':scope > h1, :scope > h2, :scope > h3, :scope > h4')]) {
    const next = h.nextElementSibling as HTMLElement | null;
    if (!next || /^H[1-4]$/.test(next.tagName) || next.offsetHeight > 320) continue;
    const wrap = document.createElement('div');
    wrap.className = 'export-keep';
    h.before(wrap);
    wrap.append(h, next);
  }
}

export async function downloadPdf(args: DocArgs) {
  const [{ default: html2pdf }, { el, cleanup }] = await Promise.all([import('html2pdf.js'), renderOffscreen(args, 'html', true)]);
  try {
    keepHeadingsWithNext(el);
    const options = {
      margin: [12, 12, 16, 12],
      filename: args.filename,
      image: { type: 'jpeg', quality: 0.97 },
      enableLinks: true,
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', letterRendering: true, windowWidth: CONTENT_WIDTH_PX + 40 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: {
        mode: ['css', 'legacy'],
        avoid: ['.export-keep', 'tr', 'li', 'p', 'blockquote', 'pre', 'img', '.katex-display', 'h1', 'h2', 'h3', 'h4', 'header'],
      },
    };
    const worker = html2pdf().set(options as any).from(el).toPdf();
    const pdf = await worker.get('pdf');
    const pages: number = pdf.internal.getNumberOfPages();
    const w: number = pdf.internal.pageSize.getWidth();
    const h: number = pdf.internal.pageSize.getHeight();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.setDrawColor(226, 232, 240);
      pdf.line(12, h - 11, w - 12, h - 11);
      pdf.text('Generated with Tutorix', 12, h - 7);
      pdf.text(`Page ${i} of ${pages}`, w - 12, h - 7, { align: 'right' });
    }
    await worker.save(args.filename);
  } finally {
    cleanup();
  }
}

export async function downloadWordDoc(args: DocArgs) {
  const { el, cleanup } = await renderOffscreen(args, 'mathml', false);
  try {
    const html = el.innerHTML;
    downloadWord(args.filename, args.title, html);
  } finally {
    cleanup();
  }
}
