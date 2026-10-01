const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Groq counts prompt + max_completion_tokens against the per-minute token quota,
// so every request is budgeted to stay under this ceiling.
const TOKEN_CEILING = 7900;

export interface ChatOptions {
  model: string;
  fallbacks?: string[];
  temperature?: number;
  maxTokens?: number;
  reasoning?: 'low' | 'medium' | 'high';
  json?: boolean;
  /** Stable leading block of the system prompt (reference material), kept first for prompt-cache hits. */
  prefix?: string;
}

export interface ChatResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export class AiError extends Error {
  status: number;
  retryable: boolean;
  /** The failure is specific to the API key (rate limit / invalid key), so another key may succeed. */
  keyIssue: boolean;
  constructor(message: string, status = 502, retryable = false, keyIssue = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.keyIssue = keyIssue;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Bengali script tokenizes far denser than Latin text, so it is counted separately. */
export const estimateTokens = (text: string) => {
  const bangla = text.match(/[\u0980-\u09FF]/g)?.length ?? 0;
  return Math.ceil((text.length - bangla) / 3.2 + bangla / 2.2);
};

/** Primary key first, then GROQ_API_KEY_2, GROQ_API_KEY_3 … as fallbacks. */
function apiKeys(): string[] {
  const keys = [Deno.env.get('GROQ_API_KEY')];
  for (let i = 2; i <= 5; i++) keys.push(Deno.env.get(`GROQ_API_KEY_${i}`));
  return [...new Set(keys.map((k) => k?.trim()).filter((k): k is string => !!k))];
}

// Groq limits are per key and per model; remember which pairs are cooling down within this isolate.
const cooldown = new Map<string, number>();
const coolKey = (key: string, model: string) => `${key.slice(-8)}:${model}`;

function keysFor(model: string) {
  const now = Date.now();
  const keys = apiKeys();
  const ready = keys.filter((k) => (cooldown.get(coolKey(k, model)) ?? 0) <= now);
  const cooling = keys.filter((k) => !ready.includes(k));
  return [...ready, ...cooling];
}

async function callModel(model: string, key: string, system: string, user: string, opts: ChatOptions, canSwitchKey: boolean): Promise<ChatResult> {

  const promptEst = estimateTokens(system) + estimateTokens(user) + 40;
  if (promptEst > TOKEN_CEILING - 900) {
    throw new AiError('The input is too long for the AI engine. Please shorten the text and try again.', 413);
  }
  const maxTokens = Math.max(900, Math.min(opts.maxTokens ?? 4000, TOKEN_CEILING - promptEst));

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.6,
    max_completion_tokens: maxTokens,
  };
  if (opts.json) payload.response_format = { type: 'json_object' };
  if (model.startsWith('openai/gpt-oss')) {
    payload.reasoning_effort = opts.reasoning ?? 'low';
    payload.include_reasoning = false;
  } else if (model.startsWith('qwen/')) {
    payload.reasoning_format = 'hidden';
  }

  let lastError = 'The AI engine did not respond.';
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      lastError = `Network error contacting the AI engine: ${(e as Error).message}`;
      await sleep(700 * (attempt + 1));
      continue;
    }

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON error body */
    }

    if (res.ok) {
      const choice = data?.choices?.[0];
      const content = choice?.message?.content?.trim() ?? '';
      if (!content) {
        lastError = 'The AI returned an empty response.';
        continue;
      }
      if (choice?.finish_reason === 'length' && opts.json) {
        // Truncated JSON is useless; let the caller try another model.
        throw new AiError('The AI response was cut off.', 502, true);
      }
      return {
        content,
        model: data.model ?? model,
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      };
    }

    const message: string = data?.error?.message ?? `AI engine error (HTTP ${res.status})`;
    lastError = message;

    if (res.status === 429 || res.status === 413 || /rate limit|too large/i.test(message)) {
      const m = /try again in (?:(\d+)m)?([0-9.]+)(ms|s)/i.exec(message);
      const wait = m
        ? (Number(m[1] ?? 0) * 60000) + (m[3] === 'ms' ? Number(m[2]) : Number(m[2]) * 1000)
        : 5000;
      const daily = /per day|TPD|RPD/i.test(message);
      if (res.status === 429) cooldown.set(coolKey(key, model), Date.now() + (daily ? 30 * 60000 : Math.max(wait, 3000)));
      if (canSwitchKey && res.status === 429) {
        throw new AiError('The AI engine is busy right now. Please try again in a minute.', 429, true, true);
      }
      if (attempt === 0 && wait <= 7000 && !daily) {
        await sleep(wait + 250);
        continue;
      }
      throw new AiError('The AI engine is busy right now. Please try again in a minute.', 429, true, true);
    }
    if (res.status === 401 || res.status === 403) {
      cooldown.set(coolKey(key, model), Date.now() + 10 * 60000);
      throw new AiError('The AI engine rejected its API key. Please contact the administrator.', 500, true, true);
    }
    if (res.status >= 500) {
      await sleep(900 * (attempt + 1));
      continue;
    }
    if (res.status === 400 && /json/i.test(message) && payload.response_format) {
      delete payload.response_format;
      messages[1].content += '\n\nReply with ONE valid JSON object only. No markdown fences, no commentary.';
      continue;
    }
    if (res.status === 404 || (res.status === 400 && /model/i.test(message))) {
      throw new AiError(message, 502, true);
    }
    throw new AiError(message, 502);
  }
  throw new AiError(lastError, 502, true);
}

