-- Selah Ember Beta 1 manual cleanup: obvious test/smoke users only.
--
-- Scope:
-- - Auth emails beginning with phase, design-smoke, or temp-dm.
-- - Explicitly excludes known real accounts.
-- - Does not delete auth.users. Delete Auth users manually only after verification.
-- - Does not delete the default/open community.
-- - Hard-blocks the Beta 1 default/open community:
--   db8815e6-29dc-434e-bf10-fc67301ac08a.
-- - Preserves communities, groups, events, and conversations that include
--   real/noncandidate members, participants, authors, or RSVPs.
--
-- Required workflow:
-- 1. Run with execute_cleanup = false and save all preview output.
-- 2. Review candidate users and impact counts.
-- 3. Confirm backups and approvals.
-- 4. Change only execute_cleanup to true in a working copy, then rerun.
-- 5. Perform the post-cleanup verification queries at the end.
-- 6. Delete exact Auth users manually in Supabase Auth only after relational
--    and Storage verification pass.

begin;

create temp table cleanup_control (
  execute_cleanup boolean not null
) on commit drop;

insert into cleanup_control (execute_cleanup)
values (false);

create temp table excluded_real_emails (
  email text primary key
) on commit drop;

insert into excluded_real_emails (email) values
  ('aclife200024@gmail.com'),
  ('singerofthelord21@gmail.com');

create temp table preserved_community_ids (
  id uuid primary key,
  reason text not null
) on commit drop;

insert into preserved_community_ids (id, reason) values
  ('db8815e6-29dc-434e-bf10-fc67301ac08a', 'Beta 1 default/open community');

create temp table candidate_auth_users on commit drop as
select
  u.id as user_id,
  lower(u.email) as email,
  u.created_at
from auth.users u
where u.email is not null
  and (
    lower(u.email) like 'phase%'
    or lower(u.email) like 'design-smoke%'
    or lower(u.email) like 'temp-dm%'
  )
  and lower(u.email) not in (select email from excluded_real_emails);

create unique index candidate_auth_users_user_idx on candidate_auth_users (user_id);
create unique index candidate_auth_users_email_idx on candidate_auth_users (email);

create temp table candidate_profiles on commit drop as
select p.*
from public.profiles p
join candidate_auth_users c on c.user_id = p.user_id
where p.role <> 'platform_engineer';

create unique index candidate_profiles_id_idx on candidate_profiles (id);
create unique index candidate_profiles_user_idx on candidate_profiles (user_id);

create temp table cleanup_groups on commit drop as
select g.id
from public.study_groups g
join candidate_profiles cp on cp.id = g.created_by
where not exists (
  select 1
  from public.group_memberships gm
  where gm.group_id = g.id
    and gm.profile_id not in (select id from candidate_profiles)
);

create unique index cleanup_groups_id_idx on cleanup_groups (id);

create temp table cleanup_communities on commit drop as
select c.id
from public.churches c
join candidate_profiles cp on cp.id = c.created_by
where coalesce(c.is_default, false) = false
  and c.id not in (select id from preserved_community_ids)
  and not exists (
    select 1
    from public.church_memberships cm
    where cm.church_id = c.id
      and cm.profile_id not in (select id from candidate_profiles)
  )
  and not exists (
    select 1
    from public.study_groups g
    where g.community_id = c.id
      and g.id not in (select id from cleanup_groups)
  )
  and not exists (
    select 1
    from public.community_posts p
    where p.community_id = c.id
      and p.author_id not in (select user_id from candidate_auth_users)
  )
  and not exists (
    select 1
    from public.giving_intents gi
    where gi.community_id = c.id
      and gi.giver_id is not null
      and gi.giver_id not in (select user_id from candidate_auth_users)
  );

create unique index cleanup_communities_id_idx on cleanup_communities (id);

create temp table cleanup_posts on commit drop as
select p.id
from public.community_posts p
where p.author_id in (select user_id from candidate_auth_users)
   or p.community_id in (select id from cleanup_communities);

create unique index cleanup_posts_id_idx on cleanup_posts (id);

