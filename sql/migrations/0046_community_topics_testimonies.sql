-- Community topics and structured testimonies.
-- Adds focused community spaces without changing existing default feed content.

create table if not exists public.community_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_sensitive boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_topics_slug_not_blank check (length(btrim(slug)) > 0),
  constraint community_topics_name_not_blank check (length(btrim(name)) > 0),
  constraint community_topics_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint community_topics_description_length check (description is null or char_length(description) <= 500)
);

create unique index if not exists community_topics_slug_unique_idx
on public.community_topics (slug);

create index if not exists community_topics_active_sort_idx
on public.community_topics (is_active, sort_order, name);

drop trigger if exists set_community_topics_updated_at on public.community_topics;
create trigger set_community_topics_updated_at
before update on public.community_topics
for each row execute function public.set_updated_at();

create table if not exists public.community_post_topics (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  topic_id uuid not null references public.community_topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, topic_id)
);

create unique index if not exists community_post_topics_one_topic_per_post_idx
on public.community_post_topics (post_id);

create index if not exists community_post_topics_topic_idx
on public.community_post_topics (topic_id, created_at desc);

create table if not exists public.community_testimonies (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.community_topics(id) on delete restrict,
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  what_i_went_through text not null,
  what_happened text,
  what_god_taught_me text,
  where_i_am_now text,
  scripture_reflection text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint community_testimonies_title_not_blank check (length(btrim(title)) > 0),
  constraint community_testimonies_title_length check (char_length(title) <= 160),
  constraint community_testimonies_went_through_not_blank check (length(btrim(what_i_went_through)) > 0),
  constraint community_testimonies_went_through_length check (char_length(what_i_went_through) <= 4000),
  constraint community_testimonies_happened_length check (what_happened is null or char_length(what_happened) <= 4000),
  constraint community_testimonies_taught_length check (what_god_taught_me is null or char_length(what_god_taught_me) <= 4000),
  constraint community_testimonies_now_length check (where_i_am_now is null or char_length(where_i_am_now) <= 4000),
  constraint community_testimonies_scripture_reflection_length check (scripture_reflection is null or char_length(scripture_reflection) <= 2000),
  constraint community_testimonies_has_reflection_check check (
    length(btrim(coalesce(what_happened, ''))) > 0
    or length(btrim(coalesce(what_god_taught_me, ''))) > 0
    or length(btrim(coalesce(where_i_am_now, ''))) > 0
  )
);

create index if not exists community_testimonies_public_topic_idx
on public.community_testimonies (topic_id, created_at desc)
where deleted_at is null and is_published = true;

create index if not exists community_testimonies_author_idx
on public.community_testimonies (author_id, created_at desc);

drop trigger if exists set_community_testimonies_updated_at on public.community_testimonies;
create trigger set_community_testimonies_updated_at
before update on public.community_testimonies
for each row execute function public.set_updated_at();

create table if not exists public.community_testimony_scriptures (
  id uuid primary key default gen_random_uuid(),
  testimony_id uuid not null references public.community_testimonies(id) on delete cascade,
  translation_id text not null,
  book_id text not null,
  chapter integer not null,
  verse_start text,
  verse_end text,
  created_at timestamptz not null default now(),
  constraint community_testimony_scriptures_translation_not_blank check (length(btrim(translation_id)) > 0),
  constraint community_testimony_scriptures_book_not_blank check (length(btrim(book_id)) > 0),
  constraint community_testimony_scriptures_chapter_positive check (chapter > 0),
  constraint community_testimony_scriptures_verse_start_length check (verse_start is null or char_length(verse_start) <= 12),
  constraint community_testimony_scriptures_verse_end_length check (verse_end is null or char_length(verse_end) <= 12),
  unique (testimony_id, translation_id, book_id, chapter, verse_start, verse_end)
);

create index if not exists community_testimony_scriptures_testimony_idx
on public.community_testimony_scriptures (testimony_id, created_at asc);

