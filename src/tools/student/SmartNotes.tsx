import clsx from 'clsx';
import { BookMarked, Calendar, CircleHelp, FlaskConical, Lightbulb, ListChecks, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { BulletList, Markdown, Md } from '@/components/Markdown';
import { SourceInput } from '@/components/SourceInput';
import { Field, Input, SectionCard, Segmented, Select } from '@/components/ui';
import { md } from '@/lib/export';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input { mode: 'notes' | 'revision'; topic: string; subject: string; level: string; style: 'outline' | 'cornell' | 'detailed'; source_text: string; material_ids: string[]; language: string }
interface NotesOut {
  mode: 'notes'; style: string; title: string; summary: string;
  sections: { heading: string; cue: string; points: string[]; example: string }[];
  key_terms: { term: string; definition: string }[]; key_takeaways: string[]; review_questions: string[];
}
interface RevisionOut {
  mode: 'revision'; title: string; big_idea: string; formulas: { name: string; formula: string; meaning: string }[];
  definitions: { term: string; definition: string }[]; key_facts: string[]; dates: { date: string; event: string }[];
  diagrams: string[]; exam_tips: string[]; common_mistakes: string[]; quick_check: { q: string; a: string }[];
}
type Output = NotesOut | RevisionOut;

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({
    mode: 'notes', topic: '', subject: profile?.subject ?? '', level: profile?.grade_level ?? '', style: 'outline', source_text: '', material_ids: [], language: defaultLanguage(profile),
  }, initial);
  return (
    <FormShell onSubmit={() => onSubmit(v)} loading={loading} disabled={!v.topic.trim() && v.source_text.trim().length < 50 && !v.material_ids.length} submitLabel={v.mode === 'notes' ? 'Make my notes' : 'Make revision sheet'}>
      <Segmented value={v.mode} onChange={(m) => set('mode', m)} options={[{ value: 'notes', label: 'Full notes' }, { value: 'revision', label: 'One-page revision sheet' }]} />
      <Grid cols={3}>
        <Field label="Topic" hint="Or leave blank and upload material below."><Input {...bind('topic')} placeholder="e.g. Photosynthesis" /></Field>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. Biology" /></Field>
        <Field label="Class / level"><Select {...bind('level')} options={GRADE_OPTIONS} /></Field>
      </Grid>
      <Grid>
        {v.mode === 'notes' ? (
          <Field label="Note style">
            <Select {...bind('style')} options={[{ value: 'outline', label: 'Outline (concise bullets)' }, { value: 'cornell', label: 'Cornell (cues + notes)' }, { value: 'detailed', label: 'Detailed (with examples)' }]} />
          </Field>
        ) : <div />}
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
      <SourceInput value={v.source_text} onChange={(t) => set('source_text', t)} materialIds={v.material_ids} onMaterialIds={(ids) => set('material_ids', ids)} label="Your textbook chapter / notes / PDF (optional)" rows={6} />
    </FormShell>
  );
}

function NotesView({ o }: { o: NotesOut }) {
  const cornell = o.style === 'cornell';
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <span className="badge bg-brand-50 capitalize text-brand-700">{o.style} notes</span>
        <h2 className="mt-3 text-2xl font-extrabold text-slate-900">{o.title}</h2>
        <p className="mt-2 leading-relaxed text-slate-600"><Md>{o.summary}</Md></p>
      </div>
      {o.sections.map((s, i) => (
        <section key={i} className={clsx('card avoid-break overflow-hidden', cornell && 'grid md:grid-cols-[220px_1fr]')}>
          {cornell && (
            <div className="border-b border-slate-100 bg-amber-50/70 p-5 md:border-b-0 md:border-r">
              <div className="text-xs font-bold uppercase text-amber-700">Cue</div>
              <p className="mt-1 text-sm font-semibold text-amber-900">{s.cue}</p>
            </div>
          )}
          <div className="p-6">
            <h3 className="mb-3 text-lg font-bold text-slate-900"><Md>{s.heading}</Md></h3>
            <ul className="space-y-2">
              {s.points.map((p, j) => (
                <li key={j} className="flex gap-2.5 text-[15px] leading-relaxed text-slate-700">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  <span className="min-w-0"><Md>{p}</Md></span>
                </li>
              ))}
            </ul>
            {s.example && <div className="mt-4 rounded-xl bg-sky-50 p-4 text-sm text-sky-900"><b>Example: </b><Md>{s.example}</Md></div>}
          </div>
        </section>
      ))}
      <div className="grid gap-6 lg:grid-cols-2">
        {o.key_terms.length > 0 && (
          <SectionCard title="Key terms" icon={<BookMarked className="h-5 w-5" />}>
            <dl className="space-y-2.5">{o.key_terms.map((k) => <div key={k.term} className="text-sm"><dt className="inline font-bold text-slate-900">{k.term}: </dt><dd className="inline text-slate-600"><Md>{k.definition}</Md></dd></div>)}</dl>
          </SectionCard>
        )}
        <SectionCard title="Key takeaways" icon={<Lightbulb className="h-5 w-5" />}><BulletList items={o.key_takeaways} /></SectionCard>
      </div>
      {o.review_questions.length > 0 && (
        <SectionCard title="Test yourself" icon={<CircleHelp className="h-5 w-5" />}>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">{o.review_questions.map((q, i) => <li key={i}><Md>{q}</Md></li>)}</ol>
        </SectionCard>
      )}
    </div>
  );
}

