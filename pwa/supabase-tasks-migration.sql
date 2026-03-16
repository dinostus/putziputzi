alter table public.household_tasks
add column if not exists seed_key text;

alter table public.household_tasks
add column if not exists first_person text not null default 'Laura';

alter table public.household_tasks
add column if not exists built_in boolean not null default false;