create table if not exists public.community_testimony_encouragements (
  testimony_id uuid not null references public.community_testimonies(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (testimony_id, author_id)
);

create index if not exists community_testimony_encouragements_author_idx
on public.community_testimony_encouragements (author_id, created_at desc);

create table if not exists public.community_testimony_reports (
  id uuid primary key default gen_random_uuid(),
  testimony_id uuid not null references public.community_testimonies(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint community_testimony_reports_reason_not_blank check (length(btrim(reason)) > 0),
  constraint community_testimony_reports_reason_length check (char_length(reason) <= 160),
  constraint community_testimony_reports_details_length check (details is null or char_length(details) <= 1000),
  constraint community_testimony_reports_status_check check (status in ('open', 'reviewed', 'resolved', 'dismissed'))
);

create index if not exists community_testimony_reports_status_idx
on public.community_testimony_reports (status, created_at desc);

create index if not exists community_testimony_reports_reporter_idx
on public.community_testimony_reports (reporter_id, created_at desc);

create index if not exists community_testimony_reports_testimony_idx
on public.community_testimony_reports (testimony_id, created_at desc);

alter table public.community_topics enable row level security;
alter table public.community_post_topics enable row level security;
alter table public.community_testimonies enable row level security;
alter table public.community_testimony_scriptures enable row level security;
alter table public.community_testimony_encouragements enable row level security;
alter table public.community_testimony_reports enable row level security;

drop policy if exists "Active community topics are publicly readable" on public.community_topics;
create policy "Active community topics are publicly readable"
on public.community_topics for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Platform engineers can manage community topics" on public.community_topics;
create policy "Platform engineers can manage community topics"
on public.community_topics for all
to authenticated
using (public.is_platform_engineer())
with check (public.is_platform_engineer());

drop policy if exists "Public can read visible community post topics" on public.community_post_topics;
create policy "Public can read visible community post topics"
on public.community_post_topics for select
to anon, authenticated
using (
  exists (
    select 1
    from public.community_posts
    join public.churches on churches.id = community_posts.community_id
    join public.community_topics on community_topics.id = community_post_topics.topic_id
    where community_posts.id = community_post_topics.post_id
      and community_posts.deleted_at is null
      and community_posts.is_published = true
      and churches.is_published = true
      and churches.is_default = true
      and community_topics.is_active = true
  )
);

drop policy if exists "Authors can create community post topic links" on public.community_post_topics;
create policy "Authors can create community post topic links"
on public.community_post_topics for insert
to authenticated
with check (
  public.is_not_banned()
  and exists (
    select 1
    from public.community_posts
    join public.community_topics on community_topics.id = community_post_topics.topic_id
    where community_posts.id = community_post_topics.post_id
      and community_posts.author_id = auth.uid()
      and community_posts.community_id = public.default_community_id()
      and community_posts.deleted_at is null
      and community_topics.is_active = true
  )
);

drop policy if exists "Authors and platform can delete community post topic links" on public.community_post_topics;
create policy "Authors and platform can delete community post topic links"
on public.community_post_topics for delete
to authenticated
using (
  public.is_platform_engineer()
  or exists (
    select 1
    from public.community_posts
    where community_posts.id = community_post_topics.post_id
      and community_posts.author_id = auth.uid()
  )
);

drop policy if exists "Public can read published community testimonies" on public.community_testimonies;
create policy "Public can read published community testimonies"
on public.community_testimonies for select
to anon, authenticated
using (
  deleted_at is null
  and is_published = true
  and exists (
    select 1
    from public.community_topics
    where community_topics.id = community_testimonies.topic_id
      and community_topics.is_active = true
  )
);

drop policy if exists "Platform engineers can read all community testimonies" on public.community_testimonies;
create policy "Platform engineers can read all community testimonies"
on public.community_testimonies for select
to authenticated
using (public.is_platform_engineer());

drop policy if exists "Signed-in users can create community testimonies" on public.community_testimonies;
create policy "Signed-in users can create community testimonies"
on public.community_testimonies for insert
to authenticated
with check (
  public.is_not_banned()
  and author_id = auth.uid()
  and exists (
    select 1
    from public.community_topics
    where community_topics.id = community_testimonies.topic_id
      and community_topics.is_active = true
  )
);

drop policy if exists "Authors and platform can update community testimonies" on public.community_testimonies;
create policy "Authors and platform can update community testimonies"
on public.community_testimonies for update
to authenticated
using (
  public.is_platform_engineer()
  or author_id = auth.uid()
)
with check (
  public.is_platform_engineer()
  or author_id = auth.uid()
);

drop policy if exists "Public can read published testimony scriptures" on public.community_testimony_scriptures;
create policy "Public can read published testimony scriptures"
on public.community_testimony_scriptures for select
to anon, authenticated
using (
  exists (
    select 1
    from public.community_testimonies
    where community_testimonies.id = community_testimony_scriptures.testimony_id
      and community_testimonies.deleted_at is null
      and community_testimonies.is_published = true
  )
);

drop policy if exists "Authors and platform can manage testimony scriptures" on public.community_testimony_scriptures;
create policy "Authors and platform can manage testimony scriptures"
on public.community_testimony_scriptures for all
to authenticated
using (
  public.is_platform_engineer()
  or exists (
    select 1
    from public.community_testimonies
    where community_testimonies.id = community_testimony_scriptures.testimony_id
      and community_testimonies.author_id = auth.uid()
  )
)
with check (
  public.is_not_banned()
  and (
    public.is_platform_engineer()
    or exists (
      select 1
      from public.community_testimonies
      where community_testimonies.id = community_testimony_scriptures.testimony_id
        and community_testimonies.author_id = auth.uid()
    )
  )
);

drop policy if exists "Public can read testimony encouragements" on public.community_testimony_encouragements;
create policy "Public can read testimony encouragements"
on public.community_testimony_encouragements for select
to anon, authenticated
using (
  exists (
    select 1
    from public.community_testimonies
    where community_testimonies.id = community_testimony_encouragements.testimony_id
      and community_testimonies.deleted_at is null
      and community_testimonies.is_published = true
  )
);

drop policy if exists "Signed-in users can encourage testimonies" on public.community_testimony_encouragements;
create policy "Signed-in users can encourage testimonies"
on public.community_testimony_encouragements for insert
to authenticated
with check (
  public.is_not_banned()
  and author_id = auth.uid()
  and exists (
    select 1
    from public.community_testimonies
    where community_testimonies.id = community_testimony_encouragements.testimony_id
      and community_testimonies.deleted_at is null
      and community_testimonies.is_published = true
  )
);

drop policy if exists "Users can remove own testimony encouragements" on public.community_testimony_encouragements;
create policy "Users can remove own testimony encouragements"
on public.community_testimony_encouragements for delete
to authenticated
using (
  public.is_platform_engineer()
  or author_id = auth.uid()
);

drop policy if exists "Users can create testimony reports" on public.community_testimony_reports;
create policy "Users can create testimony reports"
on public.community_testimony_reports for insert
to authenticated
with check (
  public.is_not_banned()
  and reporter_id = auth.uid()
  and exists (
    select 1
    from public.community_testimonies
    where community_testimonies.id = community_testimony_reports.testimony_id
      and community_testimonies.deleted_at is null
      and community_testimonies.is_published = true
  )
);

drop policy if exists "Users can read own testimony reports" on public.community_testimony_reports;
create policy "Users can read own testimony reports"
on public.community_testimony_reports for select
to authenticated
using (reporter_id = auth.uid());

drop policy if exists "Platform engineers can manage testimony reports" on public.community_testimony_reports;
create policy "Platform engineers can manage testimony reports"
on public.community_testimony_reports for all
to authenticated
using (public.is_platform_engineer())
with check (public.is_platform_engineer());

insert into public.community_topics (slug, name, sort_order, is_sensitive, is_active)
values
  ('anger', 'Anger', 10, false, true),
  ('depression', 'Depression', 20, false, true),
  ('anxiety-fear', 'Anxiety & Fear', 30, false, true),
  ('sadness', 'Sadness', 40, false, true),
  ('grief', 'Grief', 50, false, true),
  ('loneliness', 'Loneliness', 60, false, true),
  ('ptsd', 'PTSD', 70, true, true),
  ('postpartum-depression-ppd', 'Postpartum Depression (PPD)', 80, true, true),
  ('relationships', 'Relationships', 90, false, true),
  ('forgiveness', 'Forgiveness', 100, false, true),
  ('temptation', 'Temptation', 110, false, true),
  ('faith-doubt', 'Faith & Doubt', 120, false, true),
  ('purpose', 'Purpose', 130, false, true),
  ('family', 'Family', 140, false, true),
  ('financial-struggles', 'Financial Struggles', 150, false, true),
  ('spiritual-growth', 'Spiritual Growth', 160, false, true)
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_sensitive = excluded.is_sensitive,
  is_active = excluded.is_active;

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

  delete from public.community_testimony_encouragements where author_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('community_testimony_encouragements', affected);

  delete from public.community_testimony_reports where reporter_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('community_testimony_reports', affected);

  update public.community_testimonies
  set author_id = null,
      title = 'Deleted testimony',
      what_i_went_through = 'Deleted testimony',
      what_happened = 'Deleted testimony',
      what_god_taught_me = null,
      where_i_am_now = null,
      scripture_reflection = null,
      is_published = false,
      deleted_at = coalesce(deleted_at, now())
  where author_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('community_testimonies_scrubbed', affected);

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
