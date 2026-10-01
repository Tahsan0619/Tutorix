import { BookOpen, FileText, Library, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button, EmptyState, Field, Input, Modal, Spinner, Textarea } from '@/components/ui';
import { extractText } from '@/lib/files';
import { timeAgo } from '@/lib/format';
import { deleteMaterial, FULL_TEXT_CHARS, listMaterials, resumeIndexing, saveMaterial } from '@/lib/materials';
import type { Material } from '@/lib/types';

function IndexBar({ m }: { m: Material }) {
  const pct = m.chunk_count ? Math.round((m.embedded_count / m.chunk_count) * 100) : 100;
  if (pct >= 100) return null;
  return (
    <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      Indexing {pct}%
    </div>
  );
}

export default function Materials() {
  const toast = useToast();
  const [items, setItems] = useState<Material[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [kind, setKind] = useState<'pdf' | 'text'>('text');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [indexing, setIndexing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Material | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listMaterials().then(setItems).catch((e) => {
      toast((e as Error).message, 'error');
      setItems([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upsert = (m: Material) => setItems((xs) => [m, ...(xs ?? []).filter((x) => x.id !== m.id)]);

  const onFile = async (file?: File) => {
    if (!file) return;
    setExtracting(true);
    try {
      const text = await extractText(file);
      setContent(text);
      setKind(/\.pdf$/i.test(file.name) ? 'pdf' : 'text');
      if (!title.trim()) setTitle(file.name.replace(/\.[a-z0-9]+$/i, ''));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const m = await saveMaterial({ title: title.trim(), kind, content }, (p) => {
        upsert(p);
        setIndexing(p.id);
        setAdding(false);
      });
      if (m.indexError) toast(`Saved. Indexing paused: ${m.indexError} Use "Finish indexing" to continue.`, 'info');
      else toast(m.duplicate ? 'You have already saved this material' : `Saved "${m.title}"`);
      setTitle('');
      setContent('');
      setKind('text');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
      setIndexing(null);
    }
  };

  const resume = async (m: Material) => {
    setIndexing(m.id);
    try {
      await resumeIndexing(m, upsert);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setIndexing(null);
    }
  };

  const remove = async () => {
    if (!confirm) return;
    try {
      await deleteMaterial(confirm.id);
      setItems((xs) => (xs ?? []).filter((x) => x.id !== confirm.id));
      toast('Deleted');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
    setConfirm(null);
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My materials</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Save textbook chapters, class notes and past papers once, then attach them in any tool that says "My materials".
            Short material is read in full. Long material, even a whole book, is searched and only the passages that matter for your request are used.
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add material</Button>
      </div>

      {items === null ? (
        <div className="flex justify-center p-10"><Spinner className="h-6 w-6" /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Library className="h-6 w-6" />}
          title="No materials yet"
          text="Upload a PDF of your textbook chapter or paste your notes. Tutorix will ground notes, quizzes, flashcards and worksheets in it."
          action={<Button icon={<Upload className="h-4 w-4" />} onClick={() => setAdding(true)}>Add your first material</Button>}
        />
      ) : (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {items.map((m) => {
            const incomplete = m.embedded_count < m.chunk_count;
            return (
              <div key={m.id} className="flex items-center gap-4 px-4 py-3.5">
                <div className="shrink-0 rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                  {m.kind === 'pdf' ? <FileText className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">{m.title}</div>
                  <div className="text-xs text-slate-500">
                    {m.char_count.toLocaleString()} chars · {m.chunk_count} {m.chunk_count === 1 ? 'passage' : 'passages'} ·{' '}
                    {m.char_count <= FULL_TEXT_CHARS ? 'read in full' : 'searched for relevant passages'} · {timeAgo(m.created_at)}
                  </div>
                  <IndexBar m={m} />
                </div>
                {incomplete && indexing !== m.id && (
                  <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => resume(m)}>
                    Finish indexing
                  </Button>
                )}
                {indexing === m.id && <Spinner className="h-4 w-4 text-brand-600" />}
                <button className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setConfirm(m)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={adding} onClose={() => !saving && setAdding(false)} title="Add material" wide>
        <div className="space-y-4">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Class 9 Biology, Chapter 3: Cell division" />
          </Field>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label mb-0">Text</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={extracting}>
                {extracting ? <Spinner className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />} Upload PDF / TXT
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            <Textarea rows={10} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste the chapter, notes or article here, or upload a file." />
            <div className="mt-1 text-right text-xs text-slate-500">{content.length.toLocaleString()} chars</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} loading={saving} disabled={content.trim().length < 200 || extracting}>Save material</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Delete this material?">
        <p className="text-sm text-slate-600">"{confirm?.title}" and its search index will be permanently deleted. Saved results that used it are kept.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={remove}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
