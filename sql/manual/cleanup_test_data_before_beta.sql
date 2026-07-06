-- Selah Ember Beta 1 test/demo data cleanup.
-- MANUAL, FAIL-CLOSED SCRIPT. This file is not a migration.
--
-- Safety model:
--   1. Exact selectors are empty in source control. Add only reviewed test/demo IDs.
--   2. Broad email/name searches are preview-only and never drive DELETE statements.
--   3. cleanup_control.execute_cleanup defaults to false and raises before all DELETEs.
--   4. Platform engineers and the seeded default community are hard-blocked.
--   5. Parent deletion is blocked when it would cascade into noncandidate activity.
--   6. Auth users and Storage objects are never deleted by this script.
--
-- Run the entire script in staging first. Save every preview result and the Storage
-- manifest. After review, change the single false value below to true and rerun in
-- staging. Production use requires a fresh backup and the approvals in
-- docs/BETA_DATA_CLEANUP.md.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '5min';

create temp table cleanup_control (
  execute_cleanup boolean not null
) on commit drop;

insert into cleanup_control (execute_cleanup)
values (false); -- CHANGE TO true ONLY AFTER ALL PREVIEWS ARE APPROVED.

-- Exact Auth selectors. Each row must contain exactly one email or user UUID.
-- Never select a platform_engineer. Examples are comments only:
-- insert into cleanup_user_selectors (email, user_id, reason) values
--   ('qa+beta1@example.test', null, 'Disposable Beta 1 QA account'),
--   (null, '00000000-0000-0000-0000-000000000000', 'Disposable local fixture');
create temp table cleanup_user_selectors (
  email text,
  user_id uuid,
  reason text not null,
  constraint cleanup_user_selector_exactly_one check (num_nonnulls(email, user_id) = 1),
  constraint cleanup_user_selector_email_normalized check (email is null or email = lower(btrim(email)))
) on commit drop;

-- Exact entity selectors for demo records that are not safely attributable to a
-- disposable Auth user (for example an anonymous draft giving intent). Discover
-- IDs with the preview queries below, verify each in the Supabase dashboard, then
-- add explicit rows. Supported entity types are intentionally constrained.
-- insert into cleanup_entity_selectors (entity_type, entity_id, reason) values
--   ('community', '00000000-0000-0000-0000-000000000000', 'Old demo community'),
--   ('group', '00000000-0000-0000-0000-000000000000', 'Old fixture group');
create temp table cleanup_entity_selectors (
  entity_type text not null check (entity_type in (
    'community',
    'group',
    'prayer_request',
    'event',
    'conversation',
    'discussion_thread',
    'community_post',
    'media_item',
    'giving_campaign',
    'giving_intent',
    'platform_plan',
    'platform_promo_code',
    'platform_announcement'
  )),
  entity_id uuid not null,
  reason text not null,
  primary key (entity_type, entity_id)
) on commit drop;

-- ---------------------------------------------------------------------------
-- Recognition previews. These queries do not populate deletion candidates.
-- Review false positives and copy only confirmed IDs/emails into exact selectors.
-- The checked-in repository contains no mutating Playwright fixtures, no known
-- test emails, and no disposable user UUIDs. Smoke/a11y tests are read-only.
-- ---------------------------------------------------------------------------

select
  u.id as auth_user_id,
  u.email,
  u.created_at,
  p.id as profile_id,
  p.display_name,
  p.role
from auth.users u
left join public.profiles p on p.user_id = u.id
where lower(coalesce(u.email, '')) ~ '(^|[+._-])(test|demo|sample|fixture|playwright|smoke|qa)([+._@-]|$)'
   or lower(coalesce(u.email, '')) ~ '@(example\.com|example\.test|test\.invalid)$'
   or lower(coalesce(p.display_name, '')) ~ '\m(test|demo|sample|fixture|playwright|smoke)\M'
order by u.created_at, u.id;

select 'community' as entity_type, c.id, c.name as label, c.slug as secondary_label, c.created_at
from public.churches c
where lower(c.name) ~ '\m(test|demo|sample|fixture|playwright|smoke)\M'
   or lower(coalesce(c.slug, '')) ~ '(test|demo|sample|fixture|playwright|smoke)'
