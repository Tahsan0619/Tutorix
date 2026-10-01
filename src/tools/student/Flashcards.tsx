import clsx from 'clsx';
import { ChevronLeft, ChevronRight, CircleCheck, Layers, Lightbulb, RotateCcw, Shuffle, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Md } from '@/components/Markdown';
import { SourceInput } from '@/components/SourceInput';
import { Button, Field, Input, Segmented, Select } from '@/components/ui';
import { md } from '@/lib/export';
import { FormShell, GRADE_OPTIONS, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input { topic: string; subject: string; level: string; difficulty: string; count: string; style: string; source_text: string; material_ids: string[]; language: string }
interface Card { id: string; front: string; back: string; hint: string; tag: string }
interface Output { title: string; topic: string; cards: Card[] }

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({
    topic: '', subject: profile?.subject ?? '', level: profile?.grade_level ?? '', difficulty: 'medium', count: '15', style: 'mixed', source_text: '', material_ids: [], language: defaultLanguage(profile),
  }, initial);
  return (
    <FormShell onSubmit={() => onSubmit(v)} loading={loading} disabled={!v.topic.trim() && v.source_text.trim().length < 50 && !v.material_ids.length} submitLabel="Create flashcards">
      <Grid cols={3}>
        <Field label="Topic"><Input {...bind('topic')} placeholder="e.g. Cell organelles" /></Field>
        <Field label="Subject"><Input {...bind('subject')} placeholder="e.g. Biology" /></Field>
        <Field label="Class / level"><Select {...bind('level')} options={GRADE_OPTIONS} /></Field>
      </Grid>
      <Grid cols={4}>
        <Field label="Number of cards"><Select {...bind('count')} options={['5', '10', '15', '20', '25', '30', '40']} /></Field>
        <Field label="Card style">
          <Select {...bind('style')} options={[{ value: 'mixed', label: 'Mixed' }, { value: 'qa', label: 'Question → Answer' }, { value: 'term', label: 'Term → Definition' }, { value: 'cloze', label: 'Fill-in-the-blank' }]} />
        </Field>
        <Field label="Difficulty"><Select {...bind('difficulty')} options={['easy', 'medium', 'hard']} /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
      <SourceInput value={v.source_text} onChange={(t) => set('source_text', t)} materialIds={v.material_ids} onMaterialIds={(ids) => set('material_ids', ids)} label="Make cards from my notes / PDF (optional)" rows={5} />
    </FormShell>
  );
}

