import { runTool } from './ai';
import { supabase } from './supabase';
import type { Material } from './types';

const FIELDS = 'id, title, kind, char_count, chunk_count, embedded_count, created_at';

/** Roughly how much text is read in full (CAG); longer text is searched and the relevant passages are used (RAG). */
export const FULL_TEXT_CHARS = 9000;

export async function listMaterials(): Promise<Material[]> {
  const { data, error } = await supabase.from('materials').select(FIELDS).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Material[];
}

/**
 * Saves material, then builds its semantic index in small batches (the server has a per-request CPU limit).
 * If indexing fails the material is still saved and usable through keyword search; `indexError` says why.
 */
export async function saveMaterial(
  input: { title: string; kind: 'pdf' | 'text'; content: string },
  onProgress?: (m: Material) => void,
): Promise<Material & { duplicate?: boolean; indexError?: string }> {
  const { output } = await runTool<Material & { duplicate: boolean }>('material-create', input, { save: false });
  let latest: Material = output;
  const track = (m: Material) => {
    latest = m;
    onProgress?.(m);
  };
  track(output);
  try {
    return { ...(await resumeIndexing(output, track)), duplicate: output.duplicate };
  } catch (e) {
    return { ...latest, duplicate: output.duplicate, indexError: (e as Error).message };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function embedStep(id: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      const { output } = await runTool<{ embedded_count: number; done: boolean }>('material-embed', { id }, { save: false });
      return output;
    } catch (e) {
      if (attempt >= 2) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
}

/** Embeds any chunks not yet indexed (also resumes an upload that was interrupted). */
export async function resumeIndexing(m: Material, onProgress?: (m: Material) => void): Promise<Material> {
  let cur = m;
  for (let guard = 0; cur.embedded_count < cur.chunk_count && guard < 200; guard++) {
    const step = await embedStep(cur.id);
    cur = { ...cur, embedded_count: step.embedded_count };
    onProgress?.(cur);
    if (step.done) break;
  }
  return cur;
}

export async function deleteMaterial(id: string) {
  const { error } = await supabase.from('materials').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
