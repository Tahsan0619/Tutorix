// End-to-end test of every Tutorix AI tool against the deployed Edge Function.
// Usage: node scripts/test-ai.mjs [tool-id ...]
import { mkdirSync, writeFileSync } from 'node:fs';

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

async function callAi(token, tool, input, save = true) {
  const started = Date.now();
  const res = await fetch(`${URL}/functions/v1/ai`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, input, save, fresh: true }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, ms: Date.now() - started };
}

const PAPER = `1. What is the SI unit of force? (1 mark)
a) Joule b) Newton c) Watt d) Pascal
2. State Newton's second law of motion. (2 marks)
3. A 5 kg box is pushed with a net force of 20 N. Calculate its acceleration. (3 marks)
4. Explain why passengers lurch forward when a bus stops suddenly. (4 marks)`;

const teacherCases = {
  'blooms-analyzer': [
    { mode: 'single', question: 'Compare the causes of the First and Second World Wars and justify which was more avoidable.', subject: 'History', grade: 'Class 10' },
    (o) => o.level && o.improvements?.length,
  ],
  'blooms-analyzer#bulk': [
    { mode: 'bulk', subject: 'Biology', grade: 'Class 9', text: '1. Define photosynthesis.\n2. Explain the role of chlorophyll.\n3. Calculate the rate of oxygen production from the data.\n4. Design an experiment to test the effect of light intensity on photosynthesis.\n5. Evaluate whether plants could survive on Mars.\n6. List the raw materials of photosynthesis.' },
    (o) => o.items?.length === 6 && o.distribution && o.summary,
  ],
  'lesson-plan': [
    { subject: 'Physics', grade: 'Class 8', topic: "Newton's laws of motion", subtopic: 'Inertia', duration: '45 minutes', approach: '5E inquiry', language: 'English' },
    (o) => o.flow?.length >= 4 && o.objectives?.length >= 3,
  ],
  rubric: [
    { assignment: 'Persuasive essay on reducing plastic use', subject: 'English', grade: 'Class 9', type: 'analytic', levels: 4, total_points: 20, criteria_count: 4 },
    (o) => o.criteria?.length >= 3 && o.criteria.reduce((s, c) => s + c.weight, 0) === 20 && o.levels.length === 4,
  ],
  'question-worksheet': [
    { mode: 'worksheet', subject: 'Mathematics', grade: 'Class 7', topic: 'Fractions', count: 8, types: ['mcq', 'fillblank', 'short', 'truefalse'], bloom_levels: ['Remember', 'Apply', 'Analyze'], difficulty: 'mixed' },
    (o) => o.questions?.length >= 6 && o.total_marks > 0,
  ],
  'test-quality': [
    { test_title: 'Forces quiz', subject: 'Physics', grade: 'Class 8', test_text: PAPER + '\n5. Which is not a force? a) Gravity b) Friction c) Mass d) Tension (Answer: c)\n6. Newton is not the unit of all of the following except: a) force b) energy c) power d) none of the above' },
    (o) => typeof o.overall_score === 'number' && o.items?.length >= 4 && o.dimensions?.length >= 5,
  ],
  'answer-key': [
    { paper_text: PAPER, subject: 'Physics', grade: 'Class 8', detail: 'detailed' },
    (o) => o.answers?.length === 4 && o.total_marks === 10,
  ],
  differentiated: [
    { topic: 'The water cycle', subject: 'Science', grade: 'Class 5', objective: 'Explain the stages of the water cycle', include_ell: true },
    (o) => o.tiers?.length === 3 && o.tiers.every((t) => t.content),
  ],
  'learning-objectives': [
    { subject: 'Chemistry', grade: 'Class 9', topic: 'Acids and bases', count: 5, timeframe: '2 weeks' },
    (o) => o.objectives?.length >= 4 && o.objectives[0].smart?.measurable,
  ],
  'report-comments': [
    { subject: 'Mathematics', grade: 'Class 6', term: 'Term 1', tone: 'encouraging', length: 'short', students: [
      { name: 'Ayesha Rahman', scores: '92/100', strengths: 'problem solving', improvements: 'showing working' },
      { name: 'Tanvir Hasan', scores: '58/100', strengths: 'participation', improvements: 'fractions, homework completion' },
    ] },
    (o) => o.comments?.length === 2 && o.comments.every((c) => c.comment.length > 40),
  ],
  'term-planner': [
    { subject: 'Biology', grade: 'Class 9', start_date: '2027-01-03', end_date: '2027-03-25', classes_per_week: 4, minutes_per_class: 40,
      syllabus: 'Cell structure\nCell division\nTissues\nNutrition in plants\nHuman digestion\nRespiration\nTransport in plants',
      holidays: '2027-02-21 International Mother Language Day\n2027-03-08 to 2027-03-12 Mid-term break', assessments: 'Class test every 3 weeks, mid-term' },
    (o) => o.weeks?.length >= 10 && o.weeks.filter((w) => !w.is_break && w.topics.length).length >= 6,
  ],
};

