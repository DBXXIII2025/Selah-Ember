-- Phase 17 Module 8 storage and upload hardening.
-- Binds database object pointers to their authorized scope, prevents reads of
-- deleted message attachments, and mirrors application upload limits in RLS.

alter table public.message_attachments
  drop constraint if exists message_attachments_storage_path_check;
alter table public.message_attachments
  add constraint message_attachments_storage_path_check
  check (
    kind not in ('image', 'video')
    or (
      url like conversation_id::text || '/' || uploader_id::text || '/%'
      and cardinality(string_to_array(url, '/')) = 3
      and split_part(url, '/', 3) <> ''
      and url !~ '(^|/)\.\.(/|$)'
    )
  ) not valid;

create or replace function public.enforce_community_post_storage_path()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.storage_path is not null and (
    new.storage_path not like (new.community_id::text || '/' || new.author_id::text || '/%')
    or cardinality(string_to_array(new.storage_path, '/')) <> 3
    or split_part(new.storage_path, '/', 3) = ''
    or new.storage_path ~ '(^|/)\.\.(/|$)'
  ) then
    raise exception 'Community post storage path does not match its community and author'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_community_post_storage_path on public.community_posts;
create trigger enforce_community_post_storage_path
before insert or update of storage_path, community_id, author_id on public.community_posts
for each row execute function public.enforce_community_post_storage_path();

create or replace function public.enforce_media_item_storage_path()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  creator_user_id uuid;
begin
  if new.storage_path is null then
    return new;
  end if;

  select profiles.user_id
  into creator_user_id
  from public.profiles
  where profiles.id = new.created_by;

  if creator_user_id is null
    or new.storage_path not like (new.community_id::text || '/' || creator_user_id::text || '/%')
    or cardinality(string_to_array(new.storage_path, '/')) <> 3
    or split_part(new.storage_path, '/', 3) = ''
    or new.storage_path ~ '(^|/)\.\.(/|$)'
  then
    raise exception 'Media storage path does not match its community and creator'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_media_item_storage_path on public.media_items;
create trigger enforce_media_item_storage_path
before insert or update of storage_path, community_id, created_by on public.media_items
for each row execute function public.enforce_media_item_storage_path();

drop policy if exists "Message participants can read media objects" on storage.objects;
drop policy if exists "Message participants can read active media objects" on storage.objects;
create policy "Message participants can read active media objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'message-media'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then public.is_conversation_participant((storage.foldername(name))[1]::uuid)
    else false
  end
  and exists (
    select 1
    from public.message_attachments
    join public.direct_messages
      on direct_messages.id = message_attachments.message_id
      and direct_messages.conversation_id = message_attachments.conversation_id
    where message_attachments.url = storage.objects.name
      and message_attachments.kind in ('image', 'video')
      and message_attachments.conversation_id::text = (storage.foldername(storage.objects.name))[1]
      and message_attachments.uploader_id::text = (storage.foldername(storage.objects.name))[2]
      and direct_messages.deleted_at is null
  )
);

drop policy if exists "Signed-in users can upload feed media" on storage.objects;
drop policy if exists "Signed-in users can upload validated feed media" on storage.objects;
create policy "Signed-in users can upload validated feed media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-feed-media'
  and public.is_not_banned()
  and (storage.foldername(name))[1] = public.default_community_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
  and (
    (
      lower(coalesce(metadata->>'mimetype', '')) in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
      and coalesce(metadata->>'size', '') ~ '^[0-9]+$'
      and (metadata->>'size')::bigint between 1 and 10485760
    )
    or (
      lower(coalesce(metadata->>'mimetype', '')) in ('video/mp4', 'video/webm', 'video/quicktime')
      and coalesce(metadata->>'size', '') ~ '^[0-9]+$'
      and (metadata->>'size')::bigint between 1 and 262144000
    )
  )
);

drop policy if exists "Authors and platform can update feed media" on storage.objects;
drop policy if exists "Authors and platform can update validated feed media" on storage.objects;
create policy "Authors and platform can update validated feed media"
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
  and (
    (
      lower(coalesce(metadata->>'mimetype', '')) in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
      and coalesce(metadata->>'size', '') ~ '^[0-9]+$'
      and (metadata->>'size')::bigint between 1 and 10485760
    )
    or (
      lower(coalesce(metadata->>'mimetype', '')) in ('video/mp4', 'video/webm', 'video/quicktime')
      and coalesce(metadata->>'size', '') ~ '^[0-9]+$'
      and (metadata->>'size')::bigint between 1 and 262144000
    )
  )
);

drop policy if exists "Community owners can upload community media" on storage.objects;
drop policy if exists "Community owners can upload validated community media" on storage.objects;
create policy "Community owners can upload validated community media"
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
  and (
    (
      lower(coalesce(metadata->>'mimetype', '')) in ('audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav')
      and coalesce(metadata->>'size', '') ~ '^[0-9]+$'
      and (metadata->>'size')::bigint between 1 and 104857600
    )
    or (
      lower(coalesce(metadata->>'mimetype', '')) in ('video/mp4', 'video/webm', 'video/quicktime')
      and coalesce(metadata->>'size', '') ~ '^[0-9]+$'
      and (metadata->>'size')::bigint between 1 and 262144000
    )
    or (
      lower(coalesce(metadata->>'mimetype', '')) in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      and coalesce(metadata->>'size', '') ~ '^[0-9]+$'
      and (metadata->>'size')::bigint between 1 and 26214400
    )
  )
);

drop policy if exists "Community owners can update community media" on storage.objects;
drop policy if exists "Community owners can update validated community media" on storage.objects;
create policy "Community owners can update validated community media"
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
  and (
    (
      lower(coalesce(metadata->>'mimetype', '')) in ('audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav')
      and coalesce(metadata->>'size', '') ~ '^[0-9]+$'
      and (metadata->>'size')::bigint between 1 and 104857600
    )
    or (
      lower(coalesce(metadata->>'mimetype', '')) in ('video/mp4', 'video/webm', 'video/quicktime')
      and coalesce(metadata->>'size', '') ~ '^[0-9]+$'
      and (metadata->>'size')::bigint between 1 and 262144000
    )
    or (
      lower(coalesce(metadata->>'mimetype', '')) in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      and coalesce(metadata->>'size', '') ~ '^[0-9]+$'
      and (metadata->>'size')::bigint between 1 and 26214400
    )
  )
);
