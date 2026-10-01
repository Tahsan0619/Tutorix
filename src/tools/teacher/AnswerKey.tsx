import { CircleCheck, Eye, EyeOff, KeyRound, ListChecks, TriangleAlert } from 'lucide-react';
import { BulletList, Markdown, Md } from '@/components/Markdown';
import { SourceInput } from '@/components/SourceInput';
import { Button, Field, Input, SectionCard, Segmented, Select } from '@/components/ui';
import { md } from '@/lib/export';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input { paper_text: string; subject: string; grade: string; total_marks: string; curriculum: string; detail: 'brief' | 'detailed'; language: string }
interface Answer {
  number: string; question: string; type: string; marks: number; answer: string; marking_points: { point: string; marks: number }[];
  accept_also: string[]; common_mistakes: string[]; examiner_note: string;
}
interface Output { title: string; subject: string; grade: string; total_marks: number; general_instructions: string[]; answers: Answer[] }

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({
    paper_text: '', subject: profile?.subject ?? '', grade: profile?.grade_level ?? '', total_marks: '', curriculum: '', detail: 'detailed', language: defaultLanguage(profile),
  }, initial);
  return (
    <FormShell onSubmit={() => onSubmit(v)} loading={loading} disabled={v.paper_text.trim().length < 20} submitLabel="Generate answer key">
      <SourceInput label="Question paper" value={v.paper_text} onChange={(t) => set('paper_text', t)} rows={10} placeholder={'1. What is the SI unit of force? (1 mark)\n2. State Newton’s second law of motion. (2 marks)\n3. A 5 kg box is pushed with 20 N. Find its acceleration. (3 marks)'} />
      <Grid cols={4}>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. Physics" /></Field>
        <Field label="Grade / class"><Select {...bind('grade')} options={GRADE_OPTIONS} /></Field>
        <Field label="Total marks (if known)"><Input {...bind('total_marks')} placeholder="e.g. 50" /></Field>
        <Field label="Board / curriculum"><Input {...bind('curriculum')} placeholder="e.g. NCTB, Cambridge" /></Field>
      </Grid>
      <Grid>
        <Field label="Detail level">
          <Segmented value={v.detail} onChange={(d) => set('detail', d)} options={[{ value: 'detailed', label: 'Detailed marking scheme' }, { value: 'brief', label: 'Brief answer key' }]} />
        </Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
    </FormShell>
  );
}

function Result({ output: o, state, setState }: ResultProps<Output, Input>) {
  const compact = !!state.compact;
  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">{o.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{[o.subject, o.grade].filter(Boolean).join(' · ')} · {o.answers.length} questions · <b>{o.total_marks} marks</b></p>
        </div>
        <Button variant="secondary" size="sm" className="no-print" icon={compact ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} onClick={() => setState({ compact: !compact })}>
          {compact ? 'Show full scheme' : 'Answers only'}
        </Button>
      </div>

      {compact ? (
        <SectionCard title="Quick answer key" icon={<KeyRound className="h-5 w-5" />}>
          <table className="table-clean">
            <thead><tr><th className="w-16">Q</th><th>Answer</th><th className="w-20">Marks</th></tr></thead>
            <tbody>{o.answers.map((a) => <tr key={a.number}><td className="font-bold">{a.number}</td><td><Markdown className="prose-sm">{a.answer}</Markdown></td><td>{a.marks}</td></tr>)}</tbody>
          </table>
        </SectionCard>
      ) : (
        <>
          {o.general_instructions.length > 0 && <SectionCard title="Instructions for markers" icon={<ListChecks className="h-5 w-5" />}><BulletList items={o.general_instructions} /></SectionCard>}
          {o.answers.map((a) => (
            <div key={a.number} className="card avoid-break p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-slate-900 px-2 text-sm font-bold text-white">{a.number}</span>
                  <p className="pt-1 font-semibold text-slate-900"><Md>{a.question}</Md></p>
                </div>
                <span className="badge shrink-0 bg-brand-50 text-brand-700">{a.marks} mark{a.marks !== 1 ? 's' : ''}</span>
              </div>
              <div className="mt-4 rounded-xl bg-emerald-50/70 p-4">
                <div className="mb-1 text-xs font-bold uppercase text-emerald-700">Model answer</div>
                <Markdown className="prose-sm">{a.answer}</Markdown>
              </div>
              {a.marking_points.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-bold uppercase text-slate-500">Marking scheme</div>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {a.marking_points.map((p, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                        <span className="flex gap-2 text-slate-700"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><Md>{p.point}</Md></span>
                        <span className="shrink-0 font-bold text-slate-900">{p.marks}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {a.accept_also.length > 0 && <div><div className="mb-1.5 text-xs font-bold uppercase text-sky-600">Also accept</div><BulletList items={a.accept_also} /></div>}
                {a.common_mistakes.length > 0 && <div><div className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase text-rose-600"><TriangleAlert className="h-3.5 w-3.5" />Common mistakes</div><BulletList items={a.common_mistakes} /></div>}
              </div>
              {a.examiner_note && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>Examiner note:</b> <Md>{a.examiner_note}</Md></p>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    `# ${o.title}`,
    `${[o.subject, o.grade].filter(Boolean).join(' · ')} · Total: ${o.total_marks} marks`,
    md.section('Instructions for markers', md.list(o.general_instructions)),
    ...o.answers.map((a) => md.join(
      `## Q${a.number} (${a.marks} marks): ${a.question}`,
      `**Model answer:**\n\n${a.answer}`,
      a.marking_points.length ? md.table(['Marking point', 'Marks'], a.marking_points.map((p) => [p.point, p.marks])) : '',
      a.accept_also.length ? `**Also accept:**\n${md.list(a.accept_also)}` : '',
      a.common_mistakes.length ? `**Common mistakes:**\n${md.list(a.common_mistakes)}` : '',
      a.examiner_note && `*Examiner note: ${a.examiner_note}*`,
    )),
  );
}

const module: ToolModule<Input, Output> = {
  Form, Result, toMarkdown,
  loadingMessages: ['Reading the question paper…', 'Solving every question…', 'Breaking answers into marking points…', 'Listing acceptable alternatives…', 'Double-checking the answers…'],
};
export default module;
