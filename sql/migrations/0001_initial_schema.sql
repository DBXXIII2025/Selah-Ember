-- Initial Selah Ember schema.
-- This migration is intentionally additive/idempotent for safe early project setup.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'profiles'
      and constraint_name = 'profiles_user_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

create table if not exists public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  city text,
  state text,
  website_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_groups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references public.churches(id) on delete set null,
  name text not null,
  description text,
  meeting_schedule text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (group_id, profile_id)
);

create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  group_id uuid references public.study_groups(id) on delete set null,
  title text not null,
  body text,
  is_private boolean not null default false,
  prayed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references public.churches(id) on delete set null,
  group_id uuid references public.study_groups(id) on delete set null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_churches_updated_at on public.churches;
create trigger set_churches_updated_at
before update on public.churches
for each row execute function public.set_updated_at();

drop trigger if exists set_study_groups_updated_at on public.study_groups;
create trigger set_study_groups_updated_at
before update on public.study_groups
for each row execute function public.set_updated_at();

drop trigger if exists set_prayer_requests_updated_at on public.prayer_requests;
create trigger set_prayer_requests_updated_at
before update on public.prayer_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.churches enable row level security;
alter table public.study_groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.events enable row level security;

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
on public.profiles for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Profiles are editable by owner" on public.profiles;
create policy "Profiles are editable by owner"
on public.profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Service-role server code creates the profile row after signup.
-- Church, group, prayer, and event policies will be added with their features.
