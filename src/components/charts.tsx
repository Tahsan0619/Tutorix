import clsx from 'clsx';
import { BLOOM_LEVELS } from '@/lib/types';
import { BLOOM_BAR } from './ui';

export function BloomBars({ distribution, ideal }: { distribution: Record<string, number>; ideal?: Record<string, number> }) {
  const total = Object.values(distribution).reduce((s, x) => s + x, 0) || 1;
  return (
    <div className="space-y-3">
      {BLOOM_LEVELS.map((l) => {
        const count = distribution[l] ?? 0;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={l}>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700">{l}</span>
              <span className="text-slate-500">
                {count} · {pct}%{ideal && ideal[l] !== undefined && <span className="ml-1 text-slate-400">(target {ideal[l]}%)</span>}
              </span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className={clsx('h-full rounded-full transition-all duration-700', BLOOM_BAR[l])} style={{ width: `${pct}%` }} />
              {ideal && ideal[l] !== undefined && (
                <div className="absolute top-0 h-full w-0.5 bg-slate-800/60" style={{ left: `${Math.min(99, ideal[l])}%` }} title={`Target ${ideal[l]}%`} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ScoreRing({ value, max = 100, size = 120, label, color }: { value: number; max?: number; size?: number; label?: string; color?: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const stroke = color ?? (pct >= 0.8 ? '#10b981' : pct >= 0.6 ? '#f59e0b' : '#ef4444');
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#eef2f7" strokeWidth={12} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={stroke} strokeWidth={12} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .8s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-extrabold text-slate-900">{Math.round(value)}{max === 100 && <span className="text-sm text-slate-400">%</span>}</div>
        {label && <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>}
      </div>
    </div>
  );
}

export function HBar({ label, value, max, suffix = '', color = 'bg-brand-500' }: { label: string; value: number; max: number; suffix?: string; color?: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-xs font-semibold">
        <span className="truncate text-slate-700">{label}</span>
        <span className="shrink-0 text-slate-500">{value}{suffix}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={clsx('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ColumnChart({ data, height = 160 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="group flex flex-1 flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
          <span className="text-[10px] font-bold text-slate-500 opacity-0 transition group-hover:opacity-100">{d.value}</span>
          <div className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-fuchsia-500" style={{ height: `${Math.max(3, (d.value / max) * 85)}%` }} />
          <span className="text-[10px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
