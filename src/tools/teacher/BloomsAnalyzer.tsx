import clsx from 'clsx';
import { Download, Layers, Lightbulb, ListChecks, Target, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BloomBars, ScoreRing } from '@/components/charts';
import { BulletList, Md } from '@/components/Markdown';
import { SourceInput } from '@/components/SourceInput';
import { BloomBadge, Button, Field, Input, SectionCard, Segmented, Select, Textarea } from '@/components/ui';
import { downloadFile, md, toCsv } from '@/lib/export';
import { BLOOM_LEVELS } from '@/lib/types';
import { FormShell, GRADE_OPTIONS, Grid, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input { mode: 'single' | 'bulk'; question: string; text: string; subject: string; grade: string }

interface SingleOut {
  mode: 'single'; question: string; level: string; confidence: number; secondary_level: string | null; verbs: string[];
  knowledge_dimension: string; cognitive_process: string; reasoning: string; strengths: string[]; issues: string[];
  improvements: { level: string; question: string }[]; tips: string[];
}
interface BulkItem { index: number; question: string; level: string; confidence: number; verbs: string[]; knowledge_dimension: string; reason: string }
interface BulkOut {
  mode: 'bulk'; items: BulkItem[]; distribution: Record<string, number>; lower_order_pct: number; higher_order_pct: number;
  balance_score: number; summary: string; gaps: string[]; recommendations: string[]; ideal_distribution: Record<string, number>;
}
type Output = SingleOut | BulkOut;

export function countQuestions(raw: string) {
  const startRe = /^\s*(?:Q\s*)?(?:\d{1,3}|[ivx]{1,5})\s*[.)\]:-]\s+/i;
  let n = 0;
  let inQ = false;
  for (const line of raw.replace(/\r/g, '').split('\n')) {
    if (!line.trim()) {
      inQ = false;
      continue;
    }
    if (!inQ || startRe.test(line)) n++;
    inQ = true;
  }
  return n;
}

function Form({ onSubmit, loading, initial }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({ mode: 'single', question: '', text: '', subject: '', grade: '' }, initial);
  const count = useMemo(() => countQuestions(v.text), [v.text]);
  const disabled = v.mode === 'single' ? v.question.trim().length < 5 : count < 2;
  return (
    <FormShell
      onSubmit={() => onSubmit(v)}
      loading={loading}
      disabled={disabled}
      submitLabel={v.mode === 'single' ? 'Analyze question' : `Analyze ${count || ''} questions`}
      footer={v.mode === 'bulk' ? `${count} question${count === 1 ? '' : 's'} detected · max 100` : undefined}
    >
      <Segmented
        value={v.mode}
        onChange={(m) => set('mode', m)}
        options={[{ value: 'single', label: 'Single question' }, { value: 'bulk', label: 'Bulk (question set)' }]}
      />
      {v.mode === 'single' ? (
        <Field label="Question" required>
          <Textarea rows={4} {...bind('question')} placeholder="e.g. Compare the causes of the First and Second World Wars and justify which was more avoidable." />
        </Field>
      ) : (
        <SourceInput
          label="Questions (one per line or numbered)"
          value={v.text}
          onChange={(t) => set('text', t)}
          rows={10}
          accept=".pdf,.txt,.md,.csv"
          placeholder={'1. Define photosynthesis.\n2. Explain the role of chlorophyll.\n3. Design an experiment to test the effect of light intensity…'}
        />
      )}
      <Grid>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. Biology" /></Field>
        <Field label="Grade / class"><Select {...bind('grade')} options={GRADE_OPTIONS} /></Field>
      </Grid>
    </FormShell>
  );
}

const PYRAMID_COLORS: Record<string, string> = {
  Create: 'bg-fuchsia-500', Evaluate: 'bg-orange-500', Analyze: 'bg-amber-500', Apply: 'bg-lime-500', Understand: 'bg-teal-500', Remember: 'bg-sky-500',
};

