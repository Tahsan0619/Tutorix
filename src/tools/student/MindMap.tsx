import clsx from 'clsx';
import { ChevronRight, GitBranch, ListTree, Minus, Network, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SourceInput } from '@/components/SourceInput';
import { Md } from '@/components/Markdown';
import { Button, Field, Input, SectionCard, Segmented, Select } from '@/components/ui';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input { topic: string; subject: string; level: string; depth: string; source_text: string; material_ids: string[]; language: string }
interface MindNode { label: string; note?: string; children: MindNode[] }
interface Output extends MindNode { connections: { from: string; to: string; relation: string }[] }

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({ topic: '', subject: profile?.subject ?? '', level: profile?.grade_level ?? '', depth: '3', source_text: '', material_ids: [], language: defaultLanguage(profile) }, initial);
  return (
    <FormShell onSubmit={() => onSubmit(v)} loading={loading} disabled={!v.topic.trim() && v.source_text.trim().length < 50 && !v.material_ids.length} submitLabel="Draw mind map">
      <Grid cols={3}>
        <Field label="Topic"><Input {...bind('topic')} placeholder="e.g. The French Revolution" /></Field>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. History" /></Field>
        <Field label="Class / level"><Select {...bind('level')} options={GRADE_OPTIONS} /></Field>
      </Grid>
      <Grid>
        <Field label="Depth"><Select {...bind('depth')} options={[{ value: '2', label: '2 levels (overview)' }, { value: '3', label: '3 levels (recommended)' }, { value: '4', label: '4 levels (detailed)' }]} /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
      <SourceInput value={v.source_text} onChange={(t) => set('source_text', t)} materialIds={v.material_ids} onMaterialIds={(ids) => set('material_ids', ids)} label="Map my notes / chapter (optional)" rows={5} />
    </FormShell>
  );
}

const PALETTE = [
  { pill: 'bg-brand-600 text-white', soft: 'bg-brand-50 text-brand-900 border-brand-200', line: 'border-brand-300' },
  { pill: 'bg-emerald-600 text-white', soft: 'bg-emerald-50 text-emerald-900 border-emerald-200', line: 'border-emerald-300' },
  { pill: 'bg-amber-500 text-white', soft: 'bg-amber-50 text-amber-900 border-amber-200', line: 'border-amber-300' },
  { pill: 'bg-rose-600 text-white', soft: 'bg-rose-50 text-rose-900 border-rose-200', line: 'border-rose-300' },
  { pill: 'bg-sky-600 text-white', soft: 'bg-sky-50 text-sky-900 border-sky-200', line: 'border-sky-300' },
  { pill: 'bg-fuchsia-600 text-white', soft: 'bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200', line: 'border-fuchsia-300' },
  { pill: 'bg-teal-600 text-white', soft: 'bg-teal-50 text-teal-900 border-teal-200', line: 'border-teal-300' },
];

function allPaths(n: MindNode, path = 'r', out: string[] = []) {
  if (n.children.length) out.push(path);
  n.children.forEach((c, i) => allPaths(c, `${path}.${i}`, out));
  return out;
}
function countNodes(n: MindNode): number {
  return 1 + n.children.reduce((s, c) => s + countNodes(c), 0);
}

