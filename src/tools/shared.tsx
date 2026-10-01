import { Sparkles } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Button, Field, Select } from '@/components/ui';
import type { Language, Profile } from '@/lib/types';

export function useForm<T extends Record<string, any>>(defaults: T, initial?: Partial<T>) {
  const [v, setV] = useState<T>({ ...defaults, ...(initial ?? {}) });
  const set = <K extends keyof T>(k: K, val: T[K]) => setV((s) => ({ ...s, [k]: val }));
  const bind = (k: keyof T) => ({
    value: (v[k] ?? '') as string | number,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value })),
  });
  return { v, setV, set, bind };
}

export function defaultLanguage(profile: Profile | null): Language {
  return profile?.language ?? 'English';
}

export function LanguageField({ value, onChange }: { value: string; onChange: (v: Language) => void }) {
  return (
    <Field label="Output language">
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as Language)}
        options={[
          { value: 'English', label: 'English' },
          { value: 'Bangla', label: 'বাংলা (Bangla)' },
          { value: 'Bilingual', label: 'Bilingual (English + বাংলা)' },
        ]}
      />
    </Field>
  );
}

export function FormShell({
  onSubmit, loading, children, submitLabel = 'Generate', disabled, footer,
}: { onSubmit: () => void; loading: boolean; children: ReactNode; submitLabel?: string; disabled?: boolean; footer?: ReactNode }) {
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (!loading && !disabled) onSubmit();
      }}
      className="space-y-5"
    >
      {children}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <div className="text-xs text-slate-500">{footer}</div>
        <Button type="submit" loading={loading} disabled={disabled} icon={<Sparkles className="h-4 w-4" />}>
          {loading ? 'Generating…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export const GRADE_OPTIONS = [
  '', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'SSC', 'HSC (Class 11-12)', 'O Level', 'A Level', 'Undergraduate', 'Postgraduate',
].map((g) => ({ value: g, label: g || 'Select…' }));

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[cols];
  return <div className={`grid grid-cols-1 gap-4 ${c}`}>{children}</div>;
}