function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function StudyMode({ cards, known, setKnown }: { cards: Card[]; known: string[]; setKnown: (k: string[]) => void }) {
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [order, setOrder] = useState<string[]>(() => cards.map((c) => c.id));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const deck = useMemo(() => {
    const byId = new Map(cards.map((c) => [c.id, c]));
    const list = order.map((id) => byId.get(id)!).filter(Boolean);
    return onlyUnknown ? list.filter((c) => !known.includes(c.id)) : list;
  }, [cards, order, onlyUnknown, known]);

  const card = deck[Math.min(idx, deck.length - 1)];
  const go = (d: number) => {
    setFlipped(false);
    setShowHint(false);
    setIdx((i) => Math.max(0, Math.min(deck.length - 1, i + d)));
  };
  const mark = (isKnown: boolean) => {
    if (!card) return;
    setKnown(isKnown ? [...new Set([...known, card.id])] : known.filter((k) => k !== card.id));
    setFlipped(false);
    setShowHint(false);
    if (!onlyUnknown || !isKnown) setIdx((i) => Math.min(deck.length - 1, i + 1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!card) {
    return (
      <div className="card flex flex-col items-center p-10 text-center">
        <CircleCheck className="h-12 w-12 text-emerald-500" />
        <h3 className="mt-3 text-xl font-extrabold text-slate-900">You know every card!</h3>
        <p className="mt-1 text-slate-500">Great work. Reset progress to study the deck again.</p>
        <Button className="mt-4" variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => { setKnown([]); setIdx(0); }}>Reset progress</Button>
      </div>
    );
  }

  const pos = Math.min(idx, deck.length - 1);
  return (
    <div className="no-print space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-600">Card {pos + 1} of {deck.length}{card.tag && <span className="ml-2 badge bg-slate-100 text-slate-600">{card.tag}</span>}</div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={onlyUnknown} onChange={(e) => { setOnlyUnknown(e.target.checked); setIdx(0); setFlipped(false); }} className="rounded" />
            Only cards I don't know
          </label>
          <Button size="sm" variant="ghost" icon={<Shuffle className="h-4 w-4" />} onClick={() => { setOrder(shuffle(cards.map((c) => c.id))); setIdx(0); setFlipped(false); }}>Shuffle</Button>
        </div>
      </div>

      <div className={clsx('flip-card mx-auto h-72 max-w-2xl cursor-pointer sm:h-80', flipped && 'flipped')} onClick={() => setFlipped((f) => !f)}>
        <div className="flip-inner">
          <div className="flip-face card flex flex-col items-center justify-center p-8 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-500">Question</div>
            <div className="mt-3 text-xl font-bold leading-snug text-slate-900 sm:text-2xl"><Md>{card.front}</Md></div>
            {showHint && card.hint && <div className="mt-4 text-sm text-amber-700">💡 {card.hint}</div>}
            <div className="absolute bottom-4 text-xs text-slate-400">Click or press Space to flip</div>
          </div>
          <div className="flip-face flip-back card flex flex-col items-center justify-center bg-gradient-to-br from-brand-600 to-indigo-600 p-8 text-center text-white">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-100">Answer</div>
            <div className="mt-3 text-lg font-semibold leading-relaxed sm:text-xl"><Md>{card.back}</Md></div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => go(-1)} disabled={pos === 0}>Prev</Button>
        {card.hint && !flipped && <Button variant="ghost" icon={<Lightbulb className="h-4 w-4" />} onClick={() => setShowHint(true)}>Hint</Button>}
        <Button variant="danger" icon={<ThumbsDown className="h-4 w-4" />} onClick={() => mark(false)}>Still learning</Button>
        <Button className="bg-emerald-600 hover:bg-emerald-700" icon={<ThumbsUp className="h-4 w-4" />} onClick={() => mark(true)}>I know it</Button>
        <Button variant="secondary" onClick={() => go(1)} disabled={pos >= deck.length - 1}>Next <ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function Result({ output: o, state, setState }: ResultProps<Output, Input>) {
  const [view, setView] = useState<'study' | 'list'>('study');
  const known: string[] = state.known ?? [];
  const setKnown = (k: string[]) => setState({ known: k });
  const pct = o.cards.length ? Math.round((known.length / o.cards.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">{o.title}</h2>
          <div className="mt-1 text-sm text-slate-500">{o.cards.length} cards · {known.length} mastered ({pct}%)</div>
          <div className="mt-2 h-2 w-64 max-w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="no-print">
          <Segmented value={view} onChange={setView} options={[{ value: 'study', label: 'Study', icon: <Layers className="h-4 w-4" /> }, { value: 'list', label: 'All cards' }]} />
        </div>
      </div>

      {view === 'study' && <StudyMode cards={o.cards} known={known} setKnown={setKnown} />}

      <div className={clsx(view === 'study' ? 'print-only' : 'grid gap-3 md:grid-cols-2')}>
        {o.cards.map((c, i) => (
          <div key={c.id} className="card avoid-break mb-3 p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-400">#{i + 1}{c.tag && ` · ${c.tag}`}</span>
              {known.includes(c.id) && <span className="badge bg-emerald-100 text-emerald-700">Mastered</span>}
            </div>
            <div className="font-semibold text-slate-900"><Md>{c.front}</Md></div>
            <div className="mt-2 border-t border-dashed border-slate-200 pt-2 text-sm text-slate-600"><Md>{c.back}</Md></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(`# ${o.title}`, md.table(['#', 'Front', 'Back', 'Tag'], o.cards.map((c, i) => [i + 1, c.front, c.back, c.tag])));
}

const module: ToolModule<Input, Output> = { Form, Result, toMarkdown };
export default module;
