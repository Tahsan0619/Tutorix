import { AiError } from './groq.ts';
import {
  arr, bloom, ctxLine, int, langLine, makeId, MATERIAL_RULE, num, oneOf, required, shortTitle, str, strArr, type Ctx, type ToolDef,
} from './util.ts';

const STUDENT = ['student', 'admin'] as const;

/** Topic plus any pasted or saved study material, retrieved for what this tool needs most. */
async function topicOrSource(input: any, ctx: Ctx, focus: string) {
  const topic = str(input.topic, 300);
  const g = await ctx.ground(input, [topic, str(input.subject, 80), focus].filter(Boolean).join(' '));
  if (!topic && !g.text) throw new AiError('Enter a topic, or paste, upload or pick your study material.', 400);
  return { topic, g, rule: g.text ? `\n${MATERIAL_RULE}\n` : '' };
}

/* ------------------------------------------------------------------ */
/* 1. Smart Notes & Revision Sheet Generator                           */
/* ------------------------------------------------------------------ */

const smartNotes: ToolDef = {
  roles: [...STUDENT],
  save: true,
  title: (input, output) => str(output.title, 120) || `${input.mode === 'revision' ? 'Revision sheet' : 'Notes'}: ${str(input.topic, 80)}`,
  async run(input, ctx) {
    const mode = input.mode === 'revision' ? 'revision' : 'notes';
    const { topic, g, rule: material } = await topicOrSource(
      input,
      ctx,
      mode === 'revision' ? 'key definitions formulas facts dates exam' : 'main ideas explanation examples key terms',
    );
    const context = ctxLine({ Topic: topic, Subject: input.subject, 'Class / level': input.level });

    if (mode === 'revision') {
      const d = await ctx.json(
        'You are an expert tutor who makes compact, high-yield one-page revision sheets for last-minute exam review. ' +
          'Only include what is most likely to be examined. Use LaTeX between $...$ for any math/chemistry formula. Return ONLY valid JSON.',
        `Create a one-page revision sheet.\n${context}\n${material}\n${langLine(input.language)}\n` +
          'Return JSON exactly:\n{"title":"string","big_idea":"one-sentence core idea",' +
          '"formulas":[{"name":"","formula":"LaTeX without $","meaning":"what each symbol means / when to use"}],' +
          '"definitions":[{"term":"","definition":"crisp exam-ready definition"}],"key_facts":["high-yield facts"],' +
          '"dates":[{"date":"","event":""}],"diagrams":["diagrams/processes to be able to draw or describe"],' +
          '"exam_tips":["..."],"common_mistakes":["..."],"quick_check":[{"q":"","a":""}]}\n' +
          'Leave arrays empty when not relevant to the subject (e.g. no formulas for history).',
        { temperature: 0.4, maxTokens: 4500, material: g },
      );
      return {
        mode,
        title: str(d.title, 160) || `${topic || 'Revision'}: revision sheet`,
        big_idea: str(d.big_idea, 400),
        formulas: arr(d.formulas).slice(0, 15).map((f: any) => ({ name: str(f?.name, 100), formula: str(f?.formula, 300).replace(/^\$+|\$+$/g, ''), meaning: str(f?.meaning, 400) })).filter((f) => f.formula),
        definitions: arr(d.definitions).slice(0, 15).map((x: any) => ({ term: str(x?.term, 100), definition: str(x?.definition, 400) })).filter((x) => x.term),
        key_facts: strArr(d.key_facts, 15, 400),
        dates: arr(d.dates).slice(0, 15).map((x: any) => ({ date: str(x?.date, 60), event: str(x?.event, 300) })).filter((x) => x.date),
        diagrams: strArr(d.diagrams, 6),
        exam_tips: strArr(d.exam_tips, 8),
        common_mistakes: strArr(d.common_mistakes, 8),
        quick_check: arr(d.quick_check).slice(0, 8).map((x: any) => ({ q: str(x?.q, 300), a: str(x?.a, 400) })).filter((x) => x.q),
      };
    }

    const style = oneOf(input.style, ['outline', 'cornell', 'detailed'] as const, 'outline');
    const d = await ctx.json(
      'You are an expert tutor who writes clear, well-structured study notes that make hard topics easy to learn. ' +
        'Use markdown inside strings (bold for key terms), and LaTeX between $...$ for formulas. Return ONLY valid JSON.',
      `Create study notes in "${style}" style.\n${context}\n${material}\n${langLine(input.language)}\n` +
        (style === 'cornell' ? 'Cornell style: every section needs a "cue" question for the left column.\n' : '') +
        (style === 'detailed' ? 'Detailed style: thorough explanations with examples in each section.\n' : 'Outline style: concise hierarchical bullet points.\n') +
        'Return JSON exactly:\n{"title":"string","summary":"3-4 sentence overview",' +
        '"sections":[{"heading":"","cue":"question for Cornell cue column (or empty)","points":["markdown bullet points"],' +
        '"example":"a worked example or real-life example (or empty)"}] (4-8 sections),' +
        '"key_terms":[{"term":"","definition":""}],"key_takeaways":["..."],"review_questions":["self-test questions"]}',
      { temperature: 0.5, maxTokens: 5500, material: g },
    );
    const sections = arr(d.sections).slice(0, 12).map((s: any) => ({
      heading: str(s?.heading, 160),
      cue: str(s?.cue, 300),
      points: strArr(s?.points, 14, 800),
      example: str(s?.example, 1200),
    })).filter((s) => s.heading || s.points.length);
    if (!sections.length) throw new AiError('The AI did not return notes. Please try again.');
    return {
      mode,
      style,
      title: str(d.title, 160) || `${topic || 'Study'} notes`,
      summary: str(d.summary, 1200),
      sections,
      key_terms: arr(d.key_terms).slice(0, 15).map((x: any) => ({ term: str(x?.term, 100), definition: str(x?.definition, 400) })).filter((x) => x.term),
      key_takeaways: strArr(d.key_takeaways, 8),
      review_questions: strArr(d.review_questions, 8),
    };
  },
};