union all
select 'group', g.id, coalesce(g.title, g.name), null, g.created_at
from public.study_groups g
where lower(coalesce(g.title, g.name, '')) ~ '\m(test|demo|sample|fixture|playwright|smoke)\M'
union all
select 'event', e.id, e.title, null, e.created_at
from public.events e
where lower(e.title) ~ '\m(test|demo|sample|fixture|playwright|smoke)\M'
union all
select 'prayer_request', p.id, p.title, null, p.created_at
from public.prayer_requests p
where lower(p.title) ~ '\m(test|demo|sample|fixture|playwright|smoke)\M'
union all
select 'discussion_thread', d.id, d.title, d.scope_type, d.created_at
from public.discussion_threads d
where lower(d.title) ~ '\m(test|demo|sample|fixture|playwright|smoke)\M'
union all
select 'community_post', p.id, coalesce(p.title, '(untitled post)'), null, p.created_at
from public.community_posts p
where lower(coalesce(p.title, '')) ~ '\m(test|demo|sample|fixture|playwright|smoke)\M'
union all
select 'media_item', m.id, m.title, m.content_kind, m.created_at
from public.media_items m
where lower(m.title) ~ '\m(test|demo|sample|fixture|playwright|smoke)\M'
union all
select 'giving_campaign', g.id, g.title, null, g.created_at
from public.giving_campaigns g
where lower(g.title) ~ '\m(test|demo|sample|fixture|playwright|smoke)\M'
order by entity_type, created_at, id;

-- Exact email matches for anonymous giving-intent review. These are preview-only.
select id, community_id, campaign_id, giver_id, giver_name, giver_email, status, created_at
from public.giving_intents
where lower(coalesce(giver_email, '')) ~ '(^|[+._-])(test|demo|sample|fixture|playwright|smoke|qa)([+._@-]|$)'
   or lower(coalesce(giver_email, '')) ~ '@(example\.com|example\.test|test\.invalid)$'
order by created_at, id;

-- Age is not proof of test data. This monthly inventory is for manual review only.
select source_table, created_month, row_count
from (
  select 'profiles' as source_table, date_trunc('month', created_at) as created_month, count(*) as row_count from public.profiles group by 1, 2
  union all select 'communities', date_trunc('month', created_at), count(*) from public.churches group by 1, 2
  union all select 'groups', date_trunc('month', created_at), count(*) from public.study_groups group by 1, 2
  union all select 'events', date_trunc('month', created_at), count(*) from public.events group by 1, 2
  union all select 'prayer_requests', date_trunc('month', created_at), count(*) from public.prayer_requests group by 1, 2
  union all select 'conversations', date_trunc('month', created_at), count(*) from public.conversations group by 1, 2
  union all select 'community_posts', date_trunc('month', created_at), count(*) from public.community_posts group by 1, 2
  union all select 'media_items', date_trunc('month', created_at), count(*) from public.media_items group by 1, 2
  union all select 'giving_intents', date_trunc('month', created_at), count(*) from public.giving_intents group by 1, 2
) inventory
order by created_month, source_table;

-- ---------------------------------------------------------------------------
-- Resolve exact selectors into candidate sets.
-- ---------------------------------------------------------------------------

create temp table cleanup_users on commit drop as
select distinct
  u.id as user_id,
  lower(u.email) as email,
  u.created_at,
  s.reason
from cleanup_user_selectors s
join auth.users u
  on (s.user_id is not null and u.id = s.user_id)
  or (s.email is not null and lower(u.email) = s.email);

create unique index cleanup_users_user_id_idx on cleanup_users (user_id);

create temp table cleanup_profiles on commit drop as
select p.id as profile_id, p.user_id, p.display_name, p.role, u.reason
from public.profiles p
join cleanup_users u on u.user_id = p.user_id;

create unique index cleanup_profiles_profile_id_idx on cleanup_profiles (profile_id);

create temp table cleanup_communities on commit drop as
select c.id as community_id, c.name, c.slug, c.is_default, s.reason
from cleanup_entity_selectors s
join public.churches c on c.id = s.entity_id
where s.entity_type = 'community';

create unique index cleanup_communities_id_idx on cleanup_communities (community_id);

create temp table cleanup_groups on commit drop as
select g.id as group_id, coalesce(g.title, g.name) as title, s.reason
from cleanup_entity_selectors s
join public.study_groups g on g.id = s.entity_id
where s.entity_type = 'group';

create unique index cleanup_groups_id_idx on cleanup_groups (group_id);

create temp table cleanup_events on commit drop as
select distinct e.id as event_id
from public.events e
where e.created_by in (select profile_id from cleanup_profiles)
   or e.id in (select entity_id from cleanup_entity_selectors where entity_type = 'event');

create unique index cleanup_events_id_idx on cleanup_events (event_id);

