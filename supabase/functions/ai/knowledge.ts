import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { AiError, estimateTokens } from './groq.ts';
import type { Grounding } from './util.ts';

// Supabase Edge Runtime global (built-in gte-small embedding model).
declare const Supabase: { ai: { Session: new (model: string) => { run: (input: string, opts: Record<string, unknown>) => Promise<unknown> } } };

/**
 * Material that fits this many prompt tokens is preloaded whole (CAG); anything larger is searched
 * and only the best passages are sent (RAG). Groq counts prompt + completion against an ~8k per-request
 * budget on this plan, so the material share has to stay well below that.
 */
export const MATERIAL_TOKEN_BUDGET = 3000;
export const MAX_MATERIAL_CHARS = 400_000;
const CHUNK_CHARS = 1100;
const MAX_MATERIALS_PER_REQUEST = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ */
/* Text utilities                                                      */
/* ------------------------------------------------------------------ */

export function normalizeMaterial(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\uFEFF]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Paragraph-aware chunks of roughly CHUNK_CHARS; long paragraphs split on sentence ends (including the Bangla danda). */
export function chunkText(text: string, size = CHUNK_CHARS): string[] {
  const pieces: string[] = [];
  for (const para of text.split(/\n\s*\n/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length <= size) {
      pieces.push(p);
      continue;
    }
    let buf = '';
    for (const sentence of p.split(/(?<=[.!?।])\s+/)) {
      if (sentence.length > size) {
        if (buf) pieces.push(buf);
        buf = '';
        for (let i = 0; i < sentence.length; i += size) pieces.push(sentence.slice(i, i + size));
      } else if (buf.length + sentence.length + 1 > size) {
        pieces.push(buf);
        buf = sentence;
      } else {
        buf = buf ? `${buf} ${sentence}` : sentence;
      }
    }
    if (buf) pieces.push(buf);
  }
  const chunks: string[] = [];
  let cur = '';
  for (const piece of pieces) {
    if (cur && cur.length + piece.length + 2 > size) {
      chunks.push(cur);
      cur = piece;
    } else {
      cur = cur ? `${cur}\n\n${piece}` : piece;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

const STOPWORDS = new Set(
  ('a an and are as at be by for from has have how in is it its of on or that the this to was were what when where which who why will with ' +
    'about into than then them they their there these those can do does did not no yes you your we our i me my he she his her also more most ' +
    'এবং ও কি কী যে এই সেই করে করা হয় হয়ে থেকে জন্য না একটি এক তার তাদের আর বা কোন কোনো দিয়ে হতে হবে ছিল আছে').split(' '),
);

/** Unicode-aware tokenizer: keeps Bangla vowel signs attached to their words. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function isMostlyBangla(text: string): boolean {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (!letters) return false;
  const bangla = text.match(/[\u0980-\u09FF]/g)?.length ?? 0;
  return bangla / letters > 0.3;
}

/** Okapi BM25 scores of each document for the query. */
export function bm25(docs: string[], query: string, k1 = 1.2, b = 0.75): number[] {
  const q = [...new Set(tokenize(query))];
  if (!q.length || !docs.length) return docs.map(() => 0);
  const tokenized = docs.map(tokenize);
  const avg = tokenized.reduce((s, t) => s + t.length, 0) / tokenized.length || 1;
  const df = new Map<string, number>();
  for (const toks of tokenized) for (const t of new Set(toks)) if (q.includes(t)) df.set(t, (df.get(t) ?? 0) + 1);
  return tokenized.map((toks) => {
    const tf = new Map<string, number>();
    for (const t of toks) if (df.has(t)) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const [t, f] of tf) {
      const n = df.get(t)!;
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * toks.length) / avg)));
    }
    return score;
  });
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

let session: { run: (input: string, opts: Record<string, unknown>) => Promise<unknown> } | null = null;

