import { BookOpen, CircleHelp, ClipboardCheck, Clock, Heart, Home, Layers, Package, Split, Target, TriangleAlert } from 'lucide-react';
import { BulletList, Md } from '@/components/Markdown';
import { BloomBadge, Field, Input, SectionCard, Select, Textarea } from '@/components/ui';
import { md } from '@/lib/export';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input {
  subject: string; grade: string; topic: string; subtopic: string; duration: string; approach: string; objective: string;
  class_size: string; resources: string; curriculum: string; notes: string; language: string;
}
interface Output {
  title: string; overview: string;
  snapshot: { subject: string; grade: string; topic: string; subtopic: string; duration: string; approach: string };
  objectives: { text: string; bloom_level: string }[]; success_criteria: string[]; prior_knowledge: string[];
  vocabulary: { term: string; definition: string }[]; materials: { must_have: string[]; nice_to_have: string[] };
  flow: { phase: string; minutes: number; teacher_actions: string; student_actions: string; bloom_level: string; check: string }[];
  total_minutes: number; differentiation: { support: string[]; core: string[]; extension: string[] };
  assessment: { formative: string[]; summative: string; exit_ticket: string };
  misconceptions: { misconception: string; correction: string }[];
  homework: string; extension: string; reflection: string; sel_prompt: string; cross_curricular: string[];
}

const APPROACHES = ['', '5E inquiry model', 'Direct instruction', 'Project-based learning', 'Flipped classroom', 'Cooperative learning', 'Problem-based learning', 'Gradual release (I do, We do, You do)', 'Game-based learning'];

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({
    subject: profile?.subject ?? '', grade: profile?.grade_level ?? '', topic: '', subtopic: '', duration: '45 minutes', approach: '',
    objective: '', class_size: '', resources: '', curriculum: 'NCTB (Bangladesh)', notes: '', language: defaultLanguage(profile),
  }, initial);
  return (
    <FormShell onSubmit={() => onSubmit(v)} loading={loading} disabled={!v.topic.trim()} submitLabel="Generate lesson plan">
      <Grid cols={3}>
        <Field label="Topic" required><Input {...bind('topic')} placeholder="e.g. Newton's laws of motion" /></Field>
        <Field label="Subtopic / focus"><Input {...bind('subtopic')} placeholder="e.g. Inertia" /></Field>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. Physics" /></Field>
        <Field label="Grade / class"><Select {...bind('grade')} options={GRADE_OPTIONS} /></Field>
        <Field label="Duration">
          <Select {...bind('duration')} options={['30 minutes', '35 minutes', '40 minutes', '45 minutes', '50 minutes', '60 minutes', '75 minutes', '90 minutes', '2 × 45 minutes']} />
        </Field>
        <Field label="Teaching approach"><Select {...bind('approach')} options={APPROACHES.map((a) => ({ value: a, label: a || 'Best fit (AI decides)' }))} /></Field>
      </Grid>
      <Field label="Main learning goal" hint="Optional. Tutorix will infer measurable objectives if left blank.">
        <Textarea rows={2} {...bind('objective')} placeholder="What should students be able to do by the end of the lesson?" />
      </Field>
      <Grid cols={3}>
        <Field label="Class size"><Input {...bind('class_size')} placeholder="e.g. 40 students" /></Field>
        <Field label="Available resources"><Input {...bind('resources')} placeholder="e.g. whiteboard, projector, no lab" /></Field>
        <Field label="Curriculum / board"><Input {...bind('curriculum')} placeholder="e.g. NCTB, Cambridge" /></Field>
      </Grid>
      <Grid>
        <Field label="Anything else?"><Input {...bind('notes')} placeholder="e.g. mixed-ability class, include group work" /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
    </FormShell>
  );
}

