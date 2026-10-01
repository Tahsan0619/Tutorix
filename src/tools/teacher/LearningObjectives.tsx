import { Copy, Layers, Lightbulb, Target } from 'lucide-react';
import { BloomBars } from '@/components/charts';
import { useToast } from '@/components/Toast';
import { BulletList, Md } from '@/components/Markdown';
import { BloomBadge, ChipGroup, Field, Input, SectionCard, Select, bloomOptions } from '@/components/ui';
import { copyText, md } from '@/lib/export';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input { topic: string; subject: string; grade: string; count: number; timeframe: string; standards: string; context: string; bloom_levels: string[]; language: string }
interface Objective {
  statement: string; bloom_level: string; verb: string;
  smart: { specific: string; measurable: string; achievable: string; relevant: string; time_bound: string };
  assessment: string; success_criteria: string;
}
interface Output { topic: string; subject: string; grade: string; objectives: Objective[]; distribution: Record<string, number>; lower_order_pct: number; higher_order_pct: number; sequence_note: string; alignment_tips: string[] }

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({
    topic: '', subject: profile?.subject ?? '', grade: profile?.grade_level ?? '', count: 6, timeframe: '1 week', standards: '', context: '', bloom_levels: [], language: defaultLanguage(profile),
  }, initial);
  return (
    <FormShell onSubmit={() => onSubmit({ ...v, count: Number(v.count) })} loading={loading} disabled={!v.topic.trim()} submitLabel="Write objectives">
      <Grid cols={3}>
        <Field label="Topic / unit" required><Input {...bind('topic')} placeholder="e.g. Acids and bases" /></Field>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. Chemistry" /></Field>
        <Field label="Grade / class"><Select {...bind('grade')} options={GRADE_OPTIONS} /></Field>
        <Field label="Number of objectives"><Select {...bind('count')} options={['3', '4', '5', '6', '7', '8', '10', '12']} /></Field>
        <Field label="Time frame"><Select {...bind('timeframe')} options={['1 lesson', '2-3 lessons', '1 week', '2 weeks', '1 month', '1 term']} /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
      <Field label="Bloom levels to include" hint="Leave empty for an automatic lower-to-higher progression.">
        <ChipGroup options={bloomOptions} value={v.bloom_levels} onChange={(x) => set('bloom_levels', x)} />
      </Field>
      <Grid>
        <Field label="Standards / curriculum (optional)"><Input {...bind('standards')} placeholder="e.g. NCTB Class 9 Chemistry, Chapter 7" /></Field>
        <Field label="Context (optional)"><Input {...bind('context')} placeholder="e.g. lab available, exam-focused class" /></Field>
      </Grid>
    </FormShell>
  );
}

const SMART_LABELS: [keyof Objective['smart'], string][] = [['specific', 'S'], ['measurable', 'M'], ['achievable', 'A'], ['relevant', 'R'], ['time_bound', 'T']];

function Result({ output: o }: ResultProps<Output, Input>) {
  const toast = useToast();
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6">
          <div className="text-xs font-bold uppercase text-slate-500">Learning objectives</div>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">{o.topic}</h2>
          <p className="mt-1 text-sm text-slate-500">{[o.subject, o.grade].filter(Boolean).join(' · ')}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-sky-50 p-3"><div className="text-xl font-extrabold text-sky-700">{o.lower_order_pct}%</div><div className="text-xs font-semibold text-sky-600">Lower-order</div></div>
            <div className="rounded-xl bg-fuchsia-50 p-3"><div className="text-xl font-extrabold text-fuchsia-700">{o.higher_order_pct}%</div><div className="text-xs font-semibold text-fuchsia-600">Higher-order</div></div>
          </div>
        </div>
        <SectionCard title="Bloom distribution" icon={<Layers className="h-5 w-5" />} className="lg:col-span-2"><BloomBars distribution={o.distribution} /></SectionCard>
      </div>

      <div className="space-y-4">
        {o.objectives.map((ob, i) => (
          <div key={i} className="card avoid-break p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-500 to-green-600 font-bold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-semibold leading-relaxed text-slate-900"><Md>{ob.statement}</Md></p>
                  <button className="no-print shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Copy" onClick={async () => { await copyText(ob.statement); toast('Objective copied'); }}>
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <BloomBadge level={ob.bloom_level} />
                  {ob.verb && <span className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs text-brand-700">{ob.verb}</span>}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-5">
                  {SMART_LABELS.map(([k, l]) => (
                    <div key={k} className="rounded-lg bg-slate-50 p-2.5">
                      <div className="text-xs font-extrabold text-brand-600">{l} <span className="font-semibold capitalize text-slate-400">{k.replace('_', '-')}</span></div>
                      <div className="mt-0.5 text-xs leading-relaxed text-slate-600"><Md>{ob.smart[k]}</Md></div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <p className="text-slate-700"><b>Assess by:</b> <Md>{ob.assessment}</Md></p>
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900"><b>Success criterion:</b> <Md>{ob.success_criteria}</Md></p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="How they build" icon={<Target className="h-5 w-5" />}><p className="text-sm leading-relaxed text-slate-700"><Md>{o.sequence_note}</Md></p></SectionCard>
        <SectionCard title="Alignment tips" icon={<Lightbulb className="h-5 w-5" />}><BulletList items={o.alignment_tips} /></SectionCard>
      </div>
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    `# Learning objectives: ${o.topic}`,
    [o.subject, o.grade].filter(Boolean).join(' · '),
    md.list(o.objectives.map((ob) => `${ob.statement} **(${ob.bloom_level})**`), true),
    md.section('SMART breakdown', md.table(['#', 'Objective', 'Specific', 'Measurable', 'Achievable', 'Relevant', 'Time-bound', 'Assessment'], o.objectives.map((ob, i) => [i + 1, ob.statement, ob.smart.specific, ob.smart.measurable, ob.smart.achievable, ob.smart.relevant, ob.smart.time_bound, ob.assessment]))),
    md.section('Success criteria', md.list(o.objectives.map((ob) => ob.success_criteria))),
    md.section('Sequence', o.sequence_note),
    md.section('Alignment tips', md.list(o.alignment_tips)),
  );
}

const module: ToolModule<Input, Output> = { Form, Result, toMarkdown };
export default module;
