# Security and RLS Review

Historical Phase 12 baseline review date: 2026-05-29.

This document records the Phase 12 policy baseline; it is not a Phase 16 production security sign-off. Re-audit all current migrations, storage policies, server actions, moderation paths, and service-role usage against the deployed Supabase project before launch.

## Server Actions

- Auth actions use Supabase Auth for signup, signin, and signout. Profile creation uses the service role only after Supabase returns the authenticated user context.
- Profile actions require an authenticated user and scope reads and updates to `profiles.user_id = auth.user.id`.
- Community creation, join, and leave actions require an authenticated profile for mutation. Owners are protected from leaving their own community through the normal leave action.
- Group creation, join, and leave actions require an authenticated profile for mutation. Owners/leaders are protected from leaving through the normal leave action.
- Event creation requires an authenticated profile. RSVP create, update, and delete are scoped to the authenticated Supabase user id.
- Notification reads and read-state updates are scoped to the authenticated notification owner. Notification insertion is kept server-side through the service role helper and skips self-notifications.
- Leader dashboard actions verify owner membership before returning management summaries or updating community details.

## RLS Findings

- `profiles`: RLS is enabled. Users can read and update only their own profile row.
- `churches`: Published communities are publicly readable. Authenticated inserts require the created profile to belong to the current user. Updates require owner membership.
- `church_memberships`: Authenticated users can read their own memberships, and owners can read memberships for communities they own. Users can insert their own membership rows and delete only their own non-owner memberships.
- `study_groups`: Public groups are readable by anonymous and authenticated users. Members can read their joined groups. Updates require owner/leader membership.
- `group_memberships`: Authenticated users can read their own memberships, and owners/leaders can read memberships for their groups. Users can insert and delete their own memberships. The app-level leave action prevents owner/leader leave.
- `prayer_requests`: Authenticated users can create, read, update, and delete their own requests. Authenticated users can read non-private prayer requests. Leader summaries only return public prayer requests or the leader's own private requests.
- `events`: Events are publicly readable to support public event detail pages and signed-out RSVP redirect behavior. Authenticated users can create events for their own profile and update/delete events they created.
- `event_rsvps`: Authenticated users can read, create, update, and delete only their own RSVP rows. Duplicate RSVP rows are prevented by a unique constraint.
- `notifications`: Users can read their own notifications and update read state on their own notifications. A trigger prevents content, ownership, and link changes during read-state updates.

## Result

No Phase 12 SQL migration was required. The current policies match the implemented public/protected route behavior without weakening existing protections.
