// End-to-end test of RAG (retrieval over saved / long material), CAG (whole material preloaded)
// and the response cache, against the deployed Edge Function.
// Usage: node scripts/test-rag.mjs
const URL = 'https://gkdvlkkxzdcagxduzeay.supabase.co';
const KEY = 'sb_publishable_fcoAwMKrtNLkpg5gM_cxtw_m8cCdyX4';

async function signIn(email, password) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`sign-in ${email}: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function ai(token, tool, input, extra = {}) {
  const started = Date.now();
  const res = await fetch(`${URL}/functions/v1/ai`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, input, save: false, ...extra }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, ms: Date.now() - started };
}

async function wiki(lang, title, max) {
  const q = new URLSearchParams({ action: 'query', prop: 'extracts', explaintext: '1', titles: title, format: 'json', redirects: '1' });
  const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${q}`, { headers: { 'User-Agent': 'Tutorix-test/1.0' } });
  const data = await res.json();
  const page = Object.values(data.query.pages)[0];
  return (page.extract || '').slice(0, max);
}

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failed++;
}

async function saveMaterial(token, title, content, created) {
  const c = await ai(token, 'material-create', { title, kind: 'text', content });
  if (c.status !== 200) throw new Error(`material-create ${c.status}: ${JSON.stringify(c.body)}`);
  const m = c.body.output;
  created.push(m.id);
  let done = m.embedded_count >= m.chunk_count;
  let calls = 0;
  let retries = 0;
  while (!done && calls < 80) {
    const e = await ai(token, 'material-embed', { id: m.id });
    calls++;
    if (e.status !== 200) {
      if (++retries > 4) throw new Error(`material-embed ${e.status}: ${JSON.stringify(e.body)}`);
      console.log(`  retrying embed after ${e.status}: ${e.body.error}`);
      await new Promise((r) => setTimeout(r, 1500 * retries));
      continue;
    }
    done = e.body.output.done;
  }
  return { ...m, embedCalls: calls, retries, done };
}

async function removeMaterial(token, id) {
  await fetch(`${URL}/rest/v1/materials?id=eq.${id}`, {
    method: 'DELETE',
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  });
}

const token = await signIn('student@gmail.com', 'Student@123');
const created = [];

