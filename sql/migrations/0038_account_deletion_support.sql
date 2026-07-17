-- Account deletion support.
-- Scrubs authored content that other users may still need for context, removes private/user-owned rows,
-- and allows Auth identity deletion to happen last from trusted server code.

alter table public.community_posts
  alter column author_id drop not null;

alter table public.community_posts
  drop constraint if exists community_posts_author_id_fkey;

alter table public.community_posts
  add constraint community_posts_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

alter table public.community_post_comments
  alter column author_id drop not null;

alter table public.community_post_comments
  drop constraint if exists community_post_comments_author_id_fkey;

alter table public.community_post_comments
  add constraint community_post_comments_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

alter table public.direct_messages
  alter column sender_id drop not null;

alter table public.direct_messages
  drop constraint if exists direct_messages_sender_id_fkey;

alter table public.direct_messages
  add constraint direct_messages_sender_id_fkey
  foreign key (sender_id) references auth.users(id) on delete set null;

alter table public.discussion_threads
  alter column author_id drop not null;

alter table public.discussion_threads
  drop constraint if exists discussion_threads_author_id_fkey;

alter table public.discussion_threads
  add constraint discussion_threads_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

alter table public.discussion_replies
  alter column author_id drop not null;

alter table public.discussion_replies
  drop constraint if exists discussion_replies_author_id_fkey;

alter table public.discussion_replies
  add constraint discussion_replies_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

create or replace function public.prevent_direct_message_content_update()
returns trigger
language plpgsql
as $$
begin
  if old.sender_id is not null
    and new.sender_id is null
    and new.body = 'Message deleted'
    and new.deleted_at is not null
    and new.conversation_id = old.conversation_id
    and new.created_at = old.created_at
  then
    return new;
  end if;

  if new.conversation_id <> old.conversation_id
    or new.sender_id is distinct from old.sender_id
    or new.body <> old.body
    or new.created_at <> old.created_at
  then
    raise exception 'Only message deleted state can be updated';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_discussion_thread_content_update()
returns trigger
language plpgsql
as $$
begin
  if old.author_id is not null
    and new.author_id is null
    and new.title = 'Deleted discussion'
    and new.body = 'Deleted discussion'
    and new.deleted_at is not null
    and new.scope_type = old.scope_type
    and new.community_id is not distinct from old.community_id
    and new.group_id is not distinct from old.group_id
    and new.created_at = old.created_at
  then
    return new;
  end if;

  if old.author_id is distinct from new.author_id
    or old.scope_type <> new.scope_type
    or old.community_id is distinct from new.community_id
    or old.group_id is distinct from new.group_id
    or old.title <> new.title
    or old.body <> new.body
    or old.created_at <> new.created_at
  then
    raise exception 'Only discussion soft-delete metadata can be updated';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_discussion_reply_content_update()
returns trigger
language plpgsql
as $$
begin
  if old.author_id is not null
    and new.author_id is null
    and new.body = 'Deleted reply'
    and new.deleted_at is not null
    and new.thread_id = old.thread_id
    and new.created_at = old.created_at
  then
    return new;
  end if;

  if old.author_id is distinct from new.author_id
    or old.thread_id <> new.thread_id
    or old.body <> new.body
    or old.created_at <> new.created_at
  then
    raise exception 'Only discussion reply soft-delete metadata can be updated';
  end if;

  return new;
end;
$$;

create or replace function public.delete_user_account_data(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile_id uuid;
  affected integer;
  result jsonb := '{}'::jsonb;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  select id
  into target_profile_id
  from public.profiles
  where user_id = target_user_id;

  delete from public.message_attachments
  where uploader_id = target_user_id
     or message_id in (
       select id from public.direct_messages where sender_id = target_user_id
     );
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('message_attachments', affected);

  delete from public.message_reactions where user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('message_reactions', affected);

  update public.direct_messages
  set sender_id = null,
      body = 'Message deleted',
      deleted_at = coalesce(deleted_at, now())
  where sender_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('direct_messages_scrubbed', affected);

  delete from public.conversation_participants where user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('conversation_participants', affected);

  delete from public.conversations
  where not exists (
    select 1
    from public.conversation_participants
    where conversation_participants.conversation_id = conversations.id
  );
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('empty_conversations', affected);

  delete from public.message_reports where reporter_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('message_reports', affected);

  delete from public.user_blocks
  where blocker_id = target_user_id
     or blocked_user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('user_blocks', affected);

  delete from public.notifications where user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('notifications', affected);

  update public.notifications
  set actor_user_id = null
  where actor_user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('notifications_actor_scrubbed', affected);

  delete from public.event_rsvps where user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('event_rsvps', affected);

  delete from public.giving_intents where giver_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('giving_intents', affected);

  delete from public.giving_campaigns where created_by = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('giving_campaigns', affected);

  delete from public.community_post_reactions where author_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('community_post_reactions', affected);

  update public.community_post_comments
  set author_id = null,
      body = 'Deleted comment',
      deleted_at = coalesce(deleted_at, now())
  where author_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('community_post_comments_scrubbed', affected);

  update public.community_posts
  set author_id = null,
      title = 'Deleted post',
      body = null,
      media_url = null,
      media_kind = null,
      storage_path = null,
      file_name = null,
      mime_type = null,
      size_bytes = null,
      is_published = false,
      deleted_at = coalesce(deleted_at, now())
  where author_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('community_posts_scrubbed', affected);

  delete from public.discussion_reports where reporter_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('discussion_reports', affected);

  update public.discussion_replies
  set author_id = null,
      body = 'Deleted reply',
      deleted_at = coalesce(deleted_at, now())
  where author_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('discussion_replies_scrubbed', affected);

  update public.discussion_threads
  set author_id = null,
      title = 'Deleted discussion',
      body = 'Deleted discussion',
      deleted_at = coalesce(deleted_at, now())
  where author_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('discussion_threads_scrubbed', affected);

  if target_profile_id is not null then
    delete from public.prayer_requests where profile_id = target_profile_id;
    get diagnostics affected = row_count;
    result := result || jsonb_build_object('prayer_requests', affected);

    delete from public.profiles where id = target_profile_id;
    get diagnostics affected = row_count;
    result := result || jsonb_build_object('profiles', affected);
  else
    result := result || jsonb_build_object('prayer_requests', 0, 'profiles', 0);
  end if;

  return result;
end;
$$;

revoke execute on function public.delete_user_account_data(uuid) from public;
revoke execute on function public.delete_user_account_data(uuid) from anon;
revoke execute on function public.delete_user_account_data(uuid) from authenticated;
grant execute on function public.delete_user_account_data(uuid) to service_role;
