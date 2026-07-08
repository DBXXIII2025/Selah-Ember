-- Selah Ember Beta 1 manual repair: ensure the open community exists.
--
-- Purpose:
-- - Safe to run in the Supabase SQL Editor after confirming the target project.
-- - Idempotent; running it multiple times should preserve the same default row.
-- - Does not delete data.
-- - Preserves the oldest existing published/default community when present.
-- - Creates the canonical open community only when no default/canonical row exists.
--
-- Required SQL Editor steps:
-- 1. Open the intended Supabase project and confirm it is the deployed Beta target.
-- 2. Run sql/manual/diagnose_open_community_posting.sql first and save the output.
-- 3. Run this full script once.
-- 4. Run sql/manual/diagnose_open_community_posting.sql again and confirm:
--    - default_community_count = 1
--    - canonical_slug_count >= 1
--    - default_community_id is not null
-- 5. Test /community/new with a retained signed-in user.

begin;

alter table public.churches
  add column if not exists is_default boolean not null default false;

do $$
declare
  target_community_id uuid;
  platform_profile_id uuid;
begin
  select id
  into target_community_id
  from public.churches
  where is_default = true
    and is_published = true
  order by created_at asc
  limit 1;

  if target_community_id is null then
    select id
    into target_community_id
    from public.churches
    where slug = 'selah-ember-community'
       or lower(coalesce(name, '')) = 'selah ember community'
    order by created_at asc
    limit 1;
  end if;

  if target_community_id is null then
    select id
    into platform_profile_id
    from public.profiles
    where role = 'platform_engineer'
    order by created_at asc
    limit 1;

    insert into public.churches (
      name,
      slug,
      description,
      location,
      created_by,
      is_published,
      is_default
    )
    values (
      'Selah Ember Community',
      'selah-ember-community',
      'An open faith community for prayer, groups, encouragement, and shared updates.',
      'Online',
      platform_profile_id,
      true,
      true
    )
    returning id into target_community_id;
  end if;

  update public.churches
  set
    name = coalesce(nullif(name, ''), 'Selah Ember Community'),
    slug = coalesce(nullif(slug, ''), 'selah-ember-community'),
    description = coalesce(nullif(description, ''), 'An open faith community for prayer, groups, encouragement, and shared updates.'),
    location = coalesce(nullif(location, ''), 'Online'),
    is_published = true,
    is_default = true
  where id = target_community_id;

  update public.churches
  set is_default = false
  where is_default = true
    and id <> target_community_id;
end $$;

create unique index if not exists churches_single_default_idx
on public.churches (is_default)
where is_default = true;

create or replace function public.default_community_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select churches.id
  from public.churches
  where churches.is_default = true
    and churches.is_published = true
  order by churches.created_at asc
  limit 1;
$$;

grant execute on function public.default_community_id() to anon, authenticated;

select
  public.default_community_id() as default_community_id,
  count(*) filter (where is_default = true) as default_community_count,
  count(*) filter (where slug = 'selah-ember-community') as canonical_slug_count
from public.churches;

commit;
