# Observability and Production Error Monitoring

Phase 17 Module 9 baseline date: 2026-07-05.

## Scope and current state

Selah Ember now emits one-line structured JSON logs for security-relevant and operational server events without adding a monitoring vendor or runtime dependency. `proxy.ts` assigns or accepts a constrained request ID, forwards it to Server Components and Server Actions, and returns it as `x-selah-request-id`. Server-side events use that ID where a Next.js request context is available.

This is an application logging foundation, not full tracing. Logs still depend on the deployment platform's retention, search, alerting, and export facilities. Browser error-boundary events are safe console records containing only an event name and Next.js error digest; they are not yet delivered to a server collector.

## Implementation

- `lib/observability/log.ts` normalizes event names, allowlists metadata fields, rejects sensitive key names, truncates strings, redacts UUID path segments, and writes JSON through the appropriate console level.
- `lib/observability/request.ts` adds the current request ID and sanitized pathname to server logs when available.
- `lib/observability/client.ts` records only the error-boundary event and opaque Next.js digest. It never records an exception message or stack.
- `proxy.ts` accepts `x-request-id` only when it matches 8-64 ASCII letters, numbers, dots, underscores, or hyphens. Otherwise it generates a UUID. Internal request headers are `x-selah-request-id` and `x-selah-pathname`.

The logger intentionally drops unknown metadata keys. New fields must be explicitly added to the allowlist or use the bounded aggregate suffixes `Count`, `Bytes`, or `Ms`.

## Event naming

Use lowercase dot-separated names in the form `domain.resource.action_or_outcome`. Names are normalized defensively by the helper. Do not put IDs, filenames, user input, or variable values in event names.

Current event families include:

| Family | Examples | Intended signal |
| --- | --- | --- |
| Auth | `auth.session.unavailable`, `auth.callback.exchange_failed`, `auth.signin.failed` | Auth provider or session failures |
| Provider reads | `supabase.public_feed.unavailable`, `supabase.public_groups.unavailable` | Degraded public read paths |
| Authorization | `authorization.platform.denied`, `authorization.media.denied` | Denied privileged actions |
| Upload | `upload.request.rejected`, `upload.validation.rejected` | Request or file validation rejection |
| Storage | `storage.sign.failed`, `storage.upload.failed`, `storage.delete.failed` | Storage operation failure |
| Messages | `message.send.succeeded`, `message.send.failed` and normalized message helper events | Message operation health without content |
| Media | `media.create.succeeded`, `media.update.failed`, `media.delete.failed` | Media mutation outcomes |
| Platform | `platform.user_role_update.succeeded`, `platform.temporary_ban_create.failed` | Privileged moderation mutation outcomes |
| UI | `ui.route.error`, `ui.global.error` | Client error boundary activation |

Use `info` for successful, low-volume administrative or mutation outcomes; `warn` for expected rejection, denial, degraded fallback, or recoverable provider failure; and `error` for failed mutations or storage operations requiring investigation.

## Safe metadata

Safe metadata is deliberately coarse:

- generated request ID;
- sanitized route pathname with query strings removed and UUID segments replaced by `:id`;
- HTTP method or status;
- controlled operation, resource type, provider, bucket, role, outcome, reason, or scope values;
- provider error name/code/status, but not the provider message;
- boolean authorization check outcomes;
- aggregate counts, byte sizes, and elapsed milliseconds.

Even an allowlisted field must receive a controlled application value. Do not pass raw form values into `reason`, `operation`, `role`, or any other metadata field.

## Never log

Never log any of the following, including in exception messages or temporary debugging statements:

- passwords, session cookies, JWTs, refresh/access tokens, API keys, service-role keys, authorization headers, or credentials;
- email addresses, phone numbers, auth user IDs, profile IDs, conversation IDs, IP addresses, or other direct identifiers;
- message bodies, discussion/post/comment content, announcement bodies, moderation reasons, search text, or form payloads;
- filenames, full object paths, signed/public URLs, query strings, or uploaded file content;
- raw Supabase errors, request/response bodies, exception messages, or stack traces in application-authored logs;
- payment, checkout, or financial details.

The structured helper blocks metadata keys commonly associated with these values. That is defense in depth, not permission to pass sensitive values to the helper.

## Instrumented areas