/* ------------------------------------------------------------------ */
/* 2. To-Do List Generator                                             */
/* ------------------------------------------------------------------ */

const todo: ToolDef = {
  roles: [...STUDENT],
  save: true,
  cache: false,
  title: (input) => `To-do: ${shortTitle(str(input.goal), 70)}`,
  async run(input, ctx) {
    const goal = required(input, 'goal', 'your goal');
    const today = new Date().toISOString().slice(0, 10);
    const d = await ctx.json(
      'You are a productivity coach for students. You break big goals into small, concrete, doable tasks (15-90 min each), ' +
        'ordered logically, with realistic time estimates and priorities. Return ONLY valid JSON.',
      `Break this goal into an actionable to-do list.\n${ctxLine({ Goal: goal, "Today's date": today, Deadline: input.deadline, 'Hours available per day': input.hours_per_day, 'Current level / situation': input.context })}\n` +
        `${langLine(input.language)}\n` +
        'Group tasks into 2-5 phases. If a deadline is given, set due dates (YYYY-MM-DD) between today and the deadline.\n' +
        'Return JSON exactly:\n{"summary":"one-paragraph plan overview","phases":[{"name":"","tasks":[{"title":"short action starting with a verb",' +
        '"detail":"how to do it / what done looks like","estimate_minutes":number,"priority":"high|medium|low","due":"YYYY-MM-DD or empty"}]}],' +
        '"tips":["motivation and focus tips"]}',
      { temperature: 0.55, maxTokens: 4000 },
    );
    let n = 0;
    const phases = arr(d.phases).slice(0, 6).map((p: any) => ({
      name: str(p?.name, 100),
      tasks: arr(p?.tasks).slice(0, 12).map((t: any) => ({
        id: makeId('t', n++),
        title: str(t?.title, 200),
        detail: str(t?.detail, 600),
        estimate_minutes: int(t?.estimate_minutes, 5, 600, 30),
        priority: oneOf(t?.priority, ['high', 'medium', 'low'] as const, 'medium'),
        due: /^\d{4}-\d{2}-\d{2}$/.test(str(t?.due, 10)) ? str(t?.due, 10) : '',
      })).filter((t) => t.title),
    })).filter((p) => p.tasks.length);
    if (!phases.length) throw new AiError('The AI did not return tasks. Please try again.');
    return {
      goal,
      deadline: str(input.deadline, 20),
      summary: str(d.summary, 1200),
      phases,
      total_minutes: phases.reduce((s, p) => s + p.tasks.reduce((a, t) => a + t.estimate_minutes, 0), 0),
      tips: strArr(d.tips, 6),
    };
  },
};

/* ------------------------------------------------------------------ */
/* 3. Study Planner / Timetable Generator                              */
/* ------------------------------------------------------------------ */

