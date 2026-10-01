import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { AiError } from './groq.ts';

export type Role = 'teacher' | 'student' | 'admin';
export type Tier = 'primary' | 'fast';

/** Reference material attached to a request: preloaded whole (cag), retrieved passages (rag) or none. */
export interface Grounding {
  mode: 'none' | 'cag' | 'rag';
  text: string;
  sources: { title: string; used: number | 'full'; total: number }[];
  query: string;
  matched?: number;
}

export interface JsonOpts {
  tier?: Tier;
  temperature?: number;
  maxTokens?: number;
  reasoning?: 'low' | 'medium' | 'high';
  rotate?: number;
  /** Placed at the very start of the system prompt so repeated calls on the same material hit Groq's prompt cache. */
  material?: Grounding;
}

export interface Ctx {
  json: (system: string, user: string, opts?: JsonOpts) => Promise<any>;
  /** Resolves input.source_text and input.material_ids into prompt-ready material for the given retrieval query. */
  ground: (input: any, query: string) => Promise<Grounding>;
  userId: string;
  db: SupabaseClient;
}

export interface ToolDef {
  roles: Role[];
  save: boolean;
  run: (input: any, ctx: Ctx) => Promise<any>;
  title?: (input: any, output: any) => string;
  /** Identical requests may be answered from the response cache (default true). */
  cache?: boolean;
  /** Counts towards the hourly AI limit and usage analytics (default true). */
  meter?: boolean;
}

export const MATERIAL_RULE =
  'Use the REFERENCE MATERIAL at the top as the primary source. Do not invent facts beyond it except brief, clearly general clarifications.';

export const BLOOM = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'] as const;
export type Bloom = (typeof BLOOM)[number];

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
 * Repairs common model-output damage so every string renders cleanly as markdown:
 * LaTeX commands whose backslash JSON.parse turned into a control character ("\frac" → form feed + "rac"),
 * literal "\n" sequences, HTML formatting tags, invisible characters, whole-string code fences,
 * unbalanced bold markers and excess blank lines.
 */
export function cleanText(input: string): string {
  let s = input
    .replace(/\f(?=[a-zA-Z])/g, '\\f')
    .replace(/\x08(?=[a-zA-Z])/g, '\\b')
    .replace(/\x0B(?=[a-zA-Z])/g, '\\v')
    .replace(/\t(?=[a-z]{2,})/g, '\\t')
    .replace(/\r(?=[a-zA-Z])/g, '\\r')
    .replace(/\r\n?/g, '\n');
  // Inside $…$ a newline followed by a LaTeX command name was originally "\n…" (\neq, \nabla, \nu, \not …).
  s = s.replace(/\$[^$]+\$/g, (m) => m.replace(/\n(?=(?:eq|abla|u|ot|eg|ewline|i|e|mid|parallel)(?![a-z]))/g, '\\n'));
  s = s.replace(/\^circ\b/g, '^\\circ');
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u2060\uFEFF]/g, '');
  if (!/\$|\\\(|\\\[/.test(s)) s = s.replace(/\\n(?=[\sA-Z0-9\-*•#(]|$)/g, '\n');
  if (HTML_FORMATTING.test(s) && !/`[^`]*</.test(s)) {
    s = s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(?:b|strong)>/gi, '**')
      .replace(/<\/?(?:i|em)>/gi, '*')
      .replace(/<sup>(.*?)<\/sup>/gi, '^$1')
      .replace(/<sub>(.*?)<\/sub>/gi, '_$1')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/?(?:p|div|h[1-6]|ul|ol)[^>]*>/gi, '\n')
      .replace(/<\/?(?:span|u|li|font|small|mark)\b[^>]*>/gi, '')
      .replace(/&nbsp;/g, ' ');
  }
  const fenced = /^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n?```$/i.exec(s.trim());
  if (fenced) s = fenced[1];
  if (((s.match(/\*\*/g) ?? []).length) % 2 === 1) s = s.replace(/\*\*(?![\s\S]*\*\*)/, '');
  return noEmDash(s)
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Coerces a model-output value to clean text. */
export function str(v: unknown, max = 4000): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v);
  return cleanText(s).slice(0, max);
}

/** Coerces user input to text without output cleaning (pasted material may legitimately contain tabs, HTML, etc.). */
export function raw(v: unknown, max = 4000): string {
  if (v === null || v === undefined) return '';
  return (typeof v === 'string' ? v : String(v)).trim().slice(0, max);
}

export function arr<T = any>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v === null || v === undefined || v === '') return [];
  return [v as T];
}

/** List items are rendered with their own bullets/numbers, so leading markers are removed. */
export function listItem(s: string) {
  return s.replace(/^(?:[-*•●▪◦–]\s+|\d{1,2}[.)]\s+|\(?[a-hA-H]\)\s+)/, '').trim();
}

export function strArr(v: unknown, maxItems = 20, maxLen = 600): string[] {
  return arr(v)
    .map((x) => listItem(typeof x === 'object' && x !== null ? str(Object.values(x).join(': '), maxLen) : str(x, maxLen)))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function required(input: any, field: string, label = field): string {
  const v = raw(input?.[field], 20000);
  if (!v) throw new AiError(`Please provide ${label}.`, 400);
  return v;
}

export function bloom(v: unknown): Bloom {
  const s = str(v, 40).toLowerCase();
  if (s.startsWith('rem') || s.startsWith('know')) return 'Remember';
  if (s.startsWith('und') || s.startsWith('compr')) return 'Understand';
  if (s.startsWith('app')) return 'Apply';
  if (s.startsWith('ana')) return 'Analyze';
  if (s.startsWith('eva')) return 'Evaluate';
  if (s.startsWith('cre') || s.startsWith('synth')) return 'Create';
  return 'Understand';
}

export function bloomDistribution(levels: Bloom[]) {
  const dist: Record<Bloom, number> = { Remember: 0, Understand: 0, Apply: 0, Analyze: 0, Evaluate: 0, Create: 0 };
  for (const l of levels) dist[l]++;
  const total = levels.length || 1;
  const lower = dist.Remember + dist.Understand + dist.Apply;
  return {
    distribution: dist,
    lower_order_pct: Math.round((lower / total) * 100),
    higher_order_pct: Math.round(((levels.length - lower) / total) * 100),
  };
}

export function language(v: unknown): 'English' | 'Bangla' | 'Bilingual' {
  const s = str(v, 20).toLowerCase();
  if (s.startsWith('ban') || s.startsWith('ben')) return 'Bangla';
  if (s.startsWith('bil')) return 'Bilingual';
  return 'English';
}

export function langLine(v: unknown): string {
  const l = language(v);
  if (l === 'Bangla') return 'Write ALL human-readable text values in Bangla (Bengali script). Keep JSON keys in English.';
  if (l === 'Bilingual')
    return 'Write human-readable text in English followed by a Bangla (Bengali script) translation in parentheses. Keep JSON keys in English.';
  return 'Write in clear, natural English.';
}

export function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  const s = str(v, 60).toLowerCase();
  return options.find((o) => o.toLowerCase() === s) ?? fallback;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function ctxLine(parts: Record<string, unknown>): string {
  return Object.entries(parts)
    .map(([k, v]) => [k, str(v, 600)] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
}

export function makeId(prefix: string, i: number) {
  return `${prefix}${i + 1}`;
}

export function shortTitle(s: string, max = 80) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t || 'Untitled';
}