- proxy auth refresh and endpoint-specific multipart rejections;
- protected-layout auth availability and sign-up/sign-in/callback failures;
- degraded public community, group, feed, and member reads;
- profile, message, community-feed, and media upload validation/failures;
- signed URL path rejection/failure and stored-object deletion failure;
- direct-message send failure/success without message or recipient data;
- media create/update/delete outcomes;
- platform-engineer gate denials and privileged settings, role, announcement, community, group, event, and temporary-ban mutations;
- App Router route and global error boundaries.

## Production monitoring recommendations

For the initial deployment, use the hosting provider's runtime log stream and configure retention appropriate for incident response. Parse logs as JSON and index at least `timestamp`, `level`, `event`, `requestId`, `path`, `environment`, `status`, `errorCode`, `bucket`, and `operation`.

Create alerts after a staging baseline is known. Start with:

- any sustained `auth.session.*unavailable` or `supabase.*.unavailable` rate;
- any `storage.*.failed` burst, especially signing failures;
- repeated `upload.request.rejected` 411/413 responses by route;
- repeated authorization denials as an abuse or UI regression signal, without treating one denial as an incident;
- any `platform.*.failed` event;
- elevated `ui.global.error` or `ui.route.error` frequency if browser collection is later enabled.

Avoid alerting on successful message/media events individually. Use rate or failure-ratio alerts to control noise.

### Optional future Sentry or OpenTelemetry

No paid dependency is required by this module. If error volume or cross-service complexity justifies it:

1. Sentry can collect server/client exceptions and source-mapped stack traces. Configure `beforeSend` scrubbing, disable request bodies, remove cookies/authorization headers, avoid user identity attachment, and validate sampling in staging.
2. OpenTelemetry can provide vendor-neutral traces and metrics. Start with server request spans and Supabase/storage operation timing; keep the same request ID as a searchable correlation field. Export through a controlled collector and apply attribute allowlists.
3. Do not enable session replay, broad browser breadcrumbs, body capture, or automatic PII collection without a separate privacy/security review.

Either option must remain additive to the stable event names in this document so operational queries do not depend on one vendor.

## Incident triage checklist

1. Record the UTC time window, environment, affected route, visible symptom, and returned `x-selah-request-id` if available.
2. Search the exact request ID, then expand to the same event and route in a narrow time window.
3. Determine whether the signal is auth, Supabase database, Storage, authorization, upload validation, application mutation, or UI rendering.
4. Check provider status and deployment health. Compare error rates with the previous release and a known-good route.
5. Use only safe fields to correlate events. Do not ask a user to send tokens, cookies, passwords, signed URLs, or private message/upload content.
6. For authorization events, verify the user's role and membership through approved administrative tooling without copying identifiers into logs or tickets unnecessarily.
7. Contain the incident using the smallest reversible action. Do not weaken RLS, Storage policies, authorization gates, or validation to restore service.
8. Preserve relevant logs according to retention policy, document impact and timeline, and add a regression check before closing.

## Staging verification

- Confirm ordinary responses include a valid `x-selah-request-id` and server logs for that request use the same value.
- Send a valid constrained `x-request-id` and confirm it is propagated; send an invalid or oversized value and confirm it is replaced.
- Trigger sign-in failure, denied platform access, invalid upload MIME/size, oversized multipart request, and a controlled Storage/Supabase failure. Confirm each produces the expected event without raw error messages or identifiers.
- Exercise message send and media create/update/delete. Confirm success/failure logs contain no content, filenames, object paths, user/profile/conversation IDs, or signed URLs.
- Trigger route and global error boundaries in a non-production test build and confirm only the event, timestamp, service, and digest are emitted in the browser.
- Search deployed logs for `token`, `authorization`, `cookie`, `password`, `email`, `body`, `content`, and representative test data. Investigate any match before production.
- Confirm upload, auth, messaging, media, moderation, checkout, and payment behavior is otherwise unchanged.

## Production deployment gates

- Lint, production build, and `git diff --check` pass.
- Staging verification above passes against production-equivalent hosting and Supabase configuration.
- Runtime logs are parsed as JSON, retained, access-controlled, and searchable by event and request ID.
- At least one owner is assigned for auth/provider, Storage, and privileged-platform alerts, with an escalation path and retention policy.
- No secrets, user content, direct identifiers, signed URLs, or raw provider messages appear in sampled staging logs.
- Existing Phase 17 database/Storage migration gates remain satisfied. This module does not change schema, RLS, Storage policies, checkout, payment, or production data.

Deployment should remain blocked until these logging and existing security/storage gates have passed staging verification.
