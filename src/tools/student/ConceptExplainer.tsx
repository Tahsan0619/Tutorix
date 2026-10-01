import clsx from 'clsx';
import { ArrowRightLeft, CircleHelp, Lightbulb, ListOrdered, MessageCircle, Send, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BulletList, Markdown, Md } from '@/components/Markdown';
import { SourceInput } from '@/components/SourceInput';
import { useToast } from '@/components/Toast';
import { Button, Field, Input, SectionCard, Segmented, Textarea } from '@/components/ui';
import { runTool } from '@/lib/ai';
import { md } from '@/lib/export';
import { FormShell, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

type Level = 'kid' | 'school' | 'college' | 'expert';
interface Input { concept: string; level: Level; subject: string; context: string; source_text: string; material_ids: string[]; language: string }
interface Output {
  concept: string; level: Level; title: string; one_liner: string; explanation: string; analogy: string; example: string; steps: string[];
  compare: { with: string; rows: { aspect: string; this: string; that: string }[] } | null;
  misconceptions: string[]; check_questions: { q: string; a: string }[]; related: string[];
}
interface ChatMsg { role: 'user' | 'assistant'; content: string }

const LEVEL_LABEL: Record<Level, string> = { kid: 'Like I\'m 10', school: 'School', college: 'College', expert: 'Expert' };

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const [params] = useSearchParams();
  const preset = params.get('concept');
  const { v, set, bind } = useForm<Input>(
    { concept: '', level: 'school', subject: profile?.subject ?? '', context: '', source_text: '', material_ids: [], language: defaultLanguage(profile) },
    preset ? { ...initial, concept: preset, context: '' } : initial,
  );
  return (
    <FormShell onSubmit={() => onSubmit(v)} loading={loading} disabled={v.concept.trim().length < 2} submitLabel="Explain it">
      <Field label="What do you want to understand?" required>
        <Textarea rows={2} {...bind('concept')} placeholder="e.g. Why does the moon have phases? / What is entropy? / How does compound interest work?" />
      </Field>
      <Field label="Explain it…">
        <Segmented value={v.level} onChange={(l) => set('level', l)} options={(Object.keys(LEVEL_LABEL) as Level[]).map((l) => ({ value: l, label: LEVEL_LABEL[l] }))} />
      </Field>
      <Grid cols={3}>
        <Field label="Subject (optional)"><Input {...bind('subject')} placeholder="e.g. Physics" /></Field>
        <Field label="What confuses you? (optional)"><Input {...bind('context')} placeholder="e.g. I don't get why it's not the Earth's shadow" /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
      <SourceInput
        value={v.source_text}
        onChange={(t) => set('source_text', t)}
        materialIds={v.material_ids}
        onMaterialIds={(ids) => set('material_ids', ids)}
        label="Explain it the way my textbook does (optional)"
        placeholder="Paste the textbook paragraph, or attach a saved chapter from My materials…"
        rows={3}
      />
    </FormShell>
  );
}

function CheckQuestions({ items }: { items: { q: string; a: string }[] }) {
  const [shown, setShown] = useState<number[]>([]);
  return (
    <div className="space-y-2">
      {items.map((x, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-3 text-sm">
          <div className="font-semibold text-slate-800"><Md>{x.q}</Md></div>
          {shown.includes(i)
            ? <div className="mt-1.5 text-emerald-700"><Md>{x.a}</Md></div>
            : <button type="button" className="no-print mt-1 text-xs font-semibold text-brand-600 hover:underline" onClick={() => setShown([...shown, i])}>Show answer</button>}
        </div>
      ))}
    </div>
  );
}