const studentCases = {
  'smart-notes': [
    { mode: 'notes', topic: 'Photosynthesis', subject: 'Biology', level: 'Class 9', style: 'cornell' },
    (o) => o.sections?.length >= 3 && o.sections[0].cue !== undefined,
  ],
  'smart-notes#revision': [
    { mode: 'revision', topic: 'Kinematics equations of motion', subject: 'Physics', level: 'HSC' },
    (o) => o.formulas?.length >= 2,
  ],
  todo: [
    { goal: 'Prepare for my physics final exam', deadline: '2026-10-20', hours_per_day: 3 },
    (o) => o.phases?.length >= 2 && o.phases[0].tasks[0].id,
  ],
  'study-planner': [
    { subjects: [{ name: 'Physics', exam_date: '2026-10-12', difficulty: 4, confidence: 2 }, { name: 'English', exam_date: '2026-10-15', difficulty: 2, confidence: 4 }],
      start_date: '2026-10-01', days: 5, weekday_hours: 3, weekend_hours: 5, preferred_time: 'evening' },
    (o) => o.days?.length === 5 && o.days.filter((d) => d.sessions.length).length >= 4,
  ],
  flashcards: [
    { topic: 'World War II key events', count: 8, style: 'mixed' },
    (o) => o.cards?.length >= 6,
  ],
  'practice-quiz': [
    { subject: 'Chemistry', topic: 'Periodic table', count: 6, types: ['mcq', 'truefalse', 'short'] },
    (o) => o.questions?.length >= 5 && o.questions.every((q) => q.type !== 'mcq' || q.options.includes(q.answer)),
  ],
  'mind-map': [
    { topic: 'Renewable energy', depth: 3 },
    (o) => o.children?.length >= 3 && o.children[0].children?.length >= 1,
  ],
  'concept-explainer': [
    { concept: 'Why does ice float on water?', level: 'school', subject: 'Science' },
    (o) => o.explanation && o.analogy && o.check_questions?.length,
  ],
  'problem-solver': [
    { problem: 'A car accelerates uniformly from rest to 20 m/s in 8 s. Find its acceleration and the distance travelled.', subject: 'Physics', level: 'Class 9' },
    (o) => o.steps?.length >= 2 && /2\.5/.test(o.final_answer) && /80/.test(o.final_answer),
  ],
  mnemonics: [
    { content: 'The planets in order: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune', types: ['acronym', 'sentence', 'story'] },
    (o) => o.mnemonics?.length >= 2,
  ],
  vocabulary: [
    { mode: 'words', words: 'resilient, ubiquitous, অধ্যবসায়', level: 'intermediate' },
    (o) => o.words?.length === 3 && o.words.every((w) => w.bangla && w.examples.length),
  ],
  'quiz-grade': [
    { items: [
      { prompt: 'What does chlorophyll do?', answer: 'Absorbs light energy for photosynthesis', response: 'it traps sunlight so the plant can make food', marks: 2 },
      { prompt: 'Name the gas released in photosynthesis.', answer: 'Oxygen', response: 'carbon dioxide', marks: 2 },
    ] },
    (o) => o.results?.length === 2 && o.results[0].awarded > o.results[1].awarded,
  ],
  'weak-topics': [
    { stats: [
      { topic: 'Chemistry', subtopic: 'Periodic trends', correct: 1, total: 5, accuracy: 20 },
      { topic: 'Chemistry', subtopic: 'Atomic structure', correct: 4, total: 5, accuracy: 80 },
    ], recent_mistakes: [{ subtopic: 'Periodic trends', prompt: 'Which has larger atomic radius, Na or Cl?', response: 'Cl', answer: 'Na' }] },
    (o) => o.weak_topics?.length >= 1 && o.next_steps?.length,
  ],
  'explainer-followup': [
    { concept: 'Why ice floats', summary: 'Ice is less dense than water because hydrogen bonds form an open lattice.', question: 'Does this happen with other liquids too?' },
    (o) => o.answer?.length > 40,
  ],
};

