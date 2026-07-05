# Storage and Upload Security Audit

Phase 17 Module 8 source audit date: 2026-07-04.

## Scope and conclusion

This audit covers every checked-in Supabase Storage bucket, `storage.objects` policy, file input, upload/update/delete path, signed/public URL path, file validation helper, and database row that references stored media. It is a repository audit only. The deployed Supabase bucket catalog, object inventory, policy catalog, logs, and CDN behavior were not queried or changed.

**No critical finding was identified. Production deployment remains blocked by four high-severity findings:** service-role signed-URL helpers trust database object paths that are not always bound to the row owner/scope; the application accepts multipart Server Action bodies up to 250 MB globally; direct community-feed uploads can bypass the 10 MB application image limit; and deleted message attachments remain stored and can still be authorized/read.

The initial audit made no code, schema, RLS, storage policy, bucket, or data changes. The follow-up remediation below changes code and prepares an unapplied migration; it does not mutate production data.

## High-finding remediation status

Phase 17 follow-up remediation is prepared in application code and isolated migration `0037_storage_upload_hardening.sql`. It is not effective in a Supabase environment until the migration is applied and staging verification passes.

- **STOR-01 resolved in source:** every message, feed, and community-media signer now verifies the canonical `{scope_id}/{owner_user_id}/{filename}` path before using the service role. A new database constraint binds message pointers, and column-specific triggers bind feed/community-media pointers without blocking unrelated moderation or soft-delete updates to historical rows.
- **STOR-02 reduced to a bounded authenticated upload surface:** `proxy.ts` rejects missing/invalid content lengths, applies a 2 MB default Server Action limit, a 6 MB profile limit, and a 252 MiB allowance only on authenticated message/feed/media upload routes. The larger Next.js setting is now only a final parser ceiling. Supported 250 MiB video uploads retain multipart overhead.
- **STOR-03 resolved in source:** deleted messages are excluded from attachment loading/signing. The message-media select policy now requires a canonical attachment row joined to a non-deleted direct message, in addition to conversation participation. Objects remain retained pending the medium-severity lifecycle policy, but no new read authorization is granted after message deletion.
- **STOR-04 resolved in source:** final feed insert/update policies enforce 10 MB image and 250 MiB video limits plus the existing MIME allowlist. Community-media policy limits now also match 100 MB audio and 25 MB document application limits.

Deployment remains blocked until `0037` is applied in staging, existing noncanonical pointers are reviewed, the message-attachment constraint is validated, and the direct Storage/Server Action negative tests pass.

### Remediation migration and manual steps

1. Apply `0037_storage_upload_hardening.sql` in a staging Supabase project with production-equivalent Storage settings.
2. Before validating the constraint, run report-only queries for noncanonical paths in `message_attachments`, `community_posts`, and `media_items`. Review every mismatch; do not automatically rewrite or delete production objects.
3. After authorized message-attachment exceptions are resolved, validate the `NOT VALID` constraint:

   ```sql
   alter table public.message_attachments
     validate constraint message_attachments_storage_path_check;
   ```

4. Verify the `enforce_community_post_storage_path` and `enforce_media_item_storage_path` triggers are enabled and their function owners are controlled database roles. Confirm existing platform engineers can still update/delete moderated media through the application.
5. Confirm the old message select, feed insert/update, and community-media insert/update policy names are absent and only the `0037` replacements are effective.
6. Test valid browser-generated multipart requests include `Content-Length` in every supported production runtime/proxy. Confirm missing length receives 411, unauthenticated large requests receive 401, endpoint overages receive 413, and ordinary non-upload actions remain functional.
7. Do not validate the constraint or deploy to production until the staging checklist in this document passes.

## Buckets found

| Bucket | Migration | Public | Bucket limit | Bucket MIME allowlist | Read behavior |
| --- | --- | ---: | ---: | --- | --- |
| `profile-avatars` | `0013_profile_avatar_storage.sql` | Yes | 5 MB | JPEG, PNG, WebP | Anonymous/authenticated public object reads and permanent public URLs. |
| `message-media` | `0018_message_media_links.sql` | No | 250 MB | JPEG, PNG, WebP, GIF, MP4, WebM, QuickTime | Conversation participants can read objects whose first path segment is their conversation ID. The app also returns one-hour signed URLs. |
| `community-media` | `0029_sermons_media_library.sql` | No | 250 MB | MP3/M4A/WAV, MP4/WebM/QuickTime, PDF/DOC/DOCX | No direct object-select policy was found. The server signs stored paths for authorized management views and for published media in published communities. |
| `community-feed-media` | `0030` and final policy replacement in `0033_open_community_platform.sql` | No | 250 MB | JPEG, PNG, WebP, GIF, MP4, WebM, QuickTime | No direct object-select policy was found. The server signs paths for published feed posts and authorized management views. |

