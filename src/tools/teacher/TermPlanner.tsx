import clsx from 'clsx';
import { CalendarRange, Check, ClipboardCheck, Lightbulb, PartyPopper } from 'lucide-react';
import { SourceInput } from '@/components/SourceInput';
import { BulletList, Md } from '@/components/Markdown';
import { ChipGroup, Field, Input, SectionCard, Select, StatCard, Textarea } from '@/components/ui';
import { md } from '@/lib/export';
import { addDaysIso, formatDate, todayIso } from '@/lib/format';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input {
  subject: string; grade: string; syllabus: string; start_date: string; end_date: string; classes_per_week: number;
  minutes_per_class: number; work_days: string[]; holidays: string; assessments: string; notes: string; language: string;
}
interface Week {
  week: number; start: string; end: string; teaching_days: number; sessions: number; holiday_note: string; is_break: boolean;
  unit: string; topics: string[]; objectives: string[]; activities: string[]; assessment: string; resources: string[];
}
interface Output {
  title: string; overview: string; subject: string; grade: string; start_date: string; end_date: string; classes_per_week: number;
  total_sessions: number; weeks: Week[]; assessment_calendar: { week: number; type: string; description: string }[];
  pacing_tips: string[]; holidays: { start: string; end: string; label: string }[];
}

const DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({
    subject: profile?.subject ?? '', grade: profile?.grade_level ?? '', syllabus: '', start_date: todayIso(), end_date: addDaysIso(todayIso(), 90),
    classes_per_week: 4, minutes_per_class: 45, work_days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'], holidays: '', assessments: '', notes: '', language: defaultLanguage(profile),
  }, initial);
  const valid = v.syllabus.trim().length > 10 && v.start_date && v.end_date && v.end_date > v.start_date && v.work_days.length > 0;
  return (
    <FormShell onSubmit={() => onSubmit({ ...v, classes_per_week: Number(v.classes_per_week), minutes_per_class: Number(v.minutes_per_class) })} loading={loading} disabled={!valid} submitLabel="Build term plan">
      <Grid cols={4}>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. Biology" /></Field>
        <Field label="Grade / class"><Select {...bind('grade')} options={GRADE_OPTIONS} /></Field>
        <Field label="Term starts" required><Input type="date" {...bind('start_date')} /></Field>
        <Field label="Term ends" required><Input type="date" {...bind('end_date')} /></Field>
        <Field label="Classes per week"><Select {...bind('classes_per_week')} options={['1', '2', '3', '4', '5', '6', '7', '8', '10']} /></Field>
        <Field label="Minutes per class"><Select {...bind('minutes_per_class')} options={['30', '35', '40', '45', '50', '60', '90']} /></Field>
        <div className="sm:col-span-2"><Field label="School days"><ChipGroup options={DAYS.map((d) => ({ value: d, label: d }))} value={v.work_days} onChange={(x) => set('work_days', x)} /></Field></div>
      </Grid>
      <SourceInput label="Syllabus (chapters / topics, one per line)" value={v.syllabus} onChange={(t) => set('syllabus', t)} rows={7} placeholder={'Chapter 1: Cell structure\nChapter 2: Cell division\nChapter 3: Tissues\n…'} />
      <Grid>
        <Field label="Holidays & breaks" hint="One per line: YYYY-MM-DD name, or YYYY-MM-DD to YYYY-MM-DD name">
          <Textarea rows={4} {...bind('holidays')} placeholder={'2026-12-16 Victory Day\n2026-12-20 to 2026-12-31 Winter break'} />
        </Field>
        <div className="space-y-4">
          <Field label="Planned assessments"><Input {...bind('assessments')} placeholder="e.g. class test every 3 weeks, mid-term in week 7" /></Field>
          <Field label="Notes"><Input {...bind('notes')} placeholder="e.g. lab sessions on Thursdays" /></Field>
          <LanguageField value={v.language} onChange={(l) => set('language', l)} />
        </div>
      </Grid>
    </FormShell>
  );
}

