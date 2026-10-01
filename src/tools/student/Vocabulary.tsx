import clsx from 'clsx';
import { BookA, Check, CircleCheck, CircleX, GraduationCap, Lightbulb, RotateCcw, Volume2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Md } from '@/components/Markdown';
import { Button, Field, Input, Segmented, Select, Textarea } from '@/components/ui';
import { md } from '@/lib/export';
import { FormShell, Grid, useForm } from '../shared';
import type { FormProps, ResultProps, ToolModule } from '../types';

interface Input { mode: 'words' | 'topic'; words: string; topic: string; count: string; level: string }
interface Word {
  id: string; word: string; part_of_speech: string; ipa: string; bangla: string; meaning: string; synonyms: string[]; antonyms: string[];
  examples: { en: string; bn: string }[]; collocations: string[]; usage_note: string; memory_tip: string;
}
interface Output { mode: string; topic: string; level: string; words: Word[] }

function Form({ onSubmit, loading, initial }: FormProps<Input>) {
  const { v, set, bind } = useForm<Input>({ mode: 'words', words: '', topic: '', count: '12', level: 'intermediate' }, initial);
  const wordCount = v.words.split(/[\n,;]+/).filter((w) => w.trim()).length;
  return (
    <FormShell onSubmit={() => onSubmit(v)} loading={loading} disabled={v.mode === 'words' ? wordCount === 0 : !v.topic.trim()} submitLabel="Build my word list">
      <Segmented value={v.mode} onChange={(m) => set('mode', m)} options={[{ value: 'words', label: 'I have words' }, { value: 'topic', label: 'Give me words on a topic' }]} />
      {v.mode === 'words' ? (
        <Field label="Words (English or বাংলা)" hint={`${wordCount}/25 words · separate with commas or new lines`}>
          <Textarea rows={4} {...bind('words')} placeholder="e.g. resilient, ambiguous, meticulous, অধ্যবসায়" />
        </Field>
      ) : (
        <Grid>
          <Field label="Topic"><Input {...bind('topic')} placeholder="e.g. Environment, Job interview, IELTS Writing Task 2" /></Field>
          <Field label="Number of words"><Select {...bind('count')} options={['5', '8', '10', '12', '15', '20', '25']} /></Field>
        </Grid>
      )}
      <Field label="Level">
        <Select {...bind('level')} options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }, { value: 'IELTS / SAT', label: 'IELTS / SAT / GRE' }]} />
      </Field>
    </FormShell>
  );
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

