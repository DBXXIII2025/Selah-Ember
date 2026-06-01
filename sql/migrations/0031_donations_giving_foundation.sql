-- Phase 16 donations and giving foundation.
-- Captures campaign setup and non-payment giving intent drafts only. No live payments.

create table if not exists public.giving_campaigns (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.churches(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  description text,
  goal_amount_cents integer,
  currency text not null default 'usd',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint giving_campaigns_title_not_blank check (length(btrim(title)) > 0),
  constraint giving_campaigns_goal_positive check (goal_amount_cents is null or goal_amount_cents > 0),
  constraint giving_campaigns_currency_check check (currency = lower(currency) and char_length(currency) = 3)
);

create index if not exists giving_campaigns_public_idx
on public.giving_campaigns (community_id, is_active, created_at desc)
where deleted_at is null;

drop trigger if exists set_giving_campaigns_updated_at on public.giving_campaigns;
create trigger set_giving_campaigns_updated_at
before update on public.giving_campaigns
for each row execute function public.set_updated_at();

create table if not exists public.giving_intents (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.churches(id) on delete cascade,
  campaign_id uuid references public.giving_campaigns(id) on delete set null,
  giver_id uuid references auth.users(id) on delete set null,
  amount_cents integer not null,
  currency text not null default 'usd',
  giver_name text,
  giver_email text,
  note text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint giving_intents_amount_positive check (amount_cents > 0),
  constraint giving_intents_currency_check check (currency = lower(currency) and char_length(currency) = 3),
  constraint giving_intents_status_check check (status in ('draft', 'pending', 'completed', 'failed', 'cancelled'))
);

create index if not exists giving_intents_community_idx
on public.giving_intents (community_id, created_at desc);

create index if not exists giving_intents_campaign_idx
on public.giving_intents (campaign_id, created_at desc);

create index if not exists giving_intents_giver_idx
on public.giving_intents (giver_id, created_at desc)
where giver_id is not null;

drop trigger if exists set_giving_intents_updated_at on public.giving_intents;
create trigger set_giving_intents_updated_at
before update on public.giving_intents
for each row execute function public.set_updated_at();

alter table public.giving_campaigns enable row level security;
alter table public.giving_intents enable row level security;

drop policy if exists "Public can read active giving campaigns" on public.giving_campaigns;
create policy "Public can read active giving campaigns"
on public.giving_campaigns for select
to anon, authenticated
using (
  deleted_at is null
  and is_active = true
  and exists (
    select 1
    from public.churches
    where churches.id = giving_campaigns.community_id
      and churches.is_published = true
  )
);

drop policy if exists "Community managers can read all giving campaigns" on public.giving_campaigns;
create policy "Community managers can read all giving campaigns"
on public.giving_campaigns for select
to authenticated
using (public.can_manage_community(community_id));

drop policy if exists "Platform engineers can read all giving campaigns" on public.giving_campaigns;
create policy "Platform engineers can read all giving campaigns"
on public.giving_campaigns for select
to authenticated
using (public.is_platform_engineer());

drop policy if exists "Community managers can create giving campaigns" on public.giving_campaigns;
create policy "Community managers can create giving campaigns"
on public.giving_campaigns for insert
to authenticated
with check (
  public.is_not_banned()
  and created_by = auth.uid()
  and public.can_manage_community(community_id)
);

drop policy if exists "Community managers can update giving campaigns" on public.giving_campaigns;
create policy "Community managers can update giving campaigns"
on public.giving_campaigns for update
to authenticated
using (public.can_manage_community(community_id) or public.is_platform_engineer())
with check (public.can_manage_community(community_id) or public.is_platform_engineer());

drop policy if exists "Community managers can delete giving campaigns" on public.giving_campaigns;
create policy "Community managers can delete giving campaigns"
on public.giving_campaigns for delete
to authenticated
using (public.can_manage_community(community_id) or public.is_platform_engineer());

drop policy if exists "Visitors can create giving intents" on public.giving_intents;
create policy "Visitors can create giving intents"
on public.giving_intents for insert
to anon, authenticated
with check (
  amount_cents > 0
  and status in ('draft', 'pending')
  and (giver_id is null or giver_id = auth.uid())
  and exists (
    select 1
    from public.churches
    where churches.id = giving_intents.community_id
      and churches.is_published = true
  )
  and (
    campaign_id is null
    or exists (
      select 1
      from public.giving_campaigns
      where giving_campaigns.id = giving_intents.campaign_id
        and giving_campaigns.community_id = giving_intents.community_id
        and giving_campaigns.is_active = true
        and giving_campaigns.deleted_at is null
    )
  )
);

drop policy if exists "Community managers can read giving intents" on public.giving_intents;
create policy "Community managers can read giving intents"
on public.giving_intents for select
to authenticated
using (public.can_manage_community(community_id) or public.is_platform_engineer());

drop policy if exists "Givers can read own giving intents" on public.giving_intents;
create policy "Givers can read own giving intents"
on public.giving_intents for select
to authenticated
using (giver_id = auth.uid());
