-- Tutorix schema (Supabase / Postgres)
-- Drops every legacy object first so the project starts clean.

-- ---------------------------------------------------------------
-- Clean slate
-- ---------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.current_role() cascade;
drop function if exists public.admin_set_role(uuid, text) cascade;
drop function if exists public.admin_set_status(uuid, text) cascade;
drop function if exists public.admin_overview() cascade;
drop function if exists public.protect_profile_columns() cascade;
drop function if exists public.touch_updated_at() cascade;
drop table if exists public.ai_usage cascade;
drop table if exists public.quiz_attempts cascade;
drop table if exists public.generations cascade;
drop table if exists public.app_settings cascade;
drop table if exists public.profiles cascade;

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  role        text not null default 'student' check (role in ('teacher', 'student', 'admin')),
  status      text not null default 'active' check (status in ('active', 'suspended')),
  institution text,
  grade_level text,
  subject     text,
  language    text not null default 'English' check (language in ('English', 'Bangla', 'Bilingual')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  tool        text not null,
  title       text not null default 'Untitled',
  input       jsonb not null default '{}'::jsonb,
  output      jsonb not null default '{}'::jsonb,
  state       jsonb not null default '{}'::jsonb,
  is_favorite boolean not null default false,
  model       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index generations_user_created_idx on public.generations (user_id, created_at desc);
create index generations_user_tool_idx on public.generations (user_id, tool);

create table public.quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  generation_id uuid references public.generations (id) on delete set null,
  subject       text,
  topic         text,
  score         numeric(7, 2) not null default 0,
  max_score     numeric(7, 2) not null default 0,
  percentage    numeric(5, 2) not null default 0,
  results       jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, created_at desc);

create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.ai_usage (
  id                bigint generated always as identity primary key,
  user_id           uuid references public.profiles (id) on delete set null,
  tool              text not null,
  model             text,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  latency_ms        integer not null default 0,
  success           boolean not null default true,
  error             text,
  created_at        timestamptz not null default now()
);
create index ai_usage_created_idx on public.ai_usage (created_at desc);
create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

insert into public.app_settings (key, value) values
  ('ai_models', '{"primary": "openai/gpt-oss-120b", "fast": "openai/gpt-oss-20b"}'::jsonb),
  ('ai_limits', '{"per_user_per_hour": 60}'::jsonb);

-- ---------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger generations_touch before update on public.generations
  for each row execute function public.touch_updated_at();

-- New auth user -> profile. Self sign-up may only pick teacher or student.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
begin
  if requested not in ('teacher', 'student') then
    requested := 'student';
  end if;
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    requested
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Non-admins can never change their own role, status or email.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.email := old.email;
  end if;
  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

create or replace function public.admin_set_role(target uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  if new_role not in ('teacher', 'student', 'admin') then
    raise exception 'Invalid role';
  end if;
  if target = auth.uid() and new_role <> 'admin' then
    raise exception 'You cannot remove your own admin role';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;

create or replace function public.admin_set_status(target uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change account status';
  end if;
  if new_status not in ('active', 'suspended') then
    raise exception 'Invalid status';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot suspend yourself';
  end if;
  update public.profiles set status = new_status where id = target;
end;
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can view the overview';
  end if;
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'teachers', (select count(*) from public.profiles where role = 'teacher'),
    'students', (select count(*) from public.profiles where role = 'student'),
    'admins', (select count(*) from public.profiles where role = 'admin'),
    'generations', (select count(*) from public.generations),
    'quiz_attempts', (select count(*) from public.quiz_attempts),
    'ai_calls_24h', (select count(*) from public.ai_usage where created_at > now() - interval '24 hours'),
    'ai_errors_24h', (select count(*) from public.ai_usage where created_at > now() - interval '24 hours' and not success),
    'tokens_7d', (select coalesce(sum(prompt_tokens + completion_tokens), 0) from public.ai_usage where created_at > now() - interval '7 days'),
    'avg_latency_ms_7d', (select coalesce(round(avg(latency_ms)), 0) from public.ai_usage where created_at > now() - interval '7 days' and success),
    'by_tool', coalesce((
      select jsonb_agg(t order by t.count desc) from (
        select tool, count(*) as count from public.ai_usage
        where created_at > now() - interval '30 days' group by tool
      ) t
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(d order by d.day) from (
        select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*) as count
        from public.ai_usage where created_at > now() - interval '14 days'
        group by 1
      ) d
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.app_settings enable row level security;
alter table public.ai_usage enable row level security;

create policy "profiles: read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own or admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "generations: owner select" on public.generations
  for select using (user_id = auth.uid() or public.is_admin());
create policy "generations: owner insert" on public.generations
  for insert with check (user_id = auth.uid());
create policy "generations: owner update" on public.generations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "generations: owner delete" on public.generations
  for delete using (user_id = auth.uid() or public.is_admin());

create policy "quiz_attempts: owner select" on public.quiz_attempts
  for select using (user_id = auth.uid() or public.is_admin());
create policy "quiz_attempts: owner insert" on public.quiz_attempts
  for insert with check (user_id = auth.uid());
create policy "quiz_attempts: owner delete" on public.quiz_attempts
  for delete using (user_id = auth.uid());

create policy "app_settings: admin read" on public.app_settings
  for select using (public.is_admin());
create policy "app_settings: admin write" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

create policy "ai_usage: own or admin read" on public.ai_usage
  for select using (user_id = auth.uid() or public.is_admin());

grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_set_status(uuid, text) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.is_admin() to authenticated;
