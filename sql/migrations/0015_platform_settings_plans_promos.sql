-- Phase 13 platform settings, plan, promo, and admin messaging foundation.

create table if not exists public.platform_settings (
  id boolean primary key default true,
  site_name text not null default 'Selah Ember',
  site_tagline text,
  logo_url text,
  homepage_announcement text,
  support_contact text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id = true)
);

insert into public.platform_settings (id, site_name, site_tagline)
values (true, 'Selah Ember', 'Faith, Reflection, Community')
on conflict (id) do nothing;

create table if not exists public.platform_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_label text not null,
  description text,
  features text[] not null default '{}',
  is_active boolean not null default true,
  intended_audience text not null default 'individual',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_plans_audience_check check (intended_audience in ('individual', 'church', 'ministry'))
);

create table if not exists public.platform_promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_label text not null,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_direct_message_intents (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  started_by uuid references public.profiles(id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'pending_phase_13_messaging',
  created_at timestamptz not null default now(),
  constraint platform_direct_message_intents_status_check check (
    status in ('pending_phase_13_messaging', 'sent')
  )
);

drop trigger if exists set_platform_settings_updated_at on public.platform_settings;
create trigger set_platform_settings_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_platform_plans_updated_at on public.platform_plans;
create trigger set_platform_plans_updated_at
before update on public.platform_plans
for each row execute function public.set_updated_at();

drop trigger if exists set_platform_promo_codes_updated_at on public.platform_promo_codes;
create trigger set_platform_promo_codes_updated_at
before update on public.platform_promo_codes
for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;
alter table public.platform_plans enable row level security;
alter table public.platform_promo_codes enable row level security;
alter table public.platform_direct_message_intents enable row level security;

drop policy if exists "Platform engineers can manage settings" on public.platform_settings;
create policy "Platform engineers can manage settings"
on public.platform_settings for all
to authenticated
using (public.is_platform_engineer())
with check (public.is_platform_engineer());

drop policy if exists "Platform engineers can manage plans" on public.platform_plans;
create policy "Platform engineers can manage plans"
on public.platform_plans for all
to authenticated
using (public.is_platform_engineer())
with check (public.is_platform_engineer());

drop policy if exists "Platform engineers can manage promo codes" on public.platform_promo_codes;
create policy "Platform engineers can manage promo codes"
on public.platform_promo_codes for all
to authenticated
using (public.is_platform_engineer())
with check (public.is_platform_engineer());

drop policy if exists "Platform engineers can manage direct message intents" on public.platform_direct_message_intents;
create policy "Platform engineers can manage direct message intents"
on public.platform_direct_message_intents for all
to authenticated
using (public.is_platform_engineer())
with check (public.is_platform_engineer());
