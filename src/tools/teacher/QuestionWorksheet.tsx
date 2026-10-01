import clsx from 'clsx';
import { Eye, EyeOff, Layers } from 'lucide-react';
import { useMemo } from 'react';
import { BloomBars } from '@/components/charts';
import { Md } from '@/components/Markdown';
import { SourceInput } from '@/components/SourceInput';
import { BloomBadge, Button, ChipGroup, Field, Input, SectionCard, Segmented, Select, bloomOptions } from '@/components/ui';
import { md } from '@/lib/export';
import { BLOOM_LEVELS } from '@/lib/types';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

type QType = 'mcq' | 'truefalse' | 'fillblank' | 'short' | 'long' | 'matching';
interface Input {
  mode: 'questions' | 'worksheet'; topic: string; subject: string; grade: string; focus: string; count: number; types: QType[];
  bloom_levels: string[]; difficulty: string; source_text: string; material_ids: string[]; worksheet_title: string; instructions: string; language: string;
}
export interface Question {
  id: string; type: QType; bloom_level: string; difficulty: string; prompt: string; options?: string[];
  pairs?: { left: string; right: string }[]; answer: string; explanation: string; marks: number;
}
interface Output {
  mode: 'questions' | 'worksheet'; title: string; instructions: string; subject: string; grade: string; topic: string;
  questions: Question[]; total_marks: number; distribution: Record<string, number>;
}

