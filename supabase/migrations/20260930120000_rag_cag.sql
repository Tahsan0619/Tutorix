-- Knowledge base for retrieval-augmented generation (RAG) and a response cache (CAG).

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------
-- Saved study materials ("My materials")
-- ---------------------------------------------------------------
create table if not exists public.materials (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 200),
  kind           text not null default 'text' check (kind in ('pdf', 'text')),
  content        text not null,
  content_hash   text not null,
  char_count     integer not null default 0,
  chunk_count    integer not null default 0,
  embedded_count integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists materials_owner_idx on public.materials (owner, created_at desc);

create table if not exists public.material_chunks (
  id          bigint generated always as identity primary key,
  material_id uuid not null references public.materials (id) on delete cascade,
  owner       uuid not null references public.profiles (id) on delete cascade,
  idx         integer not null,
  content     text not null,
  embedding   extensions.vector(384),
  unique (material_id, idx)
);
create index if not exists material_chunks_owner_idx on public.material_chunks (owner, material_id);
create index if not exists material_chunks_embedding_idx on public.material_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.materials enable row level security;
alter table public.material_chunks enable row level security;

drop policy if exists "materials: owner select" on public.materials;
drop policy if exists "materials: owner update" on public.materials;
drop policy if exists "materials: owner delete" on public.materials;
drop policy if exists "material_chunks: owner select" on public.material_chunks;
create policy "materials: owner select" on public.materials for select using (owner = auth.uid());
create policy "materials: owner update" on public.materials for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy "materials: owner delete" on public.materials for delete using (owner = auth.uid());
create policy "material_chunks: owner select" on public.material_chunks for select using (owner = auth.uid());
-- Materials and chunks are written by the ai edge function (service role) so chunking and embedding stay server-side.

-- Semantic search over one user's selected materials (cosine similarity on gte-small embeddings).
create or replace function public.match_material_chunks(
  p_owner uuid,
  p_material_ids uuid[],
  p_embedding extensions.vector(384),
  p_count integer default 24
)
returns table (id bigint, material_id uuid, idx integer, similarity double precision)
language sql
stable
set search_path = public, extensions
as $$
  select c.id, c.material_id, c.idx, 1 - (c.embedding <=> p_embedding) as similarity
  from public.material_chunks c
  where c.owner = p_owner
    and c.material_id = any (p_material_ids)
    and c.embedding is not null
  order by c.embedding <=> p_embedding
  limit least(greatest(p_count, 1), 100);
$$;
revoke all on function public.match_material_chunks(uuid, uuid[], extensions.vector, integer) from public, anon, authenticated;
grant execute on function public.match_material_chunks(uuid, uuid[], extensions.vector, integer) to service_role;

-- ---------------------------------------------------------------
-- Response cache: identical requests (same tool, input, material versions and prompt version) reuse the answer
-- ---------------------------------------------------------------
create table if not exists public.ai_cache (
  key        text primary key,
  tool       text not null,
  output     jsonb not null,
  model      text,
  hits       integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_cache_created_idx on public.ai_cache (created_at);
alter table public.ai_cache enable row level security;
-- No policies: only the service role (edge function) can read or write the cache.