function FollowUp({ o, input, chat, setChat }: { o: Output; input: Input; chat: ChatMsg[]; setChat: (c: ChatMsg[]) => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (chat.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [chat.length, busy]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    const next: ChatMsg[] = [...chat, { role: 'user', content: question.trim() }];
    setChat(next);
    setQ('');
    setBusy(true);
    try {
      const res = await runTool<{ answer: string }>('explainer-followup', {
        concept: o.title, summary: `${o.one_liner}\n${o.explanation}`.slice(0, 1500), history: chat, question: question.trim(), language: input.language,
        source_text: input.source_text ?? '', material_ids: input.material_ids ?? [],
      }, { save: false });
      setChat([...next, { role: 'assistant', content: res.output.answer }]);
    } catch (e) {
      toast((e as Error).message, 'error');
      setChat(chat);
      setQ(question);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = ['Can you give another example?', 'Explain it even simpler', 'How is this tested in exams?', 'Why does this matter in real life?'];
  return (
    <SectionCard title="Still confused? Ask a follow-up" icon={<MessageCircle className="h-5 w-5" />} className="no-print">
      <div className="space-y-3">
        {chat.map((m, i) => (
          <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={clsx('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800')}>
              {m.role === 'user' ? m.content : <Markdown className="prose-sm">{m.content}</Markdown>}
            </div>
          </div>
        ))}
        {busy && <div className="flex"><div className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500"><span className="animate-pulse">Thinking…</span></div></div>}
        <div ref={endRef} />
      </div>
      {chat.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((s) => <button key={s} type="button" className="chip chip-off" onClick={() => ask(s)} disabled={busy}>{s}</button>)}
        </div>
      )}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input className="input" placeholder="Ask anything about this concept…" value={q} onChange={(e) => setQ(e.target.value)} disabled={busy} />
        <Button type="submit" loading={busy} icon={<Send className="h-4 w-4" />} disabled={!q.trim()}>Ask</Button>
      </form>
    </SectionCard>
  );
}

function Result({ output: o, input, state, setState }: ResultProps<Output, Input>) {
  const chat: ChatMsg[] = state.chat ?? [];
  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-brand-600 to-indigo-600 p-6 text-white">
          <span className="badge bg-white/20 text-white">{LEVEL_LABEL[o.level]} level</span>
          <h2 className="mt-2 text-2xl font-extrabold">{o.title}</h2>
          {o.one_liner && <p className="mt-2 text-lg text-brand-50"><Md>{o.one_liner}</Md></p>}
        </div>
        <div className="p-6"><Markdown>{o.explanation}</Markdown></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {o.analogy && (
          <div className="card avoid-break border-l-4 border-l-amber-400 p-6">
            <div className="mb-2 flex items-center gap-2 font-bold text-amber-700"><Lightbulb className="h-5 w-5" /> Think of it like this</div>
            <Markdown className="prose-sm">{o.analogy}</Markdown>
          </div>
        )}
        {o.example && (
          <div className="card avoid-break border-l-4 border-l-emerald-400 p-6">
            <div className="mb-2 flex items-center gap-2 font-bold text-emerald-700"><Sparkles className="h-5 w-5" /> Example</div>
            <Markdown className="prose-sm">{o.example}</Markdown>
          </div>
        )}
      </div>

      {o.steps.length > 0 && (
        <SectionCard title="Step by step" icon={<ListOrdered className="h-5 w-5" />}>
          <ol className="space-y-3">
            {o.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{i + 1}</span>
                <span className="pt-0.5 text-slate-700"><Md>{s}</Md></span>
              </li>
            ))}
          </ol>
        </SectionCard>
      )}

      {o.compare && o.compare.rows.length > 0 && (
        <SectionCard title={`${o.title} vs ${o.compare.with}`} icon={<ArrowRightLeft className="h-5 w-5" />}>
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead><tr><th /><th>{o.title}</th><th>{o.compare.with}</th></tr></thead>
              <tbody>{o.compare.rows.map((r, i) => <tr key={i}><td className="font-semibold">{r.aspect}</td><td><Md>{r.this}</Md></td><td><Md>{r.that}</Md></td></tr>)}</tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {o.misconceptions.length > 0 && <SectionCard title="Common misconceptions" icon={<TriangleAlert className="h-5 w-5" />}><BulletList items={o.misconceptions} /></SectionCard>}
        {o.check_questions.length > 0 && <SectionCard title="Check your understanding" icon={<CircleHelp className="h-5 w-5" />}><CheckQuestions items={o.check_questions} /></SectionCard>}
      </div>

      {o.related.length > 0 && (
        <div className="no-print flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">Learn next:</span>
          {o.related.map((r) => <Link key={r} to={`/tools/concept-explainer?concept=${encodeURIComponent(r)}`} className="chip chip-off">{r}</Link>)}
        </div>
      )}

      <FollowUp o={o} input={input} chat={chat} setChat={(c) => setState({ chat: c })} />
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    `# ${o.title}`,
    o.one_liner && `> ${o.one_liner}`,
    o.explanation,
    md.section('Analogy', o.analogy),
    md.section('Example', o.example),
    md.section('Steps', md.list(o.steps, true)),
    o.compare && o.compare.rows.length ? md.section(`${o.title} vs ${o.compare.with}`, md.table(['Aspect', o.title, o.compare.with], o.compare.rows.map((r) => [r.aspect, r.this, r.that]))) : '',
    md.section('Common misconceptions', md.list(o.misconceptions)),
    md.section('Check your understanding', md.list(o.check_questions.map((x) => `${x.q} *Answer: ${x.a}*`), true)),
    md.section('Learn next', md.list(o.related)),
  );
}

const module: ToolModule<Input, Output> = { Form, Result, toMarkdown };
export default module;
