-- Phase 14 community and group discussion threads.
-- Member-scoped text/link discussion surfaces with soft deletes and report foundation.

create table if not exists public.discussion_threads (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null,
  community_id uuid references public.churches(id) on delete cascade,
  group_id uuid references public.study_groups(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint discussion_threads_scope_type_check check (scope_type in ('community', 'group')),
  constraint discussion_threads_scope_check check (
    (scope_type = 'community' and community_id is not null and group_id is null)
    or (scope_type = 'group' and group_id is not null and community_id is null)
  ),
  constraint discussion_threads_title_not_blank check (length(btrim(title)) > 0),
  constraint discussion_threads_title_length check (char_length(title) <= 160),
  constraint discussion_threads_body_not_blank check (length(btrim(body)) > 0),
  constraint discussion_threads_body_length check (char_length(body) <= 10000)
);

create index if not exists discussion_threads_community_idx
on public.discussion_threads (community_id, updated_at desc)
where scope_type = 'community';

create index if not exists discussion_threads_group_idx
on public.discussion_threads (group_id, updated_at desc)
where scope_type = 'group';

create index if not exists discussion_threads_author_idx
on public.discussion_threads (author_id, created_at desc);

create table if not exists public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint discussion_replies_body_not_blank check (length(btrim(body)) > 0),
  constraint discussion_replies_body_length check (char_length(body) <= 10000)
);

create index if not exists discussion_replies_thread_idx
on public.discussion_replies (thread_id, created_at asc);

create index if not exists discussion_replies_author_idx
on public.discussion_replies (author_id, created_at desc);

create table if not exists public.discussion_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.discussion_threads(id) on delete cascade,
  reply_id uuid references public.discussion_replies(id) on delete set null,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  constraint discussion_reports_target_check check (thread_id is not null or reply_id is not null),
  constraint discussion_reports_reason_not_blank check (length(btrim(reason)) > 0),
  constraint discussion_reports_details_length check (details is null or char_length(details) <= 1000)
);

create index if not exists discussion_reports_reporter_idx
on public.discussion_reports (reporter_id, created_at desc);

create index if not exists discussion_reports_thread_idx
on public.discussion_reports (thread_id, created_at desc);

drop trigger if exists set_discussion_threads_updated_at on public.discussion_threads;
create trigger set_discussion_threads_updated_at
before update on public.discussion_threads
for each row execute function public.set_updated_at();

drop trigger if exists set_discussion_replies_updated_at on public.discussion_replies;
create trigger set_discussion_replies_updated_at
before update on public.discussion_replies
for each row execute function public.set_updated_at();

create or replace function public.touch_discussion_thread_on_reply()
returns trigger
language plpgsql
as $$
begin
  update public.discussion_threads
  set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists touch_discussion_thread_after_reply on public.discussion_replies;
create trigger touch_discussion_thread_after_reply
after insert on public.discussion_replies
for each row execute function public.touch_discussion_thread_on_reply();

create or replace function public.is_community_member(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.church_memberships
    join public.profiles on profiles.id = church_memberships.profile_id
    where church_memberships.church_id = target_community_id
      and profiles.user_id = auth.uid()
  );
$$;

create or replace function public.is_study_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_memberships
    join public.profiles on profiles.id = group_memberships.profile_id
    where group_memberships.group_id = target_group_id
      and profiles.user_id = auth.uid()
  );
$$;

create or replace function public.can_read_discussion_thread(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.discussion_threads
    where discussion_threads.id = target_thread_id
      and (
        (discussion_threads.scope_type = 'community' and public.is_community_member(discussion_threads.community_id))
        or (discussion_threads.scope_type = 'group' and public.is_study_group_member(discussion_threads.group_id))
      )
  );
$$;

create or replace function public.prevent_discussion_thread_content_update()
returns trigger
language plpgsql
as $$
begin
  if old.author_id <> new.author_id
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

drop trigger if exists prevent_discussion_thread_content_update on public.discussion_threads;
create trigger prevent_discussion_thread_content_update
before update on public.discussion_threads
for each row execute function public.prevent_discussion_thread_content_update();

create or replace function public.prevent_discussion_reply_content_update()
returns trigger
language plpgsql
as $$
begin
  if old.author_id <> new.author_id
    or old.thread_id <> new.thread_id
    or old.body <> new.body
    or old.created_at <> new.created_at
  then
    raise exception 'Only discussion reply soft-delete metadata can be updated';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_discussion_reply_content_update on public.discussion_replies;
create trigger prevent_discussion_reply_content_update
before update on public.discussion_replies
for each row execute function public.prevent_discussion_reply_content_update();

alter table public.discussion_threads enable row level security;
alter table public.discussion_replies enable row level security;
alter table public.discussion_reports enable row level security;

drop policy if exists "Members can read discussion threads" on public.discussion_threads;
create policy "Members can read discussion threads"
on public.discussion_threads for select
to authenticated
using (
  (scope_type = 'community' and public.is_community_member(community_id))
  or (scope_type = 'group' and public.is_study_group_member(group_id))
);

drop policy if exists "Members can create discussion threads" on public.discussion_threads;
create policy "Members can create discussion threads"
on public.discussion_threads for insert
to authenticated
with check (
  public.is_not_banned()
  and auth.uid() = author_id
  and (
    (scope_type = 'community' and public.is_community_member(community_id))
    or (scope_type = 'group' and public.is_study_group_member(group_id))
  )
);

drop policy if exists "Authors can soft delete own discussion threads" on public.discussion_threads;
create policy "Authors can soft delete own discussion threads"
on public.discussion_threads for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "Members can read discussion replies" on public.discussion_replies;
create policy "Members can read discussion replies"
on public.discussion_replies for select
to authenticated
using (public.can_read_discussion_thread(thread_id));

drop policy if exists "Members can create discussion replies" on public.discussion_replies;
create policy "Members can create discussion replies"
on public.discussion_replies for insert
to authenticated
with check (
  public.is_not_banned()
  and auth.uid() = author_id
  and public.can_read_discussion_thread(thread_id)
  and exists (
    select 1
    from public.discussion_threads
    where discussion_threads.id = discussion_replies.thread_id
      and discussion_threads.deleted_at is null
  )
);

drop policy if exists "Authors can soft delete own discussion replies" on public.discussion_replies;
create policy "Authors can soft delete own discussion replies"
on public.discussion_replies for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "Members can create discussion reports" on public.discussion_reports;
create policy "Members can create discussion reports"
on public.discussion_reports for insert
to authenticated
with check (
  auth.uid() = reporter_id
  and (
    (thread_id is not null and reply_id is null and public.can_read_discussion_thread(thread_id))
    or exists (
      select 1
      from public.discussion_replies
      where discussion_replies.id = discussion_reports.reply_id
        and (discussion_reports.thread_id is null or discussion_reports.thread_id = discussion_replies.thread_id)
        and public.can_read_discussion_thread(discussion_replies.thread_id)
    )
  )
);

drop policy if exists "Users can read own discussion reports" on public.discussion_reports;
create policy "Users can read own discussion reports"
on public.discussion_reports for select
to authenticated
using (auth.uid() = reporter_id);

drop policy if exists "Platform engineers can read discussion reports" on public.discussion_reports;
create policy "Platform engineers can read discussion reports"
on public.discussion_reports for select
to authenticated
using (public.is_platform_engineer());