function Pyramid({ level, secondary }: { level: string; secondary?: string | null }) {
  const order = [...BLOOM_LEVELS].reverse();
  return (
    <div className="flex flex-col items-center gap-1">
      {order.map((l, i) => (
        <div
          key={l}
          className={clsx(
            'rounded-md py-1.5 text-center text-xs font-bold transition',
            l === level ? `${PYRAMID_COLORS[l]} text-white shadow-lg ring-4 ring-offset-1 ring-brand-200` : l === secondary ? `${PYRAMID_COLORS[l]} text-white opacity-60` : 'bg-slate-100 text-slate-400',
          )}
          style={{ width: `${40 + i * 12}%` }}
        >
          {l}
        </div>
      ))}
    </div>
  );
}

function SingleResult({ o }: { o: SingleOut }) {
  return (
    <div className="space-y-6">
      <div className="card grid gap-6 p-6 md:grid-cols-[1fr_auto_220px] md:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Question</div>
          <p className="mt-1 text-lg font-semibold leading-relaxed text-slate-900"><Md>{o.question}</Md></p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">Classified as</span>
            <BloomBadge level={o.level} />
            {o.secondary_level && <><span className="text-xs text-slate-400">also touches</span><BloomBadge level={o.secondary_level} /></>}
            <span className="badge bg-slate-100 text-slate-700">{o.knowledge_dimension} knowledge</span>
          </div>
          {o.verbs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {o.verbs.map((v) => <span key={v} className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs text-brand-700">{v}</span>)}
            </div>
          )}
        </div>
        <ScoreRing value={o.confidence} label="confidence" size={112} color="#6326ee" />
        <Pyramid level={o.level} secondary={o.secondary_level} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Why this level" icon={<Target className="h-5 w-5" />}>
          <p className="text-sm font-semibold text-slate-800"><Md>{o.cognitive_process}</Md></p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600"><Md>{o.reasoning}</Md></p>
        </SectionCard>
        <SectionCard title="Question quality" icon={<ListChecks className="h-5 w-5" />}>
          {o.strengths.length > 0 && <><div className="mb-2 text-xs font-bold uppercase text-emerald-600">Strengths</div><BulletList items={o.strengths} /></>}
          {o.issues.length > 0 && <><div className="mb-2 mt-4 text-xs font-bold uppercase text-rose-600">Issues</div><BulletList items={o.issues} /></>}
          {!o.strengths.length && !o.issues.length && <p className="text-sm text-slate-500">No issues found.</p>}
        </SectionCard>
      </div>
      {o.improvements.length > 0 && (
        <SectionCard title="Rewritten at other levels" icon={<Layers className="h-5 w-5" />}>
          <div className="grid gap-3 md:grid-cols-3">
            {o.improvements.map((x, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-4">
                <BloomBadge level={x.level} />
                <p className="mt-2 text-sm leading-relaxed text-slate-700"><Md>{x.question}</Md></p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
      {o.tips.length > 0 && <SectionCard title="Teacher tips" icon={<Lightbulb className="h-5 w-5" />}><BulletList items={o.tips} /></SectionCard>}
    </div>
  );
}

function BulkResult({ o }: { o: BulkOut }) {
  const [filter, setFilter] = useState('');
  const items = filter ? o.items.filter((i) => i.level === filter) : o.items;
  const exportCsv = () =>
    downloadFile('blooms-analysis.csv', toCsv([
      ['#', 'Question', 'Bloom level', 'Confidence', 'Knowledge dimension', 'Verbs', 'Reason'],
      ...o.items.map((i) => [i.index, i.question, i.level, i.confidence, i.knowledge_dimension, i.verbs.join(' '), i.reason]),
    ]), 'text/csv;charset=utf-8');
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card flex flex-col items-center justify-center p-6 text-center">
          <ScoreRing value={o.balance_score} max={10} label="balance /10" size={130} color={o.balance_score >= 7 ? '#10b981' : o.balance_score >= 5 ? '#f59e0b' : '#ef4444'} />
          <div className="mt-4 grid w-full grid-cols-2 gap-3">
            <div className="rounded-xl bg-sky-50 p-3"><div className="text-xl font-extrabold text-sky-700">{o.lower_order_pct}%</div><div className="text-xs font-semibold text-sky-600">Lower-order</div></div>
            <div className="rounded-xl bg-fuchsia-50 p-3"><div className="text-xl font-extrabold text-fuchsia-700">{o.higher_order_pct}%</div><div className="text-xs font-semibold text-fuchsia-600">Higher-order</div></div>
          </div>
          <p className="mt-3 text-xs text-slate-500">{o.items.length} questions analyzed</p>
        </div>
        <SectionCard title="Distribution vs. recommended" icon={<Layers className="h-5 w-5" />} className="lg:col-span-2">
          <BloomBars distribution={o.distribution} ideal={o.ideal_distribution} />
          <p className="mt-4 text-sm leading-relaxed text-slate-600"><Md>{o.summary}</Md></p>
        </SectionCard>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Gaps" icon={<TriangleAlert className="h-5 w-5" />}><BulletList items={o.gaps} /></SectionCard>
        <SectionCard title="Recommendations" icon={<Lightbulb className="h-5 w-5" />}><BulletList items={o.recommendations} /></SectionCard>
      </div>
      <SectionCard
        title="Question-by-question"
        icon={<ListChecks className="h-5 w-5" />}
        action={
          <div className="no-print flex items-center gap-2">
            <select className="rounded-lg border border-slate-200 px-2 py-1 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All levels</option>
              {BLOOM_LEVELS.map((l) => <option key={l} value={l}>{l} ({o.distribution[l] ?? 0})</option>)}
            </select>
            <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={exportCsv}>CSV</Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="table-clean">
            <thead><tr><th className="w-10">#</th><th>Question</th><th>Level</th><th className="w-24">Confidence</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.index}>
                  <td className="font-semibold text-slate-400">{i.index}</td>
                  <td>
                    <div className="text-slate-800"><Md>{i.question}</Md></div>
                    <div className="mt-1 text-xs text-slate-500"><Md>{i.reason}</Md></div>
                  </td>
                  <td><BloomBadge level={i.level} /><div className="mt-1 text-[11px] text-slate-400">{i.knowledge_dimension}</div></td>
                  <td className="text-slate-600">{i.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function Result({ output }: ResultProps<Output, Input>) {
  return output.mode === 'bulk' ? <BulkResult o={output} /> : <SingleResult o={output} />;
}

function toMarkdown(o: Output) {
  if (o.mode === 'single') {
    return md.join(
      `# Bloom's analysis`,
      `**Question:** ${o.question}`,
      `**Level:** ${o.level}${o.secondary_level ? ` (also ${o.secondary_level})` : ''} · **Confidence:** ${o.confidence}% · **Knowledge:** ${o.knowledge_dimension}`,
      md.section('Reasoning', `${o.cognitive_process}\n\n${o.reasoning}`),
      md.section('Strengths', md.list(o.strengths)),
      md.section('Issues', md.list(o.issues)),
      md.section('Rewritten at other levels', md.list(o.improvements.map((x) => `**${x.level}:** ${x.question}`))),
      md.section('Tips', md.list(o.tips)),
    );
  }
  return md.join(
    `# Bloom's analysis: ${o.items.length} questions`,
    `**Balance score:** ${o.balance_score}/10 · Lower-order ${o.lower_order_pct}% · Higher-order ${o.higher_order_pct}%`,
    o.summary,
    md.table(['Level', 'Count', 'Target %'], BLOOM_LEVELS.map((l) => [l, o.distribution[l] ?? 0, o.ideal_distribution?.[l] ?? ''])),
    md.section('Gaps', md.list(o.gaps)),
    md.section('Recommendations', md.list(o.recommendations)),
    md.section('Questions', md.table(['#', 'Question', 'Level', 'Confidence'], o.items.map((i) => [i.index, i.question, i.level, `${i.confidence}%`]))),
  );
}

const module: ToolModule<Input, Output> = {
  Form,
  Result,
  toMarkdown,
  loadingMessages: ['Reading each question…', 'Identifying the cognitive process required…', 'Classifying by Bloom level…', 'Checking cognitive balance…', 'Writing recommendations…'],
};
export default module;