function QuickCheck({ items }: { items: { q: string; a: string }[] }) {
  const [shown, setShown] = useState<number[]>([]);
  return (
    <div className="space-y-2">
      {items.map((x, i) => (
        <button key={i} type="button" onClick={() => setShown(shown.includes(i) ? shown.filter((s) => s !== i) : [...shown, i])} className="block w-full rounded-xl border border-slate-200 p-3 text-left text-sm hover:border-brand-300">
          <div className="font-semibold text-slate-800"><Md>{x.q}</Md></div>
          {shown.includes(i) ? <div className="mt-1.5 text-emerald-700"><Md>{x.a}</Md></div> : <div className="no-print mt-1 text-xs text-brand-600">Tap to reveal</div>}
        </button>
      ))}
    </div>
  );
}

function RevisionView({ o }: { o: RevisionOut }) {
  return (
    <div className="space-y-6">
      <div className="card bg-gradient-to-r from-brand-600 to-indigo-600 p-6 text-white">
        <div className="text-xs font-bold uppercase tracking-wider text-brand-100">Revision sheet</div>
        <h2 className="mt-1 text-2xl font-extrabold">{o.title}</h2>
        {o.big_idea && <p className="mt-2 text-brand-50"><b>Big idea:</b> <Md>{o.big_idea}</Md></p>}
      </div>
      {o.formulas.length > 0 && (
        <SectionCard title="Formulas" icon={<FlaskConical className="h-5 w-5" />}>
          <div className="grid gap-3 md:grid-cols-2">
            {o.formulas.map((f, i) => (
              <div key={i} className="avoid-break rounded-xl border border-slate-200 p-4">
                <div className="text-xs font-bold uppercase text-slate-500">{f.name}</div>
                <Markdown className="my-1">{`$$${f.formula}$$`}</Markdown>
                <p className="text-xs leading-relaxed text-slate-600"><Md>{f.meaning}</Md></p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {o.definitions.length > 0 && (
          <SectionCard title="Definitions" icon={<BookMarked className="h-5 w-5" />}>
            <dl className="space-y-2.5">{o.definitions.map((d) => <div key={d.term} className="text-sm"><dt className="inline font-bold text-slate-900">{d.term}: </dt><dd className="inline text-slate-600"><Md>{d.definition}</Md></dd></div>)}</dl>
          </SectionCard>
        )}
        {o.key_facts.length > 0 && (
          <SectionCard title="Key facts" icon={<ListChecks className="h-5 w-5" />}>
            <ul className="space-y-2">{o.key_facts.map((f, i) => <li key={i} className="flex gap-2.5 text-sm text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" /><span><Md>{f}</Md></span></li>)}</ul>
          </SectionCard>
        )}
      </div>
      {o.dates.length > 0 && (
        <SectionCard title="Dates & timeline" icon={<Calendar className="h-5 w-5" />}>
          <div className="space-y-2">{o.dates.map((d, i) => <div key={i} className="flex gap-4 text-sm"><span className="w-28 shrink-0 font-bold text-brand-700">{d.date}</span><span className="text-slate-700">{d.event}</span></div>)}</div>
        </SectionCard>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Exam tips" icon={<Lightbulb className="h-5 w-5" />}><BulletList items={o.exam_tips} /></SectionCard>
        <SectionCard title="Common mistakes" icon={<TriangleAlert className="h-5 w-5" />}><BulletList items={o.common_mistakes} /></SectionCard>
        {o.diagrams.length > 0 && <SectionCard title="Be able to draw / describe" icon={<FlaskConical className="h-5 w-5" />}><BulletList items={o.diagrams} /></SectionCard>}
      </div>
      {o.quick_check.length > 0 && <SectionCard title="Quick check" icon={<CircleHelp className="h-5 w-5" />}><QuickCheck items={o.quick_check} /></SectionCard>}
    </div>
  );
}

function Result({ output }: ResultProps<Output, Input>) {
  return output.mode === 'revision' ? <RevisionView o={output} /> : <NotesView o={output} />;
}

function toMarkdown(o: Output) {
  if (o.mode === 'revision') {
    return md.join(
      `# ${o.title}`,
      o.big_idea && `**Big idea:** ${o.big_idea}`,
      md.section('Formulas', md.list(o.formulas.map((f) => `**${f.name}:** $${f.formula}$ (${f.meaning})`))),
      md.section('Definitions', md.list(o.definitions.map((d) => `**${d.term}:** ${d.definition}`))),
      md.section('Key facts', md.list(o.key_facts)),
      md.section('Dates', md.list(o.dates.map((d) => `**${d.date}:** ${d.event}`))),
      md.section('Diagrams', md.list(o.diagrams)),
      md.section('Exam tips', md.list(o.exam_tips)),
      md.section('Common mistakes', md.list(o.common_mistakes)),
      md.section('Quick check', md.list(o.quick_check.map((x) => `${x.q} *Answer: ${x.a}*`), true)),
    );
  }
  return md.join(
    `# ${o.title}`,
    o.summary,
    ...o.sections.map((s) => md.join(`## ${s.heading}`, s.cue && `> **Cue:** ${s.cue}`, md.list(s.points), s.example && `**Example:** ${s.example}`)),
    md.section('Key terms', md.list(o.key_terms.map((k) => `**${k.term}:** ${k.definition}`))),
    md.section('Key takeaways', md.list(o.key_takeaways)),
    md.section('Review questions', md.list(o.review_questions, true)),
  );
}

const module: ToolModule<Input, Output> = {
  Form, Result, toMarkdown,
  loadingMessages: ['Reading your material…', 'Finding the key ideas…', 'Organizing into sections…', 'Adding examples and key terms…', 'Final polish…'],
};
export default module;