const studyPlanner: ToolDef = {
  roles: [...STUDENT],
  save: true,
  cache: false,
  title: (input, output) => `Study plan · ${output.days?.length ?? 0} days · ${arr(input.subjects).map((s: any) => str(s?.name, 20)).filter(Boolean).slice(0, 3).join(', ')}`,
  async run(input, ctx) {
    const subjects = arr(input.subjects).map((s: any) => ({
      name: str(s?.name, 60),
      exam_date: /^\d{4}-\d{2}-\d{2}$/.test(str(s?.exam_date, 10)) ? str(s?.exam_date, 10) : '',
      difficulty: int(s?.difficulty, 1, 5, 3),
      confidence: int(s?.confidence, 1, 5, 3),
      topics: str(s?.topics, 400),
    })).filter((s) => s.name);
    if (!subjects.length) throw new AiError('Add at least one subject.', 400);
    if (subjects.length > 10) throw new AiError('Up to 10 subjects per plan.', 400);

    const startStr = /^\d{4}-\d{2}-\d{2}$/.test(str(input.start_date, 10)) ? str(input.start_date, 10) : new Date().toISOString().slice(0, 10);
    const start = new Date(`${startStr}T00:00:00Z`);
    const days = int(input.days, 3, 14, 7);
    const weekdayHours = num(input.weekday_hours, 3);
    const weekendHours = num(input.weekend_hours, 5);
    const weekend = strArr(input.weekend_days, 2, 3).length ? strArr(input.weekend_days, 2, 3) : ['Fri', 'Sat'];
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const calendar = Array.from({ length: days }, (_, i) => {
      const d = new Date(start.getTime() + i * 86400000);
      const day = names[d.getUTCDay()];
      return { date: d.toISOString().slice(0, 10), day, hours: weekend.includes(day) ? weekendHours : weekdayHours };
    });

    const d = await ctx.json(
      'You are an expert study coach. You build realistic, balanced study timetables using spaced repetition, interleaving, ' +
        'active recall, and Pomodoro-style breaks, prioritizing subjects with nearer exams, higher difficulty and lower confidence. Return ONLY valid JSON.',
      `Build a day-by-day study timetable.\nSubjects:\n` +
        subjects.map((s) => `- ${s.name}: exam ${s.exam_date || 'not set'}, difficulty ${s.difficulty}/5, confidence ${s.confidence}/5${s.topics ? `, topics: ${s.topics}` : ''}`).join('\n') +
        `\n\nDays and available study hours:\n${calendar.map((c) => `${c.date} (${c.day}): ${c.hours}h`).join('\n')}\n` +
        `\n${ctxLine({ 'Preferred study time': input.preferred_time || 'evening', 'Day starts at': input.day_start || '16:00', 'Break style': input.break_style || 'pomodoro (50 min study / 10 min break)', 'Other commitments': input.notes })}\n` +
        `${langLine(input.language)}\n` +
        'Use 24h HH:MM times. Sessions of a day must fit in its available hours (excluding breaks is fine). No study on an exam day for that subject except light revision. ' +
        'Keep it concise: max 5 sessions per day, include breaks as type "break" only between long blocks.\n' +
        'Return JSON exactly:\n{"summary":"strategy overview","days":[{"date":"YYYY-MM-DD","focus":"theme of the day",' +
        '"sessions":[{"start":"HH:MM","end":"HH:MM","subject":"","activity":"specific task e.g. Solve 10 past-paper MCQs on Optics","type":"learn|practice|revise|mock|break"}]}],' +
        '"weekly_goals":["..."],"tips":["..."]}',
      { temperature: 0.5, maxTokens: Math.min(6500, 1200 + days * 380) },
    );
    const byDate = new Map<string, any>();
    for (const x of arr(d.days)) byDate.set(str(x?.date, 10), x);
    let n = 0;
    return {
      summary: str(d.summary, 1200),
      subjects,
      days: calendar.map((c, i) => {
        const x = byDate.get(c.date) ?? arr(d.days)[i] ?? {};
        return {
          ...c,
          focus: str(x.focus, 160),
          sessions: arr(x.sessions).slice(0, 8).map((s: any) => ({
            id: makeId('s', n++),
            start: str(s?.start, 5),
            end: str(s?.end, 5),
            subject: str(s?.subject, 60),
            activity: str(s?.activity, 300),
            type: oneOf(s?.type, ['learn', 'practice', 'revise', 'mock', 'break'] as const, 'learn'),
          })),
        };
      }),
      weekly_goals: strArr(d.weekly_goals, 8),
      tips: strArr(d.tips, 6),
    };
  },
};

/* ------------------------------------------------------------------ */
/* 4. Flashcard Generator                                              */
/* ------------------------------------------------------------------ */

const flashcards: ToolDef = {
  roles: [...STUDENT],
  save: true,
  title: (input, output) => str(output.title, 120) || `Flashcards: ${str(input.topic, 80)}`,
  async run(input, ctx) {
    const { topic, g, rule } = await topicOrSource(input, ctx, 'key terms definitions facts');
    const count = int(input.count, 5, 40, 15);
    const style = oneOf(input.style, ['qa', 'term', 'cloze', 'mixed'] as const, 'mixed');
    const d = await ctx.json(
      'You are an expert at spaced-repetition flashcards (minimum information principle: one fact per card, short answers). ' +
        'Use LaTeX between $...$ for formulas. Return ONLY valid JSON.',
      `Create exactly ${count} flashcards.\n${ctxLine({ Topic: topic, Subject: input.subject, 'Class / level': input.level, Difficulty: input.difficulty })}\n` +
        `- Card style: ${style === 'qa' ? 'question → answer' : style === 'term' ? 'term → definition' : style === 'cloze' ? 'cloze deletion (front has ____)' : 'mix of Q&A, term/definition and cloze'}\n` +
        rule +
        `\n${langLine(input.language)}\n` +
        'Return JSON exactly: {"title":"deck name","cards":[{"front":"","back":"","hint":"optional short hint","tag":"subtopic"}]}',
      { temperature: 0.55, maxTokens: 4500, material: g },
    );
    const cards = arr(d.cards).slice(0, count).map((c: any, i: number) => ({
      id: makeId('c', i),
      front: str(c?.front, 600),
      back: str(c?.back, 1200),
      hint: str(c?.hint, 200),
      tag: str(c?.tag, 60),
    })).filter((c) => c.front && c.back);
    if (!cards.length) throw new AiError('The AI did not return flashcards. Please try again.');
    return { title: str(d.title, 160) || `${topic || 'Study'} flashcards`, topic, cards };
  },
};

