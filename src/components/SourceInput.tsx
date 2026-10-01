import clsx from 'clsx';
import { BookmarkPlus, Check, FileText, Library, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractText } from '@/lib/files';
import { FULL_TEXT_CHARS, listMaterials, saveMaterial } from '@/lib/materials';
import type { Material } from '@/lib/types';
import { useToast } from './Toast';
import { Spinner } from './ui';

const SOFT_LIMIT = 12000;
const MAX_PICKED = 5;
const SAVE_SUGGEST_CHARS = 1500;

/**
 * Textarea + file upload (PDF/TXT) that extracts text in the browser.
 * With `onMaterialIds` it becomes a study-material input: saved materials can be attached,
 * pasted text can be saved for reuse, and long text is searched rather than truncated.
 */
export function SourceInput({
  value, onChange, placeholder, label = 'Study material (optional)', rows = 6, accept = '.pdf,.txt,.md', materialIds, onMaterialIds,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
  accept?: string;
  materialIds?: string[];
  onMaterialIds?: (ids: string[]) => void;
}) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const materialMode = !!onMaterialIds;
  const picked = materialIds ?? [];
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!materialMode) return;
    listMaterials().then(setMaterials).catch(() => setMaterials([]));
  }, [materialMode]);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pickerOpen]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await extractText(file);
      onChange(text);
      setFileName(file.name);
      toast(`Extracted ${text.length.toLocaleString()} characters from ${file.name}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  const toggle = (id: string) => {
    if (!onMaterialIds) return;
    if (picked.includes(id)) onMaterialIds(picked.filter((x) => x !== id));
    else if (picked.length >= MAX_PICKED) toast(`Up to ${MAX_PICKED} materials at a time.`, 'error');
    else onMaterialIds([...picked, id]);
  };

  const saveForLater = async () => {
    if (!onMaterialIds) return;
    const firstLine = value.trim().split('\n')[0].slice(0, 80);
    const title = fileName.replace(/\.[a-z0-9]+$/i, '') || firstLine || 'Untitled material';
    setSaving({ done: 0, total: 1 });
    try {
      const m = await saveMaterial(
        { title, kind: /\.pdf$/i.test(fileName) ? 'pdf' : 'text', content: value },
        (p) => setSaving({ done: p.embedded_count, total: Math.max(1, p.chunk_count) }),
      );
      setMaterials((list) => [m, ...(list ?? []).filter((x) => x.id !== m.id)]);
      if (!picked.includes(m.id)) onMaterialIds([...picked, m.id].slice(-MAX_PICKED));
      onChange('');
      setFileName('');
      if (m.indexError) toast(`Saved and attached. Smart search will finish later from My materials (${m.indexError})`, 'info');
      else toast(m.duplicate ? 'Already in My materials, attached it' : `Saved "${m.title}" to My materials and attached it`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const pickedMaterials = picked.map((id) => materials?.find((m) => m.id === id) ?? { id, title: 'Saved material' } as Material);
  const len = value.length;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <label className="label mb-0">{label}</label>
        <div className="flex flex-wrap gap-2">
          {materialMode && (
            <div className="relative" ref={pickerRef}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPickerOpen(!pickerOpen)}>
                <Library className="h-3.5 w-3.5" /> My materials{picked.length > 0 && ` (${picked.length})`}
              </button>
              {pickerOpen && (
                <div className="absolute right-0 z-20 mt-1 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  {materials === null ? (
                    <div className="flex justify-center p-4"><Spinner className="h-4 w-4" /></div>
                  ) : materials.length === 0 ? (
                    <p className="p-3 text-sm text-slate-500">
                      Nothing saved yet. Paste or upload a chapter below and choose <b>Save to My materials</b>, or add one on the{' '}
                      <Link to="/materials" className="font-semibold text-brand-600 hover:underline">My materials</Link> page.
                    </p>
                  ) : (
                    <>
                      <ul className="max-h-64 space-y-0.5 overflow-y-auto scrollbar-thin">
                        {materials.map((m) => {
                          const on = picked.includes(m.id);
                          return (
                            <li key={m.id}>
                              <button
                                type="button"
                                onClick={() => toggle(m.id)}
                                className={clsx('flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm', on ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-50')}
                              >
                                <span className={clsx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300')}>
                                  {on && <Check className="h-3 w-3" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">{m.title}</span>
                                  <span className="text-xs text-slate-500">{m.char_count.toLocaleString()} chars · {m.chunk_count} {m.chunk_count === 1 ? 'passage' : 'passages'}</span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="mt-1 border-t border-slate-100 px-2 pt-2 text-right">
                        <Link to="/materials" className="text-xs font-semibold text-brand-600 hover:underline">Manage materials</Link>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? <Spinner className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            Upload PDF / TXT
          </button>
        </div>
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>

      {pickedMaterials.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {pickedMaterials.map((m) => (
            <span key={m.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-brand-800">
              <Library className="h-3 w-3 shrink-0" />
              <span className="truncate">{m.title}</span>
              <button type="button" className="rounded-full p-0.5 hover:bg-brand-100" onClick={() => toggle(m.id)} aria-label={`Remove ${m.title}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <textarea
        className="input font-[inherit]"
        rows={rows}
        value={value}
        placeholder={placeholder ?? (materialMode && picked.length ? 'Optional: paste extra text to use alongside your saved materials…' : 'Paste textbook text, class notes or an article…')}
        onChange={(e) => onChange(e.target.value)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFile(e.dataTransfer.files?.[0]);
        }}
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          {fileName && (
            <>
              <FileText className="h-3.5 w-3.5" /> {fileName}
              <button type="button" className="text-slate-400 hover:text-rose-500" onClick={() => { setFileName(''); onChange(''); }} aria-label="Clear file">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {!fileName && 'You can also drag & drop a file here.'}
          {materialMode && len >= SAVE_SUGGEST_CHARS && (
            <button type="button" className="ml-1 inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline disabled:opacity-60" onClick={saveForLater} disabled={!!saving}>
              {saving ? <Spinner className="h-3 w-3" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
              {saving ? `Indexing ${saving.done}/${saving.total}` : 'Save to My materials'}
            </button>
          )}
        </span>
        {materialMode ? (
          <span>
            {len.toLocaleString()} chars
            {len > 0 && (len <= FULL_TEXT_CHARS ? ' · read in full' : ' · long text: the most relevant passages are used')}
          </span>
        ) : (
          <span className={len > SOFT_LIMIT ? 'font-semibold text-amber-600' : ''}>
            {len.toLocaleString()} chars{len > SOFT_LIMIT && ' · only the first ~12k are used'}
          </span>
        )}
      </div>
    </div>
  );
}
