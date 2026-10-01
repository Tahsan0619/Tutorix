export function slugify(s: string) {
  return (s || 'tutorix').toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tutorix';
}

export function downloadFile(filename: string, content: string | Blob, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

/** Exports rendered HTML as a Word-compatible .doc file. */
export function downloadWord(filename: string, title: string, html: string) {
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${title.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] ?? c)}</title>
<style>body{font-family:Calibri,'Hind Siliguri',sans-serif;font-size:11pt;line-height:1.45}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px;vertical-align:top}th{background:#eee}h1{font-size:20pt}h2{font-size:15pt;color:#4515aa}h3{font-size:12.5pt}</style>
</head><body>${html}</body></html>`;
  downloadFile(filename, new Blob(['\ufeff', doc], { type: 'application/msword' }));
}

export function toCsv(rows: (string | number)[][]) {
  return rows
    .map((r) => r.map((c) => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))
    .join('\n');
}

/** Markdown helpers used by each tool's exporter. */
export const md = {
  list: (items: string[] | undefined, ordered = false) =>
    (items ?? []).filter(Boolean).map((x, i) => `${ordered ? `${i + 1}.` : '-'} ${x}`).join('\n'),
  table: (head: string[], rows: (string | number)[][]) => {
    const esc = (v: string | number) => String(v ?? '').replace(/\|/g, '\\|').replace(/\s*\n+\s*/g, ' ').trim() || ' ';
    return [`| ${head.map(esc).join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n');
  },
  section: (title: string, body: string | undefined, level = 2) => (body && body.trim() ? `${'#'.repeat(level)} ${title}\n\n${body.trim()}\n` : ''),
  join: (...parts: (string | undefined | null | false | 0)[]) => parts.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n',
};
