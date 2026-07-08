-- Selah Ember Beta 1 diagnostic: open community posting readiness.
--
-- Run in the Supabase SQL Editor. This script does not mutate application data.
-- It creates only a temporary result table for this SQL session.
--
-- Optional: set signed_in_email below to the email shown in the deployed session
-- you are testing. Leave null to run environment-level checks only.

create temp table if not exists open_community_diagnostic_results (
  section text not null,
  result jsonb not null
) on commit drop;

truncate open_community_diagnostic_results;

do $$
declare
  signed_in_email text := null;
  has_is_default boolean;
  has_default_function boolean;
  default_function_result uuid;
  environment_result jsonb;
  canonical_result jsonb;
  signed_in_result jsonb;
  policy_result jsonb;
begin
  -- Example:
  -- signed_in_email := 'user@example.com';

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'churches'
      and column_name = 'is_default'
  )
  into has_is_default;

  select to_regprocedure('public.default_community_id()') is not null
  into has_default_function;

  if has_default_function then
    execute 'select public.default_community_id()' into default_function_result;
  end if;

  if has_is_default then
    execute $sql$
      select jsonb_build_object(
        'has_is_default_column', true,
        'has_default_community_function', $1,
        'default_community_function_result', $2,
        'default_community_count', count(*) filter (where is_default = true),
        'published_default_community_count', count(*) filter (where is_default = true and is_published = true),
        'canonical_slug_count', count(*) filter (where slug = 'selah-ember-community'),
        'sample_default_community_id', min(id::text) filter (where is_default = true and is_published = true)
      )
      from public.churches
    $sql$
    into environment_result
    using has_default_function, default_function_result;

    execute $sql$
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'name', name,
            'slug', slug,
            'is_default', is_default,
            'is_published', is_published,
            'created_by', created_by,
            'created_at', created_at
          )
          order by created_at
        ),
        '[]'::jsonb
      )
      from public.churches
      where is_default = true
         or slug = 'selah-ember-community'
         or lower(coalesce(name, '')) = 'selah ember community'
    $sql$
    into canonical_result;
  else
    execute $sql$
      select jsonb_build_object(
        'has_is_default_column', false,
        'has_default_community_function', $1,
        'default_community_function_result', $2,
        'canonical_slug_count', count(*) filter (where slug = 'selah-ember-community'),
        'canonical_published_count', count(*) filter (
          where is_published = true
            and (slug = 'selah-ember-community' or lower(coalesce(name, '')) = 'selah ember community')
        )
      )
      from public.churches
    $sql$
    into environment_result
    using has_default_function, default_function_result;

    execute $sql$
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'name', name,
            'slug', slug,
            'is_default', null,
            'is_published', is_published,
            'created_by', created_by,
            'created_at', created_at
          )
          order by created_at
        ),
        '[]'::jsonb
      )
      from public.churches
      where slug = 'selah-ember-community'
         or lower(coalesce(name, '')) = 'selah ember community'
    $sql$
    into canonical_result;
  end if;

  insert into open_community_diagnostic_results (section, result)
  values
    ('environment', environment_result),
    ('canonical_rows', canonical_result);

  if signed_in_email is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'auth_user_id', u.id,
          'email', u.email,
          'profile_id', p.id,
          'role', p.role,
          'has_profile', p.id is not null,
          'has_active_ban', exists (
            select 1
            from public.user_bans b
            where b.banned_user_id = u.id
              and b.starts_at <= now()
              and b.expires_at > now()
          ),
          'can_post_expected', p.id is not null
            and not exists (
              select 1
              from public.user_bans b
              where b.banned_user_id = u.id
                and b.starts_at <= now()
                and b.expires_at > now()
            )
            and (
              default_function_result is not null
              or exists (
                select 1
                from public.churches c
                where c.is_published = true
                  and (c.slug = 'selah-ember-community' or lower(coalesce(c.name, '')) = 'selah ember community')
              )
            )
        )
      ),
      '[]'::jsonb
    )
    into signed_in_result
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where lower(u.email) = lower(signed_in_email);
  else
    signed_in_result := jsonb_build_object(
      'skipped', true,
      'reason', 'Set signed_in_email inside the DO block to check a specific deployed session user.'
    );
  end if;

  insert into open_community_diagnostic_results (section, result)
  values ('signed_in_profile_post_readiness', signed_in_result);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'policyname', policyname,
        'roles', roles,
        'cmd', cmd,
        'with_check', with_check
      )
      order by policyname
    ),
    '[]'::jsonb
  )
  into policy_result
  from pg_policies
  where schemaname = 'public'
    and tablename = 'community_posts'
    and cmd in ('INSERT', 'ALL');

  insert into open_community_diagnostic_results (section, result)
  values ('community_post_insert_policies', policy_result);
end $$;

select section, result
from open_community_diagnostic_results
order by section;
