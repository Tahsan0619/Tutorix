import { AiError } from './groq.ts';
import {
  arr, bloom, BLOOM, bloomDistribution, chunk, ctxLine, int, langLine, makeId, MATERIAL_RULE, num, oneOf, required, shortTitle,
  str, strArr, type Bloom, type ToolDef,
} from './util.ts';

const TEACHER = ['teacher', 'admin'] as const;

const BLOOM_GUIDE =
  'Bloom levels (revised taxonomy): Remember (recall facts: define, list, name, identify), ' +
  'Understand (explain meaning: explain, summarize, classify, compare, describe), ' +
  'Apply (use a procedure in a new situation: solve, calculate, use, demonstrate), ' +
  'Analyze (break into parts, find relationships: analyze, differentiate, examine, infer), ' +
  'Evaluate (judge with criteria: justify, critique, assess, defend, argue), ' +
  'Create (produce something new: design, compose, construct, propose, formulate). ' +
  'Classify by the cognitive process actually REQUIRED to answer, not just the verb used.';

/* ------------------------------------------------------------------ */
/* 1. Bloom's Taxonomy Analyzer (single + bulk)                        */
/* ------------------------------------------------------------------ */

function splitQuestions(raw: string): string[] {
  const lines = raw.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let cur = '';
  const startRe = /^\s*(?:Q\s*)?(?:\d{1,3}|[ivx]{1,5})\s*[.)\]:-]\s+/i;
  for (const line of lines) {
    if (!line.trim()) {
      if (cur) {
        out.push(cur.trim());
        cur = '';
      }
      continue;
    }
    if (startRe.test(line) && cur) {
      out.push(cur.trim());
      cur = line.replace(startRe, '');
    } else {
      cur = cur ? `${cur} ${line.trim()}` : line.replace(startRe, '');
    }
  }
  if (cur) out.push(cur.trim());
  return out.filter((q) => q.length > 3);
}

