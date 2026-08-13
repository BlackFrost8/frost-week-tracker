-- ════════════════════════════════════════════════════════════════════════════
-- FROST // WEEK TRACKER — database schema
--
-- Run this once in your Supabase project:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Safe to re-run: everything is idempotent.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.weeks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  week_start   date not null,
  focus        text not null default '',
  reward       text not null default '',
  affirmation  text not null default '',
  -- The 7 Day objects, each with its task list. Stored as one document because
  -- the app always loads and saves a week as a unit.
  days         jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- One row per user per week. This is what the app's upsert targets.
  constraint weeks_user_week_unique unique (user_id, week_start)
);

create index if not exists weeks_user_week_idx
  on public.weeks (user_id, week_start desc);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Without this, the anon key would let anyone read everyone's data. With it,
-- every statement is invisibly filtered to the signed-in user's own rows.

alter table public.weeks enable row level security;

drop policy if exists "own rows: select" on public.weeks;
create policy "own rows: select"
  on public.weeks for select
  using (auth.uid() = user_id);

drop policy if exists "own rows: insert" on public.weeks;
create policy "own rows: insert"
  on public.weeks for insert
  with check (auth.uid() = user_id);

drop policy if exists "own rows: update" on public.weeks;
create policy "own rows: update"
  on public.weeks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own rows: delete" on public.weeks;
create policy "own rows: delete"
  on public.weeks for delete
  using (auth.uid() = user_id);

-- ── Keep updated_at honest ──────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists weeks_touch_updated_at on public.weeks;
create trigger weeks_touch_updated_at
  before update on public.weeks
  for each row execute function public.touch_updated_at();