The migrations use `insert ... on conflict do update`, so applying them resets the expected public flag, bucket size limit, and MIME allowlist. Deployed state must still be confirmed manually because dashboard-only changes and extra buckets are outside this source audit.

## Upload surfaces found

| Surface | Bucket/path | Who may upload through the app | Application validation | Cleanup behavior |
| --- | --- | --- | --- | --- |
| Profile avatar | `profile-avatars/{auth_user_id}/avatar-{timestamp}.{ext}` | Current authenticated user | Image MIME plus matching extension; non-empty; 5 MB | No previous-avatar deletion. If profile update fails after upload, the new object is not removed. |
| Direct-message image/video | `message-media/{conversation_id}/{auth_user_id}/{timestamp}-{sanitized_name}` | Authenticated, non-banned conversation participant not blocked by the recipient | Image: JPEG/PNG/WebP/GIF, matching extension, 10 MB. Video: MP4/WebM/QuickTime, matching extension, 250 MB. | No object deletion path. Upload is not rolled back if message or attachment-row creation fails. Soft-deleted messages retain attachments. |
| Community media library | `community-media/{community_id}/{auth_user_id}/{timestamp}-{sanitized_name}` | Current community manager; after the open-platform pivot this app gate is `platform_engineer` | Audio: MP3/M4A/WAV, 100 MB. Video: MP4/WebM/MOV, 250 MB. Document: PDF/DOC/DOCX, 25 MB. MIME and extension must both match. | New upload is removed if row create/update fails. Replaced/removed files are deleted best-effort after the database update. Delete failures are logged but not retried. |
| Open community feed | `community-feed-media/{default_community_id}/{auth_user_id}/{timestamp}-{sanitized_name}` | Any authenticated, non-banned user | Image: JPEG/PNG/WebP/GIF, 10 MB. Video: MP4/WebM/MOV, 250 MB. MIME and extension must both match. | Failed row writes remove the new object. Public post soft-delete does not delete the object. |
| Official/legacy updates | Same `community-feed-media` layout | Current community manager/platform engineer | Same image/video validation as open feed | Replacement deletes the old object best-effort. Soft-delete does not delete the object. |

No event image upload, giving-campaign image/media upload, group image upload, or community-banner upload is implemented. Events and giving campaigns have no stored-media fields in the reviewed code. Community `banner_url` is a caller-supplied external string, not a Supabase upload.

## Validation behavior

Shared validation in `lib/media/validation.ts` checks the browser/server-provided `File.type`, filename extension, non-zero length, and byte length. Filenames used in object paths are reduced to letters, digits, dot, underscore, and hyphen and capped at 120 characters. Profile avatar paths do not include the original basename. Uploads set `contentType` from `File.type` and do not overwrite existing paths except that avatar upload passes `upsert: true` while still generating a new timestamped name.

Validation does **not** inspect magic bytes, decode images, parse media containers, scan documents for malware/macros, strip image metadata, normalize filenames to a single extension derived from verified content, or quarantine uploads. Supabase bucket allowlists and the message object policy also trust object metadata MIME values rather than content signatures.

The UI avatar picker matches the bucket and accepts JPEG/PNG/WebP. The shared image validator also accepts GIF, so a crafted avatar Server Action request passes application validation and then fails at the bucket allowlist. Media-library and official-update file inputs do not set an `accept` attribute; their server-side validation remains authoritative.

`next.config.ts` raises the global Server Action body limit to 250 MB. Multipart data must reach and be parsed by the application before action-level authentication, ownership, MIME, and size checks execute. Multipart overhead also means a nominal 250 MiB video may exceed the configured request limit.

## Ownership and authorization rules

### Application paths

