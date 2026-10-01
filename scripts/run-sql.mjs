// Runs a SQL file (or inline SQL) against the Supabase project via the Management API.
// Usage: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/run-sql.mjs <file.sql | --query "select 1">
import { readFileSync } from 'node:fs';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || 'gkdvlkkxzdcagxduzeay';
if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN first.');
  process.exit(1);
}

const args = process.argv.slice(2);
const query = args[0] === '--query' ? args.slice(1).join(' ') : readFileSync(args[0], 'utf8');

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${text}`);
  process.exit(1);
}
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