create temp table cleanup_prayer_requests on commit drop as
select distinct p.id as prayer_request_id
from public.prayer_requests p
where p.profile_id in (select profile_id from cleanup_profiles)
   or p.id in (select entity_id from cleanup_entity_selectors where entity_type = 'prayer_request');

create unique index cleanup_prayer_requests_id_idx on cleanup_prayer_requests (prayer_request_id);

create temp table cleanup_threads on commit drop as
select distinct t.id as thread_id
from public.discussion_threads t
where t.author_id in (select user_id from cleanup_users)
   or t.community_id in (select community_id from cleanup_communities)
   or t.group_id in (select group_id from cleanup_groups)
   or t.id in (select entity_id from cleanup_entity_selectors where entity_type = 'discussion_thread');

create unique index cleanup_threads_id_idx on cleanup_threads (thread_id);

create temp table cleanup_posts on commit drop as
select distinct p.id as post_id
from public.community_posts p
where p.author_id in (select user_id from cleanup_users)
   or p.community_id in (select community_id from cleanup_communities)
   or p.id in (select entity_id from cleanup_entity_selectors where entity_type = 'community_post');

create unique index cleanup_posts_id_idx on cleanup_posts (post_id);

create temp table cleanup_media on commit drop as
select distinct m.id as media_id
from public.media_items m
where m.created_by in (select profile_id from cleanup_profiles)
   or m.community_id in (select community_id from cleanup_communities)
   or m.id in (select entity_id from cleanup_entity_selectors where entity_type = 'media_item');

create unique index cleanup_media_id_idx on cleanup_media (media_id);

create temp table cleanup_campaigns on commit drop as
select distinct c.id as campaign_id
from public.giving_campaigns c
where c.created_by in (select user_id from cleanup_users)
   or c.community_id in (select community_id from cleanup_communities)
   or c.id in (select entity_id from cleanup_entity_selectors where entity_type = 'giving_campaign');

create unique index cleanup_campaigns_id_idx on cleanup_campaigns (campaign_id);

create temp table cleanup_giving_intents on commit drop as
select distinct i.id as giving_intent_id
from public.giving_intents i
where i.giver_id in (select user_id from cleanup_users)
   or lower(i.giver_email) in (select email from cleanup_users where email is not null)
   or i.campaign_id in (select campaign_id from cleanup_campaigns)
   or i.community_id in (select community_id from cleanup_communities)
   or i.id in (select entity_id from cleanup_entity_selectors where entity_type = 'giving_intent');

create unique index cleanup_giving_intents_id_idx on cleanup_giving_intents (giving_intent_id);

-- A conversation is automatically selected only when it has at least one
-- participant and every participant is an exact candidate user. Explicitly
-- selected conversations are still rejected below if they contain a real user.
create temp table cleanup_conversations on commit drop as
select c.id as conversation_id
from public.conversations c
where c.id in (select entity_id from cleanup_entity_selectors where entity_type = 'conversation')
   or c.id in (
     select cp.conversation_id
     from public.conversation_participants cp
     group by cp.conversation_id
     having count(*) > 0
        and bool_and(cp.user_id in (select user_id from cleanup_users))
   );

create unique index cleanup_conversations_id_idx on cleanup_conversations (conversation_id);

create temp table cleanup_messages on commit drop as
select distinct m.id as message_id
from public.direct_messages m
where m.sender_id in (select user_id from cleanup_users)
   or m.conversation_id in (select conversation_id from cleanup_conversations);

create unique index cleanup_messages_id_idx on cleanup_messages (message_id);

-- ---------------------------------------------------------------------------
-- Exact candidate previews and impact counts.
-- ---------------------------------------------------------------------------

select s.email as unmatched_email_selector, s.reason
from cleanup_user_selectors s
where s.email is not null
  and not exists (select 1 from cleanup_users u where u.email = s.email);

select s.user_id as unmatched_user_id_selector, s.reason
from cleanup_user_selectors s
where s.user_id is not null
  and not exists (select 1 from cleanup_users u where u.user_id = s.user_id);

select u.user_id, u.email, p.profile_id, p.display_name, p.role, u.reason
from cleanup_users u
left join cleanup_profiles p on p.user_id = u.user_id
order by u.email, u.user_id;

select entity_type, entity_id, reason
from cleanup_entity_selectors
order by entity_type, entity_id;