/** 384-dim normalized embedding from the built-in gte-small model (English-only, 512-token window). */
export async function embed(text: string): Promise<number[]> {
  // A cold worker occasionally fails to load the model ("protobuf parsing failed"); a new session usually succeeds.
  for (let attempt = 0; ; attempt++) {
    try {
      session ??= new Supabase.ai.Session('gte-small');
      const out = await session.run(text.slice(0, 2000), { mean_pool: true, normalize: true });
      return Array.from(out as ArrayLike<number>);
    } catch (e) {
      session = null;
      if (attempt >= 1) throw new AiError(`The search index is warming up (${(e as Error).message}). Please try again.`, 503);
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

export function materialIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && UUID.test(x)))].slice(0, MAX_MATERIALS_PER_REQUEST);
}

/* ------------------------------------------------------------------ */
/* Grounding: CAG when the material fits, RAG when it does not          */
/* ------------------------------------------------------------------ */

interface Source {
  title: string;
  materialId?: string;
  full?: string;
  chunks?: { id?: number; idx: number; text: string }[];
  total: number;
}

interface Candidate {
  source: number;
  idx: number;
  id?: number;
  text: string;
  tokens: number;
}

function rrf(ranks: Map<number, number>[], k = 60): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of ranks) for (const [i, rank] of r) out.set(i, (out.get(i) ?? 0) + 1 / (k + rank));
  return out;
}

