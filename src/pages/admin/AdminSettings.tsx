import { CircleCheck, CircleX, Cpu, Gauge, Save, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button, Field, Input, PageLoader, SectionCard, Select } from '@/components/ui';
import { runTool } from '@/lib/ai';
import { supabase } from '@/lib/supabase';

interface TestResult { ok: boolean; model: string; reply?: string; latency_ms?: number; error?: string; keys?: { name: string; ok: boolean; status: number }[] }

export default function AdminSettings() {
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [models, setModels] = useState({ primary: '', fast: '' });
  const [limit, setLimit] = useState(60);
  const [available, setAvailable] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState('');
  const [results, setResults] = useState<Record<string, TestResult>>({});

  useEffect(() => {
    supabase.from('app_settings').select('key, value').then(({ data, error }) => {
      if (error) toast(error.message, 'error');
      const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      setModels({ primary: map.ai_models?.primary ?? 'openai/gpt-oss-120b', fast: map.ai_models?.fast ?? 'openai/gpt-oss-20b' });
      setLimit(Number(map.ai_limits?.per_user_per_hour ?? 60));
      setLoaded(true);
    });
    runTool<{ models: string[] }>('ai-models', {}, { save: false })
      .then((r) => setAvailable(r.output.models))
      .catch((e) => toast(`Could not list models: ${e.message}`, 'error'));
  }, [toast]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('app_settings').upsert([
      { key: 'ai_models', value: models, updated_at: new Date().toISOString() },
      { key: 'ai_limits', value: { per_user_per_hour: Math.max(1, Math.min(1000, limit)) }, updated_at: new Date().toISOString() },
    ]);
    setSaving(false);
    if (error) return toast(error.message, 'error');
    toast('AI settings saved');
  };

  const test = async (model: string) => {
    setTesting(model);
    try {
      const r = await runTool<TestResult>('ai-test', { model }, { save: false });
      setResults((x) => ({ ...x, [model]: r.output }));
    } catch (e) {
      setResults((x) => ({ ...x, [model]: { ok: false, model, error: (e as Error).message } }));
    } finally {
      setTesting('');
    }
  };

  if (!loaded) return <PageLoader />;
  const options = [...new Set([models.primary, models.fast, ...available])].filter(Boolean);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">AI settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tutorix uses Groq. API keys are stored as encrypted Supabase secrets (<code>GROQ_API_KEY</code>, fallback <code>GROQ_API_KEY_2</code>) and never reach the browser.
          When a key is rate-limited, requests switch to the fallback key automatically.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Models" icon={<Cpu className="h-5 w-5" />}>
          <div className="space-y-4">
            <Field label="Primary model" hint="Used for long, structured generation (lesson plans, analyses, notes).">
              <Select value={models.primary} onChange={(e) => setModels({ ...models, primary: e.target.value })} options={options} />
            </Field>
            <Field label="Fast model" hint="Used for quick tasks (grading short answers, follow-ups). Also the first fallback.">
              <Select value={models.fast} onChange={(e) => setModels({ ...models, fast: e.target.value })} options={options} />
            </Field>
            <p className="text-xs text-slate-500">If a model is rate-limited, Tutorix automatically retries on the other available models.</p>
          </div>
        </SectionCard>
        <SectionCard title="Usage limits" icon={<Gauge className="h-5 w-5" />}>
          <Field label="AI requests per user per hour" hint="Protects your Groq quota. Admins are not limited.">
            <Input type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </Field>
        </SectionCard>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} loading={saving} icon={<Save className="h-4 w-4" />}>Save settings</Button>
      </div>
      <SectionCard title="Connection test" icon={<Zap className="h-5 w-5" />}>
        <div className="space-y-3">
          {options.map((m) => {
            const r = results[m];
            return (
              <div key={m} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5">
                <div>
                  <div className="font-mono text-sm font-semibold text-slate-800">{m}</div>
                  {r && (
                    <div className={`mt-1 flex items-center gap-1.5 text-xs ${r.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {r.ok ? <CircleCheck className="h-3.5 w-3.5" /> : <CircleX className="h-3.5 w-3.5" />}
                      {r.ok ? `Connected · replied "${r.reply}" in ${r.latency_ms} ms` : r.error}
                    </div>
                  )}
                  {r?.keys && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {r.keys.map((k) => (
                        <span key={k.name} className={`badge ${k.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {k.name}: {k.ok ? 'valid' : `error ${k.status}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="secondary" size="sm" loading={testing === m} onClick={() => test(m)}>Test</Button>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
