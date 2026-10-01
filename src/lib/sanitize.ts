const HTML_FORMATTING = /<br\s*\/?>|<(b|strong|i|em|p|li|sup|sub|ul|ol|div|span|u|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/i;

/** Replaces em dashes with ordinary punctuation (ranges become hyphens, empty table cells become "-"). */
export function noEmDash(s: string): string {
  if (!/[—―]/.test(s)) return s;
  return s
    .replace(/\|[ \t]*[—―][ \t]*(?=\|)/g, '| - ')
    .replace(/(\d)[ \t]*[—―][ \t]*(\d)/g, '$1-$2')
    .replace(/^([ \t]*)[—―][ \t]*/gm, '$1')
    .replace(/[ \t]*[—―][ \t]*(?=[.,;:!?)\]|]|$)/gm, '')
    .replace(/,?[ \t]*[—―][ \t]*/g, ', ');
}

/**
 * Normalizes AI-generated markdown before it is rendered or exported:
 * repairs LaTeX backslashes damaged by JSON escaping, converts \( \) / \[ \] math delimiters,
 * escapes currency dollars so they are not parsed as math, turns HTML formatting into markdown,
 * removes invisible characters and unwraps whole-document code fences.
 */
export function cleanMarkdown(input: string | null | undefined): string {
  if (!input) return '';
  let s = String(input)
    .replace(/\f(?=[a-zA-Z])/g, '\\f')
    .replace(/\x08(?=[a-zA-Z])/g, '\\b')
    .replace(/\x0B(?=[a-zA-Z])/g, '\\v')
    .replace(/\t(?=[a-z]{2,})/g, '\\t')
    .replace(/\r(?=[a-zA-Z])/g, '\\r')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u2060\uFEFF]/g, '')
    .replace(/\^circ\b/g, '^\\circ');

  const fenced = /^\s*```(?:markdown|md|text)?\s*\n([\s\S]*?)\n?```\s*$/i.exec(s);
  if (fenced) s = fenced[1];

  if (HTML_FORMATTING.test(s) && !/`[^`]*</.test(s)) {
    s = s
      .split('\n')
      .map((line) => line.replace(/<br\s*\/?>/gi, line.trim().startsWith('|') ? ' ' : '\n'))
      .join('\n')
      .replace(/<\/?(?:b|strong)>/gi, '**')
      .replace(/<\/?(?:i|em)>/gi, '*')
      .replace(/<sup>(.*?)<\/sup>/gi, '^$1')
      .replace(/<sub>(.*?)<\/sub>/gi, '_$1')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/?(?:p|div|h[1-6]|ul|ol)[^>]*>/gi, '\n')
      .replace(/<\/?(?:span|u|li|font|small|mark)\b[^>]*>/gi, '');
  }

  s = s
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `$$${m}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m}$`);
  s = s.split('\n').map(escapeCurrency).join('\n');

  if ((s.match(/\*\*/g) ?? []).length % 2 === 1) s = s.replace(/\*\*(?![\s\S]*\*\*)/, '');

  return noEmDash(s)
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * "It costs $5 and $10" must not become a math span. A "$" before a digit is treated as money when there is
 * no closing "$" on the line, or when the text up to the next "$" reads as prose rather than an expression.
 */
function escapeCurrency(line: string): string {
  if (!line.includes('$')) return line;
  let out = '';
  let i = 0;
  const nextDollar = (from: number) => {
    for (let k = from; k < line.length; k++) {
      if (line[k] === '\\') k++;
      else if (line[k] === '$') return k;
    }
    return -1;
  };
  while (i < line.length) {
    const ch = line[i];
    if (ch === '\\') {
      out += line.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch !== '$') {
      out += ch;
      i++;
      continue;
    }
    if (line[i + 1] === '$') {
      const close = line.indexOf('$$', i + 2);
      const end = close === -1 ? i + 2 : close + 2;
      out += line.slice(i, end);
      i = end;
      continue;
    }
    const j = nextDollar(i + 1);
    const body = j === -1 ? '' : line.slice(i + 1, j);
    const money = /\d/.test(line[i + 1] ?? '') && (j === -1 || (!/[\\^_=+{}<>×÷]/.test(body) && /[a-zA-Z\u0980-\u09FF]{3,}/.test(body)));
    if (money || j === -1) {
      out += '\\$';
      i++;
    } else {
      out += line.slice(i, j + 1);
      i = j + 1;
    }
  }
  return out;
}

/** Plain text with markdown / LaTeX markers removed (for titles, file names, truncated previews). */
export function plainText(input: string | null | undefined): string {
  return cleanMarkdown(input)
    .replace(/\$\$?([^$]+)\$\$?/g, '$1')
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|`([^`]+)`/g, (_, a, b, c, d) => a ?? b ?? c ?? d)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\\\$/g, '$')
    .replace(/\s+/g, ' ')
    .trim();
}
