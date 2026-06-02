-- Open community platform pivot.
-- Selah Ember now has one default community feed. Roles are simplified to user/platform_engineer.

alter table public.churches
  add column if not exists is_default boolean not null default false;

create unique index if not exists churches_single_default_idx
on public.churches (is_default)
where is_default = true;

do $$
declare
  default_id uuid;
  platform_profile_id uuid;
begin
  select id
  into default_id
  from public.churches
  where is_default = true
  order by created_at asc
  limit 1;

  if default_id is null then
    select id
    into default_id
    from public.churches
    where lower(coalesce(name, '')) = 'selah ember community'
    order by created_at asc
    limit 1;
  end if;

  if default_id is null then
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
    returning id into default_id;
  else
    update public.churches
    set
      name = coalesce(nullif(name, ''), 'Selah Ember Community'),
      slug = coalesce(nullif(slug, ''), 'selah-ember-community'),
      is_published = true,
      is_default = true
    where id = default_id;
  end if;

  update public.churches
  set is_default = false
  where is_default = true
    and id <> default_id;
end $$;

update public.profiles
set role = 'user'
where role in ('church_leader', 'church_leader_pending');

do $$
declare
  constraint_name text;
begin
  select tc.constraint_name
  into constraint_name
  from information_schema.table_constraints tc
  where tc.constraint_schema = 'public'
    and tc.table_name = 'profiles'
    and tc.constraint_type = 'CHECK'
    and tc.constraint_name = 'profiles_role_check';

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'platform_engineer'));

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint community_post_comments_body_not_blank check (length(btrim(body)) > 0),
  constraint community_post_comments_body_length check (char_length(body) <= 5000)
);

create index if not exists community_post_comments_post_idx
on public.community_post_comments (post_id, created_at asc)
where deleted_at is null;

create index if not exists community_post_comments_author_idx
on public.community_post_comments (author_id, created_at desc);

drop trigger if exists set_community_post_comments_updated_at on public.community_post_comments;
create trigger set_community_post_comments_updated_at
before update on public.community_post_comments
for each row execute function public.set_updated_at();

alter table public.community_post_comments enable row level security;

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

create or replace function public.can_manage_community(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_engineer();
$$;

drop policy if exists "Community managers can read all community posts" on public.community_posts;
drop policy if exists "Community managers can create community posts" on public.community_posts;
drop policy if exists "Community managers can update community posts" on public.community_posts;
drop policy if exists "Community managers can delete community posts" on public.community_posts;
drop policy if exists "Signed-in users can create community posts" on public.community_posts;
drop policy if exists "Authors and platform can update community posts" on public.community_posts;

create policy "Signed-in users can create community posts"
on public.community_posts for insert
to authenticated
with check (
  public.is_not_banned()
  and author_id = auth.uid()
  and community_id = public.default_community_id()
);

create policy "Authors and platform can update community posts"
on public.community_posts for update
to authenticated
using (
  public.is_platform_engineer()
  or author_id = auth.uid()
)
with check (
  public.is_platform_engineer()
  or author_id = auth.uid()
);

drop policy if exists "Public can read community post comments" on public.community_post_comments;
create policy "Public can read community post comments"
on public.community_post_comments for select
to anon, authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.community_posts
    join public.churches on churches.id = community_posts.community_id
    where community_posts.id = community_post_comments.post_id
      and community_posts.deleted_at is null
      and community_posts.is_published = true
      and churches.is_published = true
      and churches.is_default = true
  )
);

drop policy if exists "Signed-in users can create community post comments" on public.community_post_comments;
create policy "Signed-in users can create community post comments"
on public.community_post_comments for insert
to authenticated
with check (
  public.is_not_banned()
  and author_id = auth.uid()
  and exists (
    select 1
    from public.community_posts
    where community_posts.id = community_post_comments.post_id
      and community_posts.deleted_at is null
      and community_posts.is_published = true
      and community_posts.community_id = public.default_community_id()
  )
);

drop policy if exists "Authors and platform can update community post comments" on public.community_post_comments;
create policy "Authors and platform can update community post comments"
on public.community_post_comments for update
to authenticated
using (
  public.is_platform_engineer()
  or author_id = auth.uid()
)
with check (
  public.is_platform_engineer()
  or author_id = auth.uid()
);

drop policy if exists "Community managers can upload feed media" on storage.objects;
drop policy if exists "Community managers can update feed media" on storage.objects;
drop policy if exists "Community managers can delete feed media" on storage.objects;
drop policy if exists "Signed-in users can upload feed media" on storage.objects;
drop policy if exists "Authors and platform can update feed media" on storage.objects;
drop policy if exists "Authors and platform can delete feed media" on storage.objects;

create policy "Signed-in users can upload feed media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-feed-media'
  and public.is_not_banned()
  and (storage.foldername(name))[1] = public.default_community_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Authors and platform can update feed media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'community-feed-media'
  and (
    public.is_platform_engineer()
    or (storage.foldername(name))[2] = auth.uid()::text
  )
)
with check (
  bucket_id = 'community-feed-media'
  and (
    public.is_platform_engineer()
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);

create policy "Authors and platform can delete feed media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-feed-media'
  and (
    public.is_platform_engineer()
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);

grant execute on function public.default_community_id() to anon, authenticated;
grant execute on function public.can_manage_community(uuid) to authenticated;