// Leftovers from an interrupted earlier run would make the duplicate check succeed for the wrong reason.
await fetch(`${URL}/rest/v1/materials?title=like.Wikipedia*`, { method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${token}` } });

try {
  // --- Saved material, long English: RAG with hybrid (BM25 + vector) retrieval ---
  const english = [
    '# Sundarbans\n' + (await wiki('en', 'Sundarbans', 16000)),
    '# Photosynthesis\n' + (await wiki('en', 'Photosynthesis', 16000)),
  ].join('\n\n');
  const m1 = await saveMaterial(token, 'Wikipedia: Sundarbans + Photosynthesis', english, created);
  check('material-create chunks long English text', m1.chunk_count > 15, `${m1.chunk_count} chunks, ${m1.char_count} chars`);
  check('material-embed completes in batches', m1.done, `${m1.embedCalls} calls, ${m1.retries} retries`);

  const dup = await ai(token, 'material-create', { title: 'again', kind: 'text', content: english });
  check('duplicate upload is detected', dup.body.output?.duplicate === true && dup.body.output?.id === m1.id);

  const notes = await ai(token, 'smart-notes', { mode: 'revision', topic: 'Royal Bengal tigers and mangrove forest', subject: 'Geography', material_ids: [m1.id], language: 'English' });
  const g1 = notes.body.output?.grounding;
  const notesText = JSON.stringify(notes.body.output ?? {}).toLowerCase();
  check('smart-notes over saved material uses RAG', notes.status === 200 && g1?.mode === 'rag', `${notes.status} mode=${g1?.mode} used=${g1?.sources?.[0]?.used}/${g1?.sources?.[0]?.total} matched=${g1?.matched} ${notes.ms}ms`);
  check('RAG answer is on the retrieved topic', /tiger|mangrove/.test(notesText) && !/chlorophyll/.test(notesText));

  const quiz = await ai(token, 'practice-quiz', { topic: 'light reactions and chlorophyll', subject: 'Biology', count: 4, types: ['mcq'], material_ids: [m1.id] });
  const quizText = JSON.stringify(quiz.body.output ?? {}).toLowerCase();
  check('practice-quiz retrieves the other half of the material', quiz.status === 200 && quiz.body.output?.grounding?.mode === 'rag' && /chlorophyll|light/.test(quizText), `${quiz.status} ${quiz.ms}ms`);

  // --- Short pasted material: CAG (whole text preloaded, no retrieval) ---
  const short = (await wiki('en', 'Padma Bridge', 3500));
  const cards = await ai(token, 'flashcards', { topic: '', source_text: short, count: 6, style: 'qa' }, { fresh: true });
  const g2 = cards.body.output?.grounding;
  check('flashcards on short pasted text use CAG', cards.status === 200 && g2?.mode === 'cag' && g2?.sources?.[0]?.used === 'full', `${cards.status} mode=${g2?.mode} ${cards.ms}ms`);

  // --- Response cache: identical request is served from cache, fresh bypasses it ---
  const again = await ai(token, 'flashcards', { topic: '', source_text: short, count: 6, style: 'qa' });
  check('identical request is a cache hit', again.status === 200 && again.body.cached === true, `${again.ms}ms vs ${cards.ms}ms`);
  const fresh = await ai(token, 'flashcards', { topic: '', source_text: short, count: 6, style: 'qa' }, { fresh: true });
  check('fresh:true bypasses the cache', fresh.status === 200 && fresh.body.cached === false, `${fresh.ms}ms`);

  // --- Long pasted Bangla text: ephemeral RAG with lexical retrieval (no English-only embeddings) ---
  const bangla = [await wiki('bn', 'সুন্দরবন', 9000), await wiki('bn', 'বাংলাদেশের মুক্তিযুদ্ধ', 9000)].join('\n\n');
  const bq = await ai(token, 'mind-map', { topic: 'সুন্দরবনের বাঘ ও ম্যানগ্রোভ', source_text: bangla, depth: 2, language: 'Bangla' });
  const g3 = bq.body.output?.grounding;
  check('long pasted Bangla text uses RAG', bq.status === 200 && g3?.mode === 'rag', `${bq.status} mode=${g3?.mode} used=${g3?.sources?.[0]?.used}/${g3?.sources?.[0]?.total} matched=${g3?.matched} ${bq.ms}ms ${bq.body.error ?? ''}`);

  // --- Concept explainer + follow-up grounded in the saved material ---
  const ex = await ai(token, 'concept-explainer', { concept: 'Why are the Sundarbans mangroves salt tolerant?', level: 'school', material_ids: [m1.id] });
  check('concept-explainer grounded in saved material', ex.status === 200 && !!ex.body.output?.grounding, `${ex.status} mode=${ex.body.output?.grounding?.mode}`);
  const fu = await ai(token, 'explainer-followup', { concept: 'Sundarbans mangroves', summary: ex.body.output?.one_liner ?? '', question: 'Which rivers form the delta?', material_ids: [m1.id] });
  check('explainer-followup grounded in saved material', fu.status === 200 && !!fu.body.output?.answer && !!fu.body.output?.grounding, `${fu.status}`);

  // --- Access control: another user cannot use this material ---
  const teacher = await signIn('teacher@gmail.com', 'Teacher@123');
  const steal = await ai(teacher, 'question-worksheet', { topic: 'Sundarbans', count: 3, material_ids: [m1.id] });
  check("another user's material is refused", steal.status === 400, `${steal.status} ${steal.body.error ?? ''}`);
} finally {
  for (const id of created) await removeMaterial(token, id);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll RAG / CAG checks passed');
process.exit(failed ? 1 : 0);