-- Candidate-owned parent records require an explicit keep/delete decision. If
-- these appear without a matching entity selector, the safety gate aborts rather
-- than deleting the profile and silently orphaning its community/group.
select 'community' as entity_type, c.id, c.name as label, c.created_at
from public.churches c
where c.created_by in (select profile_id from cleanup_profiles)
  and c.id not in (select community_id from cleanup_communities)
union all
select 'group', g.id, coalesce(g.title, g.name), g.created_at
from public.study_groups g
where g.created_by in (select profile_id from cleanup_profiles)
  and g.id not in (select group_id from cleanup_groups)
order by entity_type, created_at, id;

select table_name, candidate_rows
from (
  select 'auth users (manual; not deleted here)' as table_name, count(*)::bigint as candidate_rows from cleanup_users
  union all select 'profiles', count(*) from cleanup_profiles
  union all select 'communities', count(*) from cleanup_communities
  union all select 'groups', count(*) from cleanup_groups
  union all select 'church_memberships', count(*) from public.church_memberships where profile_id in (select profile_id from cleanup_profiles) or church_id in (select community_id from cleanup_communities)
  union all select 'group_memberships', count(*) from public.group_memberships where profile_id in (select profile_id from cleanup_profiles) or group_id in (select group_id from cleanup_groups)
  union all select 'discussion_threads', count(*) from cleanup_threads
  union all select 'discussion_replies', count(*) from public.discussion_replies where author_id in (select user_id from cleanup_users) or thread_id in (select thread_id from cleanup_threads)
  union all select 'discussion_reports', count(*) from public.discussion_reports where reporter_id in (select user_id from cleanup_users) or thread_id in (select thread_id from cleanup_threads) or reply_id in (select id from public.discussion_replies where author_id in (select user_id from cleanup_users) or thread_id in (select thread_id from cleanup_threads))
  union all select 'prayer_requests', count(*) from cleanup_prayer_requests
  union all select 'events', count(*) from cleanup_events
  union all select 'event_rsvps', count(*) from public.event_rsvps where user_id in (select user_id from cleanup_users) or event_id in (select event_id from cleanup_events)
  union all select 'notifications', count(*) from public.notifications where user_id in (select user_id from cleanup_users) or actor_user_id in (select user_id from cleanup_users)
  union all select 'conversations', count(*) from cleanup_conversations
  union all select 'conversation_participants', count(*) from public.conversation_participants where user_id in (select user_id from cleanup_users) or conversation_id in (select conversation_id from cleanup_conversations)
  union all select 'direct_messages', count(*) from cleanup_messages
  union all select 'message_attachments', count(*) from public.message_attachments where uploader_id in (select user_id from cleanup_users) or message_id in (select message_id from cleanup_messages) or conversation_id in (select conversation_id from cleanup_conversations)
  union all select 'message_reactions', count(*) from public.message_reactions where user_id in (select user_id from cleanup_users) or message_id in (select message_id from cleanup_messages)
  union all select 'message_reports', count(*) from public.message_reports where reporter_id in (select user_id from cleanup_users) or message_id in (select message_id from cleanup_messages) or conversation_id in (select conversation_id from cleanup_conversations)
  union all select 'user_blocks', count(*) from public.user_blocks where blocker_id in (select user_id from cleanup_users) or blocked_user_id in (select user_id from cleanup_users)
  union all select 'community_posts', count(*) from cleanup_posts
  union all select 'community_post_comments', count(*) from public.community_post_comments where author_id in (select user_id from cleanup_users) or post_id in (select post_id from cleanup_posts)
  union all select 'community_post_reactions', count(*) from public.community_post_reactions where author_id in (select user_id from cleanup_users) or post_id in (select post_id from cleanup_posts)
  union all select 'media_items', count(*) from cleanup_media
  union all select 'giving_campaigns', count(*) from cleanup_campaigns
  union all select 'giving_intents', count(*) from cleanup_giving_intents
  union all select 'leader_applications', count(*) from public.leader_applications where profile_id in (select profile_id from cleanup_profiles)
  union all select 'platform_plans', count(*) from public.platform_plans where created_by in (select profile_id from cleanup_profiles) or id in (select entity_id from cleanup_entity_selectors where entity_type = 'platform_plan')
  union all select 'platform_promo_codes', count(*) from public.platform_promo_codes where created_by in (select profile_id from cleanup_profiles) or id in (select entity_id from cleanup_entity_selectors where entity_type = 'platform_promo_code')
  union all select 'platform_announcements', count(*) from public.platform_announcements where created_by in (select profile_id from cleanup_profiles) or id in (select entity_id from cleanup_entity_selectors where entity_type = 'platform_announcement')
  union all select 'platform_direct_message_intents', count(*) from public.platform_direct_message_intents where target_user_id in (select user_id from cleanup_users) or started_by in (select profile_id from cleanup_profiles)
  union all select 'user_bans', count(*) from public.user_bans where banned_user_id in (select user_id from cleanup_users) or banned_by in (select profile_id from cleanup_profiles)
) impact
order by table_name;

