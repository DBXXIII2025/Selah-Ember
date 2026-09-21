-- Content discovery and organization. Safe to re-run.
alter table public.community_posts
  add column if not exists is_pinned boolean not null default false;

alter table public.discussion_threads
  add column if not exists category text not null default 'general',
  add column if not exists is_pinned boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'discussion_threads_category_check'
  ) then
    alter table public.discussion_threads
      add constraint discussion_threads_category_check
      check (category in ('general', 'bible_study', 'question', 'prayer', 'testimony', 'fellowship', 'announcement'));
  end if;
end $$;

create index if not exists community_posts_discovery_idx
  on public.community_posts (is_pinned desc, updated_at desc, created_at desc)
  where deleted_at is null and is_published = true;
create index if not exists community_posts_author_created_idx
  on public.community_posts (author_id, created_at desc)
  where deleted_at is null and is_published = true;
create index if not exists discussion_threads_group_discovery_idx
  on public.discussion_threads (group_id, is_pinned desc, updated_at desc, created_at desc)
  where deleted_at is null and scope_type = 'group';
create index if not exists discussion_threads_author_created_idx
  on public.discussion_threads (author_id, created_at desc)
  where deleted_at is null;
create index if not exists discussion_replies_author_created_idx
  on public.discussion_replies (author_id, created_at desc)
  where deleted_at is null;

create or replace function public.protect_content_pin_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile_id uuid;
  actor_role text;
  group_role text;
begin
  if new.is_pinned is not distinct from old.is_pinned then
    return new;
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  select id, role into actor_profile_id, actor_role
  from public.profiles where user_id = auth.uid();

  if actor_role = 'platform_engineer' then
    return new;
  end if;

  if tg_table_name = 'discussion_threads' and old.scope_type = 'group' then
    select role into group_role from public.group_memberships
    where group_id = old.group_id and profile_id = actor_profile_id;
    if group_role in ('owner', 'leader') then
      return new;
    end if;
  end if;

  raise exception 'You are not authorized to change pinned content.' using errcode = '42501';
end;
$$;

drop trigger if exists protect_community_post_pin_changes on public.community_posts;
create trigger protect_community_post_pin_changes
before update of is_pinned on public.community_posts
for each row execute function public.protect_content_pin_changes();

drop trigger if exists protect_discussion_thread_pin_changes on public.discussion_threads;
create trigger protect_discussion_thread_pin_changes
before update of is_pinned on public.discussion_threads
for each row execute function public.protect_content_pin_changes();