function Result({ output: o }: ResultProps<Output, Input>) {
  const snap = o.snapshot;
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap gap-2">
          {[snap.subject, snap.grade, snap.duration, snap.approach].filter(Boolean).map((x) => (
            <span key={x} className="badge bg-brand-50 text-brand-700">{x}</span>
          ))}
        </div>
        <h2 className="mt-3 text-2xl font-extrabold text-slate-900">{o.title}</h2>
        <p className="mt-2 leading-relaxed text-slate-600"><Md>{o.overview}</Md></p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Learning objectives" icon={<Target className="h-5 w-5" />}>
          <ol className="space-y-3">
            {o.objectives.map((ob, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                <div className="flex-1">{ob.text} <BloomBadge level={ob.bloom_level} /></div>
              </li>
            ))}
          </ol>
          {o.success_criteria.length > 0 && (
            <div className="mt-5 rounded-xl bg-emerald-50 p-4">
              <div className="mb-2 text-xs font-bold uppercase text-emerald-700">Success criteria</div>
              <BulletList items={o.success_criteria} />
            </div>
          )}
        </SectionCard>
        <div className="space-y-6">
          <SectionCard title="Materials" icon={<Package className="h-5 w-5" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><div className="mb-2 text-xs font-bold uppercase text-slate-500">Must have</div><BulletList items={o.materials.must_have} /></div>
              <div><div className="mb-2 text-xs font-bold uppercase text-slate-500">Nice to have</div><BulletList items={o.materials.nice_to_have} /></div>
            </div>
          </SectionCard>
          {(o.prior_knowledge.length > 0 || o.vocabulary.length > 0) && (
            <SectionCard title="Prior knowledge & vocabulary" icon={<BookOpen className="h-5 w-5" />}>
              <BulletList items={o.prior_knowledge} />
              {o.vocabulary.length > 0 && (
                <dl className="mt-4 grid gap-2">
                  {o.vocabulary.map((v) => (
                    <div key={v.term} className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><dt className="inline font-bold text-slate-900">{v.term}: </dt><dd className="inline text-slate-600">{v.definition}</dd></div>
                  ))}
                </dl>
              )}
            </SectionCard>
          )}
        </div>
      </div>

      <SectionCard title={`Lesson flow · ${o.total_minutes} min`} icon={<Clock className="h-5 w-5" />}>
        <div className="relative space-y-4">
          {o.flow.map((f, i) => (
            <div key={i} className="avoid-break grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[140px_1fr_1fr]">
              <div>
                <div className="font-bold text-slate-900"><Md>{f.phase}</Md></div>
                <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-brand-600"><Clock className="h-3.5 w-3.5" />{f.minutes} min</div>
                <div className="mt-2"><BloomBadge level={f.bloom_level} /></div>
              </div>
              <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Teacher</div><p className="text-sm leading-relaxed text-slate-700"><Md>{f.teacher_actions}</Md></p></div>
              <div>
                <div className="mb-1 text-xs font-bold uppercase text-slate-400">Students</div>
                <p className="text-sm leading-relaxed text-slate-700"><Md>{f.student_actions}</Md></p>
                {f.check && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><b>Check:</b> <Md>{f.check}</Md></p>}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Differentiation" icon={<Split className="h-5 w-5" />}>
        <div className="grid gap-4 md:grid-cols-3">
          {([['Support', o.differentiation.support, 'bg-sky-50 text-sky-800'], ['Core', o.differentiation.core, 'bg-emerald-50 text-emerald-800'], ['Extension', o.differentiation.extension, 'bg-fuchsia-50 text-fuchsia-800']] as const).map(([label, items, cls]) => (
            <div key={label} className="rounded-xl border border-slate-200 p-4">
              <span className={`badge ${cls}`}>{label}</span>
              <BulletList items={items} className="mt-3" />
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Assessment" icon={<ClipboardCheck className="h-5 w-5" />}>
          <BulletList items={o.assessment.formative} />
          {o.assessment.summative && <p className="mt-4 text-sm text-slate-700"><b>Summative:</b> {o.assessment.summative}</p>}
          {o.assessment.exit_ticket && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900"><b>Exit ticket:</b> {o.assessment.exit_ticket}</p>}
        </SectionCard>
        <SectionCard title="Misconceptions & teacher moves" icon={<TriangleAlert className="h-5 w-5" />}>
          <div className="space-y-3">
            {o.misconceptions.map((m, i) => (
              <div key={i} className="text-sm">
                <div className="font-semibold text-rose-700">✗ {m.misconception}</div>
                <div className="mt-0.5 text-slate-600">✓ {m.correction}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Homework & extension" icon={<Home className="h-5 w-5" />}>
          <p className="text-sm text-slate-700"><b>Homework:</b> <Md>{o.homework}</Md></p>
          <p className="mt-3 text-sm text-slate-700"><b>Extension:</b> <Md>{o.extension}</Md></p>
        </SectionCard>
        <SectionCard title="Reflection & SEL" icon={<Heart className="h-5 w-5" />}>
          <p className="text-sm text-slate-700"><b>Teacher reflection:</b> <Md>{o.reflection}</Md></p>
          <p className="mt-3 text-sm text-slate-700"><b>SEL prompt:</b> <Md>{o.sel_prompt}</Md></p>
        </SectionCard>
        <SectionCard title="Cross-curricular links" icon={<Layers className="h-5 w-5" />}>
          {o.cross_curricular.length ? <BulletList items={o.cross_curricular} /> : <p className="flex items-center gap-2 text-sm text-slate-500"><CircleHelp className="h-4 w-4" />None suggested</p>}
        </SectionCard>
      </div>
    </div>
  );
}

function toMarkdown(o: Output) {
  const s = o.snapshot;
  return md.join(
    `# ${o.title}`,
    md.table(['Subject', 'Grade', 'Topic', 'Duration', 'Approach'], [[s.subject, s.grade, [s.topic, s.subtopic].filter(Boolean).join(': '), s.duration, s.approach]]),
    o.overview,
    md.section('Learning objectives', md.list(o.objectives.map((x) => `${x.text} *(${x.bloom_level})*`), true)),
    md.section('Success criteria', md.list(o.success_criteria)),
    md.section('Prior knowledge', md.list(o.prior_knowledge)),
    md.section('Key vocabulary', md.list(o.vocabulary.map((v) => `**${v.term}:** ${v.definition}`))),
    md.section('Materials', `**Must have**\n${md.list(o.materials.must_have)}\n\n**Nice to have**\n${md.list(o.materials.nice_to_have)}`),
    md.section(`Lesson flow (${o.total_minutes} min)`, md.table(['Phase', 'Min', 'Teacher', 'Students', 'Bloom', 'Check'], o.flow.map((f) => [f.phase, f.minutes, f.teacher_actions, f.student_actions, f.bloom_level, f.check]))),
    md.section('Differentiation', `**Support**\n${md.list(o.differentiation.support)}\n\n**Core**\n${md.list(o.differentiation.core)}\n\n**Extension**\n${md.list(o.differentiation.extension)}`),
    md.section('Assessment', `${md.list(o.assessment.formative)}\n\n**Summative:** ${o.assessment.summative}\n\n**Exit ticket:** ${o.assessment.exit_ticket}`),
    md.section('Misconceptions', md.list(o.misconceptions.map((m) => `${m.misconception} → ${m.correction}`))),
    md.section('Homework & extension', `**Homework:** ${o.homework}\n\n**Extension:** ${o.extension}`),
    md.section('Reflection & SEL', `**Reflection:** ${o.reflection}\n\n**SEL:** ${o.sel_prompt}`),
    md.section('Cross-curricular links', md.list(o.cross_curricular)),
  );
}

const module: ToolModule<Input, Output> = {
  Form, Result, toMarkdown,
  loadingMessages: ['Analyzing the topic…', 'Writing measurable objectives…', 'Designing the lesson flow…', 'Adding differentiation & assessment…', 'Final alignment check…'],
};
export default module;