-- Save this result outside the transaction. Remove these objects manually only
-- after database cleanup succeeds and the references have been rechecked.
select bucket_id, object_path, source_table, source_id, note
from (
  select
    'profile-avatars'::text as bucket_id,
    null::text as object_path,
    'profiles'::text as source_table,
    p.id as source_id,
    'Resolve avatar_url manually; it may be a public URL or external URL: ' || coalesce(p.avatar_url, '(null)') as note
  from public.profiles p
  where p.id in (select profile_id from cleanup_profiles)
    and p.avatar_url is not null
  union all
  select 'message-media', a.url, 'message_attachments', a.id, 'Delete only after confirming the canonical conversation/user path'
  from public.message_attachments a
  where a.kind in ('image', 'video')
    and (
      a.uploader_id in (select user_id from cleanup_users)
      or a.message_id in (select message_id from cleanup_messages)
      or a.conversation_id in (select conversation_id from cleanup_conversations)
    )
  union all
  select 'community-feed-media', p.storage_path, 'community_posts', p.id, 'Delete only the exact reviewed object path'
  from public.community_posts p
  where p.id in (select post_id from cleanup_posts)
    and p.storage_path is not null
  union all
  select 'community-media', m.storage_path, 'media_items', m.id, 'Delete only the exact reviewed object path'
  from public.media_items m
  where m.id in (select media_id from cleanup_media)
    and m.storage_path is not null
) storage_manifest
order by bucket_id, object_path nulls first, source_table, source_id;

