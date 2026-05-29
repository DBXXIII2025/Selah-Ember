-- Phase 5 study groups foundation.
-- Adds app-facing fields and basic group/membership RLS.

alter table public.study_groups
  add column if not exists title text,
  add column if not exists meeting_time text,
  add column if not exists location text,
  add column if not exists community_id uuid references public.churches(id) on delete set null,
  add column if not exists is_public boolean not null default true;

update public.study_groups
set title = name
where title is null
  and name is not null;

update public.study_groups
set meeting_time = meeting_schedule
where meeting_time is null
  and meeting_schedule is not null;

update public.study_groups
set community_id = church_id
where community_id is null
  and church_id is not null;

alter table public.study_groups enable row level security;
alter table public.group_memberships enable row level security;

drop policy if exists "Authenticated users can create study groups" on public.study_groups;
create policy "Authenticated users can create study groups"
on public.study_groups for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = study_groups.created_by
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Members can read their study groups" on public.study_groups;
create policy "Members can read their study groups"
on public.study_groups for select
to authenticated
using (
  exists (
    select 1
    from public.group_memberships
    join public.profiles on profiles.id = group_memberships.profile_id
    where group_memberships.group_id = study_groups.id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can read public study group cards" on public.study_groups;
create policy "Authenticated users can read public study group cards"
on public.study_groups for select
to authenticated
using (is_public = true);

drop policy if exists "Owners can update study groups" on public.study_groups;
create policy "Owners can update study groups"
on public.study_groups for update
to authenticated
using (
  exists (
    select 1
    from public.group_memberships
    join public.profiles on profiles.id = group_memberships.profile_id
    where group_memberships.group_id = study_groups.id
      and group_memberships.role in ('owner', 'leader')
      and profiles.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.group_memberships
    join public.profiles on profiles.id = group_memberships.profile_id
    where group_memberships.group_id = study_groups.id
      and group_memberships.role in ('owner', 'leader')
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own group memberships" on public.group_memberships;
create policy "Users can read own group memberships"
on public.group_memberships for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = group_memberships.profile_id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Users can create their own group memberships" on public.group_memberships;
create policy "Users can create their own group memberships"
on public.group_memberships for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = group_memberships.profile_id
      and profiles.user_id = auth.uid()
  )
);
