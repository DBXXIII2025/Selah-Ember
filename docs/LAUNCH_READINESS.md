# Production Launch Readiness and Incident Response

Phase 17 Module 10 baseline date: 2026-07-05.

This is the authoritative go/no-go checklist for a Selah Ember production release. It consolidates the requirements in `DEPLOYMENT.md`, `TESTING.md`, `SECURITY_AUDIT.md`, `STORAGE_SECURITY_AUDIT.md`, and `OBSERVABILITY.md`. Those documents remain the detailed technical evidence; this document controls release approval.

Production deployment is **blocked** until every required gate is marked pass with an owner, UTC completion time, release commit, environment, and evidence link. “Not applicable” requires written approval from the release owner and security owner. A local source review is not evidence of deployed Supabase state.

## Release record

Create one copy of this table in the release ticket. Do not put credentials, tokens, private user content, signed URLs, or direct user identifiers in the ticket.

| Field | Required value |
| --- | --- |
| Release commit | Immutable Git SHA tested and deployed |
| Staging deployment | URL/deployment ID for the same SHA |
| Production deployment | URL/deployment ID after approval |
| Supabase projects | Staging and production project references, proving they are distinct |
| Migration state | Recorded deployed versions through `0037_storage_upload_hardening.sql` |
| Database backup | Backup/snapshot ID and UTC time |
| Restore drill | Last successful isolated restore ID, date, duration, and operator |
| Test evidence | CI run plus authenticated/manual test report |
| Approvers | Release, security, database, operations, and product/privacy owners |
| Change window | Start/end UTC and incident channel/contact |

## Staging verification checklist

Use a production-equivalent, isolated staging Supabase project and disposable test accounts/data. Never point Playwright or destructive tests at production.

### 1. Release integrity and automated verification

- [ ] Freeze the candidate commit. Confirm the worktree is clean and staging is built from that exact SHA.
- [ ] Run `npm ci` from the release commit using the production Node version.
- [ ] Run `npm run lint`; retain the successful output.
- [ ] Run `npm run build` with staging-safe environment values; retain the successful output and inspect it for secrets.
- [ ] Run `npm run test:e2e`; all smoke tests pass.
- [ ] Run `npm run test:a11y`; all automated accessibility tests pass.
- [ ] Confirm the GitHub Actions `Verify` job passes for the release SHA and archive relevant Playwright reports/traces.
- [ ] Run `git diff --check`; it passes.
- [ ] Confirm secret scanning and dependency review have no unaccepted release-blocking findings.
- [ ] Complete the manual authenticated and accessibility coverage deferred by `TESTING.md`, including keyboard, screen-reader, zoom/reflow, reduced-motion, responsive, and role-specific journeys.

The current Playwright suites are read-only and cover primarily public/signed-out behavior. Their success does not replace the authenticated, cross-user, database, Storage, or moderation tests below.

### 2. Environment and provider isolation

