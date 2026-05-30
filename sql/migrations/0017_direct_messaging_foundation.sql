-- Phase 13.1 direct messaging foundation.
-- Text-only one-on-one conversations managed by trusted server actions.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_read_at timestamptz,
  unique (conversation_id, user_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint direct_messages_body_not_blank check (length(btrim(body)) > 0),
  constraint direct_messages_body_length check (char_length(body) <= 5000)
);

create index if not exists conversation_participants_user_idx
on public.conversation_participants (user_id, conversation_id);

create index if not exists direct_messages_conversation_created_idx
on public.direct_messages (conversation_id, created_at);

create index if not exists direct_messages_sender_idx
on public.direct_messages (sender_id);

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists touch_conversation_on_message on public.direct_messages;
create trigger touch_conversation_on_message
after insert on public.direct_messages
for each row execute function public.touch_conversation_on_message();

create or replace function public.prevent_participant_identity_update()
returns trigger
language plpgsql
as $$
begin
  if new.conversation_id <> old.conversation_id
    or new.user_id <> old.user_id
    or new.created_at <> old.created_at
  then
    raise exception 'Only participant read state can be updated';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_participant_identity_update on public.conversation_participants;
create trigger prevent_participant_identity_update
before update on public.conversation_participants
for each row execute function public.prevent_participant_identity_update();

create or replace function public.prevent_direct_message_content_update()
returns trigger
language plpgsql
as $$
begin
  if new.conversation_id <> old.conversation_id
    or new.sender_id <> old.sender_id
    or new.body <> old.body
    or new.created_at <> old.created_at
  then
    raise exception 'Only message deleted state can be updated';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_direct_message_content_update on public.direct_messages;
create trigger prevent_direct_message_content_update
before update on public.direct_messages
for each row execute function public.prevent_direct_message_content_update();

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.direct_messages enable row level security;

create or replace function public.is_conversation_participant(conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants
    where conversation_participants.conversation_id = is_conversation_participant.conversation_id
      and conversation_participants.user_id = auth.uid()
  );
$$;

drop policy if exists "Users can read conversations they participate in" on public.conversations;
create policy "Users can read conversations they participate in"
on public.conversations for select
to authenticated
using (public.is_conversation_participant(id));

drop policy if exists "Users can read participants for their conversations" on public.conversation_participants;
create policy "Users can read participants for their conversations"
on public.conversation_participants for select
to authenticated
using (public.is_conversation_participant(conversation_id));

drop policy if exists "Users can update own participant read state" on public.conversation_participants;
create policy "Users can update own participant read state"
on public.conversation_participants for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read messages for their conversations" on public.direct_messages;
create policy "Users can read messages for their conversations"
on public.direct_messages for select
to authenticated
using (public.is_conversation_participant(conversation_id));

drop policy if exists "Users can insert messages in their conversations" on public.direct_messages;
create policy "Users can insert messages in their conversations"
on public.direct_messages for insert
to authenticated
with check (
  public.is_not_banned()
  and auth.uid() = sender_id
  and public.is_conversation_participant(conversation_id)
);

drop policy if exists "Users can soft delete own messages" on public.direct_messages;
create policy "Users can soft delete own messages"
on public.direct_messages for update
to authenticated
using (auth.uid() = sender_id)
with check (auth.uid() = sender_id);
