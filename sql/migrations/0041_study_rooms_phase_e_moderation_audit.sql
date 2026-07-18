-- Study Rooms Phase E moderation audit.
-- Durable, non-sensitive moderation records for Platform report review and room moderation actions.

create table if not exists public.study_room_moderation_audit (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.study_rooms(id) on delete set null,
  report_id uuid references public.study_room_reports(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  note text,
  created_at timestamptz not null default now(),
  constraint study_room_moderation_audit_action_not_blank check (length(btrim(action)) > 0),
  constraint study_room_moderation_audit_action_length check (char_length(action) <= 120),
  constraint study_room_moderation_audit_target_type_check check (target_type in ('room', 'member', 'join_request', 'invitation', 'note', 'thread', 'reply', 'prayer', 'resource', 'report')),
  constraint study_room_moderation_audit_note_length check (note is null or char_length(note) <= 500)
);

create index if not exists study_room_moderation_audit_room_idx
on public.study_room_moderation_audit (room_id, created_at desc);

create index if not exists study_room_moderation_audit_report_idx
on public.study_room_moderation_audit (report_id, created_at desc);

create index if not exists study_room_moderation_audit_actor_idx
on public.study_room_moderation_audit (actor_profile_id, created_at desc);

alter table public.study_room_moderation_audit enable row level security;

drop policy if exists "Platform engineers can read study room moderation audit" on public.study_room_moderation_audit;
create policy "Platform engineers can read study room moderation audit"
on public.study_room_moderation_audit for select
to authenticated
using (public.is_platform_engineer());

drop policy if exists "Service role can manage study room moderation audit" on public.study_room_moderation_audit;
create policy "Service role can manage study room moderation audit"
on public.study_room_moderation_audit for all
to service_role
using (true)
with check (true);
