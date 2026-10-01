import clsx from 'clsx';
import {
  Activity, ChartColumn, CircleCheck, CircleX, Lightbulb, RotateCcw, Send, Sparkles, Target, Trash2, TrendingUp, Trophy,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ColumnChart, HBar, ScoreRing } from '@/components/charts';
import { BulletList, Md } from '@/components/Markdown';
import { SourceInput } from '@/components/SourceInput';
import { useToast } from '@/components/Toast';
import { BloomBadge, Button, ChipGroup, EmptyState, Field, Input, PageLoader, SectionCard, Select, StatCard } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { runTool } from '@/lib/ai';
import { md } from '@/lib/export';
import { formatDate, timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { QuizAttempt, QuizResultItem } from '@/lib/types';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

type QType = 'mcq' | 'truefalse' | 'short';
interface Input { subject: string; topic: string; level: string; source_text: string; material_ids: string[]; count: string; types: QType[]; difficulty: string; language: string }
interface Question { id: string; type: QType; subtopic: string; bloom_level: string; prompt: string; options: string[]; answer: string; explanation: string; marks: number }
interface Output { title: string; subject: string; topic: string; questions: Question[] }
interface Submitted { results: QuizResultItem[]; score: number; max: number; percentage: number; attempt_id: string | null; at: string }

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({
    subject: profile?.subject ?? '', topic: '', level: profile?.grade_level ?? '', source_text: '', material_ids: [], count: '10', types: ['mcq', 'truefalse', 'short'], difficulty: 'mixed', language: defaultLanguage(profile),
  }, initial);
  return (
    <FormShell onSubmit={() => onSubmit(v)} loading={loading} disabled={(!v.topic.trim() && v.source_text.trim().length < 50 && !v.material_ids.length) || !v.types.length} submitLabel="Create my quiz">
      <Grid cols={3}>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. Chemistry" /></Field>
        <Field label="Topic"><Input {...bind('topic')} placeholder="e.g. Chemical bonding" /></Field>
        <Field label="Class / level"><Select {...bind('level')} options={GRADE_OPTIONS} /></Field>
      </Grid>
      <Grid cols={3}>
        <Field label="Questions"><Select {...bind('count')} options={['5', '10', '15', '20', '25']} /></Field>
        <Field label="Difficulty"><Select {...bind('difficulty')} options={['easy', 'medium', 'hard', 'mixed']} /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
      <Field label="Question types">
        <ChipGroup<QType> options={[{ value: 'mcq', label: 'Multiple choice' }, { value: 'truefalse', label: 'True / False' }, { value: 'short', label: 'Short answer (AI-graded)' }]} value={v.types} onChange={(t) => set('types', t)} />
      </Field>
      <SourceInput value={v.source_text} onChange={(t) => set('source_text', t)} materialIds={v.material_ids} onMaterialIds={(ids) => set('material_ids', ids)} label="Quiz me on my notes / PDF (optional)" rows={5} />
    </FormShell>
  );
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function QuizResult({ output: o, input, generation, state, setState }: ResultProps<Output, Input>) {
  const toast = useToast();
  const { session } = useAuth();
  const responses: Record<string, string> = state.responses ?? {};
  const submitted: Submitted | null = state.submitted ?? null;
  const [grading, setGrading] = useState(false);
  const answered = o.questions.filter((q) => (responses[q.id] ?? '').trim()).length;
  const setResponse = (id: string, val: string) => setState({ responses: { ...responses, [id]: val } });

  const submit = async () => {
    if (answered < o.questions.length && !window.confirm(`You answered ${answered} of ${o.questions.length} questions. Submit anyway?`)) return;
    setGrading(true);
    try {
      const shorts = o.questions.filter((q) => q.type === 'short' && (responses[q.id] ?? '').trim());
      let graded: Record<string, { awarded: number; feedback: string }> = {};
      if (shorts.length) {
        const res = await runTool<{ results: { i: number; awarded: number; feedback: string }[] }>('quiz-grade', {
          language: input.language,
          items: shorts.map((q) => ({ prompt: q.prompt, answer: q.answer, response: responses[q.id], marks: q.marks })),
        }, { save: false });
        graded = Object.fromEntries(res.output.results.map((r) => [shorts[r.i].id, { awarded: r.awarded, feedback: r.feedback }]));
      }
      const results: QuizResultItem[] = o.questions.map((q) => {
        const response = (responses[q.id] ?? '').trim();
        let awarded = 0;
        let feedback = '';
        if (q.type === 'short') {
          awarded = graded[q.id]?.awarded ?? 0;
          feedback = graded[q.id]?.feedback ?? (response ? '' : 'No answer given.');
        } else {
          awarded = response && norm(response) === norm(q.answer) ? q.marks : 0;
        }
        return {
          id: q.id, subtopic: q.subtopic, bloom_level: q.bloom_level, type: q.type, prompt: q.prompt, response, answer: q.answer,
          awarded, max: q.marks, correct: awarded >= q.marks * 0.6, feedback,
        };
      });
      const score = results.reduce((s, r) => s + r.awarded, 0);
      const max = results.reduce((s, r) => s + r.max, 0);
      const percentage = max ? Math.round((score / max) * 1000) / 10 : 0;
      let attempt_id: string | null = null;
      if (session?.user) {
        const { data, error } = await supabase.from('quiz_attempts').insert({
          user_id: session.user.id, generation_id: generation.id, subject: o.subject || input.subject || null, topic: o.topic || input.topic || o.title,
          score, max_score: max, percentage, results,
        }).select('id').single();
        if (error) toast(`Result not saved to your history: ${error.message}`, 'error');
        attempt_id = data?.id ?? null;
      }
      setState({ submitted: { results, score, max, percentage, attempt_id, at: new Date().toISOString() } satisfies Submitted });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGrading(false);
    }
  };

  const retake = () => setState({ responses: {}, submitted: null });

  if (submitted) return <Review o={o} s={submitted} onRetake={retake} />;

  return (
    <div className="space-y-5">
      <div className="card sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">{o.title}</h2>
          <div className="text-sm text-slate-500">{answered}/{o.questions.length} answered · {o.questions.reduce((s, q) => s + q.marks, 0)} marks</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-slate-100 sm:block">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(answered / o.questions.length) * 100}%` }} />
          </div>
          <Button onClick={submit} loading={grading} icon={<Send className="h-4 w-4" />}>{grading ? 'Grading…' : 'Submit quiz'}</Button>
        </div>
      </div>

      {o.questions.map((q, i) => (
        <div key={q.id} className="card avoid-break p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-400">Q{i + 1}</span>
            <span className="badge bg-slate-100 text-slate-600">{q.subtopic}</span>
            <span className="text-slate-400">{q.marks} mark{q.marks > 1 ? 's' : ''}</span>
          </div>
          <div className="font-semibold leading-relaxed text-slate-900"><Md>{q.prompt}</Md></div>
          <div className="mt-3">
            {q.type === 'short' ? (
              <textarea className="input" rows={3} placeholder="Type your answer…" value={responses[q.id] ?? ''} onChange={(e) => setResponse(q.id, e.target.value)} />
            ) : (
              <div className={clsx('grid gap-2', q.type === 'mcq' ? 'sm:grid-cols-2' : 'grid-cols-2 sm:w-80')}>
                {q.options.map((opt, j) => {
                  const on = responses[q.id] === opt;
                  return (
                    <button key={j} type="button" onClick={() => setResponse(q.id, opt)} className={clsx('flex items-start gap-2.5 rounded-xl border-2 p-3 text-left text-sm transition', on ? 'border-brand-500 bg-brand-50 font-semibold text-brand-900' : 'border-slate-200 hover:border-brand-200')}>
                      {q.type === 'mcq' && <span className={clsx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600')}>{String.fromCharCode(65 + j)}</span>}
                      <span className="pt-0.5"><Md>{opt}</Md></span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button onClick={submit} loading={grading} icon={<Send className="h-4 w-4" />}>{grading ? 'Grading…' : 'Submit quiz'}</Button>
      </div>
    </div>
  );
}

function Review({ o, s, onRetake }: { o: Output; s: Submitted; onRetake: () => void }) {
  const bySub = new Map<string, { correct: number; total: number }>();
  for (const r of s.results) {
    const e = bySub.get(r.subtopic) ?? { correct: 0, total: 0 };
    e.total += 1;
    if (r.correct) e.correct += 1;
    bySub.set(r.subtopic, e);
  }
  const qById = new Map(o.questions.map((q) => [q.id, q]));
  const correctCount = s.results.filter((r) => r.correct).length;
  const msg = s.percentage >= 85 ? 'Excellent! You have mastered this.' : s.percentage >= 65 ? 'Good job. A little more practice on the red areas.' : s.percentage >= 40 ? 'Keep going, and review the explanations below.' : 'This topic needs more study. Start with the weakest subtopic.';

  return (
    <div className="space-y-6">
      <div className="card grid gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
        <ScoreRing value={s.percentage} label="score" size={140} />
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">{o.title}</h2>
          <p className="mt-1 text-slate-600">{msg}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="badge bg-brand-50 text-brand-700">{s.score}/{s.max} marks</span>
            <span className="badge bg-emerald-50 text-emerald-700">{correctCount} correct</span>
            <span className="badge bg-rose-50 text-rose-700">{s.results.length - correctCount} to review</span>
            <span className="badge bg-slate-100 text-slate-600">{timeAgo(s.at)}</span>
          </div>
        </div>
        <div className="no-print flex flex-col gap-2">
          <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={onRetake}>Retake quiz</Button>
          <Link to="/tools/practice-quiz?tab=performance" className="btn btn-ghost"><ChartColumn className="h-4 w-4" /> My performance</Link>
        </div>
      </div>

      <SectionCard title="Subtopic breakdown" icon={<Target className="h-5 w-5" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {[...bySub.entries()].sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total).map(([sub, e]) => {
            const pct = Math.round((e.correct / e.total) * 100);
            return <HBar key={sub} label={`${sub} (${e.correct}/${e.total})`} value={pct} max={100} suffix="%" color={pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'} />;
          })}
        </div>
      </SectionCard>

      <div className="space-y-3">
        {s.results.map((r, i) => {
          const q = qById.get(r.id);
          return (
            <div key={r.id} className={clsx('card avoid-break border-l-4 p-5', r.correct ? 'border-l-emerald-500' : r.awarded > 0 ? 'border-l-amber-500' : 'border-l-rose-500')}>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                {r.correct ? <CircleCheck className="h-4 w-4 text-emerald-500" /> : <CircleX className="h-4 w-4 text-rose-500" />}
                <span className="font-bold text-slate-500">Q{i + 1}</span>
                <span className="badge bg-slate-100 text-slate-600">{r.subtopic}</span>
                <BloomBadge level={r.bloom_level} />
                <span className="ml-auto font-bold text-slate-700">{r.awarded}/{r.max}</span>
              </div>
              <div className="font-semibold text-slate-900"><Md>{r.prompt}</Md></div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className={clsx('rounded-lg p-3', r.correct ? 'bg-emerald-50' : 'bg-rose-50')}>
                  <div className="text-xs font-bold uppercase text-slate-500">Your answer</div>
                  <div className="mt-0.5 text-slate-800">{r.response ? <Md>{r.response}</Md> : <i className="text-slate-400">No answer</i>}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-bold uppercase text-slate-500">{r.type === 'short' ? 'Model answer' : 'Correct answer'}</div>
                  <div className="mt-0.5 text-slate-800"><Md>{r.answer}</Md></div>
                </div>
              </div>
              {r.feedback && <p className="mt-2 text-sm text-amber-800"><b>Feedback:</b> <Md>{r.feedback}</Md></p>}
              {q?.explanation && <p className="mt-2 text-sm text-slate-600"><b>Why:</b> <Md>{q.explanation}</Md></p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- My performance tab ---------------- */

interface WeakAnalysis {
  summary: string; weak_topics: { topic: string; accuracy: number; diagnosis: string; actions: string[]; practice_idea: string }[];
  strong_topics: string[]; next_steps: string[]; motivation: string; generated_at: string;
}

function Performance() {
  const { session, profile } = useAuth();
  const toast = useToast();
  const uid = session?.user.id;
  const [attempts, setAttempts] = useState<QuizAttempt[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const storageKey = `tutorix-weak-${uid}`;
  const [analysis, setAnalysis] = useState<WeakAnalysis | null>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? 'null'); } catch { return null; }
  });

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('quiz_attempts').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) toast(error.message, 'error');
    setAttempts((data ?? []).map((a) => ({ ...a, score: Number(a.score), max_score: Number(a.max_score), percentage: Number(a.percentage) })) as QuizAttempt[]);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const m = new Map<string, { topic: string; subtopic: string; correct: number; total: number }>();
    for (const a of attempts ?? []) {
      for (const r of a.results ?? []) {
        const topic = a.topic || a.subject || 'General';
        const key = `${topic}›${r.subtopic}`;
        const e = m.get(key) ?? { topic, subtopic: r.subtopic, correct: 0, total: 0 };
        e.total += 1;
        if (r.correct) e.correct += 1;
        m.set(key, e);
      }
    }
    return [...m.values()].map((e) => ({ ...e, accuracy: Math.round((e.correct / e.total) * 100) })).sort((a, b) => a.accuracy - b.accuracy);
  }, [attempts]);

  if (!attempts) return <PageLoader />;
  if (!attempts.length) {
    return (
      <EmptyState icon={<Activity className="h-6 w-6" />} title="No quiz attempts yet" text="Generate a practice quiz, take it, and your performance and weak topics will show up here."
        action={<Link to="/tools/practice-quiz" className="btn btn-primary"><Sparkles className="h-4 w-4" /> Create a quiz</Link>} />
    );
  }

  const avg = Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length);
  const best = Math.round(Math.max(...attempts.map((a) => a.percentage)));
  const questions = attempts.reduce((s, a) => s + (a.results?.length ?? 0), 0);
  const recent = [...attempts].slice(0, 12).reverse();
  const last5 = attempts.slice(0, 5);
  const prev5 = attempts.slice(5, 10);
  const trend = prev5.length ? Math.round(last5.reduce((s, a) => s + a.percentage, 0) / last5.length - prev5.reduce((s, a) => s + a.percentage, 0) / prev5.length) : null;

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const mistakes = attempts.slice(0, 10).flatMap((a) => (a.results ?? []).filter((r) => !r.correct)).slice(0, 15)
        .map((r) => ({ subtopic: r.subtopic, prompt: r.prompt, response: r.response, answer: r.answer }));
      const res = await runTool<WeakAnalysis>('weak-topics', { stats: stats.slice(0, 40), recent_mistakes: mistakes, language: profile?.language ?? 'English' }, { save: false });
      setAnalysis(res.output);
      localStorage.setItem(storageKey, JSON.stringify(res.output));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this attempt from your history?')) return;
    const { error } = await supabase.from('quiz_attempts').delete().eq('id', id);
    if (error) return toast(error.message, 'error');
    setAttempts((a) => (a ?? []).filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Quizzes taken" value={attempts.length} icon={<Activity className="h-5 w-5" />} />
        <StatCard label="Average score" value={`${avg}%`} icon={<Target className="h-5 w-5" />} tone="sky" sub={trend !== null ? `${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}% vs previous 5` : undefined} />
        <StatCard label="Best score" value={`${best}%`} icon={<Trophy className="h-5 w-5" />} tone="amber" />
        <StatCard label="Questions answered" value={questions} icon={<CircleCheck className="h-5 w-5" />} tone="emerald" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Score trend (last 12)" icon={<TrendingUp className="h-5 w-5" />}>
          <ColumnChart data={recent.map((a, i) => ({ label: `${i + 1}`, value: Math.round(a.percentage) }))} />
        </SectionCard>
        <SectionCard title="Accuracy by subtopic" icon={<ChartColumn className="h-5 w-5" />}>
          <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1 scrollbar-thin">
            {stats.map((s) => (
              <HBar key={`${s.topic}›${s.subtopic}`} label={`${s.subtopic} · ${s.topic} (${s.correct}/${s.total})`} value={s.accuracy} max={100} suffix="%"
                color={s.accuracy >= 80 ? 'bg-emerald-500' : s.accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'} />
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="AI weak-topic analysis"
        icon={<Sparkles className="h-5 w-5" />}
        action={<Button size="sm" onClick={analyze} loading={analyzing} icon={<Sparkles className="h-4 w-4" />}>{analysis ? 'Re-analyze' : 'Analyze my weak topics'}</Button>}
      >
        {!analysis && !analyzing && <p className="text-sm text-slate-500">Get a diagnosis of your weak areas with a personal improvement plan based on all your quiz attempts.</p>}
        {analyzing && <p className="text-sm text-slate-500">Studying your answers and mistakes…</p>}
        {analysis && (
          <div className="space-y-5">
            <p className="leading-relaxed text-slate-700"><Md>{analysis.summary}</Md></p>
            <div className="grid gap-3 md:grid-cols-2">
              {analysis.weak_topics.map((w) => (
                <div key={w.topic} className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-slate-900">{w.topic}</b>
                    <span className="badge bg-rose-100 text-rose-700">{w.accuracy}%</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600"><Md>{w.diagnosis}</Md></p>
                  <BulletList className="mt-2" items={w.actions} />
                  {w.practice_idea && <p className="mt-2 text-sm text-brand-800"><b>Try this:</b> <Md>{w.practice_idea}</Md></p>}
                </div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><div className="mb-2 text-sm font-bold text-slate-900">Next steps</div><BulletList items={analysis.next_steps} /></div>
              {analysis.strong_topics.length > 0 && <div><div className="mb-2 text-sm font-bold text-slate-900">Your strengths</div><BulletList items={analysis.strong_topics} /></div>}
            </div>
            {analysis.motivation && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><Lightbulb className="mr-1 inline h-4 w-4" /><Md>{analysis.motivation}</Md></p>}
            <p className="text-xs text-slate-400">Analyzed {timeAgo(analysis.generated_at)}</p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Quiz history" icon={<Activity className="h-5 w-5" />}>
        <div className="overflow-x-auto">
          <table className="table-clean">
            <thead><tr><th>Date</th><th>Topic</th><th>Score</th><th /></tr></thead>
            <tbody>
              {attempts.slice(0, 50).map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap">{formatDate(a.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td>{a.generation_id ? <Link className="font-semibold text-brand-700 hover:underline" to={`/tools/practice-quiz?g=${a.generation_id}`}>{a.topic || a.subject || 'Quiz'}</Link> : (a.topic || 'Quiz')}</td>
                  <td><span className={clsx('badge', a.percentage >= 80 ? 'bg-emerald-100 text-emerald-700' : a.percentage >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}>{a.score}/{a.max_score} · {Math.round(a.percentage)}%</span></td>
                  <td className="text-right"><button className="rounded-lg p-1 text-slate-300 hover:text-rose-500" onClick={() => remove(a.id)} aria-label="Delete attempt"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    `# ${o.title}`,
    ...o.questions.map((q, i) => md.join(
      `**Q${i + 1}.** ${q.prompt} *(${q.marks} mark${q.marks > 1 ? 's' : ''})*`,
      q.type !== 'short' && md.list(q.options.map((opt, j) => `${String.fromCharCode(65 + j)}. ${opt}`)),
    )),
    '---',
    '## Answer key',
    md.list(o.questions.map((q) => `**${q.answer}:** ${q.explanation}`), true),
  );
}

const module: ToolModule<Input, Output> = {
  Form, Result: QuizResult, toMarkdown,
  tabs: [{ id: 'performance', label: 'My performance', Component: Performance }],
  loadingMessages: ['Picking subtopics to test…', 'Writing questions…', 'Checking answers are correct…', 'Almost ready…'],
};
export default module;