function TreeNode({ node, path, depth, color, collapsed, toggle }: {
  node: MindNode; path: string; depth: number; color: (typeof PALETTE)[number]; collapsed: Set<string>; toggle: (p: string) => void;
}) {
  const open = !collapsed.has(path);
  const hasKids = node.children.length > 0;
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => hasKids && toggle(path)}
        title={node.note}
        className={clsx(
          'group relative max-w-[240px] shrink-0 rounded-xl border px-3 py-2 text-left transition',
          depth === 1 ? clsx(color.pill, 'border-transparent font-bold shadow-sm') : clsx(color.soft, 'text-sm'),
          hasKids ? 'cursor-pointer hover:shadow-md' : 'cursor-default',
        )}
      >
        <span className="flex items-center gap-1.5">
          <span className="leading-snug">{node.label}</span>
          {hasKids && <ChevronRight className={clsx('h-3.5 w-3.5 shrink-0 opacity-70 transition', open && 'rotate-90')} />}
        </span>
        {node.note && depth > 1 && <span className="mt-0.5 block text-[11px] font-normal leading-snug opacity-75"><Md>{node.note}</Md></span>}
      </button>
      {hasKids && open && (
        <div className="flex flex-col gap-2 py-1">
          {node.children.map((c, i) => (
            <div key={i} className="relative flex items-center pl-8">
              <span className={clsx('absolute left-0 top-1/2 w-8 border-t-2', color.line)} />
              <span className={clsx('absolute left-0 border-l-2', color.line, i === 0 ? 'top-1/2' : 'top-0', i === node.children.length - 1 ? 'bottom-1/2' : 'bottom-0')} />
              <TreeNode node={c} path={`${path}.${i}`} depth={depth + 1} color={color} collapsed={collapsed} toggle={toggle} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Outline({ node, depth = 0 }: { node: MindNode; depth?: number }) {
  return (
    <ul className={clsx(depth > 0 && 'ml-5 border-l border-slate-200 pl-4', 'space-y-1.5')}>
      {node.children.map((c, i) => (
        <li key={i}>
          <div className={clsx(depth === 0 ? 'font-bold text-slate-900' : 'text-sm text-slate-700')}>
            {c.label}{c.note && <span className="font-normal text-slate-500">: {c.note}</span>}
          </div>
          {c.children.length > 0 && <div className="mt-1.5"><Outline node={c} depth={depth + 1} /></div>}
        </li>
      ))}
    </ul>
  );
}

function Result({ output: o }: ResultProps<Output, Input>) {
  const [view, setView] = useState<'map' | 'outline'>('map');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const paths = useMemo(() => allPaths(o), [o]);
  const toggle = (p: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm text-slate-500">{o.children.length} main branches · {countNodes(o) - 1} ideas</div>
        <div className="no-print flex flex-wrap items-center gap-2">
          {view === 'map' && (
            <>
              <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => setCollapsed(new Set())}>Expand all</Button>
              <Button size="sm" variant="ghost" icon={<Minus className="h-4 w-4" />} onClick={() => setCollapsed(new Set(paths.filter((p) => p.split('.').length === 2)))}>Collapse</Button>
            </>
          )}
          <Segmented value={view} onChange={setView} options={[{ value: 'map', label: 'Map', icon: <Network className="h-4 w-4" /> }, { value: 'outline', label: 'Outline', icon: <ListTree className="h-4 w-4" /> }]} />
        </div>
      </div>

      {view === 'map' ? (
        <div className="card overflow-x-auto p-6 scrollbar-thin">
          <div className="flex min-w-max items-center">
            <div className="shrink-0 rounded-2xl bg-gradient-to-br from-slate-900 to-brand-900 px-5 py-4 text-center text-white shadow-glow">
              <div className="text-lg font-extrabold">{o.label}</div>
              {o.note && <div className="mt-1 max-w-[220px] text-xs text-brand-100"><Md>{o.note}</Md></div>}
            </div>
            <div className="flex flex-col gap-4 py-2">
              {o.children.map((c, i) => {
                const color = PALETTE[i % PALETTE.length];
                return (
                  <div key={i} className="relative flex items-center pl-10">
                    <span className={clsx('absolute left-0 top-1/2 w-10 border-t-2', color.line)} />
                    <span className={clsx('absolute left-0 border-l-2 border-slate-300', i === 0 ? 'top-1/2' : 'top-0', i === o.children.length - 1 ? 'bottom-1/2' : 'bottom-0')} />
                    <TreeNode node={c} path={`r.${i}`} depth={1} color={color} collapsed={collapsed} toggle={toggle} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-6">
          <h2 className="mb-1 text-xl font-extrabold text-slate-900">{o.label}</h2>
          {o.note && <p className="mb-4 text-slate-500"><Md>{o.note}</Md></p>}
          <Outline node={o} />
        </div>
      )}

      {o.connections.length > 0 && (
        <SectionCard title="Cross-links" icon={<GitBranch className="h-5 w-5" />}>
          <div className="space-y-2">
            {o.connections.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="badge bg-brand-50 text-brand-800">{c.from}</span>
                <span className="text-slate-400">→</span>
                <span className="badge bg-emerald-50 text-emerald-800">{c.to}</span>
                <span className="text-slate-600"><Md>{c.relation}</Md></span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function outlineMd(n: MindNode, depth = 0): string {
  return n.children.map((c) => `${'  '.repeat(depth)}- ${depth === 0 ? `**${c.label}**` : c.label}${c.note ? `: ${c.note}` : ''}\n${outlineMd(c, depth + 1)}`).join('');
}

function toMarkdown(o: Output) {
  return `# ${o.label}\n\n${o.note ? `${o.note}\n\n` : ''}${outlineMd(o)}${o.connections.length ? `\n## Cross-links\n\n${o.connections.map((c) => `- ${c.from} → ${c.to}: ${c.relation}`).join('\n')}\n` : ''}`;
}

const module: ToolModule<Input, Output> = { Form, Result, toMarkdown };
export default module;
