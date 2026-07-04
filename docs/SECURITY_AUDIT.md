# Supabase Security and RLS Audit

Phase 17 repository audit date: 2026-07-03.

## Scope and conclusion

This audit covers the Supabase clients, authentication/profile resolution, server actions, public reads, mutations, platform-engineer gates, storage access, and SQL migrations currently in this repository. It is a source audit only: the deployed Supabase catalog, grants, policies, bucket configuration, Auth settings, API logs, and migration history were not queried or changed.

**Production security sign-off: blocked.** The repository contains a critical direct-API privilege-escalation path: an authenticated user can update the `role` column on their own `profiles` row under the existing owner update policy. Because server-side authorization trusts that row, the user can promote themselves to `platform_engineer`. The membership insert policies and several exported service-role helpers also require remediation before production.

No schema, RLS, policy, bucket, or data changes were made during this audit.

## Supabase client and trust-boundary inventory

| Client | Location | Credential/context | Audit result |
| --- | --- | --- | --- |
| Browser client | `lib/supabase/client.ts` | Public URL and anon key | Defined but not imported by current application code. Direct REST/RPC access with the public key remains part of the threat model. |
| Server client | `lib/supabase/server.ts` | Public anon key plus request cookies | Correctly carries the caller session. Used for Auth operations and `auth.getUser()`. |
| Admin client | `lib/supabase/admin.ts` | Service-role key, no persisted session | Server-only in the reviewed imports, but used for most application reads and writes and therefore bypasses RLS. Every caller must enforce authorization itself. |
| Session refresh | `proxy.ts` | Public anon key plus request cookies | Refreshes/verifies the session and forwards the requested pathname. This is not an authorization boundary. |

`SUPABASE_SERVICE_ROLE_KEY` is referenced only by server-side modules and no tracked secret value was found. The public browser client is currently unused, so most UI behavior exercises application checks instead of the RLS policies that direct Supabase API clients exercise.

Profile lookup in `lib/auth/current.ts` first verifies the Auth user with `auth.getUser()`, then uses the admin client to create a missing profile and read the canonical profile. This prevents callers from selecting another profile through the helper, but it makes the integrity of `profiles.role` security-critical. The app layout repeats this admin upsert/read pattern.

## Tables and features audited

Every application table created by the checked-in migrations has an `ENABLE ROW LEVEL SECURITY` statement. Effective deployed state still needs dashboard/catalog verification.

| Feature | Tables | Intended access summary |
| --- | --- | --- |
| Identity and communities | `profiles`, `churches`, `church_memberships` | Own profile; published community discovery; own membership and community ownership checks. |
| Groups | `study_groups`, `group_memberships` | Public group discovery; member/private access; owner/leader management. |
| Prayer and events | `prayer_requests`, `events`, `event_rsvps` | Authenticated public/own prayer reads; public event reads; own RSVP writes. |
| Notifications | `notifications` | Recipient-only reads and read-state updates; inserts are server-side. |
| Platform administration | `platform_settings`, `platform_plans`, `platform_promo_codes`, `platform_direct_message_intents`, `platform_announcements`, `user_bans`, `leader_applications` | Platform-engineer management, plus own active-ban and own application reads where applicable. |
| Messaging | `conversations`, `conversation_participants`, `direct_messages`, `message_attachments`, `message_reports`, `user_blocks`, `message_reactions` | Participant-only reads/writes, own reports/blocks/reactions, platform report review. |
| Discussions | `discussion_threads`, `discussion_replies`, `discussion_reports` | Community/group member access, author soft-delete, member reporting, platform report review. |
| Media and feed | `media_items`, `community_posts`, `community_post_comments`, `community_post_reactions` | Published public reads; manager/author writes; platform moderation. |
| Giving | `giving_campaigns`, `giving_intents` | Public active campaigns and intent creation; manager/platform reads and campaign writes; giver reads own intents. |

## Public read surfaces

Anonymous RLS reads are intentionally present for:

- published `churches`;
- public `study_groups`;
- all `events` (there is no publication predicate);
- published, non-deleted `media_items` belonging to published communities;
- published, non-deleted `community_posts` belonging to published communities;
- non-deleted comments and reactions on published posts in the published default community;
- active, non-deleted `giving_campaigns` belonging to published communities;
- public objects in the `profile-avatars` bucket.

Public application routes also expose community discovery and member counts, group discovery and member counts, the default community feed and comments/reaction totals, recent member display names/avatar URLs/profile creation dates, community media through signed URLs, giving campaigns and completed-gift aggregate totals, and public event details/RSVP aggregate counts. Public pages include `/`, `/discover`, `/discover/groups`, `/c/[slug]`, `/c/[slug]/media`, and `/c/[slug]/give`.

