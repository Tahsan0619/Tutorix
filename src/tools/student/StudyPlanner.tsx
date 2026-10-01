import clsx from 'clsx';
import { CalendarDays, Check, Clock, Lightbulb, Plus, Target, Trash2 } from 'lucide-react';
import { HBar } from '@/components/charts';
import { BulletList, Md } from '@/components/Markdown';
import { Button, ChipGroup, Field, Input, SectionCard, Select, Textarea } from '@/components/ui';
import { md } from '@/lib/export';
import { formatDate, minutesLabel, todayIso } from '@/lib/format';
import { FormShell, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Subject { name: string; exam_date: string; difficulty: number; confidence: number; topics: string }
interface Input {
  subjects: Subject[]; start_date: string; days: string; weekday_hours: string; weekend_hours: string; weekend_days: string[];
  preferred_time: string; day_start: string; break_style: string; notes: string; language: string;
}
type SessionType = 'learn' | 'practice' | 'revise' | 'mock' | 'break';
interface Session { id: string; start: string; end: string; subject: string; activity: string; type: SessionType }
interface Day { date: string; day: string; hours: number; focus: string; sessions: Session[] }
interface Output { summary: string; subjects: Subject[]; days: Day[]; weekly_goals: string[]; tips: string[] }

const DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const emptySubject = (): Subject => ({ name: '', exam_date: '', difficulty: 3, confidence: 3, topics: '' });

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({
    subjects: [emptySubject(), emptySubject()], start_date: todayIso(), days: '7', weekday_hours: '3', weekend_hours: '5',
    weekend_days: ['Fri', 'Sat'], preferred_time: 'evening', day_start: '16:00', break_style: 'pomodoro (50 min study / 10 min break)', notes: '',
    language: defaultLanguage(profile),
  }, initial);
  const updateSubject = (i: number, patch: Partial<Subject>) => set('subjects', v.subjects.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const valid = v.subjects.some((s) => s.name.trim());

  return (
    <FormShell onSubmit={() => onSubmit({ ...v, subjects: v.subjects.filter((s) => s.name.trim()) })} loading={loading} disabled={!valid} submitLabel="Build my timetable">
      <div>
        <div className="label">Subjects</div>
        <div className="space-y-3">
          {v.subjects.map((s, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_160px_130px_130px_auto]">
                <Input placeholder="Subject e.g. Physics" value={s.name} onChange={(e) => updateSubject(i, { name: e.target.value })} />
                <Input type="date" title="Exam date" value={s.exam_date} onChange={(e) => updateSubject(i, { exam_date: e.target.value })} />
                <Select title="Difficulty" value={String(s.difficulty)} onChange={(e) => updateSubject(i, { difficulty: +e.target.value })} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Difficulty ${n}/5` }))} />
                <Select title="Confidence" value={String(s.confidence)} onChange={(e) => updateSubject(i, { confidence: +e.target.value })} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Confidence ${n}/5` }))} />
                <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30" disabled={v.subjects.length <= 1} onClick={() => set('subjects', v.subjects.filter((_, j) => j !== i))} aria-label="Remove subject">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Input className="mt-2" placeholder="Topics / chapters to cover (optional)" value={s.topics} onChange={(e) => updateSubject(i, { topics: e.target.value })} />
            </div>
          ))}
        </div>
        {v.subjects.length < 10 && (
          <Button type="button" variant="ghost" size="sm" className="mt-2" icon={<Plus className="h-4 w-4" />} onClick={() => set('subjects', [...v.subjects, emptySubject()])}>Add subject</Button>
        )}
      </div>
      <Grid cols={4}>
        <Field label="Start date"><Input type="date" {...bind('start_date')} /></Field>
        <Field label="Number of days"><Select {...bind('days')} options={['3', '5', '7', '10', '14']} /></Field>
        <Field label="Hours on school days"><Select {...bind('weekday_hours')} options={['1', '1.5', '2', '2.5', '3', '4', '5', '6']} /></Field>
        <Field label="Hours on weekends"><Select {...bind('weekend_hours')} options={['2', '3', '4', '5', '6', '7', '8', '10']} /></Field>
      </Grid>
      <Grid cols={3}>
        <Field label="Preferred study time"><Select {...bind('preferred_time')} options={['morning', 'afternoon', 'evening', 'night']} /></Field>
        <Field label="Day starts at"><Input type="time" {...bind('day_start')} /></Field>
        <Field label="Break style">
          <Select {...bind('break_style')} options={['pomodoro (25 min study / 5 min break)', 'pomodoro (50 min study / 10 min break)', '90 min deep-work blocks', 'flexible']} />
        </Field>
      </Grid>
      <Field label="Weekend days">
        <ChipGroup options={DAYS.map((d) => ({ value: d, label: d }))} value={v.weekend_days} onChange={(w) => set('weekend_days', w.slice(-2))} />
      </Field>
      <Grid>
        <Field label="Other commitments (optional)"><Textarea rows={2} {...bind('notes')} placeholder="e.g. Coaching Sun/Tue 5-7pm, football on Friday morning" /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
    </FormShell>
  );
}

const TYPE_STYLE: Record<SessionType, string> = {
  learn: 'border-l-brand-500 bg-brand-50/60',
  practice: 'border-l-emerald-500 bg-emerald-50/60',
  revise: 'border-l-amber-500 bg-amber-50/60',
  mock: 'border-l-rose-500 bg-rose-50/60',
  break: 'border-l-slate-300 bg-slate-50',
};
const TYPE_BADGE: Record<SessionType, string> = {
  learn: 'bg-brand-100 text-brand-700', practice: 'bg-emerald-100 text-emerald-700', revise: 'bg-amber-100 text-amber-700', mock: 'bg-rose-100 text-rose-700', break: 'bg-slate-100 text-slate-500',
};