create temp table cleanup_events on commit drop as
select e.id
from public.events e
where (
    e.created_by in (select id from candidate_profiles)
    or e.group_id in (select id from cleanup_groups)
    or e.church_id in (select id from cleanup_communities)
  )
  and not exists (
    select 1
    from public.event_rsvps r
    where r.event_id = e.id
      and r.user_id not in (select user_id from candidate_auth_users)
  );

create unique index cleanup_events_id_idx on cleanup_events (id);

create temp table cleanup_conversations on commit drop as
select cp.conversation_id as id
from public.conversation_participants cp
group by cp.conversation_id
having bool_and(cp.user_id in (select user_id from candidate_auth_users));

create unique index cleanup_conversations_id_idx on cleanup_conversations (id);

create temp table cleanup_giving_campaigns on commit drop as
select gc.id
from public.giving_campaigns gc
where gc.created_by in (select user_id from candidate_auth_users)
  and gc.community_id in (select id from cleanup_communities)
  and not exists (
    select 1
    from public.giving_intents gi
    where gi.campaign_id = gc.id
      and gi.giver_id is not null
      and gi.giver_id not in (select user_id from candidate_auth_users)
  );

create unique index cleanup_giving_campaigns_id_idx on cleanup_giving_campaigns (id);

-- Candidate preview.
select 'candidate_auth_users' as preview, user_id, email, created_at
from candidate_auth_users
order by email;

select 'excluded_real_email_check' as preview, e.email, (c.user_id is not null) as incorrectly_selected
from excluded_real_emails e
left join candidate_auth_users c on c.email = e.email;

select 'preserved_community_check' as preview, p.id, p.reason, (c.id is not null) as exists_in_churches
from preserved_community_ids p
left join public.churches c on c.id = p.id;

select 'impact_counts' as preview, *
from (
  select 'profiles' as table_name, count(*)::bigint as rows from candidate_profiles
  union all select 'community_post_reactions', count(*) from public.community_post_reactions where author_id in (select user_id from candidate_auth_users) or post_id in (select id from cleanup_posts)
  union all select 'community_post_comments', count(*) from public.community_post_comments where author_id in (select user_id from candidate_auth_users) or post_id in (select id from cleanup_posts)
  union all select 'community_posts', count(*) from cleanup_posts
  union all select 'event_rsvps', count(*) from public.event_rsvps where user_id in (select user_id from candidate_auth_users) or event_id in (select id from cleanup_events)
  union all select 'events', count(*) from cleanup_events
  union all select 'prayer_requests', count(*) from public.prayer_requests where profile_id in (select id from candidate_profiles) or group_id in (select id from cleanup_groups)
  union all select 'message_reports', count(*) from public.message_reports where reporter_id in (select user_id from candidate_auth_users) or conversation_id in (select id from cleanup_conversations)
  union all select 'message_attachments', count(*) from public.message_attachments where uploader_id in (select user_id from candidate_auth_users) or conversation_id in (select id from cleanup_conversations)
  union all select 'message_reactions', count(*) from public.message_reactions where user_id in (select user_id from candidate_auth_users)
  union all select 'direct_messages', count(*) from public.direct_messages where conversation_id in (select id from cleanup_conversations)
  union all select 'conversation_participants', count(*) from public.conversation_participants where conversation_id in (select id from cleanup_conversations) or user_id in (select user_id from candidate_auth_users)
  union all select 'conversations', count(*) from cleanup_conversations
  union all select 'user_blocks', count(*) from public.user_blocks where blocker_id in (select user_id from candidate_auth_users) or blocked_user_id in (select user_id from candidate_auth_users)
  union all select 'user_bans', count(*) from public.user_bans where banned_user_id in (select user_id from candidate_auth_users)
  union all select 'group_memberships', count(*) from public.group_memberships where profile_id in (select id from candidate_profiles) or group_id in (select id from cleanup_groups)
  union all select 'study_groups', count(*) from cleanup_groups
  union all select 'church_memberships', count(*) from public.church_memberships where profile_id in (select id from candidate_profiles) or church_id in (select id from cleanup_communities)
  union all select 'churches', count(*) from cleanup_communities
  union all select 'giving_intents', count(*) from public.giving_intents where giver_id in (select user_id from candidate_auth_users) or campaign_id in (select id from cleanup_giving_campaigns) or community_id in (select id from cleanup_communities)
  union all select 'giving_campaigns', count(*) from cleanup_giving_campaigns
  union all select 'notifications', count(*) from public.notifications where user_id in (select user_id from candidate_auth_users)
  union all select 'leader_applications', count(*) from public.leader_applications where profile_id in (select id from candidate_profiles)
) counts
order by table_name;