export async function buildGrounding(
  db: SupabaseClient,
  userId: string,
  opts: { pasted: string; materialIds: string[]; query: string },
): Promise<Grounding> {
  const query = opts.query.trim().slice(0, 500);
  const sources: Source[] = [];
  const pasted = normalizeMaterial(opts.pasted ?? '');
  if (pasted) sources.push({ title: 'Pasted material', full: pasted, total: 0 });

  let metas: { id: string; title: string; char_count: number; chunk_count: number; embedded_count: number }[] = [];
  if (opts.materialIds.length) {
    const { data } = await db
      .from('materials')
      .select('id, title, char_count, chunk_count, embedded_count')
      .eq('owner', userId)
      .in('id', opts.materialIds);
    metas = opts.materialIds.map((id) => (data ?? []).find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m);
    if (!metas.length) throw new AiError('The selected materials could not be found. They may have been deleted.', 400);
  }

  // Estimate the whole material first; full text is only fetched when it can be preloaded.
  const roughTokens = (pasted ? estimateTokens(pasted) : 0) + metas.reduce((s, m) => s + Math.ceil(m.char_count / 2.2), 0);
  const fitsWhole = roughTokens <= MATERIAL_TOKEN_BUDGET * 1.45;

  if (metas.length) {
    if (fitsWhole) {
      const { data } = await db.from('materials').select('id, content').eq('owner', userId).in('id', metas.map((m) => m.id));
      for (const m of metas) sources.push({ title: m.title, materialId: m.id, full: (data ?? []).find((d) => d.id === m.id)?.content ?? '', total: m.chunk_count });
    } else {
      const { data, error } = await db
        .from('material_chunks')
        .select('id, material_id, idx, content')
        .eq('owner', userId)
        .in('material_id', metas.map((m) => m.id))
        .order('idx')
        .limit(4000);
      if (error) throw new AiError('Could not read your materials. Please try again.', 500);
      for (const m of metas) {
        const chunks = (data ?? []).filter((c) => c.material_id === m.id).map((c) => ({ id: c.id as number, idx: c.idx as number, text: c.content as string }));
        sources.push({ title: m.title, materialId: m.id, chunks, total: chunks.length });
      }
    }
  }
  if (!sources.length) return { mode: 'none', text: '', sources: [], query };

  const fullTokens = sources.reduce((s, src) => s + (src.full !== undefined ? estimateTokens(src.full) : Infinity), 0);
  if (fullTokens <= MATERIAL_TOKEN_BUDGET) {
    const text = sources.map((s) => (sources.length > 1 ? `### ${s.title}\n${s.full}` : s.full!)).join('\n\n');
    return {
      mode: 'cag',
      text,
      sources: sources.map((s) => ({ title: s.title, used: 'full', total: s.total || chunkText(s.full!).length })),
      query,
    };
  }

  // RAG over every chunk of every source.
  const cands: Candidate[] = [];
  sources.forEach((s, si) => {
    const chunks: { id?: number; idx: number; text: string }[] = s.chunks ?? chunkText(s.full!).map((text, idx) => ({ idx, text }));
    s.total = chunks.length;
    for (const c of chunks) cands.push({ source: si, idx: c.idx, id: c.id, text: c.text, tokens: estimateTokens(c.text) + 12 });
  });

  const chosen = new Set<number>();
  let used = 0;
  const take = (i: number) => {
    if (chosen.has(i) || used + cands[i].tokens > MATERIAL_TOKEN_BUDGET) return false;
    chosen.add(i);
    used += cands[i].tokens;
    return true;
  };

  let matched: number[] = [];
  if (tokenize(query).length) {
    const scores = bm25(cands.map((c) => c.text), query);
    // Generic words in the query ("facts", "examples") touch almost every chunk; keep only clearly relevant hits.
    const cutoff = Math.max(...scores, 0) * 0.3;
    const lexical = scores
      .map((score, i) => ({ score, i }))
      .filter((x) => x.score > 0 && x.score >= cutoff)
      .sort((a, b) => b.score - a.score);
    const lexRank = new Map(lexical.map((x, r) => [x.i, r + 1]));

    const semRank = new Map<number, number>();
    const embeddedIds = metas.filter((m) => m.embedded_count > 0).map((m) => m.id);
    if (embeddedIds.length && !isMostlyBangla(query)) {
      try {
        const qv = await embed(query);
        const { data } = await db.rpc('match_material_chunks', {
          p_owner: userId, p_material_ids: embeddedIds, p_embedding: JSON.stringify(qv), p_count: 40,
        });
        const byId = new Map(cands.map((c, i) => [c.id, i]));
        // gte-small scores most same-language text above 0.7, so relevance is judged relative to the best hit.
        const top = data?.[0]?.similarity ?? 0;
        (data ?? [])
          .filter((r: { similarity: number }) => r.similarity >= Math.max(0.75, top - 0.06))
          .slice(0, 15)
          .forEach((r: { id: number }, rank: number) => {
            const i = byId.get(r.id);
            if (i !== undefined) semRank.set(i, rank + 1);
          });
      } catch (e) {
        console.error('semantic search failed', (e as Error).message);
      }
    }
    matched = [...rrf([lexRank, semRank])].sort((a, b) => b[1] - a[1]).map(([i]) => i);
    for (const i of matched) take(i);
    // Neighbouring passages keep retrieved text coherent.
    for (const i of matched) {
      for (const j of [i - 1, i + 1]) if (cands[j] && cands[j].source === cands[i].source) take(j);
    }
  }

  // No query or too few matches: sample evenly across the material so the whole chapter is represented.
  if (used < MATERIAL_TOKEN_BUDGET * 0.6) {
    const avg = cands.reduce((s, c) => s + c.tokens, 0) / cands.length;
    const slots = Math.max(1, Math.floor((MATERIAL_TOKEN_BUDGET - used) / avg));
    const step = cands.length / slots;
    for (let k = 0; k < slots; k++) take(Math.min(cands.length - 1, Math.floor(k * step)));
  }

  const picked = [...chosen].sort((a, b) => cands[a].source - cands[b].source || cands[a].idx - cands[b].idx);
  const blocks: string[] = [];
  sources.forEach((s, si) => {
    const mine = picked.filter((i) => cands[i].source === si);
    if (!mine.length) return;
    const parts: string[] = [];
    mine.forEach((i, n) => {
      if (n > 0 && cands[i].idx !== cands[mine[n - 1]].idx + 1) parts.push('[...]');
      parts.push(cands[i].text);
    });
    blocks.push(`### ${s.title} (${mine.length} of ${s.total} passages)\n${parts.join('\n\n')}`);
  });

  return {
    mode: 'rag',
    text: blocks.join('\n\n'),
    sources: sources.map((s, si) => ({ title: s.title, used: picked.filter((i) => cands[i].source === si).length, total: s.total })),
    query,
    matched: matched.length,
  };
}

