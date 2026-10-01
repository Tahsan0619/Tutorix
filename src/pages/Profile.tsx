import { KeyRound, Save, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button, Field, Input, SectionCard, Select } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Language } from '@/lib/types';
import { GRADE_OPTIONS } from '@/tools/shared';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ full_name: '', institution: '', grade_level: '', subject: '', language: 'English' as Language });
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? '',
        institution: profile.institution ?? '',
        grade_level: profile.grade_level ?? '',
        subject: profile.subject ?? '',
        language: profile.language ?? 'English',
      });
    }
  }, [profile]);

  const save = async () => {
    if (!profile) return;
    if (!form.full_name.trim()) return toast('Name cannot be empty', 'error');
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        institution: form.institution.trim() || null,
        grade_level: form.grade_level || null,
        subject: form.subject.trim() || null,
        language: form.language,
      })
      .eq('id', profile.id);
    setSaving(false);
    if (error) return toast(error.message, 'error');
    await refreshProfile();
    toast('Profile saved');
  };

  const changePassword = async () => {
    if (pw.next.length < 8) return toast('Password must be at least 8 characters', 'error');
    if (pw.next !== pw.confirm) return toast('Passwords do not match', 'error');
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setPwBusy(false);
    if (error) return toast(error.message, 'error');
    setPw({ next: '', confirm: '' });
    toast('Password updated');
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Profile & preferences</h1>
        <p className="mt-1 text-sm text-slate-500">
          Signed in as <b>{profile?.email}</b> · <span className="capitalize">{profile?.role}</span>
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Your details" icon={<User className="h-5 w-5" />} className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Field label="Institution"><Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="School / college / university" /></Field>
            <Field label={profile?.role === 'student' ? 'Class / level' : 'Main class you teach'}>
              <Select value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} options={GRADE_OPTIONS} />
            </Field>
            <Field label={profile?.role === 'student' ? 'Favourite subject' : 'Main subject'}>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Physics" />
            </Field>
            <Field label="Default output language" hint="Pre-selected in every tool. You can still change it per generation.">
              <Select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value as Language })}
                options={[{ value: 'English', label: 'English' }, { value: 'Bangla', label: 'বাংলা (Bangla)' }, { value: 'Bilingual', label: 'Bilingual' }]}
              />
            </Field>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={save} loading={saving} icon={<Save className="h-4 w-4" />}>Save changes</Button>
          </div>
        </SectionCard>
        <SectionCard title="Change password" icon={<KeyRound className="h-5 w-5" />}>
          <div className="space-y-4">
            <Field label="New password"><Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></Field>
            <Field label="Confirm new password"><Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" /></Field>
            <Button variant="secondary" className="w-full" onClick={changePassword} loading={pwBusy}>Update password</Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
