import clsx from 'clsx';
import { BadgeCheck, BookOpen, ChevronDown, Dumbbell, Eye, Flag, ListChecks, Route, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { BulletList, Markdown, Md } from '@/components/Markdown';
import { Button, Field, Input, SectionCard, Segmented, Select, Textarea } from '@/components/ui';
import { md } from '@/lib/export';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input { problem: string; subject: string; level: string; method: string; language: string }
interface Output {
  problem: string; subject: string; topic: string; given: string[]; find: string; concepts: string[]; strategy: string;
  steps: { title: string; work: string; why: string }[]; final_answer: string; verification: string; common_mistakes: string[];
  practice: { problem: string; answer: string } | null;
}

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({ problem: '', subject: profile?.subject ?? '', level: profile?.grade_level ?? '', method: '', language: defaultLanguage(profile) }, initial);
  return (
    <FormShell onSubmit={() => onSubmit(v)} loading={loading} disabled={v.problem.trim().length < 5} submitLabel="Solve step by step" footer="Tip: write powers as x^2 and fractions as a/b. The AI understands both.">
      <Field label="Your problem" required>
        <Textarea rows={4} {...bind('problem')} placeholder="e.g. A car accelerates uniformly from rest to 72 km/h in 10 s. Find its acceleration and the distance covered." />
      </Field>
      <Grid cols={4}>
        <Field label="Subject"><Select {...bind('subject')} options={['', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Accounting', 'Economics', 'Statistics', 'Computer Science', 'Other'].map((s) => ({ value: s, label: s || 'Auto-detect' }))} /></Field>
        <Field label="Class / level"><Select {...bind('level')} options={GRADE_OPTIONS} /></Field>
        <Field label="Method (optional)"><Input {...bind('method')} placeholder="e.g. use substitution" /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
    </FormShell>
  );
}

function Result({ output: o, state, setState }: ResultProps<Output, Input>) {
  const mode: 'all' | 'step' = state.mode ?? 'all';
  const revealed: number = state.revealed ?? 1;
  const [practiceOpen, setPracticeOpen] = useState(false);
  const visible = mode === 'all' ? o.steps.length : Math.min(revealed, o.steps.length);
  const finished = visible >= o.steps.length;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-center gap-2">
          {o.subject && <span className="badge bg-brand-50 text-brand-700">{o.subject}</span>}
          {o.topic && <span className="badge bg-slate-100 text-slate-600">{o.topic}</span>}
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-4 text-slate-800"><Markdown className="prose-sm">{o.problem}</Markdown></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-900"><ListChecks className="h-4 w-4 text-brand-600" /> Given</div>
            <ul className="space-y-1 text-sm text-slate-700">{o.given.map((g, i) => <li key={i}>• <Md>{g}</Md></li>)}</ul>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-900"><Flag className="h-4 w-4 text-brand-600" /> Find</div>
            <p className="text-sm text-slate-700"><Md>{o.find}</Md></p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {o.concepts.length > 0 && (
          <SectionCard title="Concepts & formulas" icon={<BookOpen className="h-5 w-5" />}>
            <ul className="space-y-2 text-sm text-slate-700">{o.concepts.map((c, i) => <li key={i} className="rounded-lg bg-brand-50/60 px-3 py-2"><Md>{c}</Md></li>)}</ul>
          </SectionCard>
        )}
        {o.strategy && (
          <SectionCard title="Strategy" icon={<Route className="h-5 w-5" />}>
            <p className="leading-relaxed text-slate-700"><Md>{o.strategy}</Md></p>
          </SectionCard>
        )}
      </div>

      <div className="card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Solution · {o.steps.length} steps</h3>
          <div className="no-print">
            <Segmented value={mode} onChange={(m) => setState({ mode: m, revealed: 1 })} options={[{ value: 'all', label: 'Show all' }, { value: 'step', label: 'One step at a time', icon: <Eye className="h-4 w-4" /> }]} />
          </div>
        </div>
        <ol className="space-y-4">
          {o.steps.slice(0, visible).map((s, i) => (
            <li key={i} className="avoid-break relative animate-fade-in pl-11">
              <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-sm font-bold text-white">{i + 1}</span>
              {i < o.steps.length - 1 && <span className="absolute bottom-[-16px] left-[15px] top-9 w-0.5 bg-brand-100" />}
              <div className="font-bold text-slate-900"><Md>{s.title}</Md></div>
              <div className="mt-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4"><Markdown className="prose-sm">{s.work}</Markdown></div>
              {s.why && <p className="mt-1.5 text-sm text-slate-500"><b className="text-slate-600">Why: </b><Md>{s.why}</Md></p>}
            </li>
          ))}
        </ol>
        {!finished && (
          <div className="no-print mt-4 flex justify-center">
            <Button variant="secondary" icon={<ChevronDown className="h-4 w-4" />} onClick={() => setState({ revealed: visible + 1 })}>
              Try the next step yourself, then reveal step {visible + 1}
            </Button>
          </div>
        )}
      </div>

      {finished && (
        <>
          <div className="card avoid-break border-2 border-emerald-300 bg-emerald-50/60 p-6">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-700"><BadgeCheck className="h-5 w-5" /> Final answer</div>
            <div className="mt-2 text-lg font-bold text-slate-900"><Markdown>{o.final_answer}</Markdown></div>
            {o.verification && <p className="mt-3 text-sm text-emerald-900"><b>Check: </b><Md>{o.verification}</Md></p>}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {o.common_mistakes.length > 0 && <SectionCard title="Watch out for" icon={<TriangleAlert className="h-5 w-5" />}><BulletList items={o.common_mistakes} /></SectionCard>}
            {o.practice && (
              <SectionCard title="Now you try" icon={<Dumbbell className="h-5 w-5" />}>
                <div className="text-slate-800"><Md>{o.practice.problem}</Md></div>
                <button type="button" className={clsx('no-print mt-3 text-sm font-semibold text-brand-600 hover:underline', practiceOpen && 'hidden')} onClick={() => setPracticeOpen(true)}>Show answer</button>
                {practiceOpen && <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><b>Answer: </b><Md>{o.practice.answer}</Md></div>}
              </SectionCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    '# Problem',
    o.problem,
    md.section('Given', md.list(o.given)),
    o.find && `**Find:** ${o.find}`,
    md.section('Concepts', md.list(o.concepts)),
    o.strategy && `**Strategy:** ${o.strategy}`,
    '## Solution',
    ...o.steps.map((s, i) => md.join(`### Step ${i + 1}: ${s.title}`, s.work, s.why && `*Why:* ${s.why}`)),
    `## Final answer\n\n${o.final_answer}`,
    o.verification && `**Check:** ${o.verification}`,
    md.section('Common mistakes', md.list(o.common_mistakes)),
    o.practice ? md.section('Practice', `${o.practice.problem}\n\n**Answer:** ${o.practice.answer}`) : '',
  );
}

const module: ToolModule<Input, Output> = {
  Form, Result, toMarkdown,
  loadingMessages: ['Reading the problem…', 'Identifying what is given…', 'Choosing the right method…', 'Working through each step…', 'Verifying the answer…'],
};
export default module;
