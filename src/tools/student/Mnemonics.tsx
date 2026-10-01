import clsx from 'clsx';
import { Brain, Eye, EyeOff, Heart, ListOrdered, Music, Type, BookText, Image, Lightbulb } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Md } from '@/components/Markdown';
import { Button, ChipGroup, Field, Input, SectionCard, Textarea } from '@/components/ui';
import { md } from '@/lib/export';
import { FormShell, Grid, LanguageField, defaultLanguage, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

type MType = 'acronym' | 'sentence' | 'rhyme' | 'story' | 'visual';
interface Input { content: string; topic: string; subject: string; types: MType[]; language: string }
interface Mnemonic { type: MType; title: string; mnemonic: string; breakdown: { cue: string; item: string }[]; why_it_works: string }
interface Output { topic: string; items: string[]; mnemonics: Mnemonic[]; practice_tip: string }

const TYPES: { value: MType; label: string; icon: ReactNode; color: string }[] = [
  { value: 'acronym', label: 'Acronym', icon: <Type className="h-4 w-4" />, color: 'from-brand-500 to-indigo-600' },
  { value: 'sentence', label: 'Sentence', icon: <BookText className="h-4 w-4" />, color: 'from-emerald-500 to-teal-600' },
  { value: 'rhyme', label: 'Rhyme / song', icon: <Music className="h-4 w-4" />, color: 'from-fuchsia-500 to-pink-600' },
  { value: 'story', label: 'Story', icon: <Brain className="h-4 w-4" />, color: 'from-amber-500 to-orange-600' },
  { value: 'visual', label: 'Visual / memory palace', icon: <Image className="h-4 w-4" />, color: 'from-sky-500 to-cyan-600' },
];

function Form({ onSubmit, loading, initial, profile }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({ content: '', topic: '', subject: profile?.subject ?? '', types: ['acronym', 'sentence', 'rhyme', 'story'], language: defaultLanguage(profile) }, initial);
  return (
    <FormShell onSubmit={() => onSubmit(v)} loading={loading} disabled={v.content.trim().length < 3 || !v.types.length} submitLabel="Make it memorable">
      <Field label="What do you need to memorize?" required hint="A list, sequence, set of facts or a definition. One item per line works best.">
        <Textarea rows={5} {...bind('content')} placeholder={'e.g. The planets in order:\nMercury\nVenus\nEarth\nMars\nJupiter\nSaturn\nUranus\nNeptune'} />
      </Field>
      <Grid cols={3}>
        <Field label="Topic (optional)"><Input {...bind('topic')} placeholder="e.g. Solar system" /></Field>
        <Field label="Subject (optional)"><Input {...bind('subject')} /></Field>
        <LanguageField value={v.language} onChange={(l) => set('language', l)} />
      </Grid>
      <Field label="Types of memory aids">
        <ChipGroup<MType> options={TYPES.map((t) => ({ value: t.value, label: t.label }))} value={v.types} onChange={(t) => set('types', t)} />
      </Field>
    </FormShell>
  );
}

function Result({ output: o, state, setState }: ResultProps<Output, Input>) {
  const favorite: number | null = state.favorite ?? null;
  const [test, setTest] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);

  return (
    <div className="space-y-6">
      {o.items.length > 0 && (
        <SectionCard
          title={`${o.topic || 'Items to remember'} · ${o.items.length}`}
          icon={<ListOrdered className="h-5 w-5" />}
          action={<Button size="sm" variant="ghost" className="no-print" icon={test ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} onClick={() => { setTest(!test); setRevealed([]); }}>{test ? 'Show all' : 'Test myself'}</Button>}
        >
          <div className="flex flex-wrap gap-2">
            {o.items.map((it, i) => {
              const hidden = test && !revealed.includes(i);
              return (
                <button key={i} type="button" onClick={() => test && setRevealed([...revealed, i])}
                  className={clsx('rounded-xl border px-3 py-1.5 text-sm font-semibold transition', hidden ? 'border-dashed border-slate-300 bg-slate-50 text-slate-400' : 'border-brand-200 bg-brand-50 text-brand-800')}>
                  <span className="mr-1.5 text-xs text-slate-400">{i + 1}</span>{hidden ? '? ? ?' : it}
                </button>
              );
            })}
          </div>
          {test && <p className="mt-3 text-xs text-slate-500">Recall each item using your favourite mnemonic, then tap to check.</p>}
        </SectionCard>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {o.mnemonics.map((m, i) => {
          const t = TYPES.find((x) => x.value === m.type) ?? TYPES[1];
          const fav = favorite === i;
          return (
            <div key={i} className={clsx('card avoid-break overflow-hidden', fav && 'ring-2 ring-rose-400')}>
              <div className={clsx('flex items-center justify-between bg-gradient-to-r px-5 py-3 text-white', t.color)}>
                <span className="flex items-center gap-2 text-sm font-bold">{t.icon}{t.label}{m.title && <span className="font-normal opacity-80">· {m.title}</span>}</span>
                <button type="button" className="no-print rounded-lg p-1 hover:bg-white/20" onClick={() => setState({ favorite: fav ? null : i })} aria-label="Favourite" title="Mark as my favourite">
                  <Heart className={clsx('h-4 w-4', fav && 'fill-white')} />
                </button>
              </div>
              <div className="p-5">
                <div className={clsx('whitespace-pre-line leading-relaxed text-slate-900', m.type === 'acronym' ? 'text-2xl font-extrabold tracking-wide' : 'text-lg font-semibold')}>
                  <Md>{m.mnemonic}</Md>
                </div>
                {m.breakdown.length > 0 && (
                  <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
                    {m.breakdown.map((b, j) => (
                      <div key={j} className="flex items-baseline gap-2 text-sm">
                        <span className="min-w-[2rem] shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-center font-bold text-slate-800">{b.cue}</span>
                        <span className="text-slate-600"><Md>{b.item}</Md></span>
                      </div>
                    ))}
                  </div>
                )}
                {m.why_it_works && <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500"><b>Why it works:</b> <Md>{m.why_it_works}</Md></p>}
              </div>
            </div>
          );
        })}
      </div>

      {o.practice_tip && (
        <div className="card flex items-start gap-3 p-5">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm leading-relaxed text-slate-700"><b>Lock it in: </b><Md>{o.practice_tip}</Md></p>
        </div>
      )}
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    `# Mnemonics: ${o.topic}`,
    md.section('Items', md.list(o.items, true)),
    ...o.mnemonics.map((m) => md.join(
      `## ${m.type[0].toUpperCase()}${m.type.slice(1)}${m.title ? `: ${m.title}` : ''}`,
      `> ${m.mnemonic.replace(/\n/g, '\n> ')}`,
      md.list(m.breakdown.map((b) => `**${b.cue}** → ${b.item}`)),
      m.why_it_works && `*${m.why_it_works}*`,
    )),
    o.practice_tip && `**Practice:** ${o.practice_tip}`,
  );
}

const module: ToolModule<Input, Output> = { Form, Result, toMarkdown };
export default module;
