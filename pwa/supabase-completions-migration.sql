create table if not exists public.household_task_completions (
  id uuid primary key default gen_random_uuid(),
  household_id text not null,
  completion_key text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, completion_key)
);

alter table public.household_task_completions enable row level security;

drop policy if exists "anon can read household task completions" on public.household_task_completions;
create policy "anon can read household task completions"
on public.household_task_completions
for select
to anon
using (true);

drop policy if exists "anon can insert household task completions" on public.household_task_completions;
create policy "anon can insert household task completions"
on public.household_task_completions
for insert
to anon
with check (true);

drop policy if exists "anon can update household task completions" on public.household_task_completions;
create policy "anon can update household task completions"
on public.household_task_completions
for update
to anon
using (true)
with check (true);
