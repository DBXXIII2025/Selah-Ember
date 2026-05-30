-- Phase 13.2 media and link messaging.
-- Private message media with participant-scoped attachment rows.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-media',
  'message-media',
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
  public = false,
  file_size_limit = 262144000,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'link', 'file')),
  url text not null,
  filename text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint message_attachments_size_nonnegative check (size_bytes is null or size_bytes >= 0)
);

create index if not exists message_attachments_message_idx
on public.message_attachments (message_id, created_at);

create index if not exists message_attachments_conversation_idx
on public.message_attachments (conversation_id, created_at);

create index if not exists message_attachments_uploader_idx
on public.message_attachments (uploader_id);

alter table public.message_attachments enable row level security;

drop policy if exists "Users can read attachments for their conversations" on public.message_attachments;
create policy "Users can read attachments for their conversations"
on public.message_attachments for select
to authenticated
using (public.is_conversation_participant(conversation_id));

drop policy if exists "Users can insert attachments for own messages" on public.message_attachments;
create policy "Users can insert attachments for own messages"
on public.message_attachments for insert
to authenticated
with check (
  public.is_not_banned()
  and
  auth.uid() = uploader_id
  and public.is_conversation_participant(conversation_id)
  and exists (
    select 1
    from public.direct_messages
    where direct_messages.id = message_attachments.message_id
      and direct_messages.conversation_id = message_attachments.conversation_id
      and direct_messages.sender_id = auth.uid()
  )
);

drop policy if exists "Message participants can read media objects" on storage.objects;
create policy "Message participants can read media objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'message-media'
  and public.is_conversation_participant((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Message participants can upload own media objects" on storage.objects;
create policy "Message participants can upload own media objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'message-media'
  and public.is_not_banned()
  and auth.uid()::text = (storage.foldername(name))[2]
  and public.is_conversation_participant((storage.foldername(name))[1]::uuid)
  and (
    (
      lower(coalesce(metadata->>'mimetype', '')) in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
      and coalesce((metadata->>'size')::bigint, 0) > 0
      and coalesce((metadata->>'size')::bigint, 0) <= 10485760
    )
    or (
      lower(coalesce(metadata->>'mimetype', '')) in ('video/mp4', 'video/webm', 'video/quicktime')
      and coalesce((metadata->>'size')::bigint, 0) > 0
      and coalesce((metadata->>'size')::bigint, 0) <= 262144000
    )
  )
);
