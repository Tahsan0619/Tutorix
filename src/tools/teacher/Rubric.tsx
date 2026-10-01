import clsx from 'clsx';
import { Calculator, ClipboardCheck, ListChecks, MessageSquareText, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { BulletList, Md } from '@/components/Markdown';
import { Button, Field, Input, SectionCard, Segmented, Select, Textarea } from '@/components/ui';
import { md } from '@/lib/export';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input {
  assignment: string; subject: string; grade: string; type: 'analytic' | 'holistic' | 'single-point'; levels: number;
  total_points: number; criteria_count: number; objectives: string; criteria_hint: string; language: string;
}
interface Output {
  title: string; description: string; type: string; total_points: number; levels: { name: string; band: string }[];
  criteria: { name: string; weight: number; descriptors: string[] }[]; scoring_guide: string[]; student_checklist: string[]; feedback_tips: string[];
}

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({
    assignment: '', subject: profile?.subject ?? '', grade: profile?.grade_level ?? '', type: 'analytic', levels: 4, total_points: 20,
    criteria_count: 4, objectives: '', criteria_hint: '', language: defaultLanguage(profile),
  }, initial);
  return (
    <FormShell onSubmit={() => onSubmit({ ...v, levels: Number(v.levels), total_points: Number(v.total_points), criteria_count: Number(v.criteria_count) })} loading={loading} disabled={v.assignment.trim().length < 5} submitLabel="Generate rubric">
      <Field label="Assignment / task" required>
        <Textarea rows={3} {...bind('assignment')} placeholder="e.g. Persuasive essay (500 words) arguing for or against a plastic bag ban, using at least two sources." />
      </Field>
      <Field label="Rubric type">
        <Segmented
          value={v.type}
          onChange={(t) => set('type', t)}
          options={[{ value: 'analytic', label: 'Analytic' }, { value: 'holistic', label: 'Holistic' }, { value: 'single-point', label: 'Single-point' }]}
        />
      </Field>
      <Grid cols={4}>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. English" /></Field>
        <Field label="Grade / class"><Select {...bind('grade')} options={GRADE_OPTIONS} /></Field>
        <Field label="Total points"><Input type="number" min={4} max={1000} {...bind('total_points')} /></Field>
        {v.type !== 'single-point' ? (
          <Field label="Performance levels"><Select {...bind('levels')} options={['3', '4', '5', '6']} /></Field>
        ) : <div />}
      </Grid>
      <Grid>
        {v.type === 'analytic' && <Field label="Number of criteria"><Select {...bind('criteria_count')} options={['2', '3', '4', '5', '6', '7', '8']} /></Field>}
        <Field label="Criteria you want (optional)"><Input {...bind('criteria_hint')} placeholder="e.g. thesis, evidence, organization, grammar" /></Field>
        <Field label="Learning objectives (optional)"><Input {...bind('objectives')} placeholder="What the task assesses" /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
    </FormShell>
  );
}

const LEVEL_TONES = ['bg-emerald-50', 'bg-sky-50', 'bg-amber-50', 'bg-orange-50', 'bg-rose-50', 'bg-slate-50'];

function levelPoints(weight: number, idx: number, count: number) {
  const r = (n: number) => Math.round(n * 2) / 2;
  const hi = r((weight * (count - idx)) / count);
  const lo = r((weight * (count - idx - 1)) / count);
  return lo === hi ? `${hi}` : `${lo}–${hi}`;
}

