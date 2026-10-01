import clsx from 'clsx';
import { Library as LibraryIcon, Search, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { Button, EmptyState, Modal, Select } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { plainText } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { getTool, toolsForRole } from '@/lib/tools';
import type { Generation } from '@/lib/types';

const PAGE = 30;

export default function Library() {
  const { profile } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState('');
  const [tool, setTool] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [confirm, setConfirm] = useState<Generation | null>(null);
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = async (offset = 0) => {
    if (!profile) return;
    setLoading(true);
    let q = supabase
      .from('generations')
      .select('id, tool, title, created_at, is_favorite, model')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (tool) q = q.eq('tool', tool);
    if (favOnly) q = q.eq('is_favorite', true);
    if (debounced) q = q.ilike('title', `%${debounced.replace(/[%_]/g, '')}%`);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast(error.message, 'error');
    const rows = (data ?? []) as Generation[];
    setItems((xs) => (offset === 0 ? rows : [...xs, ...rows]));
    setHasMore(rows.length === PAGE);
  };

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, tool, favOnly, debounced]);

  const toggleFav = async (g: Generation) => {
    setItems((xs) => xs.map((x) => (x.id === g.id ? { ...x, is_favorite: !x.is_favorite } : x)));
    const { error } = await supabase.from('generations').update({ is_favorite: !g.is_favorite }).eq('id', g.id);
    if (error) toast(error.message, 'error');
  };

  const remove = async () => {
    if (!confirm) return;
    const { error } = await supabase.from('generations').delete().eq('id', confirm.id);
    if (error) return toast(error.message, 'error');
    setItems((xs) => xs.filter((x) => x.id !== confirm.id));
    setConfirm(null);
    toast('Deleted');
  };

  const toolOptions = useMemo(
    () => [{ value: '', label: 'All tools' }, ...toolsForRole(profile?.role).map((t) => ({ value: t.id, label: t.name }))],
    [profile?.role],
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Library</h1>
        <p className="mt-1 text-sm text-slate-500">Everything you have generated, saved automatically. Open any item to continue, export or print.</p>
      </div>

      <div className="card mb-5 flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input className="input pl-10" placeholder="Search by title…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select className="md:w-72" value={tool} onChange={(e) => setTool(e.target.value)} options={toolOptions} />
        <button
          className={clsx('chip justify-center py-2.5', favOnly ? 'chip-on' : 'chip-off')}
          onClick={() => setFavOnly(!favOnly)}
        >
          <Star className={clsx('h-3.5 w-3.5', favOnly && 'fill-amber-400 text-amber-400')} /> Favorites
        </button>
      </div>

      {!loading && items.length === 0 ? (
        <EmptyState
          icon={<LibraryIcon className="h-6 w-6" />}
          title={debounced || tool || favOnly ? 'No matches' : 'Your library is empty'}
          text={debounced || tool || favOnly ? 'Try a different search or filter.' : 'Use any tool and the result will be saved here automatically.'}
          action={<Link to="/app" className="btn btn-primary">Explore tools</Link>}
        />
      ) : (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {items.map((g) => {
            const t = getTool(g.tool);
            return (
              <div key={g.id} className="group flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50">
                {t && (
                  <div className={clsx('shrink-0 rounded-xl bg-gradient-to-br p-2.5 text-white', t.gradient)}>
                    <t.icon className="h-4 w-4" />
                  </div>
                )}
                <Link to={`/tools/${g.tool}?g=${g.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{plainText(g.title)}</div>
                  <div className="text-xs text-slate-500">{t?.name ?? g.tool} · {timeAgo(g.created_at)}</div>
                </Link>
                <button className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-500" onClick={() => toggleFav(g)} title="Favorite">
                  <Star className={clsx('h-4 w-4', g.is_favorite && 'fill-amber-400 text-amber-400')} />
                </button>
                <button className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setConfirm(g)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {loading && <div className="p-6 text-center text-sm text-slate-500">Loading…</div>}
        </div>
      )}
      {hasMore && !loading && (
        <div className="mt-5 text-center">
          <Button variant="secondary" onClick={() => load(items.length)}>Load more</Button>
        </div>
      )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Delete this item?">
        <p className="text-sm text-slate-600">“{confirm?.title}” will be permanently deleted.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={remove}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
