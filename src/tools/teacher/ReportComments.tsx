import { Copy, Download, Home, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Md } from '@/components/Markdown';
import { Button, Field, Input, Segmented, Select } from '@/components/ui';
import { copyText, downloadFile, md, toCsv } from '@/lib/export';
import { parseCsv } from '@/lib/files';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Student { name: string; scores: string; strengths: string; improvements: string; notes: string }
interface Input {
  students: Student[]; subject: string; grade: string; term: string; teacher_name: string;
  tone: 'encouraging' | 'balanced' | 'formal'; length: 'short' | 'medium' | 'long'; language: string;
}
interface Comment { name: string; scores: string; overall: string; comment: string; next_steps: string[]; parent_tip: string }
interface Output { subject: string; grade: string; term: string; tone: string; length: string; comments: Comment[] }

const blank = (): Student => ({ name: '', scores: '', strengths: '', improvements: '', notes: '' });

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const { v, set, bind } = useForm<Input>({
    students: [blank(), blank(), blank()], subject: profile?.subject ?? '', grade: profile?.grade_level ?? '', term: '', teacher_name: profile?.full_name ?? '',
    tone: 'balanced', length: 'medium', language: defaultLanguage(profile),
  }, initial);
  const valid = v.students.filter((s) => s.name.trim());

  const update = (i: number, k: keyof Student, val: string) => set('students', v.students.map((s, j) => (j === i ? { ...s, [k]: val } : s)));

  const importCsv = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    if (!rows.length) return toast('The CSV is empty', 'error');
    const head = rows[0].map((h) => h.toLowerCase());
    const hasHeader = head.some((h) => /name|score|strength|improve|note/.test(h));
    const idx = (re: RegExp, fallback: number) => (hasHeader ? head.findIndex((h) => re.test(h)) : fallback);
    const map = { name: idx(/name/, 0), scores: idx(/score|mark|grade/, 1), strengths: idx(/strength/, 2), improvements: idx(/improve|weak/, 3), notes: idx(/note|comment/, 4) };
    const students = rows.slice(hasHeader ? 1 : 0).map((r) => ({
      name: r[map.name] ?? '', scores: map.scores >= 0 ? r[map.scores] ?? '' : '', strengths: map.strengths >= 0 ? r[map.strengths] ?? '' : '',
      improvements: map.improvements >= 0 ? r[map.improvements] ?? '' : '', notes: map.notes >= 0 ? r[map.notes] ?? '' : '',
    })).filter((s) => s.name).slice(0, 40);
    set('students', students);
    toast(`Imported ${students.length} students`);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <FormShell onSubmit={() => onSubmit({ ...v, students: valid })} loading={loading} disabled={!valid.length} submitLabel={`Write ${valid.length || ''} comments`} footer={`${valid.length} student${valid.length === 1 ? '' : 's'} · max 40 per batch`}>
      <Grid cols={4}>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. Mathematics" /></Field>
        <Field label="Grade / class"><Select {...bind('grade')} options={GRADE_OPTIONS} /></Field>
        <Field label="Term / period"><Input {...bind('term')} placeholder="e.g. Half-yearly 2026" /></Field>
        <Field label="Teacher name"><Input {...bind('teacher_name')} /></Field>
      </Grid>
      <Grid cols={3}>
        <Field label="Tone"><Segmented value={v.tone} onChange={(t) => set('tone', t)} options={[{ value: 'encouraging', label: 'Encouraging' }, { value: 'balanced', label: 'Balanced' }, { value: 'formal', label: 'Formal' }]} /></Field>
        <Field label="Length"><Segmented value={v.length} onChange={(t) => set('length', t)} options={[{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }, { value: 'long', label: 'Long' }]} /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="label mb-0">Students</label>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => downloadFile('students-template.csv', 'name,scores,strengths,improvements,notes\nAyesha Rahman,92/100,problem solving,showing working,very curious\n', 'text/csv')}>Template</Button>
            <Button type="button" variant="secondary" size="sm" icon={<Upload className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>Import CSV</Button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => importCsv(e.target.files?.[0])} />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
              <tr><th className="p-2.5">Name *</th><th className="p-2.5">Scores</th><th className="p-2.5">Strengths</th><th className="p-2.5">To improve</th><th className="p-2.5">Notes</th><th className="w-10" /></tr>
            </thead>
            <tbody>
              {v.students.map((s, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {(['name', 'scores', 'strengths', 'improvements', 'notes'] as const).map((k) => (
                    <td key={k} className="p-1.5">
                      <input className="w-full rounded-lg border border-transparent px-2 py-1.5 outline-none hover:border-slate-200 focus:border-brand-400" value={s[k]} onChange={(e) => update(i, k, e.target.value)} placeholder={{ name: 'Student name', scores: '85/100, B+', strengths: 'e.g. participation', improvements: 'e.g. homework', notes: 'anything else' }[k]} />
                    </td>
                  ))}
                  <td className="p-1.5">
                    <button type="button" className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500" onClick={() => set('students', v.students.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="ghost" size="sm" className="mt-2" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => set('students', [...v.students, blank()])} disabled={v.students.length >= 40}>Add student</Button>
      </div>
    </FormShell>
  );
}

const OVERALL: Record<string, string> = {
  Excellent: 'bg-emerald-100 text-emerald-700', 'Very good': 'bg-teal-100 text-teal-700', Good: 'bg-sky-100 text-sky-700',
  Satisfactory: 'bg-amber-100 text-amber-700', 'Needs improvement': 'bg-rose-100 text-rose-700',
};

function Result({ output: o, state, setState }: ResultProps<Output, Input>) {
  const toast = useToast();
  const edits: Record<string, string> = state.edits ?? {};
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const text = (c: Comment) => edits[c.name] ?? c.comment;

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">{o.comments.length} report card comments</h2>
          <p className="text-sm capitalize text-slate-500">{[o.subject, o.grade, o.term].filter(Boolean).join(' · ')} · {o.tone} · {o.length}</p>
        </div>
        <div className="no-print flex gap-2">
          <Button variant="secondary" size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={async () => { await copyText(o.comments.map((c) => `${c.name}: ${text(c)}`).join('\n\n')); toast('All comments copied'); }}>Copy all</Button>
          <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadFile('report-comments.csv', toCsv([['Name', 'Scores', 'Overall', 'Comment', 'Next steps', 'Parent tip'], ...o.comments.map((c) => [c.name, c.scores, c.overall, text(c), c.next_steps.join('; '), c.parent_tip])]), 'text/csv;charset=utf-8')}>CSV</Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {o.comments.map((c) => (
          <div key={c.name} className="card avoid-break flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">{c.name}</div>
                {c.scores && <div className="text-xs text-slate-500">{c.scores}</div>}
              </div>
              <span className={`badge ${OVERALL[c.overall] ?? 'bg-slate-100 text-slate-700'}`}>{c.overall}</span>
            </div>
            {editing === c.name ? (
              <div className="mt-3">
                <textarea className="input min-h-[140px]" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => { setState({ edits: { ...edits, [c.name]: draft } }); setEditing(null); toast('Comment updated'); }}>Save</Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">{text(c)}</p>
            )}
            {c.next_steps.length > 0 && (
              <div className="mt-4">
                <div className="mb-1 text-xs font-bold uppercase text-slate-500">Next steps</div>
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-600">{c.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {c.parent_tip && <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><Home className="h-3.5 w-3.5 shrink-0" /><Md>{c.parent_tip}</Md></p>}
            <div className="no-print mt-4 flex gap-2 border-t border-slate-100 pt-3">
              <Button variant="ghost" size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={async () => { await copyText(text(c)); toast(`Copied ${c.name}'s comment`); }}>Copy</Button>
              <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { setDraft(text(c)); setEditing(c.name); }}>Edit</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    `# Report card comments`,
    [o.subject, o.grade, o.term].filter(Boolean).join(' · '),
    ...o.comments.map((c) => md.join(`## ${c.name}${c.scores ? ` (${c.scores})` : ''}: ${c.overall}`, c.comment, c.next_steps.length ? `**Next steps:**\n${md.list(c.next_steps)}` : '', c.parent_tip && `*Parent tip: ${c.parent_tip}*`)),
  );
}

const module: ToolModule<Input, Output> = {
  Form, Result, toMarkdown,
  loadingMessages: ['Reading each student’s profile…', 'Writing personal, specific comments…', 'Adding next steps…', 'Checking tone and variety…'],
};
export default module;