-- ---------------------------------------------------------------------------
-- Hard safety assertions. Any hit aborts the transaction before DELETE.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from cleanup_profiles
    where role = 'platform_engineer'
  ) then
    raise exception 'ABORT: a selected user is a platform_engineer';
  end if;

  if exists (
    select 1
    from cleanup_communities
    where is_default = true
  ) then
    raise exception 'ABORT: the seeded default community cannot be selected';
  end if;

  if exists (
    select 1
    from cleanup_user_selectors s
    where not exists (
      select 1 from cleanup_users u
      where u.user_id = s.user_id
         or (s.email is not null and u.email = s.email)
    )
  ) then
    raise exception 'ABORT: one or more exact Auth selectors did not resolve';
  end if;

  if exists (
    select 1
    from cleanup_entity_selectors s
    where (s.entity_type = 'community' and not exists (select 1 from public.churches x where x.id = s.entity_id))
       or (s.entity_type = 'group' and not exists (select 1 from public.study_groups x where x.id = s.entity_id))
       or (s.entity_type = 'prayer_request' and not exists (select 1 from public.prayer_requests x where x.id = s.entity_id))
       or (s.entity_type = 'event' and not exists (select 1 from public.events x where x.id = s.entity_id))
       or (s.entity_type = 'conversation' and not exists (select 1 from public.conversations x where x.id = s.entity_id))
       or (s.entity_type = 'discussion_thread' and not exists (select 1 from public.discussion_threads x where x.id = s.entity_id))
       or (s.entity_type = 'community_post' and not exists (select 1 from public.community_posts x where x.id = s.entity_id))
       or (s.entity_type = 'media_item' and not exists (select 1 from public.media_items x where x.id = s.entity_id))
       or (s.entity_type = 'giving_campaign' and not exists (select 1 from public.giving_campaigns x where x.id = s.entity_id))
       or (s.entity_type = 'giving_intent' and not exists (select 1 from public.giving_intents x where x.id = s.entity_id))
       or (s.entity_type = 'platform_plan' and not exists (select 1 from public.platform_plans x where x.id = s.entity_id))
       or (s.entity_type = 'platform_promo_code' and not exists (select 1 from public.platform_promo_codes x where x.id = s.entity_id))
       or (s.entity_type = 'platform_announcement' and not exists (select 1 from public.platform_announcements x where x.id = s.entity_id))
  ) then
    raise exception 'ABORT: one or more exact entity selectors did not resolve';
  end if;

  -- Explicit parent deletion may cascade. Stop if a noncandidate account has
  -- participated in a selected community, group, post, thread, event, campaign,
  -- or conversation. Review and preserve the real activity instead.
  if exists (
    select 1 from public.church_memberships m
    where m.church_id in (select community_id from cleanup_communities)
      and m.profile_id not in (select profile_id from cleanup_profiles)
  ) then raise exception 'ABORT: selected community has noncandidate memberships'; end if;

  if exists (
    select 1 from public.group_memberships m
    where m.group_id in (select group_id from cleanup_groups)
      and m.profile_id not in (select profile_id from cleanup_profiles)
  ) then raise exception 'ABORT: selected group has noncandidate memberships'; end if;

  if exists (
    select 1 from public.churches c
    where c.created_by in (select profile_id from cleanup_profiles)
      and c.id not in (select community_id from cleanup_communities)
  ) then raise exception 'ABORT: candidate profile owns an unreviewed community; explicitly select it or retain the account'; end if;

  if exists (
    select 1 from public.study_groups g
    where g.created_by in (select profile_id from cleanup_profiles)
      and g.id not in (select group_id from cleanup_groups)
  ) then raise exception 'ABORT: candidate profile owns an unreviewed group; explicitly select it or retain the account'; end if;

  if exists (
    select 1 from public.study_groups g
    where (g.community_id in (select community_id from cleanup_communities)
        or g.church_id in (select community_id from cleanup_communities))
      and g.id not in (select group_id from cleanup_groups)
  ) then raise exception 'ABORT: selected community has a group that was not explicitly selected'; end if;

  if exists (
    select 1 from public.events e
    where (e.community_id in (select community_id from cleanup_communities)
        or e.church_id in (select community_id from cleanup_communities)
        or e.group_id in (select group_id from cleanup_groups))
      and e.id not in (select event_id from cleanup_events)
  ) then raise exception 'ABORT: selected community/group has a noncandidate event'; end if;

  if exists (
    select 1 from public.prayer_requests p
    where (p.community_id in (select community_id from cleanup_communities)
        or p.group_id in (select group_id from cleanup_groups))
      and p.id not in (select prayer_request_id from cleanup_prayer_requests)
  ) then raise exception 'ABORT: selected community/group has a noncandidate prayer request'; end if;

  if exists (
    select 1 from public.community_posts p
    where p.id in (select post_id from cleanup_posts)
      and p.author_id not in (select user_id from cleanup_users)
  ) then raise exception 'ABORT: selected post has a noncandidate author'; end if;

  if exists (
    select 1 from public.community_post_comments c
    where c.post_id in (select post_id from cleanup_posts)
      and c.author_id not in (select user_id from cleanup_users)
  ) or exists (
    select 1 from public.community_post_reactions r
    where r.post_id in (select post_id from cleanup_posts)
      and r.author_id not in (select user_id from cleanup_users)
  ) then raise exception 'ABORT: selected post has noncandidate comments/reactions'; end if;

  if exists (
    select 1 from public.discussion_replies r
    where r.thread_id in (select thread_id from cleanup_threads)
      and r.author_id not in (select user_id from cleanup_users)
  ) then raise exception 'ABORT: selected discussion has noncandidate replies'; end if;

  if exists (
    select 1 from public.discussion_threads t
    where t.id in (select thread_id from cleanup_threads)
      and t.author_id not in (select user_id from cleanup_users)
  ) then raise exception 'ABORT: selected discussion has a noncandidate author'; end if;

  if exists (
    select 1 from public.event_rsvps r
    where r.event_id in (select event_id from cleanup_events)
      and r.user_id not in (select user_id from cleanup_users)
  ) then raise exception 'ABORT: selected event has noncandidate RSVPs'; end if;

  if exists (
    select 1 from public.giving_intents i
    where i.campaign_id in (select campaign_id from cleanup_campaigns)
      and (i.giver_id is null or i.giver_id not in (select user_id from cleanup_users))
  ) then raise exception 'ABORT: selected campaign has anonymous/noncandidate giving intents'; end if;

  if exists (
    select 1 from public.giving_intents i
    where i.community_id in (select community_id from cleanup_communities)
      and (i.giver_id is null or i.giver_id not in (select user_id from cleanup_users))
  ) then raise exception 'ABORT: selected community has anonymous/noncandidate giving intents'; end if;

  if exists (
    select 1 from public.conversation_participants p
    where p.conversation_id in (select conversation_id from cleanup_conversations)
      and p.user_id not in (select user_id from cleanup_users)
  ) then raise exception 'ABORT: selected conversation has noncandidate participants'; end if;

  if exists (
    select 1 from public.media_items m
    where m.community_id in (select community_id from cleanup_communities)
      and m.created_by not in (select profile_id from cleanup_profiles)
  ) or exists (
    select 1 from public.community_posts p
    where p.community_id in (select community_id from cleanup_communities)
      and p.author_id not in (select user_id from cleanup_users)
  ) or exists (
    select 1 from public.giving_campaigns g
    where g.community_id in (select community_id from cleanup_communities)
      and g.created_by not in (select user_id from cleanup_users)
  ) then raise exception 'ABORT: selected community contains noncandidate authored content'; end if;

  if not (select execute_cleanup from cleanup_control) then
    raise exception 'PREVIEW COMPLETE: no rows deleted. Review results, backup, then explicitly set execute_cleanup=true.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Deletion phase. This section is unreachable while execute_cleanup=false.