select 'preserved_candidate_owned_groups_with_real_members' as preview, g.id, coalesce(g.title, g.name) as label
from public.study_groups g
join candidate_profiles cp on cp.id = g.created_by
where g.id not in (select id from cleanup_groups)
order by label nulls last, g.id;

select 'preserved_candidate_owned_communities_with_real_dependencies' as preview, c.id, c.name, c.slug, c.is_default
from public.churches c
join candidate_profiles cp on cp.id = c.created_by
where c.id not in (select id from cleanup_communities)
order by c.name, c.id;

select 'manual_auth_deletion_after_sql_verification' as preview, user_id, email
from candidate_auth_users
order by email;

-- Safety assertions. These are stop conditions.
do $$
begin
  if exists (select 1 from candidate_profiles where role = 'platform_engineer') then
    raise exception 'ABORT: platform_engineer profile selected';
  end if;

  if exists (select 1 from candidate_auth_users where email in (select email from excluded_real_emails)) then
    raise exception 'ABORT: explicitly excluded real email selected';
  end if;

  if exists (
    select 1
    from cleanup_communities cc
    join public.churches c on c.id = cc.id
    where c.is_default = true
  ) then
    raise exception 'ABORT: default/open community selected';
  end if;

  if exists (
    select 1
    from cleanup_communities
    where id in (select id from preserved_community_ids)
  ) then
    raise exception 'ABORT: preserved Beta 1 default/open community selected';
  end if;

  if exists (
    select 1
    from cleanup_groups cg
    join public.group_memberships gm on gm.group_id = cg.id
    where gm.profile_id not in (select id from candidate_profiles)
  ) then
    raise exception 'ABORT: cleanup group has noncandidate member';
  end if;

  if exists (
    select 1
    from cleanup_communities cc
    join public.church_memberships cm on cm.church_id = cc.id
    where cm.profile_id not in (select id from candidate_profiles)
  ) then
    raise exception 'ABORT: cleanup community has noncandidate member';
  end if;

  if exists (
    select 1
    from cleanup_conversations c
    join public.conversation_participants cp on cp.conversation_id = c.id
    where cp.user_id not in (select user_id from candidate_auth_users)
  ) then
    raise exception 'ABORT: cleanup conversation has noncandidate participant';
  end if;
end $$;

do $$
begin
  if not (select execute_cleanup from cleanup_control) then
    raise exception 'PREVIEW COMPLETE: no rows deleted. Review counts, backup, then explicitly set execute_cleanup=true.';
  end if;
end $$;

-- Deletion phase. Unreachable while execute_cleanup=false.
delete from public.community_post_reactions
where author_id in (select user_id from candidate_auth_users)
   or post_id in (select id from cleanup_posts);

delete from public.community_post_comments
where author_id in (select user_id from candidate_auth_users)
   or post_id in (select id from cleanup_posts);

delete from public.community_posts
where id in (select id from cleanup_posts);

delete from public.event_rsvps
where user_id in (select user_id from candidate_auth_users)
   or event_id in (select id from cleanup_events);

delete from public.events
where id in (select id from cleanup_events);

delete from public.prayer_requests
where profile_id in (select id from candidate_profiles)
   or group_id in (select id from cleanup_groups);

delete from public.message_reports
where reporter_id in (select user_id from candidate_auth_users)
   or conversation_id in (select id from cleanup_conversations);

