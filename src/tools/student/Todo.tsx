import clsx from 'clsx';
import { Check, Clock, Flame, Lightbulb, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ScoreRing } from '@/components/charts';
import { BulletList, Md } from '@/components/Markdown';
import { Button, Field, Input, SectionCard, Select, Textarea } from '@/components/ui';
import { md } from '@/lib/export';
import { formatDate, minutesLabel, todayIso } from '@/lib/format';
import { FormShell, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input { goal: string; deadline: string; hours_per_day: string; context: string; language: string }
interface Task { id: string; title: string; detail: string; estimate_minutes: number; priority: 'high' | 'medium' | 'low'; due: string }
interface Output { goal: string; deadline: string; summary: string; phases: { name: string; tasks: Task[] }[]; total_minutes: number; tips: string[] }

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({ goal: '', deadline: '', hours_per_day: '2', context: '', language: defaultLanguage(profile) }, initial);
  return (
    <FormShell onSubmit={() => onSubmit(v)} loading={loading} disabled={v.goal.trim().length < 5} submitLabel="Break it down">
      <Field label="Your goal" required>
        <Textarea rows={2} {...bind('goal')} placeholder="e.g. Prepare for my physics final exam / Finish my science fair project / Learn 500 English words" />
      </Field>
      <Grid cols={3}>
        <Field label="Deadline"><Input type="date" min={todayIso()} {...bind('deadline')} /></Field>
        <Field label="Hours per day you can give"><Select {...bind('hours_per_day')} options={['0.5', '1', '1.5', '2', '3', '4', '5', '6', '8']} /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
      <Field label="Where are you now? (optional)"><Input {...bind('context')} placeholder="e.g. I finished chapters 1-3 but I'm weak at numericals" /></Field>
    </FormShell>
  );
}

const PRIORITY: Record<string, string> = { high: 'bg-rose-100 text-rose-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-slate-100 text-slate-600' };

function Result({ output: o, state, setState }: ResultProps<Output, Input>) {
  const done: string[] = state.done ?? [];
  const custom: Task[] = state.custom ?? [];
  const [newTask, setNewTask] = useState('');
  const all = [...o.phases.flatMap((p) => p.tasks), ...custom];
  const doneCount = all.filter((t) => done.includes(t.id)).length;
  const remaining = all.filter((t) => !done.includes(t.id)).reduce((s, t) => s + t.estimate_minutes, 0);
  const toggle = (id: string) => setState({ done: done.includes(id) ? done.filter((x) => x !== id) : [...done, id] });
  const today = todayIso();

  const TaskRow = ({ t, removable }: { t: Task; removable?: boolean }) => {
    const isDone = done.includes(t.id);
    const overdue = t.due && t.due < today && !isDone;
    return (
      <div className={clsx('group flex items-start gap-3 rounded-xl border p-3.5 transition', isDone ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 hover:border-brand-200')}>
        <button onClick={() => toggle(t.id)} className={clsx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition', isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-brand-500')} aria-label="Toggle task">
          {isDone && <Check className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={clsx('font-semibold', isDone ? 'text-slate-400 line-through' : 'text-slate-900')}>{t.title}</div>
          {t.detail && <p className={clsx('mt-0.5 text-sm', isDone ? 'text-slate-400' : 'text-slate-600')}><Md>{t.detail}</Md></p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={clsx('badge capitalize', PRIORITY[t.priority])}>{t.priority}</span>
            <span className="flex items-center gap-1 text-slate-500"><Clock className="h-3 w-3" />{minutesLabel(t.estimate_minutes)}</span>
            {t.due && <span className={clsx('font-semibold', overdue ? 'text-rose-600' : 'text-slate-500')}>{overdue ? 'Overdue · ' : 'Due '}{formatDate(t.due)}</span>}
          </div>
        </div>
        {removable && (
          <button className="no-print rounded-lg p-1 text-slate-300 opacity-0 hover:text-rose-500 group-hover:opacity-100" onClick={() => setState({ custom: custom.filter((c) => c.id !== t.id), done: done.filter((d) => d !== t.id) })} aria-label="Remove">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="card grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center">
        <ScoreRing value={all.length ? (doneCount / all.length) * 100 : 0} label="done" size={120} color="#10b981" />
        <div>
          <div className="text-xs font-bold uppercase text-slate-500">Goal</div>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900"><Md>{o.goal}</Md></h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600"><Md>{o.summary}</Md></p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="badge bg-emerald-100 text-emerald-700">{doneCount}/{all.length} tasks done</span>
            <span className="badge bg-sky-100 text-sky-700">{minutesLabel(remaining)} left</span>
            {o.deadline && <span className="badge bg-rose-100 text-rose-700"><Flame className="h-3 w-3" /> Deadline {formatDate(o.deadline)}</span>}
          </div>
        </div>
      </div>

      {o.phases.map((p, i) => {
        const pd = p.tasks.filter((t) => done.includes(t.id)).length;
        return (
          <SectionCard key={i} title={`${i + 1}. ${p.name}`} action={<span className="text-xs font-semibold text-slate-500">{pd}/{p.tasks.length}</span>}>
            <div className="space-y-2.5">{p.tasks.map((t) => <TaskRow key={t.id} t={t} />)}</div>
          </SectionCard>
        );
      })}

      <SectionCard title="My own tasks" icon={<Plus className="h-5 w-5" />}>
        <div className="space-y-2.5">{custom.map((t) => <TaskRow key={t.id} t={t} removable />)}</div>
        <form
          className="no-print mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTask.trim()) return;
            setState({ custom: [...custom, { id: `u${Date.now()}`, title: newTask.trim(), detail: '', estimate_minutes: 30, priority: 'medium', due: '' }] });
            setNewTask('');
          }}
        >
          <input className="input" placeholder="Add a task…" value={newTask} onChange={(e) => setNewTask(e.target.value)} />
          <Button type="submit" variant="secondary" icon={<Plus className="h-4 w-4" />}>Add</Button>
        </form>
      </SectionCard>

      {o.tips.length > 0 && <SectionCard title="Stay on track" icon={<Lightbulb className="h-5 w-5" />}><BulletList items={o.tips} /></SectionCard>}
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    `# To-do: ${o.goal}`,
    o.deadline && `**Deadline:** ${o.deadline} · **Total time:** ${minutesLabel(o.total_minutes)}`,
    o.summary,
    ...o.phases.map((p, i) => `## ${i + 1}. ${p.name}\n\n${p.tasks.map((t) => `- [ ] **${t.title}** (${t.priority}, ${minutesLabel(t.estimate_minutes)}${t.due ? `, due ${t.due}` : ''})${t.detail ? `: ${t.detail}` : ''}`).join('\n')}`),
    md.section('Tips', md.list(o.tips)),
  );
}

const module: ToolModule<Input, Output> = { Form, Result, toMarkdown };
export default module;