- Avatar upload resolves the caller with `auth.getUser()` and always constructs the first path segment from that Auth UID.
- Message upload verifies current-user conversation participation before upload and constructs both conversation and user path segments server-side.
- Community media create/update/delete requires the canonical current profile, ban check, target community lookup, and `canCreateEvent()`; this currently resolves to platform-engineer access.
- Feed upload resolves the default published community server-side for ordinary users. Official update upload requires the platform/community manager gate.
- Media replacement and deletion read the stored path only after target authorization. The service-role client performs all app uploads/deletes, so Storage RLS is bypassed and these application checks are security boundaries.

### Storage policies

- Avatar insert/update/delete requires the first folder segment to equal `auth.uid()`; reads are public.
- Message-media select requires membership in the conversation named by folder segment one. Insert additionally requires folder segment two to equal `auth.uid()`, a non-banned caller, participant access, an allowed metadata MIME, and either a 10 MB image or 250 MB video limit. There is no update or delete policy.
- Community-media insert/update/delete requires a UUID community segment, caller UID segment, and either platform-engineer or community-creator status. There is no metadata size/MIME predicate beyond the bucket-wide settings and no object-select policy.
- Final feed insert requires the published default community segment, caller UID segment, and a non-banned caller. Final update/delete permits a platform engineer or a caller whose UID matches folder segment two. There is no per-type metadata size predicate and no object-select policy.

Platform moderation is implemented primarily through authorized Server Actions plus the service role. Feed Storage policies also allow platform engineers to update/delete objects across uploader folders. Community-media policies still require folder segment two to equal the platform engineer's own UID even in the platform branch, so direct Storage API moderation of another user's object is not available; the server-side service-role path is required.

## URL behavior

- Avatar URLs are permanent public URLs generated with `getPublicUrl()`. The public bucket makes the object available without a token. Updating a profile does not revoke earlier avatar URLs.
- Message, community-media, and feed objects use signed URLs with a one-hour expiry.
- Public feed and public media-library requests generate signed URLs with the service role after database publication checks. URLs can be copied, logged, cached, or shared and remain valid until expiry even after a row is unpublished/deleted or the user's authorization changes.
- Message attachment signing occurs only after the app loads a conversation for a current participant. However, the signer accepts the `message_attachments.url` path without rechecking that its folder segments match the attachment's `conversation_id` and `uploader_id`.
- Feed/media signers accept `storage_path` from database rows without rechecking bucket path ownership/scope. Direct row policies permit some authors/creators to update these pointer columns.
- Profile editing submits the existing `avatar_url` as a hidden field and the Server Action accepts it as an arbitrary string. A crafted action request can set an external avatar URL; there is no scheme/host or expected-bucket validation.

## Findings

### Critical

No critical storage finding was confirmed from source alone.

### STOR-01 — High — service-role signed-URL confused-deputy paths

Private-object signing trusts path strings stored in `message_attachments.url`, `community_posts.storage_path`, and `media_items.storage_path`. Database constraints/policies do not consistently prove that those paths belong to the row's conversation, community, uploader, or author:

- a direct `message_attachments` insert must reference the caller's message/conversation but may place any string in `url`;
- community-post authors can directly update their row, including storage pointer fields;
- media-item creators/platform engineers can directly update storage pointer fields.

If a caller learns another private object path, they may be able to place that path in an authorized row and have the service-role application mint a signed URL, bypassing the original object's Storage select policy. Object paths must be identifiers, not secrets or authorization evidence.

Recommended remediation: enforce canonical path prefixes at database insert/update time, make pointer identity fields immutable except through narrow trusted RPCs, and have every signer parse and compare bucket/path segments to the authorized row before signing. Add cross-conversation, cross-community, cross-uploader, unpublished, and deleted-object negative tests.

### STOR-02 — High — global 250 MB Server Action body limit exposes pre-authorization resource pressure

All Server Actions share a 250 MB multipart limit. Authentication and content validation occur inside the action after the request body reaches the application. This expands bandwidth, memory, temporary-storage, and concurrency exposure for every action and allows repeated oversized/near-limit requests to consume resources even when the caller is unauthenticated or unauthorized.

Recommended remediation: move large uploads to short-lived, scope-bound direct-to-Storage signed upload flows created only after authentication/authorization; keep ordinary Server Actions at a small global limit; add edge rate limiting, content-length rejection where reliable, per-user quotas, concurrency limits, and upload observability.

