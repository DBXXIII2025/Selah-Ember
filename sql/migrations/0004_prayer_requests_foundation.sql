-- Phase 4 prayer request foundation.
-- Adds content/community support and basic owner/public read policies.

alter table public.prayer_requests
  add column if not exists content text,
  add column if not exists community_id uuid references public.churches(id) on delete set null;

update public.prayer_requests
set content = body
where content is null
  and body is not null;

alter table public.prayer_requests enable row level security;

drop policy if exists "Authenticated users can create own prayer requests" on public.prayer_requests;
create policy "Authenticated users can create own prayer requests"
on public.prayer_requests for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = prayer_requests.profile_id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own prayer requests" on public.prayer_requests;
create policy "Users can read own prayer requests"
on public.prayer_requests for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = prayer_requests.profile_id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can read public prayer requests" on public.prayer_requests;
create policy "Authenticated users can read public prayer requests"
on public.prayer_requests for select
to authenticated
using (is_private = false);

drop policy if exists "Users can update own prayer requests" on public.prayer_requests;
create policy "Users can update own prayer requests"
on public.prayer_requests for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = prayer_requests.profile_id
      and profiles.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = prayer_requests.profile_id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own prayer requests" on public.prayer_requests;
create policy "Users can delete own prayer requests"
on public.prayer_requests for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = prayer_requests.profile_id
      and profiles.user_id = auth.uid()
  )
);
