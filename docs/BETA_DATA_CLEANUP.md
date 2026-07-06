# Beta 1 Test and Demo Data Cleanup

Prepared for Beta 1 on 2026-07-05. This is a review and execution guide for `sql/manual/cleanup_test_data_before_beta.sql`; it does not authorize deletion by itself.

## Current repository findings

The source repository contains no hard-coded test email addresses, disposable Auth UUIDs, mutable seed fixture set, or authenticated smoke-test accounts. The Playwright smoke and accessibility suites are read-only: they do not create users, submit forms, upload files, or mutate database rows. Therefore no record can be classified as test data from the repository alone.

Two migration-created records are application foundation data and must be preserved:

- the `platform_settings` singleton seeded with the Selah Ember site name;
- the published default community named `Selah Ember Community` with slug `selah-ember-community`.

The cleanup script also refuses to select any `platform_engineer` profile. Legitimate platform engineers, real accounts, real content, the default community, and platform settings are outside cleanup scope.

## Cleanup strategy

The script is manual and fail-closed:

1. Broad matches for words such as test, demo, fixture, Playwright, smoke, or sample are preview-only. Age/month inventories are also preview-only. Neither can delete data.
2. User cleanup requires an exact lowercase Auth email or exact Auth user UUID inserted into `cleanup_user_selectors`.
3. Parent/demo records not attributable to a disposable user require an exact UUID in `cleanup_entity_selectors`.
4. `execute_cleanup` is committed as `false`. The script runs previews and safety assertions, then deliberately raises before the deletion phase.
5. The operator must save and approve the impact counts and Storage manifest, take a backup, change the single flag to `true`, and rerun the complete script in staging.
6. Deletion uses explicit child-before-parent statements inside one transaction. It never deletes `auth.users` or `storage.objects`.

Parent selectors are intentionally strict. A selected community, group, post, discussion, event, giving campaign, or conversation aborts cleanup if deletion would affect a noncandidate member, author, participant, RSVP, prayer request, linked group/event, or giving intent. Do not work around an abort by adding real users to the candidate list. Remove the parent selector and clean only the confirmed test-owned leaf records, or escalate for a record-by-record preservation plan.

## Tables reviewed and potentially affected

The script previews or removes confirmed candidates from:

- identity and memberships: `profiles`, `church_memberships`, `group_memberships`, and `leader_applications`;
- communities and groups: `churches` and `study_groups`;
- discussions: `discussion_threads`, `discussion_replies`, and `discussion_reports`;
- prayer/events: `prayer_requests`, `events`, and `event_rsvps`;
- notifications and moderation: `notifications`, `user_bans`, and `user_blocks`;
- messaging: `conversations`, `conversation_participants`, `direct_messages`, `message_attachments`, `message_reactions`, and `message_reports`;
- community feed: `community_posts`, `community_post_comments`, and `community_post_reactions`;
- media: `media_items`;
- giving: `giving_campaigns` and `giving_intents`;
- explicitly selected platform planning/demo rows: `platform_plans`, `platform_promo_codes`, `platform_announcements`, and `platform_direct_message_intents`.

`auth.users` and Storage objects are previewed/reconciled but must be removed separately after database cleanup verification. `platform_settings` is never deleted.

## Recognition and selector review

Use the first preview queries to build a candidate worksheet. For every proposed user or entity record, record:

- exact Auth email and UUID, or exact entity UUID;
- who created it and why it is known to be disposable;
- creation time and the test/beta activity that produced it;
- related memberships, authored content, messages, uploads, giving records, and real-user interactions;
- reviewer and approval time.

Do not classify a row as test data solely because it is old, has a generic-looking name, uses a common word such as “demo,” or appears in a development screenshot. Confirm ownership through the Supabase Auth user, known test plan, external QA record, or explicit fixture documentation.

The safe workflow is:

1. Run only the recognition queries with selectors empty.
2. Investigate each possible match in Auth, Table Editor, SQL, and Storage.
3. Add exact candidate users to `cleanup_user_selectors` in a working copy of the SQL file. Use one selector per row and a concrete reason.
4. Add exact parent/entity UUIDs only when the entire record is confirmed disposable. Parent IDs are never inferred from names.
5. Leave `execute_cleanup = false` and run the complete script. The final `PREVIEW COMPLETE` exception is expected and proves the deletion section was not reached.
6. Save the exact candidate user list, entity list, per-table impact counts, safety result, and Storage manifest in the restricted cleanup ticket. Do not put message/post content, credentials, tokens, signed URLs, or unnecessary personal data in the ticket.

An unmatched exact selector aborts cleanup. Correct the selector or remove it; never substitute a partial match.

## Backup requirements

Before any staging or production execution with `execute_cleanup = true`:

- confirm the target Supabase project/environment with a second reviewer;
- create a fresh database backup/snapshot and record its immutable ID and UTC completion time;
- confirm the backup completed and is covered by a tested restore procedure; a scheduled backup is not sufficient;
- export or record migration history, Auth configuration, Storage bucket configuration, and a report-only object inventory according to the launch runbook;
- record RPO/RTO, restore operator, cleanup owner, approver, and rollback decision-maker;
- stop if the backup, restore evidence, environment identity, or candidate evidence is missing.