### STOR-03 — High — deleted message media remains accessible and has no purge path

Message deletion only sets `direct_messages.deleted_at`. Attachment rows and objects remain. `getConversation()` still loads and signs attachments for deleted messages before the UI chooses not to render them, and participants retain direct Storage select access based solely on conversation membership. There is no message-media delete policy or server-side purge workflow.

Recommended remediation: define deletion/retention semantics, stop loading/signing attachments for deleted messages, revoke future application access immediately on delete, and perform an authorized asynchronous object/row purge according to the retention policy. Test that old signed URLs expire and no new URL can be issued after deletion.

### STOR-04 — High — direct feed uploads bypass application image limits

The feed bucket is capped at 250 MB and the final feed insert policy checks bucket, ban status, default community, and caller folder but not metadata size/type beyond bucket settings. A signed-in user can bypass the app's 10 MB image limit and upload an allowed image approaching 250 MB directly through Supabase Storage, creating storage/bandwidth/processing abuse risk.

Recommended remediation: add policy-level metadata predicates equivalent to the message-media policy (10 MB images, approved video limit), add quotas/rate limits, and verify malformed/missing metadata is rejected. Consider a lower video limit based on hosting capacity.

### STOR-05 — Medium — MIME/extension checks do not verify file content

All surfaces trust caller-declared MIME and filename extension. Community documents can contain malware or active macros; images may retain sensitive EXIF data; media containers can be malformed/polyglot content. Bucket MIME allowlists do not replace content inspection.

Recommended remediation: verify magic bytes/container signatures, decode/re-encode images, strip metadata, quarantine and asynchronously scan documents/media, serve downloads with safe content disposition where appropriate, and reject files until scanning succeeds.

### STOR-06 — Medium — orphaned and retained objects have no lifecycle control

Old avatars are never deleted; an avatar remains if the subsequent profile update fails; message uploads are not rolled back when message/attachment insertion fails; message attachments are never deleted; feed soft-deletes retain objects; and best-effort community-media/feed replacement deletion has no retry queue. The repository has no reconciliation, retention, quota, or orphan-cleanup job.

Recommended remediation: define retention by bucket, make upload/finalization state explicit, clean up failed uploads, enqueue idempotent deletion with retries, and run a report-only reconciliation before any deletion job. Never delete solely from an unreviewed heuristic in production.

### STOR-07 — Medium — one-hour signed URLs outlive row/access changes

Signed URLs are bearer credentials valid for one hour. Unpublishing, soft-deleting, blocking, banning, or removing membership does not revoke a previously issued URL. Public pages also sign every returned stored item, increasing URL issuance and exposure in rendered HTML, browser history, referrers, logs, and caches.

Recommended remediation: approve an explicit TTL by data class (messages should normally be shorter than public media), avoid signing deleted/unpublished content, limit signing to the item being viewed, set appropriate referrer/cache headers, and document that immediate revocation requires object move/delete or a delivery proxy.

### STOR-08 — Medium — community-media direct uploads bypass narrower application limits

The private community-media bucket allows every approved type up to 250 MB, while the app limits audio to 100 MB and documents to 25 MB. An authorized community creator/platform engineer using the direct Storage API can bypass those narrower limits. The policy does not inspect metadata size or MIME.

Recommended remediation: mirror per-type application limits in Storage policy predicates and add database consistency checks for `mime_type`, `size_bytes`, `content_kind`, and canonical object path.

### STOR-09 — Medium — arbitrary external avatar and banner URLs are rendered

Crafted profile updates can replace `avatar_url` with an arbitrary string, and community banner URLs are stored without HTTP(S)/host validation. These values are rendered as image sources on public pages. This enables third-party tracking, broken/mixed-content assets, and ungoverned external content even though script execution through `<img>` is not expected.

Recommended remediation: require avatars to reference the expected bucket/path, validate banner/avatar URL scheme and approved origin policy, and consider proxying or importing reviewed remote images.

### STOR-10 — Low — validation and UI configuration drift

The shared image validator accepts GIF for avatars while the avatar bucket/UI do not. Media and official-update file inputs omit `accept` hints. The global 250 MB body limit is equal to the nominal video limit, leaving no multipart overhead. These inconsistencies primarily cause failed or confusing uploads.

