import { Activity, Brain, Clock, FileText, GraduationCap, NotebookPen, TriangleAlert, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ColumnChart, HBar } from '@/components/charts';
import { useToast } from '@/components/Toast';
import { PageLoader, SectionCard, StatCard } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { getTool } from '@/lib/tools';

interface Overview {
  users: number; teachers: number; students: number; admins: number; generations: number; quiz_attempts: number;
  ai_calls_24h: number; ai_errors_24h: number; tokens_7d: number; avg_latency_ms_7d: number;
  by_tool: { tool: string; count: number }[];
  daily: { day: string; count: number }[];
}

interface UsageRow { id: number; tool: string; model: string | null; success: boolean; error: string | null; latency_ms: number; created_at: string }

export default function AdminOverview() {
  const toast = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [recent, setRecent] = useState<UsageRow[]>([]);

  useEffect(() => {
    supabase.rpc('admin_overview').then(({ data: d, error }) => {
      if (error) toast(error.message, 'error');
      else setData(d as Overview);
    });
    supabase.from('ai_usage').select('id, tool, model, success, error, latency_ms, created_at').order('created_at', { ascending: false }).limit(12)
      .then(({ data: rows }) => setRecent((rows ?? []) as UsageRow[]));
  }, [toast]);

  if (!data) return <PageLoader />;

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
    return { label: d.slice(8), value: data.daily.find((x) => x.day === d)?.count ?? 0 };
  });
  const maxTool = Math.max(1, ...data.by_tool.map((t) => t.count));

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Admin overview</h1>
        <p className="mt-1 text-sm text-slate-500">Platform health, adoption and AI usage.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={data.users} sub={`${data.admins} admin`} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Teachers" value={data.teachers} icon={<GraduationCap className="h-5 w-5" />} tone="sky" />
        <StatCard label="Students" value={data.students} icon={<NotebookPen className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Saved creations" value={data.generations} sub={`${data.quiz_attempts} quiz attempts`} icon={<FileText className="h-5 w-5" />} tone="amber" />
        <StatCard label="AI calls (24h)" value={data.ai_calls_24h} icon={<Zap className="h-5 w-5" />} />
        <StatCard label="AI errors (24h)" value={data.ai_errors_24h} icon={<TriangleAlert className="h-5 w-5" />} tone="rose" />
        <StatCard label="Tokens (7d)" value={Number(data.tokens_7d).toLocaleString()} icon={<Brain className="h-5 w-5" />} tone="sky" />
        <StatCard label="Avg latency (7d)" value={`${(Number(data.avg_latency_ms_7d) / 1000).toFixed(1)}s`} icon={<Clock className="h-5 w-5" />} tone="emerald" />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <SectionCard title="AI requests · last 14 days" icon={<Activity className="h-5 w-5" />} className="lg:col-span-3">
          <ColumnChart data={days} height={200} />
        </SectionCard>
        <SectionCard title="Most used tools · 30 days" icon={<Zap className="h-5 w-5" />} className="lg:col-span-2">
          {data.by_tool.length === 0 ? (
            <p className="text-sm text-slate-500">No usage yet.</p>
          ) : (
            <div className="space-y-3">
              {data.by_tool.slice(0, 10).map((t) => (
                <HBar key={t.tool} label={getTool(t.tool)?.name ?? t.tool} value={t.count} max={maxTool} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
      <SectionCard title="Recent AI requests" icon={<Clock className="h-5 w-5" />}>
        <div className="overflow-x-auto">
          <table className="table-clean">
            <thead><tr><th>Tool</th><th>Model</th><th>Status</th><th>Latency</th><th>When</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-slate-800">{getTool(r.tool)?.name ?? r.tool}</td>
                  <td className="text-slate-500">{r.model ?? '-'}</td>
                  <td>
                    {r.success ? <span className="badge bg-emerald-100 text-emerald-700">OK</span> : <span className="badge bg-rose-100 text-rose-700" title={r.error ?? ''}>Error</span>}
                    {!r.success && r.error && <div className="mt-1 max-w-xs truncate text-xs text-rose-600">{r.error}</div>}
                  </td>
                  <td className="text-slate-500">{(r.latency_ms / 1000).toFixed(1)}s</td>
                  <td className="text-slate-500">{timeAgo(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
