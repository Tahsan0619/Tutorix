import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface AiResponse<O> {
  output: O;
  generation_id: string | null;
  model: string;
  latency_ms: number;
  /** Served from the response cache (an identical earlier request). */
  cached?: boolean;
}

export async function runTool<O = any>(
  tool: string,
  input: unknown,
  opts: { save?: boolean; fresh?: boolean } = {},
): Promise<AiResponse<O>> {
  const { data, error } = await supabase.functions.invoke('ai', {
    body: { tool, input, save: opts.save ?? true, fresh: opts.fresh ?? false },
  });
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body?.error) message = body.error;
      } catch {
        /* keep default message */
      }
    }
    if (/Failed to send a request/i.test(message)) message = 'Could not reach the AI service. Check your internet connection.';
    throw new Error(message);
  }
  return data as AiResponse<O>;
}