function Result({ output: o, state, setState }: ResultProps<Output, Input>) {
  const done: number[] = state.done ?? [];
  const teaching = o.weeks.filter((w) => !w.is_break);
  const completed = teaching.filter((w) => done.includes(w.week)).length;
  const toggle = (week: number) => setState({ done: done.includes(week) ? done.filter((x) => x !== week) : [...done, week] });
  const today = todayIso();

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-extrabold text-slate-900">{o.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{formatDate(o.start_date, { day: 'numeric', month: 'short', year: 'numeric' })} → {formatDate(o.end_date, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        <p className="mt-3 leading-relaxed text-slate-600"><Md>{o.overview}</Md></p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Weeks" value={o.weeks.length} sub={`${o.weeks.length - teaching.length} break weeks`} icon={<CalendarRange className="h-5 w-5" />} />
        <StatCard label="Teaching sessions" value={o.total_sessions} sub={`${o.classes_per_week} per week`} icon={<ClipboardCheck className="h-5 w-5" />} tone="sky" />
        <StatCard label="Assessments" value={o.assessment_calendar.length} icon={<ClipboardCheck className="h-5 w-5" />} tone="amber" />
        <StatCard label="Progress" value={`${completed}/${teaching.length}`} sub="weeks completed" icon={<Check className="h-5 w-5" />} tone="emerald" />
      </div>

      <SectionCard title="Week-by-week plan" icon={<CalendarRange className="h-5 w-5" />}>
        <div className="space-y-3">
          {o.weeks.map((w) => {
            const current = w.start <= today && today <= w.end;
            if (w.is_break) {
              return (
                <div key={w.week} className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  <PartyPopper className="h-4 w-4" />
                  <b>Week {w.week}</b> · {formatDate(w.start)} – {formatDate(w.end)} · {w.holiday_note || 'No classes'}
                </div>
              );
            }
            const isDone = done.includes(w.week);
            return (
              <div key={w.week} className={clsx('avoid-break rounded-xl border p-4 transition', current ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200', isDone && 'opacity-70')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggle(w.week)} className={clsx('no-print mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition', isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-brand-400')} aria-label="Mark week complete">
                      {isDone && <Check className="h-4 w-4" />}
                    </button>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900">Week {w.week}</span>
                        <span className="text-sm text-slate-500">{formatDate(w.start)} – {formatDate(w.end)}</span>
                        {current && <span className="badge bg-brand-600 text-white">This week</span>}
                        {w.holiday_note && <span className="badge bg-amber-100 text-amber-800">{w.holiday_note}</span>}
                      </div>
                      {w.unit && <div className="mt-1 font-semibold text-brand-700"><Md>{w.unit}</Md></div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge bg-slate-100 text-slate-700">{w.sessions} session{w.sessions !== 1 ? 's' : ''}</span>
                    {w.assessment && <span className="badge bg-rose-100 text-rose-700">{w.assessment}</span>}
                  </div>
                </div>
                <div className="mt-3 grid gap-4 pl-9 text-sm md:grid-cols-3">
                  <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Topics</div><BulletList items={w.topics} /></div>
                  <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Objectives</div><BulletList items={w.objectives} /></div>
                  <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Activities</div><BulletList items={w.activities} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Assessment calendar" icon={<ClipboardCheck className="h-5 w-5" />}>
          <table className="table-clean">
            <thead><tr><th>Week</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>{o.assessment_calendar.map((a, i) => <tr key={i}><td className="font-bold">{a.week}</td><td><span className="badge bg-rose-50 text-rose-700">{a.type}</span></td><td className="text-slate-600"><Md>{a.description}</Md></td></tr>)}</tbody>
          </table>
        </SectionCard>
        <SectionCard title="Pacing tips" icon={<Lightbulb className="h-5 w-5" />}>
          <BulletList items={o.pacing_tips} />
          {o.holidays.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs font-bold uppercase text-slate-500">Holidays applied</div>
              <ul className="space-y-1 text-sm text-slate-600">{o.holidays.map((h, i) => <li key={i}>{formatDate(h.start)}{h.end !== h.start && ` – ${formatDate(h.end)}`}: {h.label}</li>)}</ul>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    `# ${o.title}`,
    `${o.start_date} → ${o.end_date} · ${o.total_sessions} sessions · ${o.classes_per_week}/week`,
    o.overview,
    md.table(['Week', 'Dates', 'Sessions', 'Unit', 'Topics', 'Objectives', 'Activities', 'Assessment'], o.weeks.map((w) => [
      w.week, `${w.start} – ${w.end}`, w.is_break ? `Break${w.holiday_note ? `: ${w.holiday_note}` : ''}` : w.sessions, w.unit, w.topics.join('; '), w.objectives.join('; '), w.activities.join('; '), w.assessment,
    ])),
    md.section('Assessment calendar', md.table(['Week', 'Type', 'Description'], o.assessment_calendar.map((a) => [a.week, a.type, a.description]))),
    md.section('Pacing tips', md.list(o.pacing_tips)),
  );
}

const module: ToolModule<Input, Output> = {
  Form, Result, toMarkdown,
  loadingMessages: ['Building the term calendar…', 'Removing holidays and breaks…', 'Sequencing the syllabus…', 'Placing assessments…', 'Adding revision buffers…'],
};
export default module;