-- Child rows are removed before parents even where ON DELETE CASCADE exists, so
-- the impact remains reviewable and does not rely on broad implicit cascades.
-- ---------------------------------------------------------------------------

create temp table cleanup_deleted_counts (
  table_name text primary key,
  deleted_rows bigint not null
) on commit drop;

with deleted as (
  delete from public.message_reactions
  where user_id in (select user_id from cleanup_users)
     or message_id in (select message_id from cleanup_messages)
  returning 1
) insert into cleanup_deleted_counts select 'message_reactions', count(*) from deleted;

with deleted as (
  delete from public.message_reports
  where reporter_id in (select user_id from cleanup_users)
     or message_id in (select message_id from cleanup_messages)
     or conversation_id in (select conversation_id from cleanup_conversations)
  returning 1
) insert into cleanup_deleted_counts select 'message_reports', count(*) from deleted;

with deleted as (
  delete from public.message_attachments
  where uploader_id in (select user_id from cleanup_users)
     or message_id in (select message_id from cleanup_messages)
     or conversation_id in (select conversation_id from cleanup_conversations)
  returning 1
) insert into cleanup_deleted_counts select 'message_attachments', count(*) from deleted;

with deleted as (
  delete from public.direct_messages where id in (select message_id from cleanup_messages) returning 1
) insert into cleanup_deleted_counts select 'direct_messages', count(*) from deleted;

with deleted as (
  delete from public.conversation_participants
  where user_id in (select user_id from cleanup_users)
     or conversation_id in (select conversation_id from cleanup_conversations)
  returning 1
) insert into cleanup_deleted_counts select 'conversation_participants', count(*) from deleted;

with deleted as (
  delete from public.conversations where id in (select conversation_id from cleanup_conversations) returning 1
) insert into cleanup_deleted_counts select 'conversations', count(*) from deleted;

with deleted as (
  delete from public.user_blocks
  where blocker_id in (select user_id from cleanup_users)
     or blocked_user_id in (select user_id from cleanup_users)
  returning 1
) insert into cleanup_deleted_counts select 'user_blocks', count(*) from deleted;

with deleted as (
  delete from public.discussion_reports
  where reporter_id in (select user_id from cleanup_users)
     or thread_id in (select thread_id from cleanup_threads)
     or reply_id in (
       select id from public.discussion_replies
       where author_id in (select user_id from cleanup_users)
          or thread_id in (select thread_id from cleanup_threads)
     )
  returning 1
) insert into cleanup_deleted_counts select 'discussion_reports', count(*) from deleted;

with deleted as (
  delete from public.discussion_replies
  where author_id in (select user_id from cleanup_users)
     or thread_id in (select thread_id from cleanup_threads)
  returning 1
) insert into cleanup_deleted_counts select 'discussion_replies', count(*) from deleted;

with deleted as (
  delete from public.discussion_threads where id in (select thread_id from cleanup_threads) returning 1
) insert into cleanup_deleted_counts select 'discussion_threads', count(*) from deleted;

with deleted as (
  delete from public.community_post_reactions
  where author_id in (select user_id from cleanup_users)
     or post_id in (select post_id from cleanup_posts)
  returning 1
) insert into cleanup_deleted_counts select 'community_post_reactions', count(*) from deleted;

with deleted as (
  delete from public.community_post_comments
  where author_id in (select user_id from cleanup_users)
     or post_id in (select post_id from cleanup_posts)
  returning 1
) insert into cleanup_deleted_counts select 'community_post_comments', count(*) from deleted;

with deleted as (
  delete from public.community_posts where id in (select post_id from cleanup_posts) returning 1
) insert into cleanup_deleted_counts select 'community_posts', count(*) from deleted;

