-- Phase 13.4 messaging quality layer.
-- Per-user archive state, soft-delete/report/block foundations, and block-aware message inserts.

alter table public.conversation_participants
  add column if not exists archived_at timestamptz;

create index if not exists conversation_participants_user_archived_idx
on public.conversation_participants (user_id, archived_at, conversation_id);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.direct_messages(id) on delete set null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  constraint message_reports_reason_not_blank check (length(btrim(reason)) > 0),
  constraint message_reports_details_length check (details is null or char_length(details) <= 1000)
);

create index if not exists message_reports_reporter_idx
on public.message_reports (reporter_id, created_at desc);

create index if not exists message_reports_conversation_idx
on public.message_reports (conversation_id, created_at desc);

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_user_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_user_id)
);

create index if not exists user_blocks_blocked_idx
on public.user_blocks (blocked_user_id, blocker_id);

alter table public.message_reports enable row level security;
alter table public.user_blocks enable row level security;

drop policy if exists "Users can create reports for their conversations" on public.message_reports;
create policy "Users can create reports for their conversations"
on public.message_reports for insert
to authenticated
with check (
  auth.uid() = reporter_id
  and public.is_conversation_participant(conversation_id)
  and (
    message_id is null
    or exists (
      select 1
      from public.direct_messages
      where direct_messages.id = message_reports.message_id
        and direct_messages.conversation_id = message_reports.conversation_id
    )
  )
);

drop policy if exists "Users can read their own reports" on public.message_reports;
create policy "Users can read their own reports"
on public.message_reports for select
to authenticated
using (auth.uid() = reporter_id);

drop policy if exists "Platform engineers can read message reports" on public.message_reports;
create policy "Platform engineers can read message reports"
on public.message_reports for select
to authenticated
using (public.is_platform_engineer());

drop policy if exists "Users can manage own block rows" on public.user_blocks;
create policy "Users can manage own block rows"
on public.user_blocks for all
to authenticated
using (auth.uid() = blocker_id)
with check (auth.uid() = blocker_id);

drop policy if exists "Platform engineers can read user blocks" on public.user_blocks;
create policy "Platform engineers can read user blocks"
on public.user_blocks for select
to authenticated
using (public.is_platform_engineer());

drop policy if exists "Users can insert messages in their conversations" on public.direct_messages;
create policy "Users can insert messages in their conversations"
on public.direct_messages for insert
to authenticated
with check (
  public.is_not_banned()
  and auth.uid() = sender_id
  and public.is_conversation_participant(conversation_id)
  and not exists (
    select 1
    from public.conversation_participants
    join public.user_blocks
      on user_blocks.blocker_id = conversation_participants.user_id
      and user_blocks.blocked_user_id = auth.uid()
    where conversation_participants.conversation_id = direct_messages.conversation_id
      and conversation_participants.user_id <> auth.uid()
  )
);