Recommended remediation: define per-surface validation profiles from one source, align UI/bucket/policy MIME lists and sizes, and reserve transport overhead below infrastructure request limits.

## Recommended remediation order

1. Fix STOR-01 before production: bind every database pointer and signer to canonical bucket/path ownership.
2. Fix STOR-03 so deletion stops new message attachment access and has an approved purge/retention path.
3. Replace or constrain the global large Server Action upload path (STOR-02), with rate limits and quotas.
4. Add policy-level feed and community-media size/MIME limits (STOR-04 and STOR-08).
5. Add content inspection/quarantine and safe document delivery (STOR-05).
6. Implement report-first lifecycle reconciliation, retryable deletion, and retention (STOR-06).
7. Reduce/segment signed URL TTL and harden external URL fields (STOR-07 and STOR-09).
8. Align UI/application/bucket validation constants (STOR-10).

## Manual Supabase dashboard checks

1. In Storage, confirm exactly the four expected buckets, public flags, byte limits, and MIME allowlists. Record any dashboard-only or extra buckets.
2. Export/read `pg_policies` for `storage.objects`; confirm the effective policy set matches the final migrations and that obsolete `0030` feed policies were dropped by `0033`.
3. Confirm `message-media`, `community-media`, and `community-feed-media` cannot be fetched through public object URLs and `profile-avatars` is intentionally public.
4. Inspect object counts and bytes by bucket, first/second path segment, MIME, and age. Flag malformed paths, missing metadata, oversized objects, unknown MIME values, and objects with no matching database row.
5. Compare `message_attachments.url`, `community_posts.storage_path`, and `media_items.storage_path` to canonical path formats and matching owner/scope IDs. Do not repair/delete during the audit query.
6. Review deleted/unpublished database rows that still have objects and document required retention/legal holds before cleanup.
7. Confirm legitimate platform engineers' direct versus service-role capabilities for another user's objects, especially the community-media second-segment restriction.
8. Review Storage/API logs for near-limit uploads, repeated failures, high signed-URL issuance, path traversal/odd filenames, direct uploads that bypass app limits, and anonymous large Server Action traffic.
9. Verify CDN/cache/referrer behavior for public and signed objects, including what happens after object deletion and URL expiry.
10. Confirm service-role keys remain server-only and that production, preview, and staging projects/buckets are isolated.

## Staging verification checklist

- Upload every permitted type at just below and just above each application and bucket limit; include multipart overhead tests.
- Reject empty files, double extensions, uppercase/mixed extensions, MIME/extension mismatches, missing MIME, forged MIME, polyglots, malformed media, and executable/HTML/SVG payloads.
- Attempt direct feed image uploads above 10 MB before and after remediation.
- Attempt cross-user avatar update/delete, cross-conversation message read/insert/sign, and cross-community media/feed update/delete.
- Insert authorized attachment/media/post rows with another object's path and prove no signed URL is issued.
- Verify banned users cannot upload through either Server Actions or direct Storage APIs.
- Verify a normal user cannot use platform moderation paths and a platform engineer can perform only intended moderation.
- Delete a message/post/media item and verify database visibility, new signed-URL issuance, old URL expiry, object retention/purge, and audit logging match the approved policy.
- Force database failure after object upload and object-delete failure after database update; verify cleanup/retry behavior.
- Confirm avatar replacement removes or intentionally retains prior objects according to policy.
- Load public pages and ensure only published/non-deleted content receives signed URLs and URL TTL/cache headers are correct.
- Exercise concurrent uploads and quota/rate-limit boundaries without using production data.

## Production deployment gates

Deployment remains blocked until:

- STOR-01, STOR-02, STOR-03, and STOR-04 are remediated and pass direct API plus application negative tests;
- the deployed bucket/policy catalog matches reviewed migrations;
- a report-only production object/row reconciliation has been reviewed, with no unapproved destructive cleanup;
- upload rate limits, quotas, monitoring, alerting, and incident ownership are operational;
- message deletion and all bucket retention rules receive product/privacy approval;
- malware/content handling is approved for public documents and media, or risky upload types remain disabled;
- signed URL TTL and cache/referrer behavior are approved per data class;
- staging passes the checklist above using production-equivalent bucket settings and infrastructure limits;
- lint, production build, automated tests, dependency/secret review, and `git diff --check` pass on the release commit.