delete from public.message_attachments
where uploader_id in (select user_id from candidate_auth_users)
   or conversation_id in (select id from cleanup_conversations);

delete from public.message_reactions
where user_id in (select user_id from candidate_auth_users);

delete from public.direct_messages
where conversation_id in (select id from cleanup_conversations);

delete from public.conversation_participants
where conversation_id in (select id from cleanup_conversations)
   or user_id in (select user_id from candidate_auth_users);

delete from public.conversations
where id in (select id from cleanup_conversations);

delete from public.user_blocks
where blocker_id in (select user_id from candidate_auth_users)
   or blocked_user_id in (select user_id from candidate_auth_users);

delete from public.user_bans
where banned_user_id in (select user_id from candidate_auth_users);

delete from public.giving_intents
where giver_id in (select user_id from candidate_auth_users)
   or campaign_id in (select id from cleanup_giving_campaigns)
   or community_id in (select id from cleanup_communities);

delete from public.giving_campaigns
where id in (select id from cleanup_giving_campaigns);

delete from public.group_memberships
where profile_id in (select id from candidate_profiles)
   or group_id in (select id from cleanup_groups);

delete from public.study_groups
where id in (select id from cleanup_groups);

delete from public.church_memberships
where profile_id in (select id from candidate_profiles)
   or church_id in (select id from cleanup_communities);

delete from public.churches
where id in (select id from cleanup_communities);

delete from public.notifications
where user_id in (select user_id from candidate_auth_users);

delete from public.leader_applications
where profile_id in (select id from candidate_profiles);

delete from public.profiles
where id in (select id from candidate_profiles);

-- Post-cleanup verification. Run after execute_cleanup=true completes.
select 'remaining_test_auth_users' as verification, count(*) as rows
from auth.users u
where u.email is not null
  and (
    lower(u.email) like 'phase%'
    or lower(u.email) like 'design-smoke%'
    or lower(u.email) like 'temp-dm%'
  )
  and lower(u.email) not in (select email from excluded_real_emails);

select 'remaining_candidate_profiles' as verification, count(*) as rows
from public.profiles
where user_id in (select user_id from candidate_auth_users);

select 'remaining_test_profiles' as verification, count(*) as rows
from public.profiles p
join auth.users u on u.id = p.user_id
where u.email is not null
  and (
    lower(u.email) like 'phase%'
    or lower(u.email) like 'design-smoke%'
    or lower(u.email) like 'temp-dm%'
  )
  and lower(u.email) not in (select email from excluded_real_emails);

select 'remaining_test_communities' as verification, count(*) as rows
from public.churches c
join public.profiles p on p.id = c.created_by
join auth.users u on u.id = p.user_id
where u.email is not null
  and (
    lower(u.email) like 'phase%'
    or lower(u.email) like 'design-smoke%'
    or lower(u.email) like 'temp-dm%'
  )
  and lower(u.email) not in (select email from excluded_real_emails)
  and c.id not in (select id from preserved_community_ids);

select 'remaining_test_groups' as verification, count(*) as rows
from public.study_groups g
join public.profiles p on p.id = g.created_by
join auth.users u on u.id = p.user_id
where u.email is not null
  and (
    lower(u.email) like 'phase%'
    or lower(u.email) like 'design-smoke%'
    or lower(u.email) like 'temp-dm%'
  )
  and lower(u.email) not in (select email from excluded_real_emails);

select 'remaining_candidate_auth_users_for_manual_deletion' as verification, user_id, email
from candidate_auth_users
order by email;

select 'default_community_still_present' as verification, count(*) as rows
from public.churches
where is_default = true
  and is_published = true;

select 'preserved_default_community_check' as verification, p.id, p.reason, c.is_default, c.is_published
from preserved_community_ids p
left join public.churches c on c.id = p.id;

select 'real_email_profiles_still_present' as verification, e.email, p.id as profile_id
from excluded_real_emails e
left join auth.users u on lower(u.email) = e.email
left join public.profiles p on p.user_id = u.id
order by e.email;

commit;
