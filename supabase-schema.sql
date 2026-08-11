-- Budget Tracker — Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Stores each user's entire budget document as one JSONB row, secured so a user
-- can only read/write their own row (Row-Level Security).

create table if not exists public.budgets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.budgets enable row level security;

-- A user may select their own row.
create policy "own row - select"
  on public.budgets for select
  using (auth.uid() = user_id);

-- A user may insert a row for themselves.
create policy "own row - insert"
  on public.budgets for insert
  with check (auth.uid() = user_id);

-- A user may update their own row.
create policy "own row - update"
  on public.budgets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A user may delete their own row.
create policy "own row - delete"
  on public.budgets for delete
  using (auth.uid() = user_id);