The app performs these reads mainly with the service role. Most functions reproduce the RLS publication filters, but `getPublicCommunityPosts(communityId)` does not verify that the parent community is published, and `getPublicGivingCampaigns(communityId)` does not verify the parent community before returning active campaigns and totals. These exported functions are weaker than the corresponding RLS policies.

Prayer requests are not anonymous at the database layer: non-private prayer requests are readable only to authenticated users. Messaging and discussions are participant/member scoped.

## Authenticated write surfaces

- Auth: signup/signin/signout use the session-aware server client; signup creates the profile with the admin client after Supabase returns the new Auth user.
- Profile: the app scopes profile and avatar updates to the authenticated Auth user. Direct RLS updates are broader and currently include `role`.
- Community/group membership: app join actions force `role = 'member'`; leave actions scope deletes to the current profile and protect owner/leader rows in application code.
- Groups, prayer, and events: create actions write with the admin client. RSVP changes are scoped to the current Auth user.
- Feed/discussions/messages: create, reaction, report, block, and soft-delete actions normally bind author/sender/reporter IDs to the current Auth user and verify membership/participation.
- Notifications: recipient reads and updates are correctly scoped. Notification inserts use a service-role helper.
- Giving intents: anonymous and authenticated callers can create pending intents; campaign management is intended to be platform-only after the open-community pivot.
- Platform administration: settings, plans, promo codes, announcements, roles, destructive content actions, bans, support conversations, and platform reporting use `requirePlatformEngineer()`.

The SQL policies include `is_not_banned()` checks on many direct inserts. Those checks do not apply when a server action uses the service role.

## Owner-only and platform-engineer checks

Application owner/member helpers in `lib/auth/ownership.ts` use the admin client and compare the authenticated profile ID against `created_by` or membership rows. Group management accepts the group creator, a membership role of `owner`/`leader`, or `platform_engineer`. Following the open-community pivot, community management and official event creation return true only for `platform_engineer`.

Owner-scoped server actions generally re-fetch the target and constrain the mutation:

- prayer deletion checks `profile_id` (with platform override);
- event deletion checks `created_by` (with platform override);
- group deletion uses `canManageGroup()`;
- community deletion and legacy leader/media/giving/update actions now require platform access through the shared community-management helpers;
- message deletion binds both conversation participation and `sender_id`;
- discussion deletion binds author unless the caller is a platform engineer;
- feed post/comment deletion binds author unless the caller is a platform engineer.

Platform pages and exported platform mutations call `requirePlatformEngineer()` before service-role access. This gate is structurally consistent, but it is defeated by the current self-service profile role update vulnerability.

## Storage buckets

| Bucket | Visibility | Limits/types in migrations | Access pattern and findings |
| --- | --- | --- | --- |
| `profile-avatars` | Public | 5 MB; JPEG/PNG/WebP | Public read; authenticated path-owner insert/update/delete. App uploads with the service role after image/type/size validation. Old avatar objects are not removed when a new timestamped avatar is uploaded. |
| `message-media` | Private | 250 MB; images/video | Participant read and path-bound uploader insert policies. App uses service-role upload and issues one-hour signed URLs only after conversation-participant checks. No delete policy/workflow was found, so retention/orphan cleanup is deferred. |
| `community-media` | Private | 250 MB; audio/video/PDF/DOC/DOCX | Owner/platform path policies; public published records receive one-hour signed URLs from server code. App validation trusts declared MIME metadata and does not scan content. |
| `community-feed-media` | Private | 250 MB; images/video | Default-community author/platform policies; published feed items receive one-hour signed URLs. App deletes objects on replacement/deletion where possible. |

Bucket configuration is set with `ON CONFLICT DO UPDATE`, but deployed bucket visibility, MIME allowlists, file limits, object policies, and unexpected extra buckets must be checked manually.

## Findings and recommended fixes

### SE-01 — Critical — authenticated users can self-promote to platform engineer

`Profiles are editable by owner` allows an authenticated user to update any column on their row as long as `user_id` remains their Auth UID. Later migrations add `profiles.role` but never narrow the update policy or add a trigger/column privilege that protects it. A direct Supabase API update can set `role = 'platform_engineer'`; all application and SQL platform gates then trust that value.

Recommended fix: before production, add a migration that prevents non-platform callers from changing protected identity columns (`role`, `user_id`, and other server-owned fields). Prefer a narrowly scoped profile-update RPC or explicit column grants plus a trigger enforcing immutable/protected columns. Add a negative RLS test proving a normal authenticated user cannot change `role`, and a positive test for the approved platform role-change path.

