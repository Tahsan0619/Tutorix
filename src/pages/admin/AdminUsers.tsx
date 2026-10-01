import { Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { PageLoader, Select } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/lib/types';

export default function AdminUsers() {
  const { profile: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const load = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) return toast(error.message, 'error');
    setUsers(data as Profile[]);
    const { data: gens } = await supabase.from('generations').select('user_id');
    const c: Record<string, number> = {};
    for (const g of gens ?? []) c[g.user_id] = (c[g.user_id] ?? 0) + 1;
    setCounts(c);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRole = async (u: Profile, role: Role) => {
    const { error } = await supabase.rpc('admin_set_role', { target: u.id, new_role: role });
    if (error) return toast(error.message, 'error');
    setUsers((xs) => xs?.map((x) => (x.id === u.id ? { ...x, role } : x)) ?? null);
    toast(`${u.full_name || u.email} is now ${role}`);
  };

  const setStatus = async (u: Profile, status: 'active' | 'suspended') => {
    const { error } = await supabase.rpc('admin_set_status', { target: u.id, new_status: status });
    if (error) return toast(error.message, 'error');
    setUsers((xs) => xs?.map((x) => (x.id === u.id ? { ...x, status } : x)) ?? null);
    toast(status === 'suspended' ? 'User suspended' : 'User reactivated', 'info');
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return (users ?? []).filter((u) => (!roleFilter || u.role === roleFilter) && (!q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
  }, [users, query, roleFilter]);

  if (!users) return <PageLoader />;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900"><Users className="h-6 w-6 text-brand-600" /> Users</h1>
        <p className="mt-1 text-sm text-slate-500">{users.length} accounts. Change roles or suspend access.</p>
      </div>
      <div className="card flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input className="input pl-10" placeholder="Search name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select className="sm:w-48" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} options={[{ value: '', label: 'All roles' }, 'teacher', 'student', 'admin'].map((o) => (typeof o === 'string' ? { value: o, label: o[0].toUpperCase() + o.slice(1) } : o))} />
      </div>
      <div className="card overflow-x-auto">
        <table className="table-clean">
          <thead>
            <tr><th>User</th><th>Role</th><th>Status</th><th>Creations</th><th>Joined</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="font-semibold text-slate-900">{u.full_name || 'No name'}{u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm capitalize"
                    value={u.role}
                    disabled={u.id === me?.id}
                    onChange={(e) => setRole(u, e.target.value as Role)}
                  >
                    <option value="teacher">teacher</option>
                    <option value="student">student</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{u.status}</span>
                </td>
                <td className="text-slate-600">{counts[u.id] ?? 0}</td>
                <td className="text-slate-500">{timeAgo(u.created_at)}</td>
                <td className="text-right">
                  {u.id !== me?.id && (
                    <button
                      className={`btn btn-sm ${u.status === 'active' ? 'btn-secondary text-rose-600' : 'btn-secondary text-emerald-700'}`}
                      onClick={() => setStatus(u, u.status === 'active' ? 'suspended' : 'active')}
                    >
                      {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