function WordCard({ w, learned, onToggle }: { w: Word; learned: boolean; onToggle: () => void }) {
  return (
    <div className={clsx('card avoid-break p-5', learned && 'border-emerald-200 bg-emerald-50/30')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-xl font-extrabold text-slate-900">{w.word}</h3>
            {w.part_of_speech && <span className="text-sm italic text-slate-500">{w.part_of_speech}</span>}
            {w.ipa && <span className="font-mono text-sm text-slate-500">{w.ipa}</span>}
            <button type="button" className="no-print rounded-lg p-1 text-slate-400 hover:bg-brand-50 hover:text-brand-600" onClick={() => speak(w.word)} aria-label="Pronounce" title="Listen">
              <Volume2 className="h-4 w-4" />
            </button>
          </div>
          <div className="font-bangla mt-0.5 text-lg font-semibold text-brand-700">{w.bangla}</div>
        </div>
        <button type="button" onClick={onToggle} className={clsx('no-print flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition', learned ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700')}>
          <Check className="h-3.5 w-3.5" /> {learned ? 'Learned' : 'Mark learned'}
        </button>
      </div>
      <p className="mt-2 text-slate-700"><Md>{w.meaning}</Md></p>
      {w.examples.length > 0 && (
        <div className="mt-3 space-y-2">
          {w.examples.map((e, i) => (
            <div key={i} className="rounded-lg border-l-4 border-l-brand-300 bg-slate-50 px-3 py-2 text-sm">
              <div className="text-slate-800"><Md>{e.en}</Md></div>
              {e.bn && <div className="font-bangla mt-0.5 text-slate-500">{e.bn}</div>}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {w.synonyms.length > 0 && <div><span className="font-semibold text-emerald-700">Synonyms: </span><span className="text-slate-600">{w.synonyms.join(', ')}</span></div>}
        {w.antonyms.length > 0 && <div><span className="font-semibold text-rose-700">Antonyms: </span><span className="text-slate-600">{w.antonyms.join(', ')}</span></div>}
      </div>
      {w.collocations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">{w.collocations.map((c) => <span key={c} className="badge bg-sky-50 text-sky-700">{c}</span>)}</div>
      )}
      {(w.usage_note || w.memory_tip) && (
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
          {w.usage_note && <p><b>Usage: </b><Md>{w.usage_note}</Md></p>}
          {w.memory_tip && <p className="flex gap-1"><Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-500" /><span><b>Remember: </b><Md>{w.memory_tip}</Md></span></p>}
        </div>
      )}
    </div>
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

type QuizQ = { w: Word; kind: 'meaning' | 'bangla'; options: string[]; answer: string };

function buildQuiz(words: Word[]): QuizQ[] {
  return shuffle(words).map((w, i) => {
    const kind: QuizQ['kind'] = i % 2 === 0 || !w.bangla ? 'meaning' : 'bangla';
    const pool = words.filter((x) => x.id !== w.id);
    const answer = kind === 'meaning' ? w.meaning : w.bangla;
    const distractors = shuffle(pool).slice(0, 3).map((x) => (kind === 'meaning' ? x.meaning : x.bangla || x.meaning));
    return { w, kind, answer, options: shuffle([answer, ...distractors]) };
  });
}

function SelfQuiz({ words, onLearned }: { words: Word[]; onLearned: (id: string) => void }) {
  const [quiz, setQuiz] = useState(() => buildQuiz(words));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  if (words.length < 2) return <p className="card p-6 text-sm text-slate-500">You need at least 2 words to take a quiz.</p>;
  const restart = () => { setQuiz(buildQuiz(words)); setI(0); setPicked(null); setScore(0); };

  if (i >= quiz.length) {
    const pct = Math.round((score / quiz.length) * 100);
    return (
      <div className="card flex flex-col items-center p-10 text-center">
        <GraduationCap className="h-12 w-12 text-brand-500" />
        <h3 className="mt-3 text-2xl font-extrabold text-slate-900">{score}/{quiz.length} correct ({pct}%)</h3>
        <p className="mt-1 text-slate-500">{pct >= 80 ? 'Superb! These words are sticking.' : 'Review the cards and try again. Repetition wins.'}</p>
        <Button className="mt-4" icon={<RotateCcw className="h-4 w-4" />} onClick={restart}>Try again</Button>
      </div>
    );
  }

  const q = quiz[i];
  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (opt === q.answer) {
      setScore((s) => s + 1);
      onLearned(q.w.id);
    }
  };

  return (
    <div className="card mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
        <span>Question {i + 1} of {quiz.length}</span>
        <span className="font-semibold text-emerald-600">Score {score}</span>
      </div>
      <div className="mb-1 text-xs font-bold uppercase text-brand-500">{q.kind === 'meaning' ? 'What does this word mean?' : 'বাংলা অর্থ কী?'}</div>
      <div className="mb-5 flex items-center gap-2">
        <h3 className="text-3xl font-extrabold text-slate-900">{q.w.word}</h3>
        <button type="button" className="rounded-lg p-1 text-slate-400 hover:text-brand-600" onClick={() => speak(q.w.word)} aria-label="Pronounce"><Volume2 className="h-5 w-5" /></button>
      </div>
      <div className="space-y-2">
        {q.options.map((opt, j) => {
          const isAnswer = opt === q.answer;
          const isPicked = opt === picked;
          return (
            <button key={j} type="button" onClick={() => choose(opt)} disabled={!!picked}
              className={clsx('flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left text-sm transition',
                !picked && 'border-slate-200 hover:border-brand-300',
                picked && isAnswer && 'border-emerald-500 bg-emerald-50',
                picked && isPicked && !isAnswer && 'border-rose-500 bg-rose-50',
                picked && !isAnswer && !isPicked && 'border-slate-100 opacity-60',
                q.kind === 'bangla' && 'font-bangla text-base')}>
              {picked && isAnswer ? <CircleCheck className="h-5 w-5 shrink-0 text-emerald-500" /> : picked && isPicked ? <CircleX className="h-5 w-5 shrink-0 text-rose-500" /> : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{String.fromCharCode(65 + j)}</span>}
              <span><Md>{opt}</Md></span>
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{q.w.examples[0]?.en}</p>
          <Button onClick={() => { setI(i + 1); setPicked(null); }}>{i + 1 >= quiz.length ? 'See score' : 'Next'}</Button>
        </div>
      )}
    </div>
  );
}

function Result({ output: o, state, setState }: ResultProps<Output, Input>) {
  const [view, setView] = useState<'cards' | 'quiz' | 'table'>('cards');
  const [filter, setFilter] = useState<'all' | 'new' | 'learned'>('all');
  const learned: string[] = state.learned ?? [];
  const toggle = (id: string) => setState({ learned: learned.includes(id) ? learned.filter((x) => x !== id) : [...learned, id] });
  const markLearned = (id: string) => { if (!learned.includes(id)) setState({ learned: [...learned, id] }); };
  const shown = useMemo(() => o.words.filter((w) => filter === 'all' || (filter === 'learned' ? learned.includes(w.id) : !learned.includes(w.id))), [o.words, filter, learned]);
  const pct = o.words.length ? Math.round((learned.filter((id) => o.words.some((w) => w.id === id)).length / o.words.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500"><BookA className="h-4 w-4" /> {o.words.length} words{o.topic && ` · ${o.topic}`}{o.level && ` · ${o.level}`}</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
            <span className="text-sm font-semibold text-emerald-700">{pct}% learned</span>
          </div>
        </div>
        <div className="no-print">
          <Segmented value={view} onChange={setView} options={[{ value: 'cards', label: 'Word cards' }, { value: 'quiz', label: 'Self-quiz' }, { value: 'table', label: 'Table' }]} />
        </div>
      </div>

      {view === 'cards' && (
        <>
          <div className="no-print flex gap-2">
            {(['all', 'new', 'learned'] as const).map((f) => (
              <button key={f} type="button" className={clsx('chip capitalize', filter === f ? 'chip-on' : 'chip-off')} onClick={() => setFilter(f)}>{f === 'new' ? 'Still learning' : f}</button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">{shown.map((w) => <WordCard key={w.id} w={w} learned={learned.includes(w.id)} onToggle={() => toggle(w.id)} />)}</div>
        </>
      )}
      {view === 'quiz' && <SelfQuiz words={o.words} onLearned={markLearned} />}
      {view === 'table' && (
        <div className="card overflow-x-auto p-2">
          <table className="table-clean">
            <thead><tr><th>Word</th><th>বাংলা</th><th>Meaning</th><th>Synonyms</th></tr></thead>
            <tbody>
              {o.words.map((w) => (
                <tr key={w.id}>
                  <td><b>{w.word}</b> <span className="text-xs italic text-slate-400">{w.part_of_speech}</span></td>
                  <td className="font-bangla">{w.bangla}</td>
                  <td><Md>{w.meaning}</Md></td>
                  <td className="text-slate-500">{w.synonyms.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function toMarkdown(o: Output) {
  return md.join(
    `# Vocabulary${o.topic ? `: ${o.topic}` : ''}`,
    ...o.words.map((w) => md.join(
      `## ${w.word} ${w.ipa ? `\`${w.ipa}\`` : ''} *${w.part_of_speech}*`,
      `**বাংলা:** ${w.bangla}  \n**Meaning:** ${w.meaning}`,
      md.list(w.examples.map((e) => `${e.en}${e.bn ? ` (${e.bn})` : ''}`)),
      w.synonyms.length > 0 && `**Synonyms:** ${w.synonyms.join(', ')}`,
      w.antonyms.length > 0 && `**Antonyms:** ${w.antonyms.join(', ')}`,
      w.collocations.length > 0 && `**Collocations:** ${w.collocations.join(', ')}`,
      w.memory_tip && `💡 ${w.memory_tip}`,
    )),
  );
}

const module: ToolModule<Input, Output> = { Form, Result, toMarkdown };
export default module;