### SE-02 — High — membership insert policies accept caller-selected roles

The church and group membership insert policies prove only that the inserted `profile_id` belongs to the caller (plus the ban check). They do not require `role = 'member'`. Neither membership table has a role check constraint. A direct API caller can join with `owner`, `leader`, or any arbitrary role. Forged group leadership satisfies `canManageGroup()`, enables group updates/private discussion access, and is trusted by the service-role group deletion action. Forged church ownership grants ownership/member semantics and private discussion access, even though the current open-community manager helper is platform-only.

Recommended fix: constrain allowed role values at the table level; require self-join inserts to use `member`; separate privileged membership assignment into a manager-only policy/RPC; prevent owner/leader role changes through generic self-service paths; and test direct REST insert attempts for every privileged role.

### SE-03 — High — exported service-role helpers do not bind authority to the caller

`createNotification`, `findDirectConversation`, `createOrGetDirectConversation`, and `insertDirectMessage` are exported from `"use server"` modules and use the service role. They accept user/sender/recipient IDs from arguments without independently authenticating the caller or proving that the supplied actor ID is the caller. They are intended as internal composition helpers, but an exposed/replayed Server Action reference could create arbitrary conversations, impersonate senders, generate notifications, or reveal whether two users share a direct conversation.

Recommended fix: move privileged composition helpers to non-action server-only modules, do not export them as Server Actions, and have every externally callable action resolve its own Auth user. Use a distinct platform-only wrapper for support messaging. Treat action IDs as untrusted and add authorization tests that invoke each mutation directly.

### SE-04 — High — historical platform bootstrap can elevate an unintended sole profile

Migration `0014_platform_engineer_foundation.sql` promotes the sole existing profile to `platform_engineer`. On a fresh or partially populated environment, migration ordering and signup timing could elevate the wrong account.

Recommended fix: verify the deployed platform engineer list explicitly. For future environment creation, replace implicit row-count promotion with a controlled, audited bootstrap procedure and document recovery/rotation.

### SE-05 — Medium — service-role actions bypass database ban enforcement

Several admin-client mutations do not call `assertNotBanned()`, including `createStudyGroup`, `createPrayerRequest`, and `createEvent`. The RLS policies contain `is_not_banned()` checks, but service-role writes bypass them. Some delete/unreact/read-state actions also remain available to banned users; the desired ban scope is not documented.

Recommended fix: define the exact ban contract, centralize a required authenticated mutation guard, apply it to every prohibited server action, and test banned users against both Server Actions and direct Supabase API writes.

### SE-06 — Medium — public service-role reads are broader than matching RLS

`getPublicCommunityPosts(communityId)` and `getPublicGivingCampaigns(communityId)` filter child rows but do not verify that the parent community is published. `getRecentCommunityMembersForPublicPage()` deliberately publishes profile display metadata that RLS otherwise keeps owner/platform-only. Service-role aggregate helpers also count membership/RSVP/giving records beyond what anonymous RLS exposes.

Recommended fix: make each public function enforce the full parent publication predicate, cap caller-controlled limits, explicitly approve the recent-members/profile creation-date exposure, and prefer anon/session clients for public reads so RLS remains the enforcement layer.

### SE-07 — Medium — security-definer RPC arguments are not caller-bound

Several `SECURITY DEFINER` helpers accept arbitrary user/profile IDs. The final three-argument `can_access_group_discussions` ignores `target_auth_user_id`; membership branches do not prove the supplied profile belongs to the current caller. The app currently supplies matched IDs, and RLS calls use `auth.uid()`, but direct RPC calls provide membership/ownership oracles and the functions are unsafe building blocks. The migrations grant execution to `authenticated` without first revoking the PostgreSQL default `PUBLIC` function execute privilege.

Recommended fix: use `auth.uid()` inside client-callable authorization helpers, remove unnecessary identity parameters, revoke execute from `PUBLIC`/`anon`, grant only required signatures, and keep separate service-only helpers in a non-exposed schema. Verify every function's owner, `prosecdef`, `search_path`, and ACL in the deployed catalog.

### SE-08 — Medium — anonymous giving-intent creation lacks abuse controls

Both RLS and the public service-role action allow anonymous creation of pending giving intents containing names, email addresses, and notes. There is no repository-level CAPTCHA, rate limit, idempotency key, maximum amount, or database length constraint for several free-text fields. Payments are not live, but the endpoint can accumulate spam and personal data.

Recommended fix: add edge/app rate limiting and bot protection, strict field and maximum-amount validation, database length constraints, retention/deletion rules, and idempotency before enabling payment processing. Do not treat a client-submitted or pending intent as a completed donation.

