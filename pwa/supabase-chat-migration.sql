create table if not exists public.household_chat_messages (
  id uuid primary key default gen_random_uuid(),
  household_id text not null,
  person text not null check (person in ('Laura', 'Dino')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.household_chat_messages enable row level security;

drop policy if exists "anon can read household chat messages" on public.household_chat_messages;
create policy "anon can read household chat messages"
on public.household_chat_messages
for select
to anon
using (true);

drop policy if exists "anon can insert household chat messages" on public.household_chat_messages;
create policy "anon can insert household chat messages"
on public.household_chat_messages
for insert
to anon
with check (true);