/* ------------------------------------------------------------------ */
/* 5. Practice Quiz & Weak Topic Analyzer                              */
/* ------------------------------------------------------------------ */

const practiceQuiz: ToolDef = {
  roles: [...STUDENT],
  save: true,
  title: (input, output) => str(output.title, 120) || `Quiz: ${str(input.topic, 80)}`,
  async run(input, ctx) {
    const { topic, g, rule } = await topicOrSource(input, ctx, 'important concepts facts examples');
    const count = int(input.count, 3, 25, 10);
    const types = strArr(input.types, 3, 20).filter((t) => ['mcq', 'truefalse', 'short'].includes(t));
    const useTypes = types.length ? types : ['mcq', 'truefalse', 'short'];
    const d = await ctx.json(
      'You are an expert examiner creating a self-assessment practice quiz. Questions are accurate and unambiguous; ' +
        'each is tagged with a precise subtopic so weak areas can be diagnosed. Return ONLY valid JSON.',
      `Create exactly ${count} practice questions.\n${ctxLine({ Subject: input.subject, Topic: topic, 'Class / level': input.level, Difficulty: input.difficulty || 'mixed' })}\n` +
        `- Types: ${useTypes.join(', ')} (mcq = 4 options, answer is the exact option text; truefalse answer is "True"/"False"; short = 1-3 sentence answer)\n` +
        '- Cover 3-6 different subtopics, spread evenly.\n' +
        rule +
        `\n${langLine(input.language)}\n` +
        'Return JSON exactly: {"title":"string","questions":[{"type":"mcq|truefalse|short","subtopic":"","bloom_level":"Bloom level",' +
        '"prompt":"","options":["mcq only"],"answer":"","explanation":"why, 1-3 sentences"}]}',
      { temperature: 0.6, maxTokens: 5000, material: g },
    );
    const questions = arr(d.questions).slice(0, count).map((q: any, i: number) => {
      let type = oneOf(q?.type, ['mcq', 'truefalse', 'short'] as const, 'short');
      let options = type === 'mcq' ? strArr(q?.options, 6, 300).map((o) => o.replace(/^[A-Da-d][.)]\s+/, '')) : type === 'truefalse' ? ['True', 'False'] : [];
      let answer = str(q?.answer, 1200);
      if (type === 'mcq') {
        const letter = /^[A-Da-d]$/.exec(answer.trim());
        if (letter) answer = options[letter[0].toUpperCase().charCodeAt(0) - 65] ?? answer;
        if (options.length < 2) {
          type = 'short';
          options = [];
        } else if (!options.includes(answer)) {
          const match = options.find((o) => o.toLowerCase().trim() === answer.toLowerCase().trim() || o.toLowerCase().includes(answer.toLowerCase()));
          if (match) answer = match;
        }
      }
      if (type === 'truefalse') answer = /^t/i.test(answer) ? 'True' : 'False';
      return {
        id: makeId('q', i),
        type,
        subtopic: str(q?.subtopic, 80) || topic || 'General',
        bloom_level: bloom(q?.bloom_level),
        prompt: str(q?.prompt, 1500),
        options,
        answer,
        explanation: str(q?.explanation, 1000),
        marks: type === 'short' ? 2 : 1,
      };
    }).filter((q) => q.prompt && q.answer);
    if (!questions.length) throw new AiError('The AI did not return quiz questions. Please try again.');
    return { title: str(d.title, 160) || `${topic || 'Practice'} quiz`, subject: str(input.subject, 80), topic, questions };
  },
};