export const TYPE_LABELS: Record<QType, string> = {
  mcq: 'Multiple choice', truefalse: 'True / False', fillblank: 'Fill in the blanks', short: 'Short answer', long: 'Long answer', matching: 'Matching',
};
const TYPE_ORDER: QType[] = ['mcq', 'truefalse', 'fillblank', 'matching', 'short', 'long'];

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({
    mode: 'worksheet', topic: '', subject: profile?.subject ?? '', grade: profile?.grade_level ?? '', focus: '', count: 10,
    types: ['mcq', 'fillblank', 'short'], bloom_levels: ['Remember', 'Understand', 'Apply', 'Analyze'], difficulty: 'mixed',
    source_text: '', material_ids: [], worksheet_title: '', instructions: '', language: defaultLanguage(profile),
  }, initial);
  return (
    <FormShell
      onSubmit={() => onSubmit({ ...v, count: Number(v.count) })}
      loading={loading}
      disabled={!v.topic.trim() || !v.types.length}
      submitLabel={v.mode === 'worksheet' ? 'Generate worksheet' : 'Generate questions'}
    >
      <Segmented value={v.mode} onChange={(m) => set('mode', m)} options={[{ value: 'worksheet', label: 'Printable worksheet' }, { value: 'questions', label: 'Question bank' }]} />
      <Grid cols={3}>
        <Field label="Topic" required><Input {...bind('topic')} placeholder="e.g. Fractions" /></Field>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. Mathematics" /></Field>
        <Field label="Grade / class"><Select {...bind('grade')} options={GRADE_OPTIONS} /></Field>
      </Grid>
      <Field label={`Number of questions: ${v.count}`}>
        <input type="range" min={1} max={40} value={v.count} onChange={(e) => set('count', Number(e.target.value))} className="w-full accent-brand-600" />
      </Field>
      <Field label="Question types">
        <ChipGroup options={TYPE_ORDER.map((t) => ({ value: t, label: TYPE_LABELS[t] }))} value={v.types} onChange={(t) => set('types', t)} />
      </Field>
      <Field label="Bloom levels">
        <ChipGroup options={bloomOptions} value={v.bloom_levels} onChange={(t) => set('bloom_levels', t)} />
      </Field>
      <Grid cols={3}>
        <Field label="Difficulty"><Select {...bind('difficulty')} options={[{ value: 'mixed', label: 'Mixed' }, { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} /></Field>
        <Field label="Specific focus"><Input {...bind('focus')} placeholder="e.g. adding unlike fractions" /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
      {v.mode === 'worksheet' && (
        <Grid>
          <Field label="Worksheet title (optional)"><Input {...bind('worksheet_title')} placeholder="e.g. Fractions Practice, Week 3" /></Field>
          <Field label="Instructions (optional)"><Input {...bind('instructions')} placeholder="e.g. Answer all questions. Show your working." /></Field>
        </Grid>
      )}
      <SourceInput value={v.source_text} onChange={(t) => set('source_text', t)} materialIds={v.material_ids} onMaterialIds={(ids) => set('material_ids', ids)} label="Base on your material (optional)" rows={4} />
    </FormShell>
  );
}

function seededShuffle<T>(arr: T[], seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function QuestionBody({ q, showAnswer, printable }: { q: Question; showAnswer: boolean; printable?: boolean }) {
  const rights = useMemo(() => (q.pairs ? seededShuffle(q.pairs.map((p) => p.right), q.id + q.prompt) : []), [q]);
  return (
    <div>
      <div className="text-[15px] leading-relaxed text-slate-900"><Md>{q.prompt}</Md></div>
      {q.type === 'mcq' && q.options && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {q.options.map((opt, i) => (
            <div key={i} className={clsx('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', showAnswer && opt === q.answer ? 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-900' : 'border-slate-200 text-slate-700')}>
              <span className="font-bold text-slate-400">{String.fromCharCode(65 + i)}.</span> <Md>{opt}</Md>
            </div>
          ))}
        </div>
      )}
      {q.type === 'truefalse' && (
        <div className="mt-3 flex gap-3">
          {['True', 'False'].map((x) => (
            <span key={x} className={clsx('rounded-lg border px-4 py-1.5 text-sm', showAnswer && q.answer === x ? 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-900' : 'border-slate-200 text-slate-600')}>{x}</span>
          ))}
        </div>
      )}
      {q.type === 'matching' && q.pairs && (
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="space-y-2">{q.pairs.map((p, i) => <div key={i} className="rounded-lg border border-slate-200 px-3 py-2"><b className="mr-1.5 text-slate-400">{i + 1}.</b>{p.left}</div>)}</div>
          <div className="space-y-2">{rights.map((r, i) => <div key={i} className="rounded-lg border border-slate-200 px-3 py-2"><b className="mr-1.5 text-slate-400">{String.fromCharCode(97 + i)}.</b>{r}</div>)}</div>
        </div>
      )}
      {printable && !showAnswer && (q.type === 'short' || q.type === 'long') && (
        <div className="mt-3 space-y-5">
          {Array.from({ length: q.type === 'long' ? 6 : 2 }).map((_, i) => <div key={i} className="border-b border-dashed border-slate-300" />)}
        </div>
      )}
      {showAnswer && q.type !== 'mcq' && q.type !== 'truefalse' && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><b>Answer: </b><Md>{q.answer}</Md></div>
      )}
      {showAnswer && q.explanation && <div className="mt-2 text-xs leading-relaxed text-slate-500"><b>Why: </b><Md>{q.explanation}</Md></div>}
    </div>
  );
}

function Result({ output: o, state, setState }: ResultProps<Output, Input>) {
  const showAnswers = !!state.showAnswers;
  const sections = TYPE_ORDER.map((t) => ({ type: t, items: o.questions.filter((q) => q.type === t) })).filter((s) => s.items.length);
  let n = 0;

  const toggle = (
    <Button variant="secondary" size="sm" className="no-print" icon={showAnswers ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} onClick={() => setState({ showAnswers: !showAnswers })}>
      {showAnswers ? 'Hide answers' : 'Show answers'}
    </Button>
  );

  if (o.mode === 'worksheet') {
    return (
      <div className="space-y-6">
        <div className="no-print flex justify-end">{toggle}</div>
        <div className="card p-8 sm:p-10">
          <div className="border-b-2 border-slate-900 pb-4 text-center">
            <h2 className="text-2xl font-extrabold text-slate-900">{o.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{[o.subject, o.grade, `Total marks: ${o.total_marks}`].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-6 text-sm text-slate-700">
            <div>Name: <span className="inline-block w-3/4 border-b border-slate-400" /></div>
            <div>Class: <span className="inline-block w-2/3 border-b border-slate-400" /></div>
            <div>Date: <span className="inline-block w-2/3 border-b border-slate-400" /></div>
          </div>
          {o.instructions && <p className="mt-4 rounded-lg bg-slate-50 px-4 py-2 text-sm italic text-slate-600"><Md>{o.instructions}</Md></p>}
          {sections.map((s, si) => (
            <div key={s.type} className="mt-7">
              <h3 className="mb-4 flex items-baseline justify-between border-b border-slate-200 pb-1 font-bold text-slate-900">
                <span>Section {String.fromCharCode(65 + si)}: {TYPE_LABELS[s.type]}</span>
                <span className="text-xs font-semibold text-slate-500">{s.items.reduce((a, q) => a + q.marks, 0)} marks</span>
              </h3>
              <div className="space-y-6">
                {s.items.map((q) => {
                  n++;
                  return (
                    <div key={q.id} className="avoid-break flex gap-3">
                      <span className="w-7 shrink-0 font-bold text-slate-900">{n}.</span>
                      <div className="flex-1"><QuestionBody q={q} showAnswer={showAnswers} printable /></div>
                      <span className="shrink-0 text-xs font-semibold text-slate-400">[{q.marks}]</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-1">
          <div className="text-xs font-bold uppercase text-slate-500">Question bank</div>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">{o.title}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-brand-50 p-3"><div className="text-2xl font-extrabold text-brand-700">{o.questions.length}</div><div className="text-xs font-semibold text-brand-600">questions</div></div>
            <div className="rounded-xl bg-emerald-50 p-3"><div className="text-2xl font-extrabold text-emerald-700">{o.total_marks}</div><div className="text-xs font-semibold text-emerald-600">marks</div></div>
          </div>
          <div className="mt-4">{toggle}</div>
        </div>
        <SectionCard title="Bloom coverage" icon={<Layers className="h-5 w-5" />} className="lg:col-span-2">
          <BloomBars distribution={o.distribution} />
        </SectionCard>
      </div>
      <div className="space-y-4">
        {o.questions.map((q, i) => (
          <div key={q.id} className="card avoid-break p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{i + 1}</span>
              <span className="badge bg-slate-100 text-slate-700">{TYPE_LABELS[q.type]}</span>
              <BloomBadge level={q.bloom_level} />
              <span className="badge bg-slate-100 capitalize text-slate-600">{q.difficulty}</span>
              <span className="ml-auto text-xs font-semibold text-slate-400">{q.marks} mark{q.marks > 1 ? 's' : ''}</span>
            </div>
            <QuestionBody q={q} showAnswer={showAnswers} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function questionsMarkdown(questions: Question[], withAnswers = true) {
  return questions.map((q, i) => {
    const lines = [`**${i + 1}.** ${q.prompt} *(${q.marks} mark${q.marks > 1 ? 's' : ''} · ${q.bloom_level})*`];
    if (q.options && q.type === 'mcq') lines.push(q.options.map((o, j) => `   ${String.fromCharCode(65 + j)}. ${o}`).join('\n'));
    if (q.pairs) lines.push(q.pairs.map((p, j) => `   ${j + 1}. ${p.left}    ${String.fromCharCode(97 + j)}. ${p.right}`).join('\n'));
    if (withAnswers) lines.push(`   **Answer:** ${q.answer}${q.explanation ? `  \n   *${q.explanation}*` : ''}`);
    return lines.join('\n');
  }).join('\n\n');
}

function toMarkdown(o: Output) {
  return md.join(
    `# ${o.title}`,
    [o.subject, o.grade, `Total marks: ${o.total_marks}`].filter(Boolean).join(' · '),
    o.instructions && `*${o.instructions}*`,
    md.section('Questions', questionsMarkdown(o.questions, false)),
    md.section('Answer key', questionsMarkdown(o.questions, true)),
    md.section('Bloom coverage', md.table(['Level', 'Count'], BLOOM_LEVELS.map((l) => [l, o.distribution[l] ?? 0]))),
  );
}

const module: ToolModule<Input, Output> = {
  Form, Result, toMarkdown,
  loadingMessages: ['Mapping the topic…', 'Writing questions across Bloom levels…', 'Crafting plausible distractors…', 'Writing the answer key…', 'Laying out the worksheet…'],
};
export default module;