const only = process.argv.slice(2);
mkdirSync('scripts/test-output', { recursive: true });

const teacherToken = await signIn('teacher@tutorix.test', 'Teacher@123');
const studentToken = await signIn('student@tutorix.test', 'Student@123');
const adminToken = await signIn('admin@tutorix.test', 'Admin@123');

const results = [];
async function runCases(cases, token) {
  for (const [key, [input, check]] of Object.entries(cases)) {
    if (only.length && !only.some((o) => key.startsWith(o))) continue;
    const tool = key.split('#')[0];
    const r = await callAi(token, tool, input);
    let ok = r.status === 200;
    let reason = ok ? '' : r.body?.error;
    if (ok) {
      try {
        ok = !!check(r.body.output);
        if (!ok) reason = 'shape check failed';
      } catch (e) {
        ok = false;
        reason = `check threw: ${e.message}`;
      }
    }
    writeFileSync(`scripts/test-output/${key.replace('#', '_')}.json`, JSON.stringify(r.body, null, 2));
    results.push({ key, ok, status: r.status, ms: r.ms, model: r.body?.model, saved: !!r.body?.generation_id, reason });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${key.padEnd(24)} ${String(r.status).padEnd(4)} ${String(r.ms).padStart(6)}ms  ${r.body?.model ?? ''} ${reason ?? ''}`);
  }
}

// Permission checks
if (!only.length || only.includes('security')) {
  const denied = await callAi(studentToken, 'lesson-plan', { topic: 'x' });
  console.log(`${denied.status === 403 ? 'PASS' : 'FAIL'}  student blocked from teacher tool (${denied.status})`);
  const denied2 = await callAi(teacherToken, 'flashcards', { topic: 'x' });
  console.log(`${denied2.status === 403 ? 'PASS' : 'FAIL'}  teacher blocked from student tool (${denied2.status})`);
  const anon = await callAi('', 'flashcards', { topic: 'x' });
  console.log(`${anon.status === 401 ? 'PASS' : 'FAIL'}  anonymous request rejected (${anon.status})`);
  const health = await callAi(adminToken, 'ai-test', {});
  console.log(`${health.status === 200 ? 'PASS' : 'FAIL'}  admin AI health check (${health.status}) ${JSON.stringify(health.body)}`);
  const models = await callAi(adminToken, 'ai-models', {});
  const modelList = models.body?.output?.models ?? [];
  console.log(`${models.status === 200 && modelList.length ? 'PASS' : 'FAIL'}  admin model list (${models.status}) ${modelList.length} models`);
  const modelsDenied = await callAi(studentToken, 'ai-models', {});
  console.log(`${modelsDenied.status === 403 ? 'PASS' : 'FAIL'}  student blocked from admin tool (${modelsDenied.status})`);
}

await runCases(teacherCases, teacherToken);
await runCases(studentCases, studentToken);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} tool tests passed`);
if (failed.length) process.exitCode = 1;
