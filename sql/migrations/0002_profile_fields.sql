-- Phase 2 profile fields.
-- Safe to run after 0001_initial_schema.sql.

alter table public.profiles
  add column if not exists username text,
  add column if not exists favorite_verse text,
  add column if not exists church_name text;

create unique index if not exists profiles_username_unique_idx
on public.profiles (lower(username))
where username is not null and username <> '';
