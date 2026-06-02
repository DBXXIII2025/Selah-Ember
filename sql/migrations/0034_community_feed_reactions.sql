-- Community feed stabilization: display metadata support and post reactions.

create table if not exists public.community_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  constraint community_post_reactions_kind_check check (reaction in ('like', 'pray', 'fire', 'laugh')),
  unique (post_id, author_id, reaction)
);

create index if not exists community_post_reactions_post_idx
on public.community_post_reactions (post_id, reaction, created_at desc);

create index if not exists community_post_reactions_author_idx
on public.community_post_reactions (author_id, created_at desc);

alter table public.community_post_reactions enable row level security;

drop policy if exists "Public can read community post reactions" on public.community_post_reactions;
create policy "Public can read community post reactions"
on public.community_post_reactions for select
to anon, authenticated
using (
  exists (
    select 1
    from public.community_posts
    join public.churches on churches.id = community_posts.community_id
    where community_posts.id = community_post_reactions.post_id
      and community_posts.deleted_at is null
      and community_posts.is_published = true
      and churches.is_published = true
      and churches.is_default = true
  )
);

drop policy if exists "Signed-in users can create community post reactions" on public.community_post_reactions;
create policy "Signed-in users can create community post reactions"
on public.community_post_reactions for insert
to authenticated
with check (
  public.is_not_banned()
  and author_id = auth.uid()
  and exists (
    select 1
    from public.community_posts
    where community_posts.id = community_post_reactions.post_id
      and community_posts.deleted_at is null
      and community_posts.is_published = true
      and community_posts.community_id = public.default_community_id()
  )
);

drop policy if exists "Authors and platform can delete community post reactions" on public.community_post_reactions;
create policy "Authors and platform can delete community post reactions"
on public.community_post_reactions for delete
to authenticated
using (
  public.is_platform_engineer()
  or author_id = auth.uid()
);