/* ------------------------------------------------------------------ */
/* Saved materials                                                     */
/* ------------------------------------------------------------------ */

const MATERIAL_FIELDS = 'id, title, kind, char_count, chunk_count, embedded_count, created_at';

export async function createMaterial(db: SupabaseClient, userId: string, input: { title: string; kind: string; content: string }) {
  const content = normalizeMaterial(input.content);
  if (content.length < 200) throw new AiError('The material is too short to save. Add at least a few paragraphs.', 400);
  if (content.length > MAX_MATERIAL_CHARS) {
    throw new AiError(`The material is too long (max ${MAX_MATERIAL_CHARS.toLocaleString()} characters). Split it into chapters.`, 400);
  }
  const hash = await sha256(content);
  const { data: existing } = await db
    .from('materials')
    .select(MATERIAL_FIELDS)
    .eq('owner', userId)
    .eq('content_hash', hash)
    .maybeSingle();
  if (existing) return { ...existing, duplicate: true };

  const chunks = chunkText(content);
  const title = input.title.trim().slice(0, 200) || content.slice(0, 60);
  const { data: m, error } = await db
    .from('materials')
    .insert({ owner: userId, title, kind: input.kind === 'pdf' ? 'pdf' : 'text', content, content_hash: hash, char_count: content.length, chunk_count: chunks.length })
    .select(MATERIAL_FIELDS)
    .single();
  if (error || !m) throw new AiError('Could not save the material. Please try again.', 500);
  for (let i = 0; i < chunks.length; i += 200) {
    const rows = chunks.slice(i, i + 200).map((text, j) => ({ material_id: m.id, owner: userId, idx: i + j, content: text }));
    const { error: chunkErr } = await db.from('material_chunks').insert(rows);
    if (chunkErr) {
      await db.from('materials').delete().eq('id', m.id);
      throw new AiError('Could not index the material. Please try again.', 500);
    }
  }
  return { ...m, duplicate: false };
}

/**
 * Embeds the next batch of chunks. The edge runtime caps CPU time per request, so the client calls this
 * repeatedly until done. Mostly-Bangla chunks are skipped (gte-small is English-only); keyword search covers them.
 */
export async function embedMaterialBatch(db: SupabaseClient, userId: string, id: string, batch = 6) {
  if (!UUID.test(id)) throw new AiError('Invalid material id.', 400);
  const { data: m } = await db.from('materials').select('id, chunk_count, embedded_count').eq('owner', userId).eq('id', id).maybeSingle();
  if (!m) throw new AiError('Material not found.', 404);
  if (m.embedded_count >= m.chunk_count) return { embedded_count: m.embedded_count, chunk_count: m.chunk_count, done: true };

  const { data: rows } = await db
    .from('material_chunks')
    .select('id, idx, content')
    .eq('material_id', id)
    .gte('idx', m.embedded_count)
    .order('idx')
    .limit(batch);
  for (const row of rows ?? []) {
    if (isMostlyBangla(row.content)) continue;
    try {
      const vector = await embed(row.content);
      await db.from('material_chunks').update({ embedding: JSON.stringify(vector) }).eq('id', row.id);
    } catch (e) {
      if (row.idx > m.embedded_count) await db.from('materials').update({ embedded_count: row.idx }).eq('id', id);
      throw e;
    }
  }
  const embedded = Math.min(m.chunk_count, m.embedded_count + (rows?.length || batch));
  await db.from('materials').update({ embedded_count: embedded }).eq('id', id);
  return { embedded_count: embedded, chunk_count: m.chunk_count, done: embedded >= m.chunk_count };
}