- [ ] Staging, preview, and production use distinct Supabase projects or an approved isolation model; previews never use production credentials.
- [ ] `NEXT_PUBLIC_SITE_URL` is `https://selahember.com` for production. `NEXT_PUBLIC_APP_URL` may remain for local/staging compatibility but must not point production metadata or auth callbacks to a Vercel deployment URL.
- [ ] Supabase Auth site URL, allowed redirects, email confirmation, password controls, rate limits, SMTP, CAPTCHA/bot controls, and test providers match the approved environment configuration.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` exists only in server-side environment configuration and is absent from client bundles, browser network responses, logs, CI placeholders, and release artifacts.
- [ ] Required platform engineers are identified out of band and use appropriately protected accounts. No test platform role remains in production.

### 3. Migration `0036` authorization hardening

- [ ] Back up staging, apply the complete ordered migration set through `0036_critical_authorization_hardening.sql`, and confirm the migration history records it exactly once.
- [ ] Confirm trigger `prevent_authenticated_profile_privilege_update` exists and is enabled on `public.profiles`.
- [ ] Confirm `authenticated` has column-level profile update grants only for `display_name`, `avatar_url`, `bio`, `username`, `favorite_verse`, and `church_name`; it has no table-wide profile `UPDATE` grant.
- [ ] Confirm policies `Users can create member community memberships` and `Users can create member group memberships` are the effective insert policies and obsolete permissive insert policies are absent.
- [ ] Review all `platform_engineer` profiles and every non-member or unknown community/group membership against an external authorization record. Do not silently accept or automatically rewrite historical rows.
- [ ] Resolve unauthorized historical rows through the incident/change process, then validate `church_memberships_role_check` and `group_memberships_role_check`.
- [ ] As a normal user through direct Supabase REST/API calls, prove updates to `profiles.role`, `profiles.user_id`, `profiles.id`, and `profiles.created_at` fail and leave rows unchanged. Prove an ordinary allowed profile-field update still succeeds.
- [ ] Prove direct membership inserts fail for caller-selected `owner`, `leader`, unknown roles, and another user's profile. Prove a valid non-banned self-join inserts only `member`.
- [ ] Prove a normal user cannot invoke platform role management, notification composition, sender-selected messaging, or other service-role helpers. Prove a legitimate platform engineer can complete the intended platform workflows.
- [ ] Inspect Server Action manifests/client bundles and confirm raw notification, conversation, and sender-ID service helpers are not exported actions.

### 4. Migration `0037` Storage hardening

- [ ] Back up staging, apply `0037_storage_upload_hardening.sql`, and confirm the migration history records it exactly once after `0036`.
- [ ] Run report-only reconciliation for noncanonical `message_attachments.url`, `community_posts.storage_path`, and `media_items.storage_path` values. Review every exception without automatic repair or deletion.
- [ ] Resolve approved exceptions, then validate `message_attachments_storage_path_check`.
- [ ] Confirm triggers `enforce_community_post_storage_path` and `enforce_media_item_storage_path` exist, are enabled, and have controlled owners and fixed-safe function configuration.
- [ ] Confirm only the final `0037` policies are effective: `Message participants can read active media objects`, `Signed-in users can upload validated feed media`, `Authors and platform can update validated feed media`, `Community owners can upload validated community media`, and `Community owners can update validated community media`. Obsolete policy variants must be absent.
- [ ] Verify legitimate platform-engineer moderation still works through authorized application paths without expanding direct user permissions.

### 5. Supabase RLS, functions, grants, and Storage dashboard

- [ ] Compare deployed migration history and database definitions with every checked-in migration through `0037`; investigate missing, reordered, duplicated, or dashboard-only changes.
- [ ] Confirm RLS is enabled on every application table listed in `SECURITY_AUDIT.md`; inspect effective `pg_policies` roles, commands, `qual`, and `with_check` expressions for unexpected permissive or duplicate policies.
- [ ] Inspect table/column grants for `anon` and `authenticated`. Confirm no unexpected table privileges exist.
- [ ] Inspect security-definer functions, owners, `search_path`, execute grants, and obsolete overloads. Revoke unneeded `PUBLIC`/anon execution through a separately reviewed migration, never an ad hoc production edit.
- [ ] In Storage, confirm exactly four expected buckets and settings: public `profile-avatars` with 5 MB JPEG/PNG/WebP limits; private `message-media`, `community-media`, and `community-feed-media` with the reviewed limits and MIME allowlists.
- [ ] Confirm private buckets fail through public object URLs and `profile-avatars` public access is an explicit approved disclosure.
- [ ] Export and review effective `storage.objects` policies. Reconcile object counts, bytes, MIME, age, canonical path segments, database pointers, orphaned objects, and deleted/unpublished retention without destructive cleanup.
- [ ] Confirm CDN, cache, referrer, signed-URL expiry, and deletion behavior match the approved data classification and retention decisions.

### 6. Cross-user authorization matrix

Use at least anonymous, normal user A, normal user B, member, owner/leader where still applicable, banned user, and platform-engineer personas. Capture pass/fail results without copying identifiers or content into logs/tickets.

- [ ] Anonymous callers can read only approved public surfaces and cannot mutate application rows or private Storage objects.
- [ ] User A cannot read/update/delete user B's private profile fields, prayer requests, notifications, RSVP rows, message conversations/attachments, discussion management actions, or unpublished media.
- [ ] Users cannot forge owner/leader/platform roles, another actor/sender/uploader identity, another parent/community/conversation scope, or another object's stored path.
- [ ] Non-members cannot access group discussions; ordinary members cannot perform owner/leader actions.
- [ ] Normal users cannot access `/platform`, platform messaging/support helpers, moderation actions, role changes, announcements, bans, or typed destructive actions.
- [ ] Banned users are denied every approved mutation surface, including direct API/Storage paths documented in the ban-scope matrix.
- [ ] A legitimate platform engineer retains only the intended moderation/support capabilities and cannot bypass unrelated ownership/privacy rules accidentally.
- [ ] Public disclosure of profile/member fields, event details/counts, campaign totals, and RSVP counts matches recorded product/privacy approval.

### 7. Upload and signed-URL denial tests

- [ ] Verify valid uploads just below every endpoint/application/bucket limit and reject just-above-limit uploads, including multipart overhead.
- [ ] Missing/invalid `Content-Length` receives 411, unauthenticated large upload receives 401, endpoint overage receives 413, and ordinary non-upload Server Actions still work through the production-equivalent proxy.
- [ ] Reject empty files, unsupported types, missing MIME, MIME/extension mismatch, double/mixed-case extensions as applicable, HTML/SVG/executable payloads, malformed media, forged MIME, and known polyglot samples. Record deferred magic-byte/malware limitations.
- [ ] Reject cross-user avatar update/delete, cross-conversation message read/insert/sign, cross-community media/feed update/delete, and banned-user direct uploads.
- [ ] Insert only controlled staging rows that point to another object and prove message, feed, and media signers issue no URL.
- [ ] Soft-delete a message and prove attachments no longer load or receive new signed URLs. Verify old URL expiry and retained-object behavior against the approved retention policy.
- [ ] Force a database failure after upload and an object-delete failure after a database update; verify documented cleanup, logging, and manual recovery behavior.
- [ ] Confirm only published/non-deleted public content receives signed URLs and that one-hour TTL/cache behavior is approved.
- [ ] Exercise bounded concurrent uploads and configured quotas/rate limits without production data.

### 8. Observability privacy and correlation

- [ ] Ordinary responses return a valid `x-selah-request-id`; related server events contain the same request ID and sanitized route.
- [ ] A valid constrained upstream `x-request-id` propagates. Invalid, oversized, or malformed values are replaced.
- [ ] Trigger controlled auth/Supabase unavailability, platform denial, invalid/oversized upload, Storage signing/upload/delete failure, message/media mutation, moderation mutation, route error, and global error events.
- [ ] Confirm event names, levels, status/error codes, bucket, operation, and aggregate fields are searchable JSON.
- [ ] Confirm logs contain no passwords, keys, authorization headers, cookies, tokens, emails, phone numbers, direct user/profile/conversation IDs, IP addresses, content, form bodies, filenames, full object paths, signed URLs, query strings, payment details, raw provider messages, or application-authored stack traces.
- [ ] Search staging logs for sensitive-key terms and representative test values. Investigate every match before approval.
- [ ] Confirm log access is restricted, retention is approved, request-ID searches work, and alert routes reach an assigned responder.

### 9. Functional release journey

- [ ] Complete the current `BETA_CHECKLIST.md` with disposable staging data and at least two normal users plus a legitimate platform engineer.
- [ ] Confirm signup/signin/signout, profile, public discovery/feed, prayer, groups/discussions, events/RSVPs, notifications, messages, media, and platform moderation retain expected behavior.
- [ ] Confirm loading, unavailable, restricted, deleted, archived, error, empty, and branded 404 states reveal no internal details.
- [ ] Confirm checkout/payment behavior is unchanged and no unapproved payment execution is enabled.

## Production deployment checklist

### Go/no-go before change window

- [ ] All staging sections above are pass for the exact release SHA; no evidence refers to an older build or Supabase state.
- [ ] Security, Storage, privacy/product, database, operations, and release owners approve the release record.
- [ ] All critical/high findings are closed or explicitly release-blocking. Medium/deferred risks have owners, due dates, and accepted controls.
- [ ] A fresh production database backup/snapshot is complete and restorable; Storage object inventory and environment/Auth configuration are exported or recorded according to policy.
- [ ] The last isolated restore drill meets the recovery time and recovery point objectives. On-call and rollback decision-makers are available for the full observation window.
- [ ] Production environment values, Auth redirects, domain/DNS/TLS, Supabase project, Vercel project, runtime limits, log retention, alerts, quotas, and rate limits are independently checked by two people.
- [ ] The previous known-good application deployment and its commit SHA are identified. Compatibility with migrations 0036/0037 is confirmed.
- [ ] Change freeze, incident channel, user communication owner, maintenance/status-page plan, and stop conditions are active.

### Deployment sequence

1. Announce the change window and record the pre-deploy health baseline.
2. Confirm the fresh backup completed; do not continue on an unverified or failed backup.
3. Apply ordered, reviewed migrations to production using the approved migration mechanism. Apply 0036 before 0037; never paste selected policy statements independently.
4. Record migration output and verify history, grants, constraints, triggers, functions, policies, and bucket settings using read-only queries/dashboard views.
5. Deploy the exact approved application SHA with production environment configuration. Do not rebuild from an unreviewed worktree.
6. Run non-destructive production smoke checks: homepage/public reads, Auth redirect/sign-in with an approved test account, protected-route guard, one authorized normal-user path, platform denial for a normal user, and platform access for a designated engineer.
7. Verify request-ID propagation and inspect logs/alerts for auth, Supabase, Storage, authorization, upload, UI, and platform failures. Do not run destructive cross-user or upload-abuse tests against production.
8. Observe error rate, latency, auth success, database/Storage health, upload rejection rate, platform failures, and user reports for the approved observation window.
9. Record go/no-go completion and close the window only after metrics remain within the baseline and no security/privacy regression is present.

### Immediate stop conditions

Stop deployment and invoke rollback/incident response for any of the following:

- migration failure, unexpected schema/policy/grant drift, failed constraint validation, or loss of legitimate platform access;
- evidence of cross-user access, privilege escalation, private-object public access, signed-URL confused deputy behavior, secret/PII/content logging, or production data mutation outside the approved change;
- sustained auth, Supabase, Storage, message/media, or elevated application failure rates;
- inability to search logs, route alerts, identify the deployed SHA, or restore from the required backup;
- checkout/payment behavior changes or an unreviewed feature becomes active.

## Rollback procedure

Rollback authority belongs to the incident commander or named release owner. Preserve evidence and record UTC decisions. Never weaken RLS, Storage policies, authorization, or validation as a recovery shortcut.

### Application rollback

1. Stop further deployments and user-facing change activity. Declare the incident if a security, privacy, integrity, or material availability condition exists.
2. Identify the last known-good deployment and verify it is compatible with the already-applied database state. Migrations 0036 and 0037 are security hardening and should remain in place unless a reviewed forward fix or full restore is explicitly approved.
3. Promote/redeploy the known-good immutable artifact using the hosting platform's normal rollback mechanism. Do not change environment values unless the incident is caused by configuration and the correction is independently reviewed.
4. Purge/invalidate caches only when required and approved; assume previously issued signed URLs remain valid until expiry.
5. Repeat the non-destructive production smoke and observability checks. Continue monitoring through the incident observation window.

### Database/Storage recovery

1. Pause affected writes or place the application in the approved safe state when continued writes could worsen corruption or authorization exposure.
2. Prefer a reviewed forward migration for isolated schema/policy defects. Do not manually drop 0036/0037 protections or edit dashboard policies ad hoc.
3. Before any production restore, preserve current logs, migration history, database snapshot, Storage inventory, and incident timeline. Determine the target recovery point and quantify data loss since that point.
4. Restore the selected backup into an isolated project first. Validate integrity, migration state, RLS/policies, Auth linkage, object pointers, critical row counts, and application compatibility.
5. Production restore or project cutover requires database, security, operations, and incident-command approval plus a communication plan. Rotate or rebind credentials if the project endpoint changes.
6. Reconcile Storage separately: a database restore does not prove object bytes, metadata, or signed URLs were restored/revoked. Never bulk-delete or rewrite objects without an approved reconciliation plan.
7. Re-run the full staging authorization/Storage matrix against the recovered environment before reopening writes.

## Backup and restore checklist

- [ ] Document database backup/PITR capabilities, retention, encryption, access control, regions, recovery point objective (RPO), and recovery time objective (RTO) for the actual Supabase plan.
- [ ] Take a pre-migration backup and record its immutable ID/time. Confirm the job completed; “scheduled” is not sufficient.
- [ ] Record Storage bucket configuration, object inventory/checksums or equivalent reconciliation data, Auth settings/providers/redirects, environment configuration names, DNS/TLS configuration, and migration history. Never export secrets into the repository or ticket.
- [ ] Restrict backup and restore privileges, require MFA where available, and audit access. Maintain at least two named restore operators.
- [ ] Perform a restore drill into an isolated non-production project before launch and on the approved recurring schedule.
- [ ] After restore, verify schema/migration versions, constraints, triggers, functions, grants, RLS and Storage policies, platform-engineer roster, Auth-user/profile linkage, critical row counts, object-pointer reconciliation, and representative application journeys.
- [ ] Measure actual RPO/RTO, record discrepancies and remediation owners, then destroy the temporary restored environment and credentials according to policy.
- [ ] Define retention/legal-hold rules for messages, deleted content, uploads, donation/contact data, logs, and backups before destructive cleanup or expiration.

## Monitoring and alert requirements

Before production, runtime JSON logs must be access-controlled, retained, searchable by `event` and `requestId`, and routed to an assigned responder. Establish a staging baseline before setting rate thresholds.

| Signal | Minimum alert expectation | Initial responder |
| --- | --- | --- |
| `auth.session.*unavailable`, callback exchange failures, sign-in failure spike | Sustained rate above baseline; distinguish provider outage from credential failures | Operations/auth owner |
| `supabase.*.unavailable`, database connection/query failure rate | Immediate sustained availability alert | Operations/database owner |
| `storage.sign.failed`, `storage.upload.failed`, `storage.delete.failed` | Burst/rate alert by bucket and operation | Storage owner |
| Repeated upload 411/413/401 rejections or near-limit traffic | Rate/abuse alert by sanitized route; no IP/user logging in application events | Security/operations |
| Authorization denial spike | Rate alert and UI-regression review; a single expected denial is not an incident | Security/application owner |
| Any `platform.*.failed` event | Prompt review with release correlation | Platform/security owner |
| `ui.global.error` or `ui.route.error` | Alert only if an approved browser collector exists; console-only events are not centrally observable today | Application owner |
| Hosting health, latency, 5xx, saturation, Supabase/Auth/Storage provider status | Availability and capacity alerts independent of application logs | Operations |
| Backup failure, missed backup, restore drill/RPO/RTO breach | Immediate operational alert | Database/incident owner |

Test every alert in staging, including delivery, acknowledgement, escalation, quiet-hours coverage, and runbook link. Do not enable session replay, request-body capture, broad breadcrumbs, or automatic PII collection without separate privacy/security approval.

## Incident response checklist

### Detect and declare

1. Record UTC start time, reporter, environment, release SHA, route/symptom, and safe request ID if available.
2. Assign incident commander, operations lead, security/privacy lead, communications owner, and scribe. Select severity using the approved organizational policy.
3. Open a restricted incident channel/ticket. Never request or paste passwords, tokens, cookies, signed URLs, private content, payment details, or unnecessary identifiers.

### Triage and contain

1. Search the request ID, event family, sanitized route, deployment, and narrow time window. Compare with the pre-release baseline and provider status.
2. Classify the failure: auth, database, RLS/authorization, Storage/upload/signing, application mutation, privileged platform action, UI, configuration, or infrastructure.
3. Preserve relevant logs, deployment/configuration history, migration state, snapshots, and Storage inventory before changing state.
4. Contain with the smallest reversible control: stop rollout, roll back compatible application code, disable an affected route through an approved mechanism, revoke/rotate an exposed secret, or pause writes. Do not weaken security controls.
5. If cross-user access, privilege escalation, secret exposure, content/PII logging, or unauthorized data change is suspected, treat it as a security/privacy incident and involve required legal/privacy contacts.

### Recover and validate

1. Apply a reviewed fix or execute the rollback/restore procedure. Require independent review for migration, policy, grant, Auth, environment, or secret changes.
2. Validate in an isolated/staging environment first when time and impact permit, then run targeted production smoke checks without destructive security testing.
3. Confirm error/denial rates, provider health, data integrity, authorization boundaries, request correlation, alert delivery, and user-visible behavior return to baseline.
4. Communicate status and residual impact through approved channels. Keep the incident open through the defined observation period.

### Close and learn

1. Record detection, impact, containment, recovery, affected data/users, evidence, decisions, and final state. Keep sensitive evidence in approved restricted storage.
2. Complete required user/regulatory notifications through legal/privacy owners; do not infer notification obligations ad hoc.
3. Create regression tests, monitoring improvements, and remediation tasks with owners and dates.
4. Hold a blameless review, update this runbook, rotate temporary credentials, dispose of test/incident data safely, and verify backups remain usable.

## Final approval

The release owner may declare **GO** only when all required checks are evidenced and all approvers have signed. Any failed, unknown, stale, or unowned gate is **NO-GO**. If production differs from the approved staging state, return to NO-GO and repeat the affected verification sections.
