-- Phase 13.5 message reactions.
-- Lightweight participant-scoped reactions for direct messages.

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, reaction),
  constraint message_reactions_allowed_check check (reaction in ('🙏', '👍', '😂', '😢', '🔥'))
);

create index if not exists message_reactions_message_idx
on public.message_reactions (message_id, created_at);

create index if not exists message_reactions_user_idx
on public.message_reactions (user_id, created_at);

alter table public.message_reactions enable row level security;

drop policy if exists "Users can read reactions for their conversations" on public.message_reactions;
create policy "Users can read reactions for their conversations"
on public.message_reactions for select
to authenticated
using (
  exists (
    select 1
    from public.direct_messages
    where direct_messages.id = message_reactions.message_id
      and public.is_conversation_participant(direct_messages.conversation_id)
  )
);

drop policy if exists "Users can add reactions for their conversations" on public.message_reactions;
create policy "Users can add reactions for their conversations"
on public.message_reactions for insert
to authenticated
with check (
  public.is_not_banned()
  and auth.uid() = user_id
  and exists (
    select 1
    from public.direct_messages
    where direct_messages.id = message_reactions.message_id
      and direct_messages.deleted_at is null
      and public.is_conversation_participant(direct_messages.conversation_id)
  )
);

drop policy if exists "Users can remove own reactions" on public.message_reactions;
create policy "Users can remove own reactions"
on public.message_reactions for delete
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.direct_messages
    where direct_messages.id = message_reactions.message_id
      and public.is_conversation_participant(direct_messages.conversation_id)
  )
);
