create extension if not exists pgcrypto;

create table if not exists public.household_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id text not null,
  name text not null,
  start_date date not null,
  unit text not null check (unit in ('days', 'weeks', 'months')),
  interval integer not null check (interval > 0),
  created_at timestamptz not null default now()
);

alter table public.household_tasks enable row level security;

drop policy if exists "anon can read household tasks" on public.household_tasks;
create policy "anon can read household tasks"
on public.household_tasks
for select
to anon
using (true);

drop policy if exists "anon can insert household tasks" on public.household_tasks;
create policy "anon can insert household tasks"
on public.household_tasks
for insert
to anon
with check (true);

drop policy if exists "anon can delete household tasks" on public.household_tasks;
create policy "anon can delete household tasks"
on public.household_tasks
for delete
to anon
using (true);
