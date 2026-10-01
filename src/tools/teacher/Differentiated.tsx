import clsx from 'clsx';
import { ClipboardCheck, Globe, Users } from 'lucide-react';
import { BulletList, Markdown, Md } from '@/components/Markdown';
import { SourceInput } from '@/components/SourceInput';
import { Field, Input, SectionCard, Select, Tabs } from '@/components/ui';
import { md } from '@/lib/export';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input { content: string; topic: string; subject: string; grade: string; objective: string; include_ell: boolean; language: string }
interface Tier {
  level: 'Support' | 'Core' | 'Extension'; label: string; for_whom: string; content: string; activity: string;
  scaffolds: string[]; questions: string[]; success_criteria: string[];
}
interface Output { title: string; learning_goal: string; tiers: Tier[]; ell_supports: string[]; grouping_tips: string[]; assessment_note: string }

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({
    content: '', topic: '', subject: profile?.subject ?? '', grade: profile?.grade_level ?? '', objective: '', include_ell: true, language: defaultLanguage(profile),
  }, initial);
  return (
    <FormShell onSubmit={() => onSubmit(v)} loading={loading} disabled={!v.content.trim() && !v.topic.trim()} submitLabel="Differentiate">
      <SourceInput label="Lesson / activity / reading text" value={v.content} onChange={(t) => set('content', t)} rows={8} placeholder="Paste the lesson text, reading passage or activity you want adapted… (or just enter a topic below)" />
      <Grid cols={3}>
        <Field label="Topic" hint="Required if no text is pasted."><Input {...bind('topic')} placeholder="e.g. The water cycle" /></Field>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. Science" /></Field>
        <Field label="Grade / class"><Select {...bind('grade')} options={GRADE_OPTIONS} /></Field>
      </Grid>
      <Grid>
        <Field label="Shared learning goal (optional)"><Input {...bind('objective')} placeholder="e.g. Explain the stages of the water cycle" /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded accent-brand-600" checked={v.include_ell} onChange={(e) => set('include_ell', e.target.checked)} />
        Include supports for second-language learners
      </label>
    </FormShell>
  );
}

const TIER_STYLE: Record<string, { tone: string; ring: string }> = {
  Support: { tone: 'bg-sky-50 text-sky-800', ring: 'border-sky-200' },
  Core: { tone: 'bg-emerald-50 text-emerald-800', ring: 'border-emerald-200' },
  Extension: { tone: 'bg-fuchsia-50 text-fuchsia-800', ring: 'border-fuchsia-200' },
};

function TierView({ t }: { t: Tier }) {
  const s = TIER_STYLE[t.level];
  return (
    <div className={clsx('card avoid-break border-2 p-6', s.ring)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={clsx('badge', s.tone)}>{t.level}</span>
        {t.label && <span className="font-bold text-slate-900">{t.label}</span>}
      </div>
      {t.for_whom && <p className="mt-2 text-sm text-slate-500"><b>For:</b> <Md>{t.for_whom}</Md></p>}
      <div className="mt-5 rounded-xl bg-slate-50 p-5"><Markdown>{t.content}</Markdown></div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-bold uppercase text-slate-500">Activity</div>
          <p className="text-sm leading-relaxed text-slate-700"><Md>{t.activity}</Md></p>
          <div className="mb-2 mt-5 text-xs font-bold uppercase text-slate-500">Scaffolds</div>
          <BulletList items={t.scaffolds} />
        </div>
        <div>
          <div className="mb-2 text-xs font-bold uppercase text-slate-500">Questions</div>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">{t.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
          <div className="mb-2 mt-5 text-xs font-bold uppercase text-slate-500">Success criteria</div>
          <BulletList items={t.success_criteria} />
        </div>
      </div>
    </div>
  );
}

function Result({ output: o, state, setState }: ResultProps<Output, Input>) {
  const tab = (state.tab as string) ?? 'all';
  const shown = tab === 'all' ? o.tiers : o.tiers.filter((t) => t.level === tab);
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-extrabold text-slate-900">{o.title}</h2>
        <p className="mt-2 text-slate-600"><b>Shared goal:</b> <Md>{o.learning_goal}</Md></p>
      </div>
      <div className="no-print">
        <Tabs tabs={[{ value: 'all', label: 'All tiers' }, ...o.tiers.map((t) => ({ value: t.level, label: t.level }))]} value={tab} onChange={(v) => setState({ tab: v })} />
      </div>
      <div className="space-y-6">{shown.map((t) => <TierView key={t.level} t={t} />)}</div>
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Running the tiers" icon={<Users className="h-5 w-5" />}><BulletList items={o.grouping_tips} /></SectionCard>
        {o.ell_supports.length > 0 && <SectionCard title="Language-learner supports" icon={<Globe className="h-5 w-5" />}><BulletList items={o.ell_supports} /></SectionCard>}
        <SectionCard title="Fair assessment" icon={<ClipboardCheck className="h-5 w-5" />}><p className="text-sm leading-relaxed text-slate-700"><Md>{o.assessment_note}</Md></p></SectionCard>
      </div>
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    `# ${o.title}`,
    `**Shared learning goal:** ${o.learning_goal}`,
    ...o.tiers.map((t) => md.join(
      `## ${t.level} tier${t.label ? `: ${t.label}` : ''}`,
      t.for_whom && `*For: ${t.for_whom}*`,
      t.content,
      `**Activity:** ${t.activity}`,
      `**Scaffolds:**\n${md.list(t.scaffolds)}`,
      `**Questions:**\n${md.list(t.questions, true)}`,
      `**Success criteria:**\n${md.list(t.success_criteria)}`,
    )),
    md.section('Running the tiers', md.list(o.grouping_tips)),
    md.section('Language-learner supports', md.list(o.ell_supports)),
    md.section('Fair assessment', o.assessment_note),
  );
}

const module: ToolModule<Input, Output> = {
  Form, Result, toMarkdown,
  loadingMessages: ['Understanding the core concept…', 'Writing the Support tier…', 'Writing the Core tier…', 'Writing the Extension tier…', 'Adding scaffolds and grouping tips…'],
};
export default module;
