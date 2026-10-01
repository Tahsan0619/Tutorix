import clsx from 'clsx';
import { ChartColumn, ChevronDown, CircleCheck, Download, FileSpreadsheet, Gauge, Layers, Lightbulb, ShieldCheck, TriangleAlert, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { BloomBars, HBar, ScoreRing } from '@/components/charts';
import { SourceInput } from '@/components/SourceInput';
import { useToast } from '@/components/Toast';
import { BulletList, Md } from '@/components/Markdown';
import { BloomBadge, Button, Field, Input, SectionCard, Select, StatCard } from '@/components/ui';
import { downloadFile, md } from '@/lib/export';
import { parseCsv } from '@/lib/files';
import { analyzeResponses, reliabilityLabel, summarizeForAi, type TestStats } from '@/lib/itemAnalysis';
import { plainText } from '@/lib/sanitize';
import { FormShell, GRADE_OPTIONS, Grid, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input {
  test_title: string; subject: string; grade: string; purpose: string; objectives: string; test_text: string;
  item_stats?: string; item_analysis?: TestStats | null;
}
interface Item {
  number: string; excerpt: string; bloom_level: string; difficulty: string; quality: 'good' | 'fair' | 'poor';
  issues: { type: string; severity: 'low' | 'medium' | 'high'; detail: string }[]; suggestion: string; rewrite: string;
}
interface Output {
  overall_score: number; summary: string; dimensions: { name: string; score: number; comment: string }[]; items: Item[];
  distribution: Record<string, number>; lower_order_pct: number; higher_order_pct: number; strengths: string[];
  critical_issues: string[]; recommendations: string[]; estimated_reliability: string; has_item_stats: boolean;
}

const SAMPLE_CSV = 'Student,Q1,Q2,Q3,Q4,Q5\nKEY,B,A,D,C,A\nAyesha,B,A,D,C,A\nRafi,B,C,D,C,B\nNadia,B,A,A,C,A\nTanvir,A,C,D,B,B\nSumaiya,B,A,D,C,C\nImran,C,B,A,C,B\n';

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const { v, set, bind } = useForm<Input>({
    test_title: '', subject: profile?.subject ?? '', grade: profile?.grade_level ?? '', purpose: 'Unit test', objectives: '', test_text: '', item_analysis: null,
  }, initial);

  const onCsv = async (file?: File) => {
    if (!file) return;
    try {
      const stats = analyzeResponses(parseCsv(await file.text()));
      set('item_analysis', stats);
      toast(`Analyzed ${stats.students} students × ${stats.items} items`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const stats = v.item_analysis;
  return (
    <FormShell
      onSubmit={() => onSubmit({ ...v, item_stats: stats ? summarizeForAi(stats) : undefined })}
      loading={loading}
      disabled={v.test_text.trim().length < 30}
      submitLabel="Audit test quality"
    >
      <SourceInput
        label="Test questions (with options and answer key if available)"
        value={v.test_text}
        onChange={(t) => set('test_text', t)}
        rows={10}
        placeholder={'1. Which is the SI unit of force?\n   a) Joule  b) Newton  c) Watt  d) Pascal   (Answer: b)\n2. State Newton’s second law…'}
      />
      <Grid cols={3}>
        <Field label="Test title"><Input {...bind('test_title')} placeholder="e.g. Forces: Unit Test" /></Field>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. Physics" /></Field>
        <Field label="Grade / class"><Select {...bind('grade')} options={GRADE_OPTIONS} /></Field>
      </Grid>
      <Grid>
        <Field label="Purpose"><Select {...bind('purpose')} options={['Unit test', 'Mid-term exam', 'Final exam', 'Entrance / admission test', 'Diagnostic test', 'Quiz', 'Standardized / board-style exam']} /></Field>
        <Field label="Intended learning objectives (optional)"><Input {...bind('objectives')} placeholder="What the test is supposed to measure" /></Field>
      </Grid>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-800"><FileSpreadsheet className="h-4 w-4 text-brand-600" /> Student response data (optional)</div>
            <p className="mt-0.5 text-xs text-slate-500">Upload a CSV to compute real item statistics: difficulty (p), discrimination (D), point-biserial, KR-20 reliability and distractor analysis.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadFile('sample-responses.csv', SAMPLE_CSV, 'text/csv')}>Sample CSV</Button>
            <Button type="button" variant="secondary" size="sm" icon={<Upload className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>Upload CSV</Button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => onCsv(e.target.files?.[0])} />
          </div>
        </div>
        {stats && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-4 py-2.5 text-sm">
            <span className="text-slate-700">
              <CircleCheck className="mr-1.5 inline h-4 w-4 text-emerald-500" />
              {stats.students} students × {stats.items} items · KR-20 <b>{stats.kr20.toFixed(2)}</b> ({reliabilityLabel(stats.kr20)}) · mean {stats.meanPct.toFixed(0)}%
            </span>
            <button type="button" className="text-slate-400 hover:text-rose-500" onClick={() => set('item_analysis', null)} aria-label="Remove data"><X className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </FormShell>
  );
}

const QUALITY: Record<string, string> = { good: 'bg-emerald-100 text-emerald-700', fair: 'bg-amber-100 text-amber-700', poor: 'bg-rose-100 text-rose-700' };
const SEVERITY: Record<string, string> = { low: 'text-slate-500', medium: 'text-amber-600', high: 'text-rose-600' };

function ItemRow({ it }: { it: Item }) {
  const [open, setOpen] = useState(it.quality === 'poor');
  return (
    <div className="avoid-break rounded-xl border border-slate-200">
      <button type="button" className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(!open)}>
        <span className="w-10 shrink-0 font-bold text-slate-900">Q{it.number}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{plainText(it.excerpt)}</span>
        <BloomBadge level={it.bloom_level} />
        <span className="badge hidden bg-slate-100 capitalize text-slate-600 sm:inline-flex">{it.difficulty}</span>
        <span className={clsx('badge capitalize', QUALITY[it.quality])}>{it.quality}</span>
        {it.issues.length > 0 && <span className="text-xs font-semibold text-slate-400">{it.issues.length} issue{it.issues.length > 1 ? 's' : ''}</span>}
        <ChevronDown className={clsx('no-print h-4 w-4 shrink-0 text-slate-400 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 p-4 text-sm">
          {it.issues.map((x, i) => (
            <div key={i} className="flex gap-2">
              <TriangleAlert className={clsx('mt-0.5 h-4 w-4 shrink-0', SEVERITY[x.severity])} />
              <div><b className="text-slate-800">{x.type}</b> <span className={clsx('text-xs font-semibold uppercase', SEVERITY[x.severity])}>{x.severity}</span><div className="text-slate-600"><Md>{x.detail}</Md></div></div>
            </div>
          ))}
          {it.suggestion && <p className="text-slate-700"><b>Fix:</b> <Md>{it.suggestion}</Md></p>}
          {it.rewrite && <div className="whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-emerald-900"><b>Improved item:</b>{'\n'}{it.rewrite}</div>}
        </div>
      )}
    </div>
  );
}

function Psychometrics({ s }: { s: TestStats }) {
  return (
    <SectionCard title="Item analysis from student responses" icon={<ChartColumn className="h-5 w-5" />}>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="KR-20 reliability" value={s.kr20.toFixed(2)} sub={reliabilityLabel(s.kr20)} icon={<Gauge className="h-5 w-5" />} tone={s.kr20 >= 0.7 ? 'emerald' : 'rose'} />
        <StatCard label="Mean score" value={`${s.mean.toFixed(1)} / ${s.items}`} sub={`${s.meanPct.toFixed(0)}%`} icon={<ChartColumn className="h-5 w-5" />} />
        <StatCard label="Std. deviation" value={s.sd.toFixed(2)} icon={<Layers className="h-5 w-5" />} tone="sky" />
        <StatCard label="SEM" value={s.sem.toFixed(2)} sub={`${s.students} students`} icon={<ShieldCheck className="h-5 w-5" />} tone="amber" />
      </div>
      <div className="overflow-x-auto">
        <table className="table-clean">
          <thead><tr><th>Item</th><th>Key</th><th>Difficulty (p)</th><th>Discrimination (D)</th><th>Point-biserial</th><th>Distractors (upper / lower)</th><th>Flags</th></tr></thead>
          <tbody>
            {s.itemStats.map((it) => (
              <tr key={it.item}>
                <td className="font-bold"><Md>{it.item}</Md></td>
                <td>{it.key ?? '-'}</td>
                <td className={clsx(it.p < 0.2 || it.p > 0.9 ? 'font-semibold text-amber-600' : 'text-slate-700')}>{it.p.toFixed(2)}</td>
                <td className={clsx(it.discrimination < 0 ? 'font-bold text-rose-600' : it.discrimination < 0.2 ? 'font-semibold text-amber-600' : 'text-emerald-700')}>{it.discrimination.toFixed(2)}</td>
                <td className="text-slate-700">{it.pointBiserial.toFixed(2)}</td>
                <td className="text-xs text-slate-600">
                  {it.distractors.map((d) => <span key={d.option} className={clsx('mr-2 whitespace-nowrap', d.option === it.key && 'font-bold text-emerald-700')}>{d.option}: {d.upper}/{d.lower}</span>)}
                </td>
                <td className="text-xs text-rose-600">{it.flags.join(' · ') || <span className="text-emerald-600">OK</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">Guide: p between 0.30–0.80 is ideal; D ≥ 0.30 is good, 0.20–0.29 acceptable, &lt; 0.20 poor, negative means the key may be wrong. KR-20 ≥ 0.70 is acceptable for classroom tests, ≥ 0.80 for high-stakes tests.</p>
    </SectionCard>
  );
}

function Result({ output: o, input }: ResultProps<Output, Input>) {
  const label = o.overall_score >= 85 ? 'Excellent' : o.overall_score >= 70 ? 'Good' : o.overall_score >= 55 ? 'Needs revision' : 'Major revision needed';
  const poor = o.items.filter((i) => i.quality === 'poor').length;
  return (
    <div className="space-y-6">
      <div className="card grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center">
        <div className="text-center">
          <ScoreRing value={o.overall_score} label="quality" size={140} />
          <div className="mt-2 font-bold text-slate-900">{label}</div>
        </div>
        <div>
          <p className="leading-relaxed text-slate-700"><Md>{o.summary}</Md></p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="badge bg-slate-100 text-slate-700">{o.items.length} items reviewed</span>
            <span className="badge bg-rose-100 text-rose-700">{poor} poor items</span>
            <span className="badge bg-sky-100 text-sky-700">{o.lower_order_pct}% lower-order</span>
            <span className="badge bg-fuchsia-100 text-fuchsia-700">{o.higher_order_pct}% higher-order</span>
          </div>
          {o.estimated_reliability && <p className="mt-3 text-sm text-slate-500"><b>Estimated reliability:</b> <Md>{o.estimated_reliability}</Md></p>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Quality dimensions" icon={<Gauge className="h-5 w-5" />}>
          <div className="space-y-4">
            {o.dimensions.map((d) => (
              <div key={d.name}>
                <HBar label={d.name} value={d.score} max={10} suffix="/10" color={d.score >= 8 ? 'bg-emerald-500' : d.score >= 6 ? 'bg-amber-500' : 'bg-rose-500'} />
                <p className="mt-1 text-xs text-slate-500"><Md>{d.comment}</Md></p>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Cognitive (Bloom) balance" icon={<Layers className="h-5 w-5" />}>
          <BloomBars distribution={o.distribution} />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Critical issues" icon={<TriangleAlert className="h-5 w-5" />}><BulletList items={o.critical_issues} /></SectionCard>
        <SectionCard title="Strengths" icon={<CircleCheck className="h-5 w-5" />}><BulletList items={o.strengths} /></SectionCard>
        <SectionCard title="Recommendations" icon={<Lightbulb className="h-5 w-5" />}><BulletList items={o.recommendations} /></SectionCard>
      </div>

      {input.item_analysis && <Psychometrics s={input.item_analysis} />}

      <SectionCard title="Item-by-item review" icon={<ShieldCheck className="h-5 w-5" />}>
        <div className="space-y-2.5">{o.items.map((it) => <ItemRow key={it.number} it={it} />)}</div>
      </SectionCard>
    </div>
  );
}

function toMarkdown(o: Output, input: Input) {
  const s = input.item_analysis;
  return md.join(
    `# Test quality report${input.test_title ? `: ${input.test_title}` : ''}`,
    `**Overall score:** ${o.overall_score}/100`,
    o.summary,
    md.section('Quality dimensions', md.table(['Dimension', 'Score', 'Comment'], o.dimensions.map((d) => [d.name, `${d.score}/10`, d.comment]))),
    md.section('Critical issues', md.list(o.critical_issues)),
    md.section('Strengths', md.list(o.strengths)),
    md.section('Recommendations', md.list(o.recommendations)),
    s && md.section('Item statistics', `KR-20 ${s.kr20.toFixed(2)} · mean ${s.meanPct.toFixed(1)}% · SD ${s.sd.toFixed(2)} · SEM ${s.sem.toFixed(2)}\n\n` +
      md.table(['Item', 'p', 'D', 'r_pb', 'Flags'], s.itemStats.map((it) => [it.item, it.p.toFixed(2), it.discrimination.toFixed(2), it.pointBiserial.toFixed(2), it.flags.join('; ')]))),
    md.section('Items', o.items.map((it) => `### Q${it.number}: ${it.quality} (${it.bloom_level}, ${it.difficulty})\n${it.excerpt}\n\n${md.list(it.issues.map((x) => `**${x.type}** (${x.severity}): ${x.detail}`))}\n\n${it.suggestion ? `**Fix:** ${it.suggestion}` : ''}${it.rewrite ? `\n\n**Improved:** ${it.rewrite}` : ''}`).join('\n\n')),
  );
}

const module: ToolModule<Input, Output> = {
  Form, Result, toMarkdown,
  loadingMessages: ['Parsing the test items…', 'Checking each item against item-writing guidelines…', 'Evaluating distractors and keys…', 'Scanning for bias and ambiguity…', 'Scoring quality dimensions…'],
};
export default module;
