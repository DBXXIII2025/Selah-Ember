-- Phase 15.5 leader verification and community updates.
-- Adds verified leader workflow, official community feed posts, and tighter community/event permissions.

alter table public.profiles
  alter column role set default 'user';

update public.profiles
set role = 'church_leader'
where role = 'church_owner';

do $$
declare
  constraint_name text;
begin
  select tc.constraint_name into constraint_name
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
  check (role in ('user', 'church_leader_pending', 'church_leader', 'platform_engineer'));

create or replace function public.is_platform_engineer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role = 'platform_engineer'
  );
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select profiles.role
    from public.profiles
    where profiles.user_id = auth.uid()
    limit 1
  ), 'user');
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id
  from public.profiles
  where profiles.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.can_manage_community(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_engineer()
    or exists (
      select 1
      from public.churches
      join public.profiles on profiles.id = churches.created_by
      where churches.id = target_community_id
        and profiles.user_id = auth.uid()
        and profiles.role = 'church_leader'
    );
$$;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.can_manage_community(uuid) to authenticated;

create table if not exists public.leader_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  church_name text not null,
  website_url text,
  church_email text,
  social_url text,
  description text,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leader_applications_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint leader_applications_church_name_not_blank check (length(btrim(church_name)) > 0)
);

create index if not exists leader_applications_profile_idx
on public.leader_applications (profile_id, created_at desc);

create index if not exists leader_applications_status_idx
on public.leader_applications (status, created_at desc);

drop trigger if exists set_leader_applications_updated_at on public.leader_applications;
create trigger set_leader_applications_updated_at
before update on public.leader_applications
for each row execute function public.set_updated_at();

alter table public.leader_applications enable row level security;

drop policy if exists "Applicants can read own leader applications" on public.leader_applications;
create policy "Applicants can read own leader applications"
on public.leader_applications for select
to authenticated
using (
  public.is_platform_engineer()
  or profile_id = public.current_profile_id()
);

drop policy if exists "Users can submit leader applications" on public.leader_applications;
create policy "Users can submit leader applications"
on public.leader_applications for insert
to authenticated
with check (
  public.is_not_banned()
  and profile_id = public.current_profile_id()
);

drop policy if exists "Platform engineers can review leader applications" on public.leader_applications;
create policy "Platform engineers can review leader applications"
on public.leader_applications for update
to authenticated
using (public.is_platform_engineer())
with check (public.is_platform_engineer());

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.churches(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text,
  media_url text,
  media_kind text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint community_posts_media_kind_check check (media_kind in ('image', 'video', 'link') or media_kind is null),
  constraint community_posts_title_length check (title is null or char_length(title) <= 160),
  constraint community_posts_body_length check (body is null or char_length(body) <= 10000),
  constraint community_posts_has_content_check check (
    title is not null
    or body is not null
    or media_url is not null
    or storage_path is not null
  )
);

create index if not exists community_posts_public_idx
on public.community_posts (community_id, is_published, created_at desc)
where deleted_at is null;

create index if not exists community_posts_author_idx
on public.community_posts (author_id, created_at desc);

drop trigger if exists set_community_posts_updated_at on public.community_posts;
create trigger set_community_posts_updated_at
before update on public.community_posts
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-feed-media',
  'community-feed-media',
  false,
  262144000,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.community_posts enable row level security;

drop policy if exists "Public can read published community posts" on public.community_posts;
create policy "Public can read published community posts"
on public.community_posts for select
to anon, authenticated
using (
  deleted_at is null
  and is_published = true
  and exists (
    select 1
    from public.churches
    where churches.id = community_posts.community_id
      and churches.is_published = true
  )
);

drop policy if exists "Community managers can read all community posts" on public.community_posts;
create policy "Community managers can read all community posts"
on public.community_posts for select
to authenticated
using (public.can_manage_community(community_id));

drop policy if exists "Community managers can create community posts" on public.community_posts;
create policy "Community managers can create community posts"
on public.community_posts for insert
to authenticated
with check (
  public.is_not_banned()
  and author_id = auth.uid()
  and public.can_manage_community(community_id)
);

drop policy if exists "Community managers can update community posts" on public.community_posts;
create policy "Community managers can update community posts"
on public.community_posts for update
to authenticated
using (public.can_manage_community(community_id))
with check (public.can_manage_community(community_id));

drop policy if exists "Community managers can delete community posts" on public.community_posts;
create policy "Community managers can delete community posts"
on public.community_posts for delete
to authenticated
using (public.can_manage_community(community_id));

drop policy if exists "Verified leaders can create communities" on public.churches;
drop policy if exists "Authenticated users can create communities" on public.churches;
create policy "Verified leaders can create communities"
on public.churches for insert
to authenticated
with check (
  public.is_not_banned()
  and created_by = public.current_profile_id()
  and (
    public.is_platform_engineer()
    or public.current_profile_role() = 'church_leader'
    or (public.current_profile_role() = 'church_leader_pending' and is_published = false)
  )
);

drop policy if exists "Owners can update communities" on public.churches;
create policy "Owners can update communities"
on public.churches for update
to authenticated
using (
  public.is_platform_engineer()
  or created_by = public.current_profile_id()
)
with check (
  public.is_platform_engineer()
  or (
    created_by = public.current_profile_id()
    and (
      public.current_profile_role() = 'church_leader'
      or (public.current_profile_role() = 'church_leader_pending' and is_published = false)
    )
  )
);

drop policy if exists "Verified leaders can create official events" on public.events;
drop policy if exists "Authenticated users can create events" on public.events;
create policy "Verified leaders can create official events"
on public.events for insert
to authenticated
with check (
  public.is_not_banned()
  and created_by = public.current_profile_id()
  and (
    public.is_platform_engineer()
    or (
      public.current_profile_role() = 'church_leader'
      and (
        community_id is null
        or public.can_manage_community(community_id)
      )
    )
  )
);

drop policy if exists "Community managers can upload feed media" on storage.objects;
create policy "Community managers can upload feed media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-feed-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.can_manage_community((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Community managers can update feed media" on storage.objects;
create policy "Community managers can update feed media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'community-feed-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.can_manage_community((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'community-feed-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.can_manage_community((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Community managers can delete feed media" on storage.objects;
create policy "Community managers can delete feed media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-feed-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.can_manage_community((storage.foldername(name))[1]::uuid)
);
