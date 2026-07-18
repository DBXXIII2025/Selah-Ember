-- Restrict notification actor scrubbing to trusted account-deletion maintenance.

create or replace function public.prevent_notification_content_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id <> old.user_id
    or new.type <> old.type
    or new.title <> old.title
    or new.body is distinct from old.body
    or new.href is distinct from old.href
    or new.created_at <> old.created_at
  then
    raise exception 'Only notification read state can be updated';
  end if;

  if new.actor_user_id is distinct from old.actor_user_id
    and not (
      old.actor_user_id is not null
      and new.actor_user_id is null
      and current_setting('app.account_deletion_actor_scrub', true) = 'on'
    )
  then
    raise exception 'Only notification read state can be updated';
  end if;

  return new;
end;
$$;

create or replace function public.scrub_deleted_user_notification_actors(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  perform set_config('app.account_deletion_actor_scrub', 'on', true);

  update public.notifications
  set actor_user_id = null
  where actor_user_id = target_user_id;

  get diagnostics affected = row_count;
  perform set_config('app.account_deletion_actor_scrub', '', true);
  return affected;
exception
  when others then
    perform set_config('app.account_deletion_actor_scrub', '', true);
    raise;
end;
$$;

revoke execute on function public.scrub_deleted_user_notification_actors(uuid) from public;
revoke execute on function public.scrub_deleted_user_notification_actors(uuid) from anon;
revoke execute on function public.scrub_deleted_user_notification_actors(uuid) from authenticated;
grant execute on function public.scrub_deleted_user_notification_actors(uuid) to service_role;

create or replace function public.delete_user_account_data(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile_id uuid;
  affected integer;
  study_room_result jsonb := '{}'::jsonb;
  result jsonb := '{}'::jsonb;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  select id
  into target_profile_id
  from public.profiles
  where user_id = target_user_id;

  study_room_result := public.prepare_study_rooms_for_account_deletion(target_user_id, target_profile_id);
  result := result || jsonb_build_object('study_rooms', study_room_result);

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

  affected := public.scrub_deleted_user_notification_actors(target_user_id);
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