const quizGrade: ToolDef = {
  roles: [...STUDENT],
  save: false,
  async run(input, ctx) {
    const items = arr(input.items).slice(0, 25).map((x: any, i: number) => ({
      i,
      prompt: str(x?.prompt, 1000),
      answer: str(x?.answer, 1200),
      response: str(x?.response, 1500),
      marks: int(x?.marks, 1, 10, 2),
    }));
    if (!items.length) return { results: [] };
    const d = await ctx.json(
      'You are a fair, encouraging examiner grading short answers against a model answer. Accept correct answers phrased ' +
        'differently; give partial credit for partially correct answers; blank or irrelevant answers get 0. Return ONLY valid JSON.',
      `Grade these answers.\n${langLine(input.language)}\n\n` +
        items.map((x) => `#${x.i}\nQuestion: ${x.prompt}\nModel answer: ${x.answer}\nMax marks: ${x.marks}\nStudent answer: ${x.response || '(blank)'}`).join('\n\n') +
        '\n\nReturn JSON exactly: {"results":[{"i":number,"awarded":number,"feedback":"1-2 sentences: what was right/missing"}]}',
      { tier: 'fast', temperature: 0.1, maxTokens: 2500 },
    );
    const byI = new Map<number, any>();
    for (const r of arr(d.results)) byI.set(int(r?.i, 0, 100, -1), r);
    return {
      results: items.map((x) => {
        const r = byI.get(x.i) ?? {};
        const awarded = x.response ? Math.max(0, Math.min(x.marks, Math.round(num(r.awarded, 0) * 2) / 2)) : 0;
        return { i: x.i, awarded, max: x.marks, correct: awarded >= x.marks * 0.6, feedback: str(r.feedback, 600) };
      }),
    };
  },
};

const weakTopics: ToolDef = {
  roles: [...STUDENT],
  save: false,
  cache: false,
  async run(input, ctx) {
    const stats = arr(input.stats).slice(0, 40).map((s: any) => ({
      topic: str(s?.topic, 100),
      subtopic: str(s?.subtopic, 100),
      correct: int(s?.correct, 0, 10000, 0),
      total: int(s?.total, 0, 10000, 0),
      accuracy: int(s?.accuracy, 0, 100, 0),
    })).filter((s) => s.total > 0);
    if (!stats.length) throw new AiError('Take at least one practice quiz first so there is data to analyze.', 400);
    const mistakes = arr(input.recent_mistakes).slice(0, 15).map((m: any) => `- [${str(m?.subtopic, 60)}] Q: ${str(m?.prompt, 200)} | your answer: ${str(m?.response, 120)} | correct: ${str(m?.answer, 160)}`).join('\n');
    const d = await ctx.json(
      'You are a learning diagnostician and study coach. From quiz performance data you identify weak topics, ' +
        'likely root causes (conceptual gaps, careless errors, memory), and give a precise improvement plan. Return ONLY valid JSON.',
      `Analyze this student's practice-quiz performance.\nPer-subtopic accuracy:\n` +
        stats.map((s) => `- ${s.topic} › ${s.subtopic}: ${s.correct}/${s.total} correct (${s.accuracy}%)`).join('\n') +
        (mistakes ? `\n\nRecent mistakes:\n${mistakes}` : '') +
        `\n\n${langLine(input.language)}\n` +
        'Return JSON exactly: {"summary":"2-3 sentence diagnosis","weak_topics":[{"topic":"","accuracy":number,"diagnosis":"root cause",' +
        '"actions":["specific study actions"],"practice_idea":"one concrete practice exercise"}],"strong_topics":["..."],' +
        '"next_steps":["prioritized plan for the next 3-7 days"],"motivation":"one encouraging sentence"}',
      { temperature: 0.4, maxTokens: 3000 },
    );
    return {
      summary: str(d.summary, 1000),
      weak_topics: arr(d.weak_topics).slice(0, 8).map((w: any) => ({
        topic: str(w?.topic, 120), accuracy: int(w?.accuracy, 0, 100, 0), diagnosis: str(w?.diagnosis, 600),
        actions: strArr(w?.actions, 5), practice_idea: str(w?.practice_idea, 400),
      })).filter((w) => w.topic),
      strong_topics: strArr(d.strong_topics, 8),
      next_steps: strArr(d.next_steps, 8),
      motivation: str(d.motivation, 300),
      generated_at: new Date().toISOString(),
    };
  },
};

/* ------------------------------------------------------------------ */
/* 6. Mind Map Generator                                               */
/* ------------------------------------------------------------------ */

interface MindNode { label: string; note?: string; children: MindNode[] }

function normalizeNode(n: any, depth: number, maxDepth: number): MindNode {
  const node: MindNode = { label: str(n?.label ?? n?.name ?? n, 120) || '…', children: [] };
  const note = str(n?.note, 240);
  if (note) node.note = note;
  if (depth < maxDepth) node.children = arr(n?.children).slice(0, 7).map((c) => normalizeNode(c, depth + 1, maxDepth)).filter((c) => c.label !== '…');
  return node;
}