function Result({ output: o }: ResultProps<Output, Input>) {
  const [scoring, setScoring] = useState(false);
  const [picks, setPicks] = useState<Record<number, number>>({});
  const n = o.levels.length;
  const single = o.type === 'single-point';
  const total = o.criteria.reduce((s, c, ci) => (picks[ci] === undefined ? s : s + (c.weight * (n - picks[ci])) / n), 0);
  const done = Object.keys(picks).length === o.criteria.length;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <span className="badge bg-emerald-50 capitalize text-emerald-700">{o.type} rubric · {o.total_points} points</span>
        <h2 className="mt-3 text-2xl font-extrabold text-slate-900">{o.title}</h2>
        <p className="mt-2 text-slate-600"><Md>{o.description}</Md></p>
      </div>

      <SectionCard
        title="Rubric"
        icon={<ClipboardCheck className="h-5 w-5" />}
        action={!single && (
          <div className="no-print flex items-center gap-2">
            {scoring && <Button variant="ghost" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setPicks({})}>Reset</Button>}
            <Button variant={scoring ? 'primary' : 'secondary'} size="sm" icon={<Calculator className="h-3.5 w-3.5" />} onClick={() => setScoring(!scoring)}>
              {scoring ? 'Done scoring' : 'Score a student'}
            </Button>
          </div>
        )}
      >
        {scoring && (
          <div className="no-print mb-4 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
            <span className="text-sm text-brand-900">Click a cell in each row to pick the performance level.</span>
            <span className="text-lg font-extrabold text-brand-700">{Math.round(total * 10) / 10} / {o.total_points}{done && ` · ${Math.round((total / o.total_points) * 100)}%`}</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-44 border border-slate-200 bg-slate-50 p-3 text-left text-xs font-bold uppercase text-slate-500">Criterion</th>
                {o.levels.map((l, i) => (
                  <th key={i} className={clsx('border border-slate-200 p-3 text-left', LEVEL_TONES[i] ?? 'bg-slate-50')}>
                    <div className="font-bold text-slate-900">{l.name}</div>
                    {l.band && <div className="text-xs font-medium text-slate-500">{l.band}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {o.criteria.map((c, ci) => (
                <tr key={ci} className="avoid-break">
                  <td className="border border-slate-200 bg-slate-50/60 p-3 align-top">
                    <div className="font-bold text-slate-900">{c.name}</div>
                    <div className="mt-1 text-xs font-semibold text-brand-600">{c.weight} pts</div>
                  </td>
                  {c.descriptors.map((d, li) => (
                    <td
                      key={li}
                      onClick={() => scoring && setPicks({ ...picks, [ci]: li })}
                      className={clsx(
                        'border border-slate-200 p-3 align-top leading-relaxed text-slate-700 transition',
                        scoring && 'cursor-pointer hover:bg-brand-50',
                        picks[ci] === li && scoring && 'bg-brand-100 ring-2 ring-inset ring-brand-500',
                        single && li === 1 && 'bg-emerald-50/50 font-medium',
                      )}
                    >
                      {d || (single ? <span className="text-slate-300">Teacher notes…</span> : '')}
                      {!single && <div className="mt-2 text-[11px] font-semibold text-slate-400">{levelPoints(c.weight, li, n)} pts</div>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Scoring guide" icon={<Calculator className="h-5 w-5" />}><BulletList items={o.scoring_guide} /></SectionCard>
        <SectionCard title="Student self-check" icon={<ListChecks className="h-5 w-5" />}>
          <ul className="space-y-2">
            {o.student_checklist.map((x, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-700"><span className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-slate-300" />{x}</li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Feedback tips" icon={<MessageSquareText className="h-5 w-5" />}><BulletList items={o.feedback_tips} /></SectionCard>
      </div>
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    `# ${o.title}`,
    `*${o.type} rubric · ${o.total_points} points*`,
    o.description,
    md.table(['Criterion', ...o.levels.map((l) => `${l.name}${l.band ? ` (${l.band})` : ''}`)], o.criteria.map((c) => [`**${c.name}** (${c.weight} pts)`, ...c.descriptors])),
    md.section('Scoring guide', md.list(o.scoring_guide)),
    md.section('Student self-check', md.list(o.student_checklist.map((x) => `[ ] ${x}`))),
    md.section('Feedback tips', md.list(o.feedback_tips)),
  );
}

const module: ToolModule<Input, Output> = { Form, Result, toMarkdown };
export default module;
