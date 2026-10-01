import clsx from 'clsx';
import { GraduationCap, NotebookPen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { STUDENT_TOOLS, TEACHER_TOOLS, type ToolMeta } from '@/lib/tools';

const LESSON_FLOW = [
  ['5 min', 'Starter', 'Why does a plant die in a dark cupboard?'],
  ['15 min', 'Explain', 'Root, stem and leaf, and what each one does'],
  ['12 min', 'Group task', 'Sort 10 local plants: herb, shrub or tree'],
  ['8 min', 'Exit ticket', 'Three quick questions, one on each part'],
];

const STEPS = [
  ['Pick a tool', 'Each tool does one job well: a rubric, a mind map, a study timetable, a marking scheme.'],
  ['Give it your material', 'Type a topic, paste your own notes, or upload a chapter PDF straight from the textbook.'],
  ['Keep it, edit it, print it', 'Everything is saved to your library. Download a clean PDF or Word file, or print it for class.'],
];

const OPTIONS_EN = ['Leaf', 'Stem', 'Root', 'Flower'];
const OPTIONS_BN = ['পাতা', 'কাণ্ড', 'মূল', 'ফুল'];
const LETTERS_BN = ['ক', 'খ', 'গ', 'ঘ'];

function PenUnderline({ late = false }: { late?: boolean }) {
  return (
    <svg className="pointer-events-none absolute -bottom-2 left-0 h-4 w-full overflow-visible" viewBox="0 0 400 16" preserveAspectRatio="none" aria-hidden>
      <path
        d="M3 11 C 70 4, 150 13, 230 7 S 350 5, 397 9"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        className={clsx('pen-draw text-margin', late && 'pen-draw-late')}
      />
    </svg>
  );
}

function Tick({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 32" aria-hidden>
      <path d="M4 17 L15 27 L36 4" pathLength={1} fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className="pen-draw pen-draw-late" />
    </svg>
  );
}

function ToolIndex({ tools, tone }: { tools: ToolMeta[]; tone: 'board' | 'paper' }) {
  const board = tone === 'board';
  return (
    <ul className="grid gap-x-12 md:grid-cols-2">
      {tools.map((t) => (
        <li key={t.id} className={clsx('flex gap-4 py-5', board ? 'border-b border-dashed border-white/25' : 'border-b border-rule')}>
          <t.icon className={clsx('mt-1 h-5 w-5 shrink-0', board ? 'text-chalk' : 'text-margin')} aria-hidden />
          <div>
            <h3 className={clsx('font-grotesk text-lg font-semibold', board ? 'text-white' : 'text-ink')}>{t.name}</h3>
            <p className={clsx('mt-1 text-[15px] leading-relaxed', board ? 'text-white/75' : 'text-ink/70')}>{t.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function StartButtons({ light = false }: { light?: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Link to="/register?role=teacher" className={clsx('l-btn', light ? 'l-btn-light' : 'l-btn-primary')}>
        <GraduationCap className="h-5 w-5" aria-hidden /> Start as a teacher
      </Link>
      <Link to="/register?role=student" className={clsx('l-btn', light ? 'l-btn-outline-light' : 'l-btn-ink')}>
        <NotebookPen className="h-5 w-5" aria-hidden /> Start as a student
      </Link>
    </div>
  );
}

export default function Landing() {
  const { session } = useAuth();

  return (
    <div className="min-h-screen overflow-x-clip bg-paper font-grotesk text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        Skip to content
      </a>

      <nav className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="pen-link" aria-label="Tutorix home"><Logo size={34} /></Link>
          <div className="hidden items-center gap-8 text-[15px] font-medium text-ink/75 md:flex">
            <a href="#teachers" className="pen-link hover:text-ink">For teachers</a>
            <a href="#students" className="pen-link hover:text-ink">For students</a>
            <a href="#how" className="pen-link hover:text-ink">How it works</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {session ? (
              <Link to="/app" className="l-btn l-btn-primary h-10 px-4 text-sm">Open your dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="pen-link px-2 text-[15px] font-semibold text-ink">Log in</Link>
                <Link to="/register" className="l-btn l-btn-primary h-10 px-4 text-sm">Create free account</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main id="main">
        {/* Hero: an exercise-book page */}
        <header className="ruled relative overflow-hidden">
          <div className="relative mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-10 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-12">
            <div className="absolute inset-y-0 left-3 w-0.5 bg-margin/60 sm:left-5" aria-hidden />
            <div className="relative pl-5 sm:pl-10">
              <p lang="bn" className="relative -top-[5px] font-bangla text-lg font-semibold leading-[40px] text-margin sm:text-xl">শিক্ষক ও শিক্ষার্থীর জন্য</p>
              <h1 className="relative -top-[9px] text-[34px] font-extrabold leading-[40px] tracking-tight sm:top-[9px] sm:text-[54px] sm:leading-[80px] lg:text-[64px]">
                The AI exercise book for{' '}
                <span className="relative inline-block leading-none">Bangladeshi<PenUnderline /></span>{' '}
                classrooms.
              </h1>
              <p className="mt-10 max-w-xl text-lg leading-[40px] text-ink/80 sm:text-[19px]">
                Teachers plan lessons, set question papers and mark faster. Students turn any chapter into notes, flashcards and
                practice quizzes. Twenty tools that write in English, <span lang="bn" className="font-bangla">বাংলা</span> or both.
              </p>
              <div className="mt-10">
                {session ? (
                  <Link to="/app" className="l-btn l-btn-primary">Open your dashboard</Link>
                ) : (
                  <StartButtons />
                )}
              </div>
              <p className="mt-6 flex items-center gap-2 font-hand text-2xl text-margin">
                <Tick className="h-6 w-7" /> Free, and it works on any phone or laptop
              </p>
            </div>

            <figure className="relative mx-auto w-full max-w-xl lg:mt-6">
              <div className="relative rotate-[1.2deg] bg-white p-3 pb-2 shadow-[0_22px_45px_-22px_rgba(28,33,80,.55)]">
                <span className="absolute -top-3 left-10 h-7 w-24 -rotate-6 bg-chalk/70" aria-hidden />
                <span className="absolute -top-3 right-8 h-7 w-20 rotate-[8deg] bg-chalk/70" aria-hidden />
                <img
                  src="/images/bd-classroom.webp"
                  alt="A teacher in a saree explains the parts of a plant at a chalkboard while students in white school uniforms raise their hands"
                  width={1200}
                  height={900}
                  className="aspect-[4/3] w-full object-cover"
                />
                <figcaption className="px-1 pt-1 font-hand text-2xl text-ink/80">
                  Class 8 science, <span lang="bn" className="font-bangla text-lg">উদ্ভিদের প্রকারভেদ</span>
                </figcaption>
              </div>

              <div className="relative mx-3 -mt-4 rounded-md border border-rule bg-white p-5 shadow-[0_18px_40px_-20px_rgba(28,33,80,.5)] sm:mx-auto sm:max-w-sm lg:absolute lg:-bottom-16 lg:-left-16 lg:mx-0 lg:w-80">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">Tomorrow's lesson plan</p>
                  <p className="text-sm text-ink/60">40 min</p>
                </div>
                <ol className="mt-3 space-y-2.5 text-sm">
                  {LESSON_FLOW.map(([time, stage, text]) => (
                    <li key={stage} className="grid grid-cols-[3.5rem_1fr] gap-2">
                      <span className="font-semibold tabular-nums text-margin">{time}</span>
                      <span><span className="font-semibold">{stage}.</span> <span className="text-ink/75">{text}</span></span>
                    </li>
                  ))}
                </ol>
              </div>
            </figure>
          </div>
        </header>

        {/* Teachers: the blackboard */}
        <section id="teachers" className="scroll-mt-16 bg-paper px-3 py-20 sm:px-5 lg:py-28">
          <div className="mx-auto max-w-6xl rounded-lg border-[10px] border-[#7a5230] bg-board px-6 py-12 text-white shadow-[inset_0_0_80px_rgba(0,0,0,.35)] sm:px-10 lg:px-14 lg:py-16">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
              <div>
                <p lang="bn" className="font-bangla text-lg font-semibold text-chalk">শিক্ষকদের জন্য</p>
                <h2 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">Less paperwork after the last bell.</h2>
                <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/80">
                  Build a lesson plan, a question paper with its marking scheme, or a term plan that already skips the Eid and
                  Pohela Boishakh holidays. Check a test for weak questions before it reaches the exam hall.
                </p>
              </div>
              <figure className="relative">
                <img
                  src="/images/bd-teacher-marking.webp"
                  alt="A teacher in a blue shirt marks a stack of exercise books with a red pen, a cup of tea beside him"
                  width={1200}
                  height={900}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-sm object-cover ring-4 ring-white/10"
                />
                <figcaption className="mt-3 font-hand text-2xl text-chalk">43 khatas to go. Or let Tutorix draft the comments.</figcaption>
              </figure>
            </div>
            <div className="mt-12 border-t border-dashed border-white/25">
              <ToolIndex tools={TEACHER_TOOLS} tone="board" />
            </div>
          </div>
        </section>

        {/* Students: ruled paper with a margin */}
        <section id="students" className="relative scroll-mt-16 border-y border-rule bg-white py-20 lg:py-28">
          <div className="relative mx-auto max-w-6xl px-5">
            <div className="absolute inset-y-0 left-3 w-0.5 bg-margin/60 sm:left-5" aria-hidden />
            <div className="grid gap-10 pl-5 sm:pl-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
              <figure className="order-2 lg:order-1">
                <img
                  src="/images/bd-student-evening.webp"
                  alt="A student in school uniform studies flashcards on a laptop at her desk in the evening, with the Dhaka skyline outside the window"
                  width={1200}
                  height={900}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-sm object-cover"
                />
              </figure>
              <div className="order-1 lg:order-2">
                <p lang="bn" className="font-bangla text-lg font-semibold text-margin">শিক্ষার্থীদের জন্য</p>
                <h2 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
                  Turn any chapter into a <span className="relative inline-block">revision plan<PenUnderline late /></span>.
                </h2>
                <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink/75">
                  Upload a chapter from your textbook and get notes, flashcards and a practice quiz. Tutorix marks your answers,
                  shows which topics need another look, and plans your days until the exam.
                </p>
              </div>
            </div>
            <div className="mt-12 pl-5 sm:pl-10">
              <ToolIndex tools={STUDENT_TOOLS} tone="paper" />
            </div>
          </div>
        </section>

        {/* Bilingual proof */}
        <section className="bg-paper py-20 lg:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">One question, two languages.</h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-ink/75">
                Every tool writes in English, <span lang="bn" className="font-bangla">বাংলা</span> or both side by side, so the same
                worksheet works for Bangla medium and English version sections.
              </p>
            </div>
            <div className="relative rounded-sm border border-rule bg-white p-6 shadow-[0_18px_40px_-24px_rgba(28,33,80,.45)] sm:p-8">
              <div className="flex items-baseline justify-between border-b-2 border-ink pb-3">
                <p className="font-bold">Class 8 Science, Chapter 2</p>
                <p className="text-sm text-ink/60">Full marks: 25</p>
              </div>
              <div className="mt-5 space-y-6">
                <div>
                  <p className="font-medium"><span className="mr-2 font-bold">3.</span>Which part of a plant absorbs water and minerals from the soil?</p>
                  <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[15px] sm:grid-cols-4">
                    {OPTIONS_EN.map((o, i) => (
                      <li key={o} className="flex items-center gap-1.5">
                        <span className={clsx('grid h-7 w-7 place-items-center rounded-full text-sm', i === 2 && 'border-2 border-margin font-bold text-margin')}>
                          {String.fromCharCode(97 + i)}
                        </span>
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
                <div lang="bn" className="font-bangla">
                  <p className="text-[17px] font-medium"><span className="mr-2 font-bold">৩.</span>উদ্ভিদের কোন অংশ মাটি থেকে পানি ও খনিজ লবণ শোষণ করে?</p>
                  <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[16px] sm:grid-cols-4">
                    {OPTIONS_BN.map((o, i) => (
                      <li key={o} className="flex items-center gap-1.5">
                        <span className={clsx('grid h-7 w-7 place-items-center rounded-full text-sm', i === 2 && 'border-2 border-margin font-bold text-margin')}>
                          {LETTERS_BN[i]}
                        </span>
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="absolute -top-6 right-4 rotate-6 font-hand text-3xl text-margin lg:-right-5">1/1</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-16 border-t border-rule bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">From topic to printout in three steps.</h2>
            <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="border-t-2 border-ink pt-5">
                  <span className="font-hand text-5xl leading-none text-margin">{i + 1}</span>
                  <h3 className="mt-3 text-xl font-bold">{title}</h3>
                  <p className="mt-2 leading-relaxed text-ink/75">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="bg-ink px-5 py-20 text-white lg:py-24">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Tomorrow's class starts here.</h2>
              <p className="mt-4 max-w-lg text-lg text-white/75">A free account takes under a minute. No card, nothing to install.</p>
            </div>
            {session ? (
              <Link to="/app" className="l-btn l-btn-light w-fit">Open your dashboard</Link>
            ) : (
              <StartButtons light />
            )}
          </div>
        </section>
      </main>

      <footer className="bg-paper py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 text-[15px] text-ink/70 md:grid-cols-[auto_1fr_auto] md:items-start">
          <Logo size={30} />
          <div className="space-y-1 md:pl-10">
            <p>Built by Md. Tahsan Islam, Md. Tanjim Alam Tasin, Shadiya Zaman Tanha and Mufrid Johanee.</p>
            <p>Our supervisor is Md. Ashrafuzzaman.</p>
          </div>
          <p>© {new Date().getFullYear()} Tutorix</p>
        </div>
      </footer>
    </div>
  );
}