export async function groqChat(system: string, user: string, opts: ChatOptions): Promise<ChatResult> {
  if (!apiKeys().length) throw new AiError('The AI engine is not configured (missing GROQ_API_KEY secret).', 500);
  const models = [opts.model, ...(opts.fallbacks ?? []).filter((m) => m && m !== opts.model)];
  let lastErr: unknown = null;
  for (const model of models) {
    const keys = keysFor(model);
    for (let i = 0; i < keys.length; i++) {
      try {
        return await callModel(model, keys[i], system, user, opts, i < keys.length - 1);
      } catch (e) {
        lastErr = e;
        if (!(e instanceof AiError) || !e.retryable) throw e;
        if (!e.keyIssue) break;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new AiError('The AI engine did not respond.');
}

export function parseJson(raw: string): any {
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  let v = tryParse(raw);
  if (v !== undefined) return v;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenced) {
    v = tryParse(fenced[1].trim());
    if (v !== undefined) return v;
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    v = tryParse(raw.slice(start, end + 1));
    if (v !== undefined) return v;
  }
  return undefined;
}

export async function groqJson(system: string, user: string, opts: ChatOptions) {
  const sys = (opts.prefix ? `${opts.prefix}\n\n` : '') +
    `${/json/i.test(system) ? system : `${system} Always respond with a single valid JSON object.`}\n` +
    'FORMATTING RULES for every string value: use plain text or simple Markdown only (**bold**, *italic*, "- " lists, tables), never HTML tags. ' +
    'Never use em dashes; use commas, colons, parentheses or separate sentences instead. ' +
    'Items of JSON arrays must NOT start with bullet characters or numbering. ' +
    'Write math as LaTeX inside $...$ and escape every LaTeX backslash for JSON (write "\\\\frac{a}{b}", "\\\\times", "90^{\\\\circ}"). ' +
    'Do not wrap values in code fences.';
  let promptTokens = 0;
  let completionTokens = 0;
  const backup = (opts.fallbacks ?? []).find((m) => m && m !== opts.model);
  const attempts = backup ? 3 : 2;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const r = await groqChat(sys, user, {
      ...opts,
      ...(attempt === 2 && backup ? { model: backup, fallbacks: [opts.model] } : {}),
      json: true,
      temperature: attempt === 0 ? opts.temperature : Math.min(0.3, opts.temperature ?? 0.3),
    });
    promptTokens += r.promptTokens;
    completionTokens += r.completionTokens;
    const data = parseJson(r.content);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return { data, model: r.model, promptTokens, completionTokens };
    }
  }
  throw new AiError('The AI returned malformed output. Please try again.');
}