Follow `LAUNCH_READINESS.md` for the isolated restore drill and production recovery requirements. Database restore does not restore or revoke Storage objects automatically; reconcile those separately.

## Staging application procedure

1. Use a production-equivalent staging project restored from an approved sanitized copy or populated with equivalent fixtures.
2. Confirm migrations through `0037_storage_upload_hardening.sql` are applied and the staging application points only to staging.
3. Run the script with empty selectors and `execute_cleanup = false` to validate table/schema compatibility.
4. Add the reviewed exact selectors and rerun with the flag still false. Export all previews and the Storage manifest.
5. Resolve every safety assertion. An assertion is a stop condition, not an invitation to broaden candidate selection.
6. Take a fresh staging backup, change only `execute_cleanup` to `true`, and run the entire script once.
7. Save the returned deletion counts and compare them exactly with the approved preview counts. An unexpected count is an incident and rollback decision point.
8. Keep Auth users and Storage objects unchanged until relational verification passes.

Do not run individual DELETE statements out of order, omit assertions, disable triggers, weaken RLS, use `truncate`, delete all rows by date/name pattern, or paste only the deletion section into the SQL editor.

## Post-cleanup database and application verification

With the same exact selector lists, verify:

- candidate profiles and user-authored leaf records are absent;
- explicitly selected communities, groups, events, conversations, posts, media, campaigns, intents, and platform demo rows are absent;
- no `platform_engineer` profile changed and the approved platform roster is intact;
- the default Selah Ember community and `platform_settings` singleton remain present and functional;
- real account, membership, discussion, prayer, event/RSVP, notification, message, media, community-feed, and giving samples remain unchanged;
- no orphaned database pointers or unexpected null ownership/scope fields were introduced;
- the per-table deletion counts match previewed counts;
- RLS, triggers, constraints, policies, and migration history are unchanged.

Then exercise the staging application:

- signed-out homepage, community feed, discover, groups, Auth pages, metadata endpoints, and 404;
- sign-in and profile for a retained normal user;
- group, discussion, prayer, event/RSVP, notification, message, feed, media, and giving reads for retained records;
- platform denial for a normal user and access for a retained platform engineer;
- structured logs and request IDs, confirming cleanup did not expose deleted content or personal data.

Run `npm run lint`, `npm run build`, `npm run test:e2e`, and `npm run test:a11y` against the release source. Complete the authenticated/manual checks because current Playwright suites do not validate database cleanup.

## Supabase Storage cleanup

The SQL preview emits a Storage manifest for candidate profile avatars, message attachments, community-feed media, and community media. Export it before execution because it is built in temporary tables.

After relational cleanup passes:

1. In Storage, locate each exact bucket/path from the approved manifest. Verify the object still belongs only to a deleted candidate row and is not referenced elsewhere.
2. For `profile-avatars`, resolve `avatar_url` manually. It may be a Supabase public URL or an external URL; never treat the full URL as an object path without parsing and verifying the bucket/project.
3. Delete only exact approved objects from `profile-avatars`, `message-media`, `community-feed-media`, and `community-media`. Do not delete folders/prefixes broadly.
4. Re-run object-to-row reconciliation and record missing, orphaned, shared, malformed, or retained objects. Stop on shared references.
5. Verify private objects are not publicly retrievable, old signed URLs expire as expected, and retained public avatars remain accessible.
6. Record object deletion results separately from database deletion counts. Storage deletion is not transactionally rolled back with SQL.

Objects subject to retention, legal hold, incident evidence preservation, or unresolved ownership must remain until separately approved.

## Supabase Auth cleanup

Auth deletion is intentionally excluded from SQL. After database and Storage verification:

1. Re-open each exact candidate in Supabase Auth and compare its UUID/email to the approved candidate list.
2. Confirm it is not a platform engineer, real beta invitee, shared QA identity still needed, or owner of retained content.
3. Confirm all required relational and Storage cleanup/reconciliation is complete.
4. Delete one Auth user at a time through the approved Supabase Auth administrative workflow. Do not bulk-delete by email pattern or creation date.
5. Verify the deleted account can no longer sign in and that retained users still can.
6. Record the Auth deletion result without copying credentials, tokens, or unnecessary personal data.

If an Auth user must be retained for future QA, leave the user and document the retention decision; do not delete its profile while expecting normal application access.

## Production approval and rollback

Production cleanup is safe to consider only after the identical selector set and script version pass staging, preview/deletion counts match, backup/restore evidence is current, Storage/Auth steps are rehearsed, and database/security/product owners approve.

The SQL phase is transactional and rolls back on an error before commit. After commit, use the launch runbook's database restore procedure if approved; do not recreate rows manually from memory. Auth and Storage deletions occur outside the SQL transaction and require their own recovery/reconciliation plans. Any unexpected real-user impact, platform-access change, count mismatch, shared object, or unknown dependency is a stop condition and incident-response trigger.

## Current apply status

The checked-in script has no deletion selectors and `execute_cleanup` is false. It is therefore safe for source review and preview planning, but it is **not ready to apply with deletion enabled** until exact staging candidates, backups, safety previews, Storage manifest, and approvals are supplied. No cleanup was run while preparing these files.