### SE-09 — Medium — application authorization and RLS have drifted

The open-community application permits only platform engineers to create official events and manage legacy community media/giving, while some older direct RLS policies still permit community creators or broader authenticated writes. Author update policies for feed posts/comments also permit more column changes than the UI exposes. Broad service-role use hides these mismatches during normal testing.

Recommended fix: define a single authorization matrix, align policies and Server Actions to it, restrict update columns/immutable fields with triggers or narrow RPCs, and run the same negative authorization suite through both the app and Supabase REST/RPC interfaces.

### SE-10 — Low — storage lifecycle and content assurance are incomplete

Private object access and path ownership are generally sound, but MIME checks rely on supplied metadata, signed URLs live for one hour, old avatars and message attachments can become orphaned, and no malware/content scanning or retention process is present.

Recommended fix: inspect file signatures where feasible, add asynchronous scanning for documents/media, shorten signed URL lifetime if product requirements allow, and implement auditable retention/orphan cleanup jobs.

## Manual Supabase dashboard and SQL checks

Perform these checks in a non-production clone first, then repeat read-only in production:

1. Compare the deployed migration history and function definitions with every file through `0035_fix_group_discussion_access_final.sql`; investigate missing, reordered, or dashboard-only SQL.
2. In Table Editor/SQL, confirm RLS is enabled and not forced off for all 32 application tables listed above. Confirm there are no unexpected permissive policies or duplicate historical policies.
3. Inspect grants in `information_schema.role_table_grants` and column grants. In particular, verify whether `authenticated` can update `profiles.role` and whether anon/authenticated have unexpected table privileges.
4. Inspect `pg_policies` for exact `roles`, `cmd`, `qual`, and `with_check` values. Test as anon, a normal user, a group member, a forged-role attacker, a banned user, and a platform engineer.
5. Inspect `pg_proc.prosecdef`, function owners, `proconfig`, and `proacl`. Confirm all security-definer functions have a fixed safe `search_path`, revoke unnecessary `PUBLIC`/anon execute, and identify obsolete overloads left by discussion migrations.
6. Verify the complete `profiles` role distribution and select the intended platform engineers by known Auth UID/email. Review Auth and database audit logs for unexpected historical role changes.
7. Verify Auth settings: email confirmation policy, allowed redirect URLs/site URL, password policy, leaked-password protection if available, signup and OTP rate limits, CAPTCHA/bot protection, SMTP configuration, MFA expectations for platform engineers, and disabled test providers.
8. Verify the service-role secret exists only in server-side production environment variables, is absent from preview/client bundles and logs, and is rotated if it has ever been exposed. Confirm preview environments do not point at production.
9. In Storage, verify exactly the four expected buckets, their public flags, file limits, MIME allowlists, object policies, and object counts. Check for orphaned/stale objects and unexpected public URLs.
10. Review API/Auth/Storage logs for direct role updates, privileged membership inserts, high-volume intent/report/notification creation, repeated signed-URL generation, and access-denied patterns.
11. Verify backups, point-in-time recovery, log retention, incident contacts, and a tested restore procedure before storing donation/contact information.

## Production deployment gates

Production deployment must remain blocked until all of the following are complete:

- SE-01 is fixed and verified with direct REST/RPC negative tests.
- SE-02 and SE-03 are fixed and direct invocation tests prove role, sender, recipient, and platform authority cannot be forged.
- The deployed platform-engineer roster and migration state are manually verified.
- The intended public profile/member, event, campaign-total, and RSVP-count disclosures receive product/privacy approval.
- A ban-scope matrix is approved and enforced consistently for service-role and RLS paths.
- Public giving intents have abuse controls and a documented personal-data retention policy, or the feature is disabled.
- Every table, function, and bucket passes an anon/user/owner/platform/banned-user authorization test matrix against a staging Supabase project built from the migrations.
- Lint, production build, automated tests, secret scanning, dependency review, and `git diff --check` pass on the release commit.
- Production environment separation, Auth redirect URLs, backups/recovery, monitoring/alerts, and service-role rotation procedures are confirmed.

## Deferred items

- This audit does not prove deployed-state parity; dashboard/catalog checks are mandatory.
- No penetration test, dependency vulnerability scan, secret-history scan, load/rate-limit test, file-content scan, privacy/legal review, or payment-provider/webhook review was performed.
- Stripe/payment execution is not implemented. A separate threat model is required before accepting money or treating intents as donations.
- The repository currently has no automated RLS regression suite. Build one before relying on policy changes for production authorization.