with deleted as (
  delete from public.event_rsvps
  where user_id in (select user_id from cleanup_users)
     or event_id in (select event_id from cleanup_events)
  returning 1
) insert into cleanup_deleted_counts select 'event_rsvps', count(*) from deleted;

with deleted as (
  delete from public.events where id in (select event_id from cleanup_events) returning 1
) insert into cleanup_deleted_counts select 'events', count(*) from deleted;

with deleted as (
  delete from public.prayer_requests where id in (select prayer_request_id from cleanup_prayer_requests) returning 1
) insert into cleanup_deleted_counts select 'prayer_requests', count(*) from deleted;

with deleted as (
  delete from public.notifications
  where user_id in (select user_id from cleanup_users)
     or actor_user_id in (select user_id from cleanup_users)
  returning 1
) insert into cleanup_deleted_counts select 'notifications', count(*) from deleted;

with deleted as (
  delete from public.user_bans
  where banned_user_id in (select user_id from cleanup_users)
     or banned_by in (select profile_id from cleanup_profiles)
  returning 1
) insert into cleanup_deleted_counts select 'user_bans', count(*) from deleted;

with deleted as (
  delete from public.leader_applications where profile_id in (select profile_id from cleanup_profiles) returning 1
) insert into cleanup_deleted_counts select 'leader_applications', count(*) from deleted;

with deleted as (
  delete from public.platform_direct_message_intents
  where target_user_id in (select user_id from cleanup_users)
     or started_by in (select profile_id from cleanup_profiles)
  returning 1
) insert into cleanup_deleted_counts select 'platform_direct_message_intents', count(*) from deleted;

with deleted as (
  delete from public.platform_announcements
  where created_by in (select profile_id from cleanup_profiles)
     or id in (select entity_id from cleanup_entity_selectors where entity_type = 'platform_announcement')
  returning 1
) insert into cleanup_deleted_counts select 'platform_announcements', count(*) from deleted;

with deleted as (
  delete from public.platform_promo_codes
  where created_by in (select profile_id from cleanup_profiles)
     or id in (select entity_id from cleanup_entity_selectors where entity_type = 'platform_promo_code')
  returning 1
) insert into cleanup_deleted_counts select 'platform_promo_codes', count(*) from deleted;

with deleted as (
  delete from public.platform_plans
  where created_by in (select profile_id from cleanup_profiles)
     or id in (select entity_id from cleanup_entity_selectors where entity_type = 'platform_plan')
  returning 1
) insert into cleanup_deleted_counts select 'platform_plans', count(*) from deleted;

with deleted as (
  delete from public.giving_intents where id in (select giving_intent_id from cleanup_giving_intents) returning 1
) insert into cleanup_deleted_counts select 'giving_intents', count(*) from deleted;

with deleted as (
  delete from public.giving_campaigns where id in (select campaign_id from cleanup_campaigns) returning 1
) insert into cleanup_deleted_counts select 'giving_campaigns', count(*) from deleted;

with deleted as (
  delete from public.media_items where id in (select media_id from cleanup_media) returning 1
) insert into cleanup_deleted_counts select 'media_items', count(*) from deleted;

with deleted as (
  delete from public.group_memberships
  where profile_id in (select profile_id from cleanup_profiles)
     or group_id in (select group_id from cleanup_groups)
  returning 1
) insert into cleanup_deleted_counts select 'group_memberships', count(*) from deleted;

with deleted as (
  delete from public.church_memberships
  where profile_id in (select profile_id from cleanup_profiles)
     or church_id in (select community_id from cleanup_communities)
  returning 1
) insert into cleanup_deleted_counts select 'church_memberships', count(*) from deleted;

with deleted as (
  delete from public.study_groups where id in (select group_id from cleanup_groups) returning 1
) insert into cleanup_deleted_counts select 'study_groups', count(*) from deleted;

with deleted as (
  delete from public.churches where id in (select community_id from cleanup_communities) returning 1
) insert into cleanup_deleted_counts select 'churches', count(*) from deleted;

-- Delete non-platform profiles last. Auth users remain and must be reviewed/deleted
-- separately in Supabase Auth only after database and Storage verification.
with deleted as (
  delete from public.profiles
  where id in (select profile_id from cleanup_profiles)
    and role <> 'platform_engineer'
  returning 1
) insert into cleanup_deleted_counts select 'profiles', count(*) from deleted;

select table_name, deleted_rows
from cleanup_deleted_counts
order by table_name;

commit;
