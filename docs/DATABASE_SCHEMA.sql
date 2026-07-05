create table if not exists public.saved_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  notes text default '',
  category text default 'General',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists saved_resources_set_updated_at on public.saved_resources;

create trigger saved_resources_set_updated_at
before update on public.saved_resources
for each row
execute function public.set_updated_at();

alter table public.saved_resources enable row level security;

drop policy if exists "Users can read their saved resources" on public.saved_resources;
drop policy if exists "Users can insert their saved resources" on public.saved_resources;
drop policy if exists "Users can update their saved resources" on public.saved_resources;
drop policy if exists "Users can delete their saved resources" on public.saved_resources;

create policy "Users can read their saved resources"
on public.saved_resources
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their saved resources"
on public.saved_resources
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their saved resources"
on public.saved_resources
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their saved resources"
on public.saved_resources
for delete
to authenticated
using (auth.uid() = user_id);