const mindMap: ToolDef = {
  roles: [...STUDENT],
  save: true,
  title: (input, output) => `Mind map: ${str(output.label, 80) || str(input.topic, 80)}`,
  async run(input, ctx) {
    const { topic, g, rule } = await topicOrSource(input, ctx, 'main ideas structure categories relationships');
    const depth = int(input.depth, 2, 4, 3);
    const d = await ctx.json(
      'You are an expert at concept mapping. You organize a topic into a clear hierarchy of main branches, sub-branches and ' +
        'key details, with short labels (1-6 words) and optional one-line notes. Return ONLY valid JSON.',
      `Create a mind map.\n${ctxLine({ Topic: topic, Subject: input.subject, 'Class / level': input.level })}\n` +
        `- Depth: ${depth} levels below the center; 4-6 main branches; 2-4 children per node.\n` +
        rule +
        `\n${langLine(input.language)}\n` +
        'Return JSON exactly: {"label":"central topic","note":"one-line definition","children":[{"label":"","note":"","children":[...]}],' +
        '"connections":[{"from":"label","to":"label","relation":"how they relate"}]}',
      { temperature: 0.5, maxTokens: 4500, material: g },
    );
    const root = normalizeNode(d, 0, depth);
    if (!root.children.length) throw new AiError('The AI did not return a mind map. Please try again.');
    return {
      ...root,
      connections: arr(d.connections).slice(0, 8).map((c: any) => ({ from: str(c?.from, 120), to: str(c?.to, 120), relation: str(c?.relation, 200) })).filter((c) => c.from && c.to),
    };
  },
};

/* ------------------------------------------------------------------ */
/* 7. Concept Explainer (+ follow-up chat)                             */
/* ------------------------------------------------------------------ */

const LEVELS = {
  kid: 'like I am 10 years old, with very simple words and everyday analogies',
  school: 'for a secondary-school student, clear and exam-relevant',
  college: 'for a university student, with precise terminology and depth',
  expert: 'for an advanced learner, rigorous and nuanced, with edge cases',
};

const conceptExplainer: ToolDef = {
  roles: [...STUDENT],
  save: true,
  title: (input) => `Explained: ${shortTitle(str(input.concept), 70)}`,
  async run(input, ctx) {
    const concept = required(input, 'concept', 'a concept or question');
    const level = oneOf(input.level, ['kid', 'school', 'college', 'expert'] as const, 'school');
    const g = await ctx.ground(input, `${concept} ${str(input.subject, 80)} ${str(input.context, 300)}`);
    const d = await ctx.json(
      'You are a brilliant, patient teacher famous for making difficult ideas click. You explain accurately, build intuition first, ' +
        'then precision. Use markdown and LaTeX between $...$ for math. Return ONLY valid JSON.',
      `Explain this ${LEVELS[level]}.\n${ctxLine({ 'Concept / question': concept, Subject: input.subject, 'What confuses me': input.context })}\n` +
        (g.text ? `${MATERIAL_RULE} Explain it the way the material does, using its terms and examples.\n` : '') +
        `${langLine(input.language)}\n` +
        'Return JSON exactly:\n{"title":"concept name","one_liner":"one-sentence core idea","explanation":"main explanation in markdown (3-6 short paragraphs or bullets)",' +
        '"analogy":"a memorable analogy","example":"a concrete worked or real-life example (markdown)","steps":["if it is a process, the steps; else empty"],' +
        '"compare":{"with":"a commonly confused concept or empty","rows":[{"aspect":"","this":"","that":""}]},' +
        '"misconceptions":["common misconception → the truth"],"check_questions":[{"q":"","a":""}],"related":["concepts to learn next"]}',
      { temperature: 0.55, maxTokens: 4500, material: g },
    );
    return {
      concept,
      level,
      title: str(d.title, 160) || concept,
      one_liner: str(d.one_liner, 400),
      explanation: str(d.explanation, 6000),
      analogy: str(d.analogy, 1200),
      example: str(d.example, 2500),
      steps: strArr(d.steps, 10, 500),
      compare: d.compare?.with
        ? { with: str(d.compare.with, 100), rows: arr(d.compare.rows).slice(0, 8).map((r: any) => ({ aspect: str(r?.aspect, 100), this: str(r?.this, 300), that: str(r?.that, 300) })).filter((r) => r.aspect) }
        : null,
      misconceptions: strArr(d.misconceptions, 6),
      check_questions: arr(d.check_questions).slice(0, 5).map((x: any) => ({ q: str(x?.q, 300), a: str(x?.a, 600) })).filter((x) => x.q),
      related: strArr(d.related, 8, 80),
    };
  },
};

