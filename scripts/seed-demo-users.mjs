// Creates (or resets) the Tutorix demo accounts.
// Usage: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/seed-demo-users.mjs
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || 'gkdvlkkxzdcagxduzeay';
if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN first.');
  process.exit(1);
}

const mgmt = (path, init = {}) =>
  fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

const keys = await (await mgmt('/api-keys?reveal=true')).json();
const serviceKey = keys.find((k) => k.name === 'service_role')?.api_key;
if (!serviceKey) throw new Error('Could not read the service_role key.');

const base = `https://${ref}.supabase.co/auth/v1/admin/users`;
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

const demo = [
  { email: 'admin@tutorix.test', password: 'Admin@123', full_name: 'Tutorix Admin', role: 'admin' },
  { email: 'teacher@tutorix.test', password: 'Teacher@123', full_name: 'Nusrat Jahan', role: 'teacher' },
  { email: 'student@tutorix.test', password: 'Student@123', full_name: 'Rafi Ahmed', role: 'student' },
  { email: 'teacher@gmail.com', password: 'Teacher@123', full_name: 'Farzana Rahman', role: 'teacher' },
  { email: 'student@gmail.com', password: 'Student@123', full_name: 'Ayaan Hossain', role: 'student' },
];

const list = await (await fetch(`${base}?per_page=1000`, { headers })).json();
for (const u of demo) {
  const existing = (list.users || []).find((x) => x.email === u.email);
  const payload = {
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { full_name: u.full_name, role: u.role === 'admin' ? 'teacher' : u.role },
  };
  const res = existing
    ? await fetch(`${base}/${existing.id}`, { method: 'PUT', headers, body: JSON.stringify(payload) })
    : await fetch(base, { method: 'POST', headers, body: JSON.stringify(payload) });
  const body = await res.json();
  if (!res.ok) throw new Error(`${u.email}: ${JSON.stringify(body)}`);
  const id = body.id;
  const sql = `update public.profiles set role = '${u.role}', full_name = '${u.full_name.replace(/'/g, "''")}' where id = '${id}';`;
  const q = await mgmt('/database/query', { method: 'POST', body: JSON.stringify({ query: sql }) });
  if (!q.ok) throw new Error(await q.text());
  console.log(`${existing ? 'updated' : 'created'} ${u.role.padEnd(7)} ${u.email} / ${u.password}`);
}
