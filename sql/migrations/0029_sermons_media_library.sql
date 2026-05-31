-- Phase 15 sermons and media library.
-- Community-owned media items for sermons, teachings, notes, and resource links.

create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.churches(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  media_type text not null,
  content_kind text not null,
  external_url text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  scripture_reference text,
  speaker_name text,
  published_at timestamptz,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint media_items_media_type_check check (media_type in ('sermon', 'teaching', 'testimony', 'resource', 'announcement')),
  constraint media_items_content_kind_check check (content_kind in ('link', 'audio', 'video', 'document', 'text')),
  constraint media_items_title_not_blank check (length(btrim(title)) > 0),
  constraint media_items_external_url_check check (external_url is null or length(btrim(external_url)) > 0),
  constraint media_items_storage_path_check check (storage_path is null or length(btrim(storage_path)) > 0),
  constraint media_items_file_name_check check (file_name is null or length(btrim(file_name)) > 0),
  constraint media_items_mime_type_check check (mime_type is null or length(btrim(mime_type)) > 0)
);

create index if not exists media_items_community_idx
on public.media_items (community_id, published_at desc, created_at desc);

create index if not exists media_items_created_by_idx
on public.media_items (created_by, created_at desc);

create index if not exists media_items_published_idx
on public.media_items (is_published, published_at desc, created_at desc);

drop trigger if exists set_media_items_updated_at on public.media_items;
create trigger set_media_items_updated_at
before update on public.media_items
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  false,
  262144000,
  array[
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.media_items enable row level security;

drop policy if exists "Public can read published media items" on public.media_items;
create policy "Public can read published media items"
on public.media_items for select
to anon, authenticated
using (
  deleted_at is null
  and is_published = true
  and exists (
    select 1
    from public.churches
    where churches.id = media_items.community_id
      and churches.is_published = true
  )
);

drop policy if exists "Platform engineers can read all media items" on public.media_items;
create policy "Platform engineers can read all media items"
on public.media_items for select
to authenticated
using (public.is_platform_engineer());

drop policy if exists "Community owners can read their media items" on public.media_items;
create policy "Community owners can read their media items"
on public.media_items for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.id = media_items.created_by
  )
);

drop policy if exists "Community owners can create media items" on public.media_items;
create policy "Community owners can create media items"
on public.media_items for insert
to authenticated
with check (
  public.is_not_banned()
  and (
    public.is_platform_engineer()
    or (
      exists (
        select 1
        from public.profiles
        where profiles.user_id = auth.uid()
          and profiles.id = media_items.created_by
      )
      and exists (
        select 1
        from public.churches
        where churches.id = media_items.community_id
          and churches.created_by = media_items.created_by
      )
    )
  )
);

drop policy if exists "Community owners can update media items" on public.media_items;
create policy "Community owners can update media items"
on public.media_items for update
to authenticated
using (
  public.is_platform_engineer()
  or exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.id = media_items.created_by
  )
)
with check (
  public.is_platform_engineer()
  or exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.id = media_items.created_by
  )
);

drop policy if exists "Community owners can delete media items" on public.media_items;
create policy "Community owners can delete media items"
on public.media_items for delete
to authenticated
using (
  public.is_platform_engineer()
  or exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.id = media_items.created_by
  )
);

drop policy if exists "Community owners can upload community media" on storage.objects;
create policy "Community owners can upload community media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (
    public.is_platform_engineer()
    or exists (
      select 1
      from public.profiles
      join public.churches on churches.created_by = profiles.id
      where profiles.user_id = auth.uid()
        and churches.id = (storage.foldername(name))[1]::uuid
    )
  )
);

drop policy if exists "Community owners can update community media" on storage.objects;
create policy "Community owners can update community media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (
    public.is_platform_engineer()
    or exists (
      select 1
      from public.profiles
      join public.churches on churches.created_by = profiles.id
      where profiles.user_id = auth.uid()
        and churches.id = (storage.foldername(name))[1]::uuid
    )
  )
)
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (
    public.is_platform_engineer()
    or exists (
      select 1
      from public.profiles
      join public.churches on churches.created_by = profiles.id
      where profiles.user_id = auth.uid()
        and churches.id = (storage.foldername(name))[1]::uuid
    )
  )
);

drop policy if exists "Community owners can delete community media" on storage.objects;
create policy "Community owners can delete community media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (
    public.is_platform_engineer()
    or exists (
      select 1
      from public.profiles
      join public.churches on churches.created_by = profiles.id
      where profiles.user_id = auth.uid()
        and churches.id = (storage.foldername(name))[1]::uuid
    )
  )
);