const explainerFollowup: ToolDef = {
  roles: [...STUDENT],
  save: false,
  async run(input, ctx) {
    const question = required(input, 'question', 'your follow-up question');
    const history = arr(input.history).slice(-8).map((m: any) => `${m?.role === 'assistant' ? 'Tutor' : 'Student'}: ${str(m?.content, 1500)}`).join('\n');
    const g = await ctx.ground(input, `${question} ${str(input.concept, 300)}`);
    const d = await ctx.json(
      'You are a patient tutor continuing a conversation about a concept. Answer the follow-up clearly and concisely ' +
        '(markdown, LaTeX between $...$ for math). Return ONLY valid JSON.',
      `Concept: ${str(input.concept, 300)}\nOriginal explanation summary: ${str(input.summary, 1500)}\n\nConversation so far:\n${history || '(none)'}\n\n` +
        `Student's new question: ${question}\n${g.text ? `${MATERIAL_RULE}\n` : ''}${langLine(input.language)}\n\nReturn JSON: {"answer":"markdown answer"}`,
      { tier: 'fast', temperature: 0.5, maxTokens: 2500, material: g },
    );
    return { answer: str(d.answer, 6000) || 'Sorry, I could not answer that. Please rephrase.' };
  },
};

/* ------------------------------------------------------------------ */
/* 8. Step-by-Step Problem Solver                                      */
/* ------------------------------------------------------------------ */

