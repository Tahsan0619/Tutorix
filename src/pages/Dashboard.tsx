import clsx from 'clsx';
import { ArrowRight, Brain, CalendarClock, FileText, Library, Sparkles, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, StatCard } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { greeting, timeAgo } from '@/lib/format';
import { plainText } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { getTool, toolsForRole } from '@/lib/tools';
import type { Generation } from '@/lib/types';

export default function Dashboard() {
  const { profile } = useAuth();
  const [recent, setRecent] = useState<Generation[] | null>(null);
  const [stats, setStats] = useState({ total: 0, week: 0, favorites: 0, quizzes: 0, avg: 0 });
  const tools = toolsForRole(profile?.role);

  useEffect(() => {
    if (!profile) return;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const mine = () => supabase.from('generations').select('id', { count: 'exact', head: true }).eq('user_id', profile.id);
    Promise.all([
      supabase.from('generations').select('id, tool, title, created_at, is_favorite').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(6),
      mine(),
      mine().gte('created_at', weekAgo),
      mine().eq('is_favorite', true),
      supabase.from('quiz_attempts').select('percentage').eq('user_id', profile.id),
    ]).then(([r, total, week, fav, quizzes]) => {
      setRecent((r.data as Generation[]) ?? []);
      const pcts = (quizzes.data ?? []).map((q: { percentage: number }) => Number(q.percentage));
      setStats({
        total: total.count ?? 0,
        week: week.count ?? 0,
        favorites: fav.count ?? 0,
        quizzes: pcts.length,
        avg: pcts.length ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length) : 0,
      });
    });
  }, [profile]);

  const first = profile?.full_name?.split(' ')[0] || 'there';
  const isStudent = profile?.role === 'student';

  return (
    <div className="animate-fade-in space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-700 via-indigo-700 to-fuchsia-700 p-7 text-white sm:p-9">
        <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <img src="/logo.png" alt="" className="absolute bottom-4 right-6 hidden h-28 w-28 opacity-90 drop-shadow-xl sm:block" />
        <p className="text-sm font-semibold text-brand-100">{greeting()},</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{first} 👋</h1>
        <p className="mt-2 max-w-xl text-brand-100">
          {isStudent
            ? 'What are we studying today? Pick a tool below. Everything you create is saved to your library.'
            : profile?.role === 'admin'
              ? 'You have access to every teacher and student tool, plus the admin console.'
              : 'Ready to plan, assess and give feedback? Pick a tool below. Everything is saved to your library.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total creations" value={stats.total} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="This week" value={stats.week} icon={<CalendarClock className="h-5 w-5" />} tone="sky" />
        <StatCard label="Favorites" value={stats.favorites} icon={<Star className="h-5 w-5" />} tone="amber" />
        {isStudent ? (
          <StatCard label="Quiz average" value={stats.quizzes ? `${stats.avg}%` : '-'} sub={`${stats.quizzes} quizzes taken`} icon={<Brain className="h-5 w-5" />} tone="emerald" />
        ) : (
          <StatCard label="Tools available" value={tools.length} icon={<Sparkles className="h-5 w-5" />} tone="emerald" />
        )}
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <section className="xl:col-span-2">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Your tools</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {tools.map((t) => (
              <Link key={t.id} to={`/tools/${t.id}`} className="card group flex items-start gap-4 p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg">
                <div className={clsx('rounded-xl bg-gradient-to-br p-2.5 text-white shadow', t.gradient)}>
                  <t.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-bold text-slate-900">{t.name}</h3>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{t.tagline}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Recent</h2>
            <Link to="/library" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link>
          </div>
          {recent === null ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />)}</div>
          ) : recent.length === 0 ? (
            <EmptyState icon={<Library className="h-6 w-6" />} title="Nothing here yet" text="Your generated lesson plans, notes and quizzes will appear here." />
          ) : (
            <div className="space-y-2.5">
              {recent.map((g) => {
                const t = getTool(g.tool);
                return (
                  <Link key={g.id} to={`/tools/${g.tool}?g=${g.id}`} className="card flex items-center gap-3 p-3.5 transition hover:border-brand-200">
                    {t && (
                      <div className={clsx('rounded-lg bg-gradient-to-br p-2 text-white', t.gradient)}>
                        <t.icon className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{plainText(g.title)}</div>
                      <div className="text-xs text-slate-500">{t?.name} · {timeAgo(g.created_at)}</div>
                    </div>
                    {g.is_favorite && <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