const bloomsAnalyzer: ToolDef = {
  roles: [...TEACHER],
  save: true,
  title: (input, output) =>
    output.mode === 'bulk'
      ? `Bloom's analysis · ${output.items?.length ?? 0} questions`
      : `Bloom's: ${shortTitle(str(input.question), 60)}`,
  async run(input, ctx) {
    const mode = input.mode === 'bulk' ? 'bulk' : 'single';
    const context = ctxLine({ Subject: input.subject, Grade: input.grade });

    if (mode === 'single') {
      const question = required(input, 'question', 'a question to analyze');
      const d = await ctx.json(
        `You are an expert assessment analyst specializing in Bloom's revised taxonomy. ${BLOOM_GUIDE} Return ONLY valid JSON.`,
        `Analyze this assessment question.\n${context}\n\nQuestion:\n"""${question}"""\n\n` +
          'Return JSON exactly:\n{"level":"one of Remember|Understand|Apply|Analyze|Evaluate|Create",' +
          '"confidence":0-100,"secondary_level":"level or null","verbs":["action verbs found"],' +
          '"knowledge_dimension":"Factual|Conceptual|Procedural|Metacognitive",' +
          '"cognitive_process":"what the student must mentally do (1 sentence)",' +
          '"reasoning":"2-4 sentences explaining the classification with evidence",' +
          '"strengths":["what is good about the question"],"issues":["clarity/ambiguity problems, if any"],' +
          '"improvements":[{"level":"a DIFFERENT Bloom level","question":"rewritten question at that level"}] (give 3 rewrites, mostly higher-order),' +
          '"tips":["practical tips for the teacher"]}',
        { temperature: 0.3, maxTokens: 2500, reasoning: 'medium' },
      );
      return {
        mode,
        question,
        level: bloom(d.level),
        confidence: int(d.confidence, 0, 100, 75),
        secondary_level: d.secondary_level ? bloom(d.secondary_level) : null,
        verbs: strArr(d.verbs, 10, 40),
        knowledge_dimension: oneOf(d.knowledge_dimension, ['Factual', 'Conceptual', 'Procedural', 'Metacognitive'], 'Conceptual'),
        cognitive_process: str(d.cognitive_process, 400),
        reasoning: str(d.reasoning, 1500),
        strengths: strArr(d.strengths, 6),
        issues: strArr(d.issues, 6),
        improvements: arr(d.improvements).slice(0, 4).map((x: any) => ({ level: bloom(x?.level), question: str(x?.question, 800) }))
          .filter((x) => x.question),
        tips: strArr(d.tips, 6),
      };
    }

    const list: string[] = Array.isArray(input.questions)
      ? input.questions.map((q: unknown) => str(q, 1500)).filter(Boolean)
      : splitQuestions(str(input.text, 60000));
    if (list.length < 2) throw new AiError('Add at least 2 questions for bulk analysis (one per line or numbered).', 400);
    if (list.length > 100) throw new AiError('Bulk analysis supports up to 100 questions at a time.', 400);

    const batches = chunk(list.map((q, i) => ({ n: i + 1, q })), 20);
    const results = await Promise.all(
      batches.map((batch, bi) =>
        ctx.json(
          `You are an expert assessment analyst. ${BLOOM_GUIDE} Return ONLY valid JSON.`,
          `Classify each question by Bloom level.\n${context}\n\nQuestions:\n` +
            batch.map((b) => `${b.n}. ${b.q}`).join('\n') +
            '\n\nReturn JSON exactly: {"items":[{"n":number,"level":"Bloom level","confidence":0-100,' +
            '"verbs":["key verbs"],"knowledge_dimension":"Factual|Conceptual|Procedural|Metacognitive",' +
            '"reason":"one short sentence"}]} with one item per question, same numbers.',
          { temperature: 0.2, maxTokens: 3200, rotate: bi },
        ),
      ),
    );
    const byN = new Map<number, any>();
    for (const r of results) for (const it of arr(r.items)) byN.set(int(it?.n, 1, 1000, 0), it);

    const items = list.map((q, i) => {
      const it = byN.get(i + 1) ?? {};
      return {
        index: i + 1,
        question: q,
        level: bloom(it.level),
        confidence: int(it.confidence, 0, 100, 70),
        verbs: strArr(it.verbs, 6, 30),
        knowledge_dimension: oneOf(it.knowledge_dimension, ['Factual', 'Conceptual', 'Procedural', 'Metacognitive'], 'Conceptual'),
        reason: str(it.reason, 300),
      };
    });
    const stats = bloomDistribution(items.map((i) => i.level));

    const summary = await ctx.json(
      'You are an assessment design consultant. Return ONLY valid JSON.',
      `A question set of ${items.length} items has this Bloom distribution: ${JSON.stringify(stats.distribution)} ` +
        `(lower-order ${stats.lower_order_pct}%, higher-order ${stats.higher_order_pct}%).\n${context}\n` +
        `Sample questions:\n${items.slice(0, 12).map((i) => `- [${i.level}] ${i.question.slice(0, 160)}`).join('\n')}\n\n` +
        'Return JSON: {"balance_score":1-10,"summary":"3-4 sentence evaluation of cognitive balance",' +
        '"gaps":["missing or under-represented levels and why it matters"],' +
        '"recommendations":["specific, actionable changes, e.g. convert Q3 into an Analyze item by..."],' +
        '"ideal_distribution":{"Remember":pct,"Understand":pct,"Apply":pct,"Analyze":pct,"Evaluate":pct,"Create":pct}}',
      { tier: 'fast', temperature: 0.4, maxTokens: 1800 },
    );

    const ideal: Record<string, number> = {};
    for (const l of BLOOM) ideal[l] = int(summary.ideal_distribution?.[l], 0, 100, 0);

    return {
      mode,
      items,
      ...stats,
      balance_score: int(summary.balance_score, 1, 10, 5),
      summary: str(summary.summary, 1500),
      gaps: strArr(summary.gaps, 8),
      recommendations: strArr(summary.recommendations, 10),
      ideal_distribution: ideal,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 2. Lesson Plan Generator                                            */
/* ------------------------------------------------------------------ */

const lessonPlan: ToolDef = {
  roles: [...TEACHER],
  save: true,
  title: (input, output) => str(output.title, 120) || `Lesson plan: ${str(input.topic, 80)}`,
  async run(input, ctx) {
    const topic = required(input, 'topic', 'a topic');
    const d = await ctx.json(
      'You are a world-class curriculum designer and instructional coach. You write practical, classroom-ready ' +
        'lesson plans with pedagogical rigor, differentiation and tight assessment alignment. Return ONLY valid JSON.',
      `Create a complete lesson plan.\n${ctxLine({
        Subject: input.subject, 'Grade / class': input.grade, Topic: topic, Subtopic: input.subtopic,
        Duration: input.duration || '45 minutes', 'Teaching approach': input.approach || 'Best fit for the topic',
        'Main learning goal': input.objective, 'Class size': input.class_size, 'Available resources': input.resources,
        'Curriculum / board': input.curriculum, 'Extra requirements': input.notes,
      })}\n\n${langLine(input.language)}\n\n` +
        'The lesson flow minutes MUST add up to the total duration. Every activity must serve the objectives.\n' +
        'Return JSON exactly:\n{"title":"string","overview":"2-3 sentence summary",' +
        '"objectives":[{"text":"Students will be able to ...","bloom_level":"Bloom level"}] (4-6),' +
        '"success_criteria":["I can ..."],"prior_knowledge":["..."],' +
        '"vocabulary":[{"term":"","definition":""}],' +
        '"materials":{"must_have":["..."],"nice_to_have":["..."]},' +
        '"flow":[{"phase":"Hook|Direct instruction|Guided practice|Independent practice|Closure|...","minutes":number,' +
        '"teacher_actions":"what the teacher does and says","student_actions":"what students do","bloom_level":"Bloom level",' +
        '"check":"check for understanding"}] (5-7 phases),' +
        '"differentiation":{"support":["for struggling learners"],"core":["for on-level learners"],"extension":["for advanced learners"]},' +
        '"assessment":{"formative":["..."],"summative":"one summative task","exit_ticket":"exit ticket question"},' +
        '"misconceptions":[{"misconception":"","correction":"teacher move to fix it"}],' +
        '"homework":"string","extension":"enrichment task","reflection":"teacher reflection prompt","sel_prompt":"social-emotional prompt",' +
        '"cross_curricular":["links to other subjects"]}',
      { temperature: 0.6, maxTokens: 5200 },
    );
    const flow = arr(d.flow).slice(0, 10).map((f: any) => ({
      phase: str(f?.phase, 80),
      minutes: int(f?.minutes, 1, 300, 5),
      teacher_actions: str(f?.teacher_actions, 1200),
      student_actions: str(f?.student_actions, 1200),
      bloom_level: bloom(f?.bloom_level),
      check: str(f?.check, 500),
    }));
    return {
      title: str(d.title, 160) || `Lesson: ${topic}`,
      overview: str(d.overview, 1000),
      snapshot: {
        subject: str(input.subject, 80), grade: str(input.grade, 60), topic, subtopic: str(input.subtopic, 120),
        duration: str(input.duration, 40) || '45 minutes', approach: str(input.approach, 80),
      },
      objectives: arr(d.objectives).slice(0, 8).map((o: any) => ({ text: str(o?.text ?? o, 400), bloom_level: bloom(o?.bloom_level) })),
      success_criteria: strArr(d.success_criteria, 8),
      prior_knowledge: strArr(d.prior_knowledge, 8),
      vocabulary: arr(d.vocabulary).slice(0, 12).map((v: any) => ({ term: str(v?.term, 80), definition: str(v?.definition, 300) })).filter((v) => v.term),
      materials: { must_have: strArr(d.materials?.must_have, 12), nice_to_have: strArr(d.materials?.nice_to_have, 12) },
      flow,
      total_minutes: flow.reduce((s, f) => s + f.minutes, 0),
      differentiation: {
        support: strArr(d.differentiation?.support, 8),
        core: strArr(d.differentiation?.core, 8),
        extension: strArr(d.differentiation?.extension, 8),
      },
      assessment: {
        formative: strArr(d.assessment?.formative, 8),
        summative: str(d.assessment?.summative, 800),
        exit_ticket: str(d.assessment?.exit_ticket, 500),
      },
      misconceptions: arr(d.misconceptions).slice(0, 8).map((m: any) => ({ misconception: str(m?.misconception, 300), correction: str(m?.correction, 500) })).filter((m) => m.misconception),
      homework: str(d.homework, 800),
      extension: str(d.extension, 800),
      reflection: str(d.reflection, 500),
      sel_prompt: str(d.sel_prompt, 500),
      cross_curricular: strArr(d.cross_curricular, 6),
      language: str(input.language, 20) || 'English',
    };
  },
};

/* ------------------------------------------------------------------ */
/* 3. Rubrics Generator                                                */
/* ------------------------------------------------------------------ */

const rubric: ToolDef = {
  roles: [...TEACHER],
  save: true,
  title: (input, output) => str(output.title, 120) || `Rubric: ${str(input.assignment, 80)}`,
  async run(input, ctx) {
    const assignment = required(input, 'assignment', 'the assignment or task');
    const type = oneOf(input.type, ['analytic', 'holistic', 'single-point'] as const, 'analytic');
    const levelCount = type === 'single-point' ? 3 : int(input.levels, 3, 6, 4);
    const total = int(input.total_points, 4, 1000, 20);
    const criteriaCount = type === 'holistic' ? 1 : int(input.criteria_count, 2, 8, 4);

    const typeRule = type === 'holistic'
      ? 'HOLISTIC rubric: exactly ONE criterion named "Overall performance" with a rich descriptor per level.'
      : type === 'single-point'
        ? 'SINGLE-POINT rubric: levels are exactly ["Concerns / Areas to grow","Criteria (meets standard)","Advanced / Evidence of exceeding"]. ' +
          'For each criterion, descriptors[1] states the standard; descriptors[0] and [2] are short prompts for teacher comments.'
        : `ANALYTIC rubric: ${criteriaCount} distinct, observable criteria; each has a specific descriptor per level.`;

    const d = await ctx.json(
      'You are an expert assessment designer. You write observable, measurable, student-friendly rubric descriptors ' +
        'that clearly distinguish performance levels. Return ONLY valid JSON.',
      `Create a rubric.\n${ctxLine({
        'Assignment / task': assignment, Subject: input.subject, 'Grade / class': input.grade,
        'Learning objectives': input.objectives, 'Criteria the teacher wants': input.criteria_hint,
      })}\n- Rubric type: ${type}\n- Number of performance levels: ${levelCount} (ordered highest to lowest)\n` +
        `- Total points: ${total}\n\n${typeRule}\nCriterion weights (points) MUST add up to ${total}. ` +
        'Level points are the maximum points for that level as a fraction of each criterion; express levels as score bands of the criterion weight.\n' +
        `${langLine(input.language)}\n\n` +
        'Return JSON exactly:\n{"title":"string","description":"what the rubric assesses",' +
        '"levels":[{"name":"e.g. Exemplary","band":"e.g. 90-100%"}],' +
        '"criteria":[{"name":"string","weight":points,"descriptors":["one per level, same order as levels"]}],' +
        '"scoring_guide":["how to score and convert to grade"],"student_checklist":["student-friendly self-check items"],' +
        '"feedback_tips":["tips for giving feedback with this rubric"]}',
      { temperature: 0.5, maxTokens: 4500 },
    );

    let levels = arr(d.levels).slice(0, levelCount).map((l: any) => ({ name: str(l?.name ?? l, 60), band: str(l?.band, 40) }));
    if (levels.length < 2) levels = Array.from({ length: levelCount }, (_, i) => ({ name: `Level ${levelCount - i}`, band: '' }));
    const criteria = arr(d.criteria).slice(0, 10).map((c: any) => {
      const desc = strArr(c?.descriptors, levels.length, 800);
      while (desc.length < levels.length) desc.push('');
      return { name: str(c?.name, 100), weight: num(c?.weight, 0), descriptors: desc };
    }).filter((c) => c.name);
    const sum = criteria.reduce((s, c) => s + c.weight, 0);
    if (criteria.length && Math.abs(sum - total) > 0.01) {
      // Rescale so weights always add up to the requested total.
      let acc = 0;
      criteria.forEach((c, i) => {
        const share = sum > 0 ? c.weight / sum : 1 / criteria.length;
        c.weight = i === criteria.length - 1 ? total - acc : Math.max(1, Math.round(share * total));
        acc += c.weight;
      });
    }
    return {
      title: str(d.title, 160) || `Rubric: ${assignment.slice(0, 60)}`,
      description: str(d.description, 800),
      type,
      total_points: total,
      levels,
      criteria,
      scoring_guide: strArr(d.scoring_guide, 8),
      student_checklist: strArr(d.student_checklist, 10),
      feedback_tips: strArr(d.feedback_tips, 6),
    };
  },
};

/* ------------------------------------------------------------------ */
/* 4. Question & Worksheet Generator                                   */
/* ------------------------------------------------------------------ */

export const QUESTION_TYPES = {
  mcq: 'Multiple choice (4 options)',
  truefalse: 'True / False',
  fillblank: 'Fill in the blank (use ____ for the blank)',
  short: 'Short answer (1-3 sentences)',
  long: 'Long / extended answer',
  matching: 'Matching (4-5 pairs)',
} as const;
type QType = keyof typeof QUESTION_TYPES;

export function normalizeQuestion(q: any, i: number) {
  const type = (Object.keys(QUESTION_TYPES) as QType[]).find((t) => t === str(q?.type, 20).toLowerCase()) ?? 'short';
  const out: any = {
    id: makeId('q', i),
    type,
    bloom_level: bloom(q?.bloom_level),
    difficulty: oneOf(q?.difficulty, ['easy', 'medium', 'hard'] as const, 'medium'),
    prompt: str(q?.prompt, 2000),
    answer: str(q?.answer, 2500),
    explanation: str(q?.explanation, 1500),
    marks: int(q?.marks, 1, 50, type === 'long' ? 5 : type === 'short' || type === 'matching' ? 2 : 1),
  };
  if (type === 'mcq') {
    out.options = strArr(q?.options, 6, 400).map((o) => o.replace(/^[A-Da-d][.)]\s+/, ''));
    if (out.options.length < 2) out.type = 'short';
    const letter = /^[A-Da-d]$/.exec(out.answer.trim());
    if (letter && out.options.length) out.answer = out.options[letter[0].toUpperCase().charCodeAt(0) - 65] ?? out.answer;
  }
  if (type === 'truefalse') {
    out.options = ['True', 'False'];
    out.answer = /^t/i.test(out.answer) ? 'True' : 'False';
  }
  if (type === 'matching') {
    out.pairs = arr(q?.pairs).slice(0, 8).map((p: any) => ({ left: str(p?.left, 200), right: str(p?.right, 200) })).filter((p) => p.left && p.right);
    if (out.pairs.length < 2) out.type = 'short';
    if (!out.answer) out.answer = out.pairs.map((p: any) => `${p.left} → ${p.right}`).join('; ');
  }
  return out;
}

const questionWorksheet: ToolDef = {
  roles: [...TEACHER],
  save: true,
  title: (input, output) => str(output.title, 120) || `${input.mode === 'worksheet' ? 'Worksheet' : 'Questions'}: ${str(input.topic, 80)}`,
  async run(input, ctx) {
    const topic = required(input, 'topic', 'a topic');
    const mode = input.mode === 'worksheet' ? 'worksheet' : 'questions';
    const count = int(input.count, 1, 40, 10);
    const types = strArr(input.types, 6, 20).filter((t) => t in QUESTION_TYPES) as QType[];
    const useTypes = types.length ? types : (['mcq', 'short'] as QType[]);
    const levels = strArr(input.bloom_levels, 6, 20).map(bloom);
    const useLevels = levels.length ? [...new Set(levels)] : [...BLOOM];
    const difficulty = oneOf(input.difficulty, ['easy', 'medium', 'hard', 'mixed'] as const, 'mixed');
    const g = await ctx.ground(input, [topic, str(input.subject, 80), str(input.focus, 200), 'key concepts facts examples'].filter(Boolean).join(' '));

    // Material takes part of the token budget, so split into two parallel batches sooner.
    const batchSizes = count > (g.text ? 12 : 20) ? [Math.ceil(count / 2), Math.floor(count / 2)] : [count];
    const outputs = await Promise.all(batchSizes.map((n, bi) =>
      ctx.json(
        'You are an expert exam and worksheet author. You write fair, unambiguous, curriculum-aligned questions ' +
          'across Bloom levels, with correct answers and clear explanations. Return ONLY valid JSON.',
        `Generate exactly ${n} questions${batchSizes.length > 1 ? ` (part ${bi + 1} of ${batchSizes.length}; avoid overlap with other parts by focusing on ${bi === 0 ? 'the first half' : 'the second half'} of the subtopics)` : ''}.\n` +
          ctxLine({ Subject: input.subject, 'Grade / class': input.grade, Topic: topic, 'Specific focus': input.focus }) +
          `\n- Question types allowed: ${useTypes.map((t) => `${t} = ${QUESTION_TYPES[t]}`).join('; ')}\n` +
          `- Bloom levels to cover: ${useLevels.join(', ')}\n- Difficulty: ${difficulty}\n` +
          (g.text ? `\n${MATERIAL_RULE} Base every question on it.\n` : '') +
          `\n${langLine(input.language)}\n\nRules: mcq has exactly 4 plausible options and "answer" is the full text of the correct option; ` +
          'truefalse answer is "True" or "False"; fillblank prompt contains ____ and answer is the missing word(s); ' +
          'matching has "pairs" with left/right items (answer can be empty); short/long answer is a model answer; ' +
          'marks: 1 for mcq/truefalse/fillblank, 2 for short/matching, 4-6 for long. Mix types and levels evenly.\n' +
          'Return JSON exactly: {"title":"string","instructions":"student-facing instructions",' +
          '"questions":[{"type":"mcq|truefalse|fillblank|short|long|matching","bloom_level":"Bloom level","difficulty":"easy|medium|hard",' +
          '"prompt":"string","options":["only for mcq"],"pairs":[{"left":"","right":""}],"answer":"string","explanation":"why this is correct","marks":number}]}',
        { temperature: 0.7, maxTokens: 5600, rotate: bi, material: g },
      )
    ));
    const questions = outputs.flatMap((o) => arr(o.questions)).slice(0, count).map(normalizeQuestion).filter((q) => q.prompt);
    if (!questions.length) throw new AiError('The AI did not return any questions. Please try again.');
    return {
      mode,
      title: str(input.worksheet_title, 160) || str(outputs[0].title, 160) || `${topic} ${mode === 'worksheet' ? 'Worksheet' : 'Questions'}`,
      instructions: str(input.instructions, 800) || str(outputs[0].instructions, 800),
      subject: str(input.subject, 80),
      grade: str(input.grade, 60),
      topic,
      questions,
      total_marks: questions.reduce((s, q) => s + q.marks, 0),
      ...bloomDistribution(questions.map((q) => q.bloom_level as Bloom)),
    };
  },
};

/* ------------------------------------------------------------------ */
/* 5. Standardized Test Quality Tester                                 */
/* ------------------------------------------------------------------ */

const testQuality: ToolDef = {
  roles: [...TEACHER],
  save: true,
  title: (input, output) => `Test quality: ${str(input.test_title, 60) || str(input.subject, 40) || 'Assessment'} (${output.overall_score}/100)`,
  async run(input, ctx) {
    const test = required(input, 'test_text', 'the test questions');
    if (test.length > 16000) throw new AiError('The test is too long. Please analyze up to ~40 questions (16,000 characters) at a time.', 400);
    const stats = input.item_stats ? str(input.item_stats, 3000) : '';
    const d = await ctx.json(
      'You are a psychometrician and standardized test reviewer. You audit tests against item-writing best practices ' +
        '(Haladyna guidelines), content validity, cognitive balance, fairness/bias, and clarity. Be rigorous, specific and constructive. ' +
        `${BLOOM_GUIDE} Return ONLY valid JSON.`,
      `Audit this test.\n${ctxLine({ 'Test title': input.test_title, Subject: input.subject, 'Grade / class': input.grade, Purpose: input.purpose, 'Intended learning objectives': input.objectives })}\n\n` +
        `TEST:\n"""${test}"""\n` +
        (stats ? `\nMeasured item statistics from real student responses (use these as strong evidence):\n${stats}\n` : '') +
        '\nCheck each item for: ambiguity, grammatical cues, implausible distractors, "all/none of the above", negative stems, ' +
        'multiple correct answers, wrong key, cultural/gender bias, reading-level issues, alignment to objectives.\n' +
        'Return JSON exactly:\n{"overall_score":0-100,"summary":"3-5 sentence verdict",' +
        '"dimensions":[{"name":"Clarity & wording","score":0-10,"comment":""},{"name":"Content validity","score":0-10,"comment":""},' +
        '{"name":"Cognitive balance (Bloom)","score":0-10,"comment":""},{"name":"Distractor quality","score":0-10,"comment":""},' +
        '{"name":"Fairness & bias","score":0-10,"comment":""},{"name":"Format & structure","score":0-10,"comment":""},' +
        '{"name":"Difficulty spread","score":0-10,"comment":""}],' +
        '"items":[{"number":"item number/label","excerpt":"first ~12 words","bloom_level":"Bloom level","difficulty":"easy|medium|hard",' +
        '"quality":"good|fair|poor","issues":[{"type":"short label","severity":"low|medium|high","detail":"what is wrong"}],' +
        '"suggestion":"how to fix","rewrite":"improved version of the item, or empty if good"}],' +
        '"strengths":["..."],"critical_issues":["..."],"recommendations":["prioritized actions"],' +
        '"estimated_reliability":"low|moderate|high with one-line justification"}',
      { temperature: 0.3, maxTokens: 6000, reasoning: 'medium' },
    );
    const items = arr(d.items).slice(0, 60).map((it: any, i: number) => ({
      number: str(it?.number, 20) || String(i + 1),
      excerpt: str(it?.excerpt, 200),
      bloom_level: bloom(it?.bloom_level),
      difficulty: oneOf(it?.difficulty, ['easy', 'medium', 'hard'] as const, 'medium'),
      quality: oneOf(it?.quality, ['good', 'fair', 'poor'] as const, 'fair'),
      issues: arr(it?.issues).slice(0, 6).map((x: any) => ({
        type: str(x?.type, 60), severity: oneOf(x?.severity, ['low', 'medium', 'high'] as const, 'medium'), detail: str(x?.detail, 500),
      })).filter((x) => x.type || x.detail),
      suggestion: str(it?.suggestion, 800),
      rewrite: str(it?.rewrite, 1500),
    }));
    return {
      overall_score: int(d.overall_score, 0, 100, 60),
      summary: str(d.summary, 1500),
      dimensions: arr(d.dimensions).slice(0, 8).map((x: any) => ({ name: str(x?.name, 60), score: int(x?.score, 0, 10, 5), comment: str(x?.comment, 600) })),
      items,
      ...bloomDistribution(items.map((i) => i.bloom_level)),
      strengths: strArr(d.strengths, 8),
      critical_issues: strArr(d.critical_issues, 8),
      recommendations: strArr(d.recommendations, 10),
      estimated_reliability: str(d.estimated_reliability, 300),
      has_item_stats: !!stats,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 6. Answer Key & Marking Scheme Generator                            */
/* ------------------------------------------------------------------ */

const answerKey: ToolDef = {
  roles: [...TEACHER],
  save: true,
  title: (input, output) => str(output.title, 120) || 'Answer key & marking scheme',
  async run(input, ctx) {
    const paper = required(input, 'paper_text', 'the question paper');
    if (paper.length > 14000) throw new AiError('The question paper is too long. Please split it into parts of ~14,000 characters.', 400);
    const detail = oneOf(input.detail, ['brief', 'detailed'] as const, 'detailed');
    const d = await ctx.json(
      'You are a senior chief examiner. You produce accurate answer keys and fair, point-based marking schemes that ' +
        'different markers can apply consistently. Double-check every answer for correctness. Return ONLY valid JSON.',
      `Create the answer key and marking scheme for this paper.\n${ctxLine({ Subject: input.subject, 'Grade / class': input.grade, 'Total marks (if known)': input.total_marks, 'Board / curriculum': input.curriculum })}\n` +
        `- Level of detail: ${detail}\n\nQUESTION PAPER:\n"""${paper}"""\n\n${langLine(input.language)}\n\n` +
        'If marks are shown in the paper, respect them; otherwise assign sensible marks. marking_points marks must sum to the question marks.\n' +
        'Return JSON exactly:\n{"title":"string","total_marks":number,"general_instructions":["instructions for markers"],' +
        '"answers":[{"number":"question label","question":"short restatement","type":"mcq|short|long|numerical|other","marks":number,' +
        '"answer":"complete model answer (markdown allowed, show working for numericals)",' +
        '"marking_points":[{"point":"creditworthy point","marks":number}],"accept_also":["alternative acceptable answers"],' +
        '"common_mistakes":["typical errors and how to mark them"],"examiner_note":"string"}]}',
      { temperature: 0.2, maxTokens: 6500, reasoning: 'medium' },
    );
    const answers = arr(d.answers).slice(0, 80).map((a: any, i: number) => {
      const points = arr(a?.marking_points).slice(0, 12).map((p: any) => ({ point: str(p?.point ?? p, 500), marks: num(p?.marks, 0) })).filter((p) => p.point);
      const marks = num(a?.marks, points.reduce((s, p) => s + p.marks, 0)) || 1;
      return {
        number: str(a?.number, 20) || String(i + 1),
        question: str(a?.question, 600),
        type: str(a?.type, 20) || 'other',
        marks,
        answer: str(a?.answer, 4000),
        marking_points: points,
        accept_also: strArr(a?.accept_also, 6),
        common_mistakes: strArr(a?.common_mistakes, 6),
        examiner_note: str(a?.examiner_note, 600),
      };
    });
    if (!answers.length) throw new AiError('Could not detect any questions in the paper. Please check the text.', 400);
    return {
      title: str(d.title, 160) || 'Answer key & marking scheme',
      subject: str(input.subject, 80),
      grade: str(input.grade, 60),
      total_marks: answers.reduce((s, a) => s + a.marks, 0),
      general_instructions: strArr(d.general_instructions, 8),
      answers,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 7. Differentiated Content Generator                                 */
/* ------------------------------------------------------------------ */

const differentiated: ToolDef = {
  roles: [...TEACHER],
  save: true,
  title: (input, output) => str(output.title, 120) || `Differentiated: ${str(input.topic, 80)}`,
  async run(input, ctx) {
    const content = str(input.content, 12000);
    const topic = str(input.topic, 200);
    if (!content && !topic) throw new AiError('Provide either the lesson/activity text or a topic.', 400);
    const d = await ctx.json(
      'You are a differentiation and inclusive-education specialist (UDL, scaffolding, tiered instruction). ' +
        'You adapt the SAME learning goal to three readiness levels without lowering expectations for the core concept. Return ONLY valid JSON.',
      `Differentiate this ${content ? 'lesson / activity' : 'topic'} into three tiers.\n${ctxLine({ Subject: input.subject, 'Grade / class': input.grade, Topic: topic, 'Learning goal': input.objective })}\n` +
        (content ? `\nORIGINAL CONTENT:\n"""${content}"""\n` : '') +
        `\n${langLine(input.language)}\n` +
        (input.include_ell ? 'Also include supports for English-language learners / students learning in a second language.\n' : '') +
        'Each tier must contain the FULL adapted student-facing content (reading text or explanation), an activity, scaffolds and questions.\n' +
        'Support tier: simpler language, shorter sentences, visuals/sentence starters, worked examples. ' +
        'Core tier: grade-level. Extension tier: deeper analysis, real-world application, open-ended challenge.\n' +
        'Return JSON exactly:\n{"title":"string","learning_goal":"shared goal for all tiers",' +
        '"tiers":[{"level":"Support|Core|Extension","label":"friendly name","for_whom":"which students","content":"adapted content in markdown",' +
        '"activity":"task description","scaffolds":["..."],"questions":["..."],"success_criteria":["..."]}],' +
        '"ell_supports":["..."],"grouping_tips":["how to run the three tiers in one classroom"],"assessment_note":"how to assess fairly across tiers"}',
      { temperature: 0.6, maxTokens: 6200 },
    );
    const order = ['Support', 'Core', 'Extension'];
    const tiers = arr(d.tiers).slice(0, 3).map((t: any, i: number) => ({
      level: oneOf(t?.level, order as unknown as readonly ['Support', 'Core', 'Extension'], order[i] as 'Support'),
      label: str(t?.label, 60),
      for_whom: str(t?.for_whom, 300),
      content: str(t?.content, 5000),
      activity: str(t?.activity, 1500),
      scaffolds: strArr(t?.scaffolds, 8),
      questions: strArr(t?.questions, 8),
      success_criteria: strArr(t?.success_criteria, 6),
    }));
    if (tiers.length < 3) throw new AiError('The AI returned incomplete tiers. Please try again.');
    return {
      title: str(d.title, 160) || `Differentiated: ${topic || 'Lesson'}`,
      learning_goal: str(d.learning_goal, 600),
      tiers,
      ell_supports: strArr(d.ell_supports, 8),
      grouping_tips: strArr(d.grouping_tips, 6),
      assessment_note: str(d.assessment_note, 800),
    };
  },
};

/* ------------------------------------------------------------------ */
/* 8. Learning Objectives Generator                                    */
/* ------------------------------------------------------------------ */

const learningObjectives: ToolDef = {
  roles: [...TEACHER],
  save: true,
  title: (input) => `Learning objectives: ${str(input.topic, 80)}`,
  async run(input, ctx) {
    const topic = required(input, 'topic', 'a topic or unit');
    const count = int(input.count, 3, 12, 6);
    const levels = strArr(input.bloom_levels, 6, 20).map(bloom);
    const d = await ctx.json(
      `You are an instructional designer expert in writing SMART, measurable learning objectives aligned to Bloom's taxonomy. ${BLOOM_GUIDE} ` +
        'Never use unmeasurable verbs like "understand", "know", "learn", "appreciate". Return ONLY valid JSON.',
      `Write ${count} learning objectives.\n${ctxLine({ Subject: input.subject, 'Grade / class': input.grade, 'Topic / unit': topic, 'Time frame': input.timeframe, 'Standards / curriculum': input.standards, Context: input.context })}\n` +
        `- Bloom levels to include: ${levels.length ? [...new Set(levels)].join(', ') : 'a progression from lower to higher order'}\n` +
        `${langLine(input.language)}\n\nOrder objectives from lower-order to higher-order.\n` +
        'Return JSON exactly:\n{"objectives":[{"statement":"By the end of ..., students will be able to <measurable verb> ...",' +
        '"bloom_level":"Bloom level","verb":"the action verb","smart":{"specific":"","measurable":"","achievable":"","relevant":"","time_bound":""},' +
        '"assessment":"how to assess it","success_criteria":"student-friendly I can statement"}],' +
        '"sequence_note":"how the objectives build on each other","alignment_tips":["..."]}',
      { temperature: 0.5, maxTokens: 5000 },
    );
    const objectives = arr(d.objectives).slice(0, count + 2).map((o: any) => ({
      statement: str(o?.statement, 600),
      bloom_level: bloom(o?.bloom_level),
      verb: str(o?.verb, 40),
      smart: {
        specific: str(o?.smart?.specific, 300), measurable: str(o?.smart?.measurable, 300), achievable: str(o?.smart?.achievable, 300),
        relevant: str(o?.smart?.relevant, 300), time_bound: str(o?.smart?.time_bound, 300),
      },
      assessment: str(o?.assessment, 500),
      success_criteria: str(o?.success_criteria, 300),
    })).filter((o) => o.statement);
    return {
      topic,
      subject: str(input.subject, 80),
      grade: str(input.grade, 60),
      objectives,
      ...bloomDistribution(objectives.map((o) => o.bloom_level)),
      sequence_note: str(d.sequence_note, 800),
      alignment_tips: strArr(d.alignment_tips, 6),
    };
  },
};

/* ------------------------------------------------------------------ */
/* 9. Report Card & Feedback Comment Generator                         */
/* ------------------------------------------------------------------ */

const reportComments: ToolDef = {
  roles: [...TEACHER],
  save: true,
  title: (input, output) => `Report comments · ${output.comments?.length ?? 0} students${input.subject ? ` · ${str(input.subject, 40)}` : ''}`,
  async run(input, ctx) {
    const students = arr(input.students).map((s: any) => ({
      name: str(s?.name, 80),
      scores: str(s?.scores, 300),
      strengths: str(s?.strengths, 400),
      improvements: str(s?.improvements, 400),
      notes: str(s?.notes, 500),
    })).filter((s) => s.name);
    if (!students.length) throw new AiError('Add at least one student with a name.', 400);
    if (students.length > 40) throw new AiError('Up to 40 students per batch.', 400);
    const tone = oneOf(input.tone, ['encouraging', 'balanced', 'formal'] as const, 'balanced');
    const length = oneOf(input.length, ['short', 'medium', 'long'] as const, 'medium');
    const words = { short: '35-50', medium: '70-100', long: '120-160' }[length];

    const batches = chunk(students, 8);
    const results = await Promise.all(batches.map((batch, bi) =>
      ctx.json(
        'You are an experienced, caring teacher writing report card comments. Comments are specific, evidence-based, ' +
          'growth-oriented, free of clichés and bias, and never shaming. Each comment is unique. Return ONLY valid JSON.',
        `Write report card comments.\n${ctxLine({ Subject: input.subject, 'Grade / class': input.grade, 'Term / period': input.term, 'Teacher name': input.teacher_name })}\n` +
          `- Tone: ${tone}\n- Length: ${words} words each\n- Use the student's first name; use they/them unless the notes give pronouns.\n` +
          `${langLine(input.language)}\n\nStudents:\n` +
          batch.map((s, i) => `${i + 1}. ${s.name} | scores: ${s.scores || 'n/a'} | strengths: ${s.strengths || 'n/a'} | to improve: ${s.improvements || 'n/a'} | notes: ${s.notes || 'n/a'}`).join('\n') +
          '\n\nReturn JSON exactly: {"comments":[{"name":"student name","overall":"Excellent|Very good|Good|Satisfactory|Needs improvement",' +
          '"comment":"the report card comment","next_steps":["2-3 concrete next steps"],"parent_tip":"one way parents can help at home"}]}',
        { temperature: 0.75, maxTokens: 4500, rotate: bi },
      )
    ));
    const all = results.flatMap((r) => arr(r.comments));
    const comments = students.map((s) => {
      const c: any = all.find((x: any) => str(x?.name, 80).toLowerCase() === s.name.toLowerCase()) ??
        all.find((x: any) => str(x?.name, 80).toLowerCase().includes(s.name.split(' ')[0].toLowerCase())) ?? {};
      return {
        name: s.name,
        scores: s.scores,
        overall: str(c.overall, 30) || 'Good',
        comment: str(c.comment, 2000),
        next_steps: strArr(c.next_steps, 4),
        parent_tip: str(c.parent_tip, 400),
      };
    });
    return { subject: str(input.subject, 80), grade: str(input.grade, 60), term: str(input.term, 60), tone, length, comments };
  },
};

/* ------------------------------------------------------------------ */
/* 10. Syllabus / Term Planner                                         */
/* ------------------------------------------------------------------ */

function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

function parseHolidays(raw: string) {
  const days = new Set<string>();
  const labels: { start: string; end: string; label: string }[] = [];
  for (const line of raw.split(/\n|;/)) {
    const m = /(\d{4}-\d{2}-\d{2})(?:\s*(?:to|-|–|—)\s*(\d{4}-\d{2}-\d{2}))?\s*(.*)/.exec(line.trim());
    if (!m) continue;
    const a = parseDate(m[1]);
    const b = m[2] ? parseDate(m[2]) : a;
    if (!a || !b || b < a) continue;
    for (let d = a; d <= b; d = addDays(d, 1)) days.add(iso(d));
    labels.push({ start: iso(a), end: iso(b), label: m[3].replace(/^[:\-–—\s]+/, '').trim() || 'Holiday' });
  }
  return { days, labels };
}

const termPlanner: ToolDef = {
  roles: [...TEACHER],
  save: true,
  title: (input, output) => str(output.title, 120) || `Term plan: ${str(input.subject, 60)}`,
  async run(input, ctx) {
    const syllabus = required(input, 'syllabus', 'the syllabus topics');
    const start = parseDate(str(input.start_date, 20));
    const end = parseDate(str(input.end_date, 20));
    if (!start || !end || end <= start) throw new AiError('Provide a valid term start and end date.', 400);
    const totalDays = (end.getTime() - start.getTime()) / 86400000;
    if (totalDays > 370) throw new AiError('A term can be at most one year long.', 400);

    const perWeek = int(input.classes_per_week, 1, 14, 4);
    const workDays = strArr(input.work_days, 7, 3).length ? strArr(input.work_days, 7, 3) : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
    const dayName = (d: Date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
    const { days: holidays, labels } = parseHolidays(str(input.holidays, 3000));

    // Build calendar weeks starting on the term start date.
    const weeks: { week: number; start: string; end: string; teaching_days: number; sessions: number; holiday_note: string }[] = [];
    for (let ws = start, w = 1; ws <= end; ws = addDays(ws, 7), w++) {
      const we = addDays(ws, 6) > end ? end : addDays(ws, 6);
      let teaching = 0;
      let workInWeek = 0;
      for (let d = ws; d <= we; d = addDays(d, 1)) {
        if (!workDays.includes(dayName(d))) continue;
        workInWeek++;
        if (!holidays.has(iso(d))) teaching++;
      }
      const sessions = workInWeek ? Math.round((perWeek * teaching) / Math.max(workDays.length, 1)) : 0;
      const note = labels.filter((l) => l.start <= iso(we) && l.end >= iso(ws)).map((l) => l.label).join(', ');
      weeks.push({ week: w, start: iso(ws), end: iso(we), teaching_days: teaching, sessions: Math.min(perWeek, sessions), holiday_note: note });
    }
    if (weeks.length > 53) throw new AiError('The term is too long.', 400);
    const teachingWeeks = weeks.filter((w) => w.sessions > 0);
    const totalSessions = weeks.reduce((s, w) => s + w.sessions, 0);

    const d = await ctx.json(
      'You are an expert academic planner (scheme of work / pacing guide). You distribute syllabus content realistically ' +
        'across the available sessions, sequencing prerequisites first, leaving revision buffers and placing assessments sensibly. Return ONLY valid JSON.',
      `Plan the term week by week.\n${ctxLine({ Subject: input.subject, 'Grade / class': input.grade, 'Minutes per class': input.minutes_per_class || 45, 'Planned assessments': input.assessments, 'Teacher notes': input.notes })}\n` +
        `- Total teaching sessions available: ${totalSessions}\n\nSYLLABUS:\n"""${str(syllabus, 6000)}"""\n\n` +
        `CALENDAR (plan ONLY weeks with sessions > 0; weeks with 0 sessions are holidays):\n` +
        weeks.map((w) => `Week ${w.week} (${w.start} to ${w.end}): ${w.sessions} sessions${w.holiday_note ? ` [${w.holiday_note}]` : ''}`).join('\n') +
        `\n\n${langLine(input.language)}\n` +
        'Reserve the last 1-2 teaching weeks for revision and final assessment when the term allows.\n' +
        'Return JSON exactly:\n{"title":"string","overview":"2-3 sentence pacing summary",' +
        '"weeks":[{"week":number,"unit":"unit/chapter name","topics":["topics covered"],"objectives":["what students will achieve"],' +
        '"activities":["key activities"],"assessment":"quiz/test/project this week or empty","resources":["..."]}],' +
        '"assessment_calendar":[{"week":number,"type":"Quiz|Class test|Project|Mid-term|Final|Assignment","description":""}],' +
        '"pacing_tips":["advice to stay on track"]}',
      { temperature: 0.45, maxTokens: Math.min(6500, 900 + teachingWeeks.length * 260) },
    );
    const planByWeek = new Map<number, any>();
    for (const w of arr(d.weeks)) planByWeek.set(int(w?.week, 1, 60, 0), w);
    return {
      title: str(d.title, 160) || `${str(input.subject, 60)} term plan`,
      overview: str(d.overview, 1200),
      subject: str(input.subject, 80),
      grade: str(input.grade, 60),
      start_date: iso(start),
      end_date: iso(end),
      classes_per_week: perWeek,
      total_sessions: totalSessions,
      weeks: weeks.map((w) => {
        const p = planByWeek.get(w.week) ?? {};
        return {
          ...w,
          is_break: w.sessions === 0,
          unit: str(p.unit, 160),
          topics: strArr(p.topics, 10),
          objectives: strArr(p.objectives, 6),
          activities: strArr(p.activities, 6),
          assessment: str(p.assessment, 300),
          resources: strArr(p.resources, 5),
        };
      }),
      assessment_calendar: arr(d.assessment_calendar).slice(0, 20).map((a: any) => ({ week: int(a?.week, 1, 60, 1), type: str(a?.type, 40), description: str(a?.description, 400) })),
      pacing_tips: strArr(d.pacing_tips, 8),
      holidays: labels,
    };
  },
};

export const teacherTools: Record<string, ToolDef> = {
  'blooms-analyzer': bloomsAnalyzer,
  'lesson-plan': lessonPlan,
  rubric,
  'question-worksheet': questionWorksheet,
  'test-quality': testQuality,
  'answer-key': answerKey,
  differentiated,
  'learning-objectives': learningObjectives,
  'report-comments': reportComments,
  'term-planner': termPlanner,
};