const problemSolver: ToolDef = {
  roles: [...STUDENT],
  save: true,
  title: (input) => `Solved: ${shortTitle(str(input.problem), 70)}`,
  async run(input, ctx) {
    const problem = required(input, 'problem', 'the problem');
    const d = await ctx.json(
      'You are an expert math and science tutor. Solve problems correctly and show every step with the reasoning behind it, ' +
        'so the student learns the method. Verify the final answer. Use LaTeX between $...$ (inline) or $$...$$ (display) for all math. Return ONLY valid JSON.',
      `Solve step by step.\n${ctxLine({ Subject: input.subject, 'Class / level': input.level, 'Method to use (if any)': input.method })}\n\nPROBLEM:\n"""${problem}"""\n\n` +
        `${langLine(input.language)}\n` +
        'Return JSON exactly:\n{"topic":"what kind of problem this is","given":["known quantities/facts"],"find":"what is asked",' +
        '"concepts":["formulas/principles used, with LaTeX"],"strategy":"the plan in 1-2 sentences",' +
        '"steps":[{"title":"short step name","work":"the math/work in markdown+LaTeX","why":"reasoning for this step"}],' +
        '"final_answer":"final answer with units (LaTeX ok)","verification":"how we know it is right (substitute back / estimate / units)",' +
        '"common_mistakes":["..."],"practice":{"problem":"a similar practice problem","answer":"its answer"}}',
      { temperature: 0.2, maxTokens: 6500, reasoning: 'medium' },
    );
    const steps = arr(d.steps).slice(0, 20).map((s: any, i: number) => ({ title: str(s?.title, 160) || `Step ${i + 1}`, work: str(s?.work, 3000), why: str(s?.why, 1000) }));
    if (!steps.length) throw new AiError('The AI could not solve this problem. Try rephrasing it.');
    return {
      problem,
      subject: str(input.subject, 60),
      topic: str(d.topic, 160),
      given: strArr(d.given, 12, 300),
      find: str(d.find, 400),
      concepts: strArr(d.concepts, 8, 400),
      strategy: str(d.strategy, 800),
      steps,
      final_answer: str(d.final_answer, 800),
      verification: str(d.verification, 1500),
      common_mistakes: strArr(d.common_mistakes, 6),
      practice: d.practice?.problem ? { problem: str(d.practice.problem, 1000), answer: str(d.practice.answer, 600) } : null,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 9. Mnemonic Generator                                               */
/* ------------------------------------------------------------------ */

const mnemonics: ToolDef = {
  roles: [...STUDENT],
  save: true,
  title: (input, output) => `Mnemonics: ${str(output.topic, 80) || shortTitle(str(input.content), 60)}`,
  async run(input, ctx) {
    const content = required(input, 'content', 'what you want to memorize');
    const types = strArr(input.types, 5, 20);
    const useTypes = types.length ? types : ['acronym', 'sentence', 'rhyme', 'story', 'visual'];
    const d = await ctx.json(
      'You are a memory coach (mnemonics expert). You create vivid, funny, easy-to-recall memory aids that map EXACTLY and in order ' +
        'onto the items to remember. Verify every acronym letter matches its item. Return ONLY valid JSON.',
      `Create memory aids for:\n"""${content}"""\n${ctxLine({ Topic: input.topic, Subject: input.subject })}\n` +
        `- Mnemonic types to create (one of each): ${useTypes.join(', ')}\n` +
        '  acronym = word from first letters; sentence = acrostic sentence; rhyme = short rhyme/song; story = mini story linking items; visual = memory-palace / vivid image.\n' +
        `${langLine(input.language)}\n` +
        'Return JSON exactly:\n{"topic":"","items":["the individual items to remember, in order"],' +
        '"mnemonics":[{"type":"acronym|sentence|rhyme|story|visual","title":"short name","mnemonic":"the mnemonic itself",' +
        '"breakdown":[{"cue":"letter/word/image","item":"what it stands for"}],"why_it_works":"one sentence"}],' +
        '"practice_tip":"how to lock it in with spaced recall"}',
      { temperature: 0.85, maxTokens: 4000 },
    );
    const list = arr(d.mnemonics).slice(0, 6).map((m: any) => ({
      type: oneOf(m?.type, ['acronym', 'sentence', 'rhyme', 'story', 'visual'] as const, 'sentence'),
      title: str(m?.title, 100),
      mnemonic: str(m?.mnemonic, 2000),
      breakdown: arr(m?.breakdown).slice(0, 20).map((b: any) => ({ cue: str(b?.cue, 80), item: str(b?.item, 200) })).filter((b) => b.cue || b.item),
      why_it_works: str(m?.why_it_works, 400),
    })).filter((m) => m.mnemonic);
    if (!list.length) throw new AiError('The AI did not return mnemonics. Please try again.');
    return { topic: str(d.topic, 160) || str(input.topic, 160), items: strArr(d.items, 30, 200), mnemonics: list, practice_tip: str(d.practice_tip, 500) };
  },
};

/* ------------------------------------------------------------------ */
/* 10. Vocabulary Builder (Bangla–English)                             */
/* ------------------------------------------------------------------ */

const vocabulary: ToolDef = {
  roles: [...STUDENT],
  save: true,
  title: (input, output) => input.mode === 'topic'
    ? `Vocabulary: ${str(input.topic, 60)} (${output.words?.length ?? 0} words)`
    : `Vocabulary: ${(output.words ?? []).slice(0, 4).map((w: any) => w.word).join(', ')}`,
  async run(input, ctx) {
    const mode = input.mode === 'topic' ? 'topic' : 'words';
    let words: string[] = [];
    if (mode === 'words') {
      words = str(input.words, 3000).split(/[\n,;]+/).map((w) => w.trim()).filter(Boolean).slice(0, 25);
      if (!words.length) throw new AiError('Enter at least one word (English or Bangla).', 400);
    } else {
      required(input, 'topic', 'a topic');
    }
    const count = mode === 'topic' ? int(input.count, 5, 25, 12) : words.length;
    const d = await ctx.json(
      'You are an expert bilingual (English–Bangla) lexicographer and language teacher. Give accurate meanings, correct IPA, ' +
        'natural example sentences with faithful Bangla translations, and helpful memory tips. Return ONLY valid JSON.',
      (mode === 'words'
        ? `Build vocabulary entries for these words (each may be English or Bangla; for Bangla input give the English equivalent as "word"):\n${words.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n`
        : `Choose the ${count} most useful words for the topic "${str(input.topic, 200)}" at ${str(input.level, 40) || 'intermediate'} level.\n`) +
        `- Learner level: ${str(input.level, 40) || 'intermediate'}\n` +
        'Return JSON exactly:\n{"words":[{"word":"English word","part_of_speech":"","ipa":"/.../","bangla":"Bangla meaning(s) in Bengali script",' +
        '"meaning":"clear English definition","synonyms":["..."],"antonyms":["..."],' +
        '"examples":[{"en":"example sentence","bn":"Bangla translation"}] (2 examples),"collocations":["common word partners"],' +
        '"usage_note":"register / common errors","memory_tip":"a mnemonic to remember it"}]}',
      { temperature: 0.4, maxTokens: Math.min(7000, 600 + count * 300) },
    );
    const entries = arr(d.words).slice(0, count).map((w: any, i: number) => ({
      id: makeId('w', i),
      word: str(w?.word, 80),
      part_of_speech: str(w?.part_of_speech, 40),
      ipa: str(w?.ipa, 80),
      bangla: str(w?.bangla, 200),
      meaning: str(w?.meaning, 600),
      synonyms: strArr(w?.synonyms, 6, 40),
      antonyms: strArr(w?.antonyms, 6, 40),
      examples: arr(w?.examples).slice(0, 3).map((e: any) => ({ en: str(e?.en, 400), bn: str(e?.bn, 400) })).filter((e) => e.en),
      collocations: strArr(w?.collocations, 6, 60),
      usage_note: str(w?.usage_note, 400),
      memory_tip: str(w?.memory_tip, 400),
    })).filter((w) => w.word && w.meaning);
    if (!entries.length) throw new AiError('The AI did not return vocabulary entries. Please try again.');
    return { mode, topic: str(input.topic, 160), level: str(input.level, 40), words: entries };
  },
};

export const studentTools: Record<string, ToolDef> = {
  'smart-notes': smartNotes,
  todo,
  'study-planner': studyPlanner,
  flashcards,
  'practice-quiz': practiceQuiz,
  'mind-map': mindMap,
  'concept-explainer': conceptExplainer,
  'problem-solver': problemSolver,
  mnemonics,
  vocabulary,
  'quiz-grade': quizGrade,
  'weak-topics': weakTopics,
  'explainer-followup': explainerFollowup,
};
