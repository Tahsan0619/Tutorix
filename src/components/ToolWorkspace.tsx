import clsx from 'clsx';
import {
  BookOpenCheck, ChevronDown, Copy, Download, FileDown, FileText, Pencil, Plus, Printer, RefreshCw, Sparkles, Star, TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { runTool } from '@/lib/ai';
import { downloadPdf, downloadWordDoc } from '@/lib/documents';
import { copyText, downloadFile, slugify } from '@/lib/export';
import { cleanMarkdown, plainText } from '@/lib/sanitize';
import { timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { ToolMeta } from '@/lib/tools';
import type { Generation, Grounding } from '@/lib/types';
import type { ToolModule } from '@/tools/types';
import { Logo } from './Logo';
import { useToast } from './Toast';
import { Button, Card, Modal, PageLoader, Tabs } from './ui';

const DEFAULT_MESSAGES = [
  'Reading your request…',
  'Thinking like an expert educator…',
  'Structuring the content…',
  'Checking quality and alignment…',
  'Polishing the final result…',
];

function LoadingPanel({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    const m = setInterval(() => setI((x) => Math.min(x + 1, messages.length - 1)), 3200);
    return () => {
      clearInterval(t);
      clearInterval(m);
    };
  }, [messages.length]);
  return (
    <Card className="overflow-hidden p-8">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-5">
          <div className="absolute inset-0 animate-ping rounded-full bg-brand-200 opacity-60" />
          <div className="relative rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 p-4 text-white shadow-glow">
            <Sparkles className="h-7 w-7" />
          </div>
        </div>
        <p className="font-semibold text-slate-900">{messages[i]}</p>
        <p className="mt-1 text-sm text-slate-500">{secs}s · this usually takes 5–25 seconds</p>
        <div className="mt-6 w-full max-w-xl space-y-3">
          {[90, 75, 82, 60].map((w, k) => (
            <div key={k} className="relative h-3 overflow-hidden rounded-full bg-slate-100" style={{ width: `${w}%` }}>
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white to-transparent" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function GroundingBadge({ g }: { g?: Grounding }) {
  if (!g?.sources?.length) return null;
  const names = g.sources.map((s) => s.title).join(', ');
  const detail = g.mode === 'cag'
    ? 'read in full'
    : g.sources.map((s) => `${s.used} of ${s.total} passages`).join(' + ') + ' most relevant to this request';
  return (
    <p
      className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
      title={g.mode === 'cag' ? 'The whole material fit, so the AI read all of it.' : `The material was too long to read at once, so Tutorix searched it for: ${g.query}`}
    >
      <BookOpenCheck className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">Based on {names}: {detail}</span>
    </p>
  );
}

export function ToolWorkspace({ meta, module }: { meta: ToolMeta; module: ToolModule }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const gid = params.get('g');
  const tab = params.get('tab') ?? 'generate';

  const [generation, setGeneration] = useState<Generation | null>(null);
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(true);
  const [lastInput, setLastInput] = useState<any>(null);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [exporting, setExporting] = useState<'' | 'pdf' | 'word'>('');
  const resultRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!gid) {
      setGeneration(null);
      setFormOpen(true);
      return;
    }
    if (generation?.id === gid) return;
    setFetching(true);
    supabase
      .from('generations')
      .select('*')
      .eq('id', gid)
      .maybeSingle()
      .then(({ data, error: err }) => {
        setFetching(false);
        if (err || !data) {
          toast('That saved item could not be found.', 'error');
          setParams({}, { replace: true });
          return;
        }
        setGeneration(data as Generation);
        setFormOpen(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid]);

  const submit = async (input: any, fresh = false) => {
    setLoading(true);
    setError('');
    setLastInput(input);
    try {
      const res = await runTool(meta.id, input, { fresh });
      let gen: Generation | null = null;
      if (res.generation_id) {
        const { data } = await supabase.from('generations').select('*').eq('id', res.generation_id).single();
        gen = data as Generation;
      }
      gen ??= {
        id: '', user_id: profile?.id ?? '', tool: meta.id, title: meta.name, input, output: res.output, state: {},
        is_favorite: false, model: res.model, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      setGeneration(gen);
      setFormOpen(false);
      if (gen.id) setParams({ g: gen.id });
      if (res.cached) toast('Same request as before, so the earlier answer was reused. Use Regenerate for a new version.', 'info');
      else toast(gen.id ? 'Generated and saved to your library' : 'Generated');
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const setState = useCallback((patch: Record<string, any>) => {
    setGeneration((g) => {
      if (!g) return g;
      const next = { ...g, state: { ...g.state, ...patch } };
      if (g.id) {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          supabase.from('generations').update({ state: next.state }).eq('id', g.id).then(({ error: err }) => {
            if (err) toast('Could not save your progress: ' + err.message, 'error');
          });
        }, 600);
      }
      return next;
    });
  }, [toast]);

  const toggleFavorite = async () => {
    if (!generation?.id) return;
    const is_favorite = !generation.is_favorite;
    setGeneration({ ...generation, is_favorite });
    const { error: err } = await supabase.from('generations').update({ is_favorite }).eq('id', generation.id);
    if (err) toast(err.message, 'error');
    else toast(is_favorite ? 'Added to favorites' : 'Removed from favorites', 'info');
  };

  const rename = async () => {
    if (!generation?.id || !newTitle.trim()) return;
    const title = newTitle.trim().slice(0, 160);
    const { error: err } = await supabase.from('generations').update({ title }).eq('id', generation.id);
    if (err) return toast(err.message, 'error');
    setGeneration({ ...generation, title });
    setRenaming(false);
    toast('Renamed');
  };

  const markdown = () => (generation ? cleanMarkdown(module.toMarkdown(generation.output, generation.input)) + '\n' : '');
  const fileBase = slugify(plainText(generation?.title) || meta.name);
  const docArgs = (ext: string) => ({ title: plainText(generation?.title) || meta.name, subtitle: meta.name, markdown: markdown(), filename: `${fileBase}.${ext}` });

  const exportPdf = async () => {
    setExporting('pdf');
    try {
      await downloadPdf(docArgs('pdf'));
      toast('PDF downloaded');
    } catch (e) {
      toast(`Could not create the PDF: ${(e as Error).message}`, 'error');
    } finally {
      setExporting('');
    }
  };

  const exportWord = async () => {
    setExporting('word');
    try {
      await downloadWordDoc(docArgs('doc'));
    } catch (e) {
      toast(`Could not create the Word file: ${(e as Error).message}`, 'error');
    } finally {
      setExporting('');
    }
  };

  const startNew = () => {
    setParams({});
    setGeneration(null);
    setError('');
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const Result = module.Result;
  const Form = module.Form;
  const formInitial = generation?.input ?? lastInput ?? undefined;
  const extraTabs = module.tabs ?? [];
  const ActiveTab = extraTabs.find((t) => t.id === tab)?.Component;

  return (
    <div className="animate-fade-in">
      <div className="no-print mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={clsx('rounded-2xl bg-gradient-to-br p-3 text-white shadow-lg', meta.gradient)}>
            <meta.icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{meta.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">{meta.description}</p>
          </div>
        </div>
        {generation && tab === 'generate' && (
          <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={startNew}>New</Button>
        )}
      </div>

      {extraTabs.length > 0 && (
        <div className="no-print mb-6">
          <Tabs
            tabs={[{ value: 'generate', label: 'Generate' }, ...extraTabs.map((t) => ({ value: t.id, label: t.label }))]}
            value={tab}
            onChange={(v) => setParams(v === 'generate' ? (gid ? { g: gid } : {}) : { tab: v })}
          />
        </div>
      )}

      {ActiveTab ? (
        <ActiveTab />
      ) : (
        <>
          <Card className="no-print mb-6">
            <button
              type="button"
              className="flex w-full items-center justify-between px-6 py-4 text-left"
              onClick={() => setFormOpen(!formOpen)}
            >
              <span className="flex items-center gap-2 font-bold text-slate-900">
                <Pencil className="h-4 w-4 text-brand-600" />
                {generation ? 'Inputs' : 'Tell Tutorix what you need'}
              </span>
              <ChevronDown className={clsx('h-5 w-5 text-slate-400 transition', formOpen && 'rotate-180')} />
            </button>
            <div className={clsx('border-t border-slate-100 px-6 pb-6 pt-5', !formOpen && 'hidden')}>
              <Form key={generation?.id ?? 'new'} onSubmit={submit} loading={loading} initial={formInitial} profile={profile} />
            </div>
          </Card>

          {error && (
            <div className="no-print mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">Generation failed</div>
                <div className="mt-0.5">{error}</div>
              </div>
              {lastInput && (
                <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => submit(lastInput)}>
                  Retry
                </Button>
              )}
            </div>
          )}

          {loading && <LoadingPanel messages={module.loadingMessages ?? DEFAULT_MESSAGES} />}
          {fetching && <PageLoader />}

          {generation && !loading && (
            <div ref={resultRef} className="scroll-mt-6">
              <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-bold text-slate-900">{plainText(generation.title)}</h2>
                    {generation.id && (
                      <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Rename" onClick={() => { setNewTitle(generation.title); setRenaming(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {generation.id ? `Saved ${timeAgo(generation.created_at)}` : 'Not saved'}
                    {generation.model && ` · ${generation.model.replace('openai/', '')}`}
                  </p>
                  <GroundingBadge g={generation.output?.grounding} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {generation.id && (
                    <Button variant="secondary" size="sm" onClick={toggleFavorite} icon={<Star className={clsx('h-3.5 w-3.5', generation.is_favorite && 'fill-amber-400 text-amber-400')} />}>
                      {generation.is_favorite ? 'Favorited' : 'Favorite'}
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={async () => { await copyText(markdown()); toast('Copied as Markdown'); }}>
                    Copy
                  </Button>
                  <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadFile(`${fileBase}.md`, markdown(), 'text/markdown;charset=utf-8')}>
                    .md
                  </Button>
                  <Button variant="secondary" size="sm" icon={<FileText className="h-3.5 w-3.5" />} loading={exporting === 'pdf'} disabled={!!exporting} onClick={exportPdf}>
                    PDF
                  </Button>
                  <Button variant="secondary" size="sm" icon={<FileDown className="h-3.5 w-3.5" />} loading={exporting === 'word'} disabled={!!exporting} onClick={exportWord}>
                    Word
                  </Button>
                  <Button variant="secondary" size="sm" icon={<Printer className="h-3.5 w-3.5" />} onClick={() => window.print()}>
                    Print
                  </Button>
                  {lastInput && (
                    <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => submit(lastInput, true)}>
                      Regenerate
                    </Button>
                  )}
                </div>
              </div>
              <div className="print-only mb-6 border-b pb-3">
                <Logo size={28} />
                <h1 className="mt-2 text-2xl font-bold">{plainText(generation.title)}</h1>
              </div>
              <div className="print-area">
                <Result output={generation.output} input={generation.input} generation={generation} state={generation.state ?? {}} setState={setState} />
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={renaming} onClose={() => setRenaming(false)} title="Rename">
        <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && rename()} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
          <Button onClick={rename}>Save</Button>
        </div>
      </Modal>
    </div>
  );
}