function mins(a: string, b: string) {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  const d = bh * 60 + bm - (ah * 60 + am);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

function Result({ output: o, state, setState }: ResultProps<Output, Input>) {
  const done: string[] = state.done ?? [];
  const today = todayIso();
  const study = o.days.flatMap((d) => d.sessions).filter((s) => s.type !== 'break');
  const doneCount = study.filter((s) => done.includes(s.id)).length;
  const toggle = (id: string) => setState({ done: done.includes(id) ? done.filter((x) => x !== id) : [...done, id] });

  const perSubject = new Map<string, number>();
  for (const s of study) perSubject.set(s.subject || 'Other', (perSubject.get(s.subject || 'Other') ?? 0) + mins(s.start, s.end));
  const maxMin = Math.max(1, ...perSubject.values());
  const totalMin = [...perSubject.values()].reduce((a, b) => a + b, 0);
  const exams = o.subjects.filter((s) => s.exam_date).sort((a, b) => a.exam_date.localeCompare(b.exam_date));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card p-6">
          <div className="flex flex-wrap gap-2">
            <span className="badge bg-brand-50 text-brand-700"><CalendarDays className="h-3 w-3" /> {o.days.length} days</span>
            <span className="badge bg-sky-50 text-sky-700"><Clock className="h-3 w-3" /> {minutesLabel(totalMin)} planned</span>
            <span className="badge bg-emerald-50 text-emerald-700"><Check className="h-3 w-3" /> {doneCount}/{study.length} sessions done</span>
          </div>
          <p className="mt-3 leading-relaxed text-slate-600"><Md>{o.summary}</Md></p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${study.length ? (doneCount / study.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="card p-6">
          <div className="mb-3 text-sm font-bold text-slate-900">Time per subject</div>
          <div className="space-y-2.5">{[...perSubject.entries()].sort((a, b) => b[1] - a[1]).map(([s, m]) => <HBar key={s} label={s} value={m} max={maxMin} suffix=" min" />)}</div>
        </div>
      </div>

      {exams.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {exams.map((s) => {
            const daysLeft = Math.round((new Date(`${s.exam_date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
            return (
              <div key={s.name} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm">
                <b className="text-rose-800">{s.name}</b> <span className="text-rose-700">exam {formatDate(s.exam_date)}</span>
                <span className="ml-2 badge bg-white text-rose-700">{daysLeft < 0 ? 'done' : daysLeft === 0 ? 'today!' : `${daysLeft}d left`}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {o.days.map((d) => {
          const isToday = d.date === today;
          const dayStudy = d.sessions.filter((s) => s.type !== 'break');
          const dayDone = dayStudy.length > 0 && dayStudy.every((s) => done.includes(s.id));
          return (
            <div key={d.date} className={clsx('card avoid-break p-4', isToday && 'ring-2 ring-brand-500', dayDone && 'bg-emerald-50/40')}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold uppercase text-slate-500">{d.day} · {formatDate(d.date)}{isToday && <span className="ml-1.5 text-brand-600">Today</span>}</div>
                  <div className="font-bold text-slate-900">{d.focus || 'Study day'}</div>
                </div>
                <span className="badge bg-slate-100 text-slate-600">{d.hours}h</span>
              </div>
              <div className="space-y-2">
                {d.sessions.length === 0 && <p className="text-sm text-slate-400">Rest day</p>}
                {d.sessions.map((s) => {
                  const isDone = done.includes(s.id);
                  if (s.type === 'break') {
                    return <div key={s.id} className="px-3 text-xs text-slate-400">{s.start}–{s.end} · {s.activity || 'Break'}</div>;
                  }
                  return (
                    <button key={s.id} type="button" onClick={() => toggle(s.id)} className={clsx('flex w-full items-start gap-2.5 rounded-lg border-l-4 p-2.5 text-left transition hover:shadow-sm', TYPE_STYLE[s.type], isDone && 'opacity-60')}>
                      <span className={clsx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2', isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white')}>
                        {isDone && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 text-xs">
                          <b className="text-slate-700">{s.start}–{s.end}</b>
                          <span className={clsx('badge capitalize', TYPE_BADGE[s.type])}>{s.type}</span>
                        </span>
                        <span className={clsx('mt-0.5 block text-sm font-semibold text-slate-900', isDone && 'line-through')}>{s.subject}</span>
                        <span className="block text-xs leading-snug text-slate-600"><Md>{s.activity}</Md></span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Goals for this plan" icon={<Target className="h-5 w-5" />}><BulletList items={o.weekly_goals} /></SectionCard>
        <SectionCard title="Study tips" icon={<Lightbulb className="h-5 w-5" />}><BulletList items={o.tips} /></SectionCard>
      </div>
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    '# Study timetable',
    o.summary,
    md.section('Exams', md.list(o.subjects.filter((s) => s.exam_date).map((s) => `**${s.name}:** ${s.exam_date}`))),
    ...o.days.map((d) => md.join(
      `## ${d.day} ${d.date}: ${d.focus || 'Study'} (${d.hours}h)`,
      d.sessions.length ? md.table(['Time', 'Subject', 'Activity', 'Type'], d.sessions.map((s) => [`${s.start}–${s.end}`, s.subject, s.activity, s.type])) : '_Rest day_',
    )),
    md.section('Goals', md.list(o.weekly_goals)),
    md.section('Tips', md.list(o.tips)),
  );
}

const module: ToolModule<Input, Output> = {
  Form, Result, toMarkdown,
  loadingMessages: ['Checking your exam dates…', 'Balancing subjects by difficulty…', 'Adding spaced repetition…', 'Scheduling breaks…', 'Finalizing your timetable…'],
};
export default module;
