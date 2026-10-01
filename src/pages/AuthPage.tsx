import clsx from 'clsx';
import { GraduationCap, Lock, Mail, NotebookPen, Shield, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

const DEMO = [
  { label: 'Teacher', email: 'teacher@gmail.com', password: 'Teacher@123', icon: GraduationCap },
  { label: 'Student', email: 'student@gmail.com', password: 'Student@123', icon: NotebookPen },
  { label: 'Admin', email: 'admin@tutorix.test', password: 'Admin@123', icon: Shield },
];

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>(params.get('role') === 'student' ? 'student' : 'teacher');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const from = (location.state as { from?: string } | null)?.from ?? '/app';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    try {
      if (mode === 'login') await signIn(email.trim(), password);
      else await signUp({ email: email.trim(), password, fullName: fullName.trim(), role });
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="ruled relative hidden overflow-hidden border-r border-rule px-14 py-10 font-grotesk text-ink lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-y-0 left-8 w-0.5 bg-margin/60" aria-hidden />
        <Link to="/" className="pen-link relative w-fit" aria-label="Tutorix home">
          <Logo size={32} />
        </Link>
        <figure className="relative mx-auto w-full max-w-md">
          <div className="relative -rotate-[1.5deg] bg-white p-3 pb-2 shadow-[0_22px_45px_-22px_rgba(28,33,80,.55)]">
            <span className="absolute -top-3 left-10 h-7 w-24 -rotate-6 bg-chalk/70" aria-hidden />
            <img
              src="/images/bd-classroom.webp"
              alt="A teacher explains the parts of a plant at a chalkboard to students in white school uniforms"
              width={1200}
              height={900}
              className="aspect-[4/3] w-full object-cover"
            />
            <figcaption className="px-1 pt-1 font-hand text-2xl text-ink/80">
              {mode === 'login' ? 'Back to class.' : 'First day of term.'}
            </figcaption>
          </div>
        </figure>
        <div className="relative">
          <p lang="bn" className="font-bangla text-lg font-semibold text-margin">শিক্ষক ও শিক্ষার্থীর জন্য</p>
          <h2 className="mt-1 text-4xl font-extrabold leading-tight tracking-tight">Twenty tools for the way you teach and learn.</h2>
          <p className="mt-3 max-w-md text-ink/70">
            Lesson plans, rubrics, question papers and test audits for teachers. Notes, flashcards, quizzes and study plans for students.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-white p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-block lg:hidden"><Logo size={36} /></Link>
          <h1 className="font-grotesk text-4xl font-extrabold tracking-tight text-ink">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <Link to={mode === 'login' ? '/register' : '/login'} className="font-semibold text-brand-700 hover:underline">
              {mode === 'login' ? 'Sign up free' : 'Log in'}
            </Link>
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="label">I am a…</label>
                  <div className="grid grid-cols-2 gap-3">
                    {([['teacher', 'Teacher', GraduationCap], ['student', 'Student', NotebookPen]] as const).map(([value, label, Icon]) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => setRole(value)}
                        className={clsx(
                          'flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition',
                          role === value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300',
                        )}
                      >
                        <Icon className={clsx('h-5 w-5', role === value ? 'text-brand-600' : 'text-slate-400')} />
                        <span className="font-semibold text-slate-800">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Full name</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input className="input pl-10" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" autoComplete="name" />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input className="input pl-10" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" autoComplete="email" />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  className="input pl-10" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            </div>
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
            <Button type="submit" loading={busy} className="w-full py-3">
              {mode === 'login' ? 'Log in' : 'Create account'}
            </Button>
          </form>

          {mode === 'login' && (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-600">Try a demo account</p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO.map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:bg-brand-50"
                    onClick={() => { setEmail(d.email); setPassword(d.password); }}
                  >
                    <d.icon className="h-4 w-4 text-brand-600" /> {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
