drop policy if exists "anon can update household tasks" on public.household_tasks;
create policy "anon can update household tasks"
on public.household_tasks
for update
to anon
using (true)
with check (true);
