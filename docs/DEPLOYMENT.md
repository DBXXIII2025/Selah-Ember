# Deployment Guide

`LAUNCH_READINESS.md` is the authoritative Phase 17 go/no-go checklist, deployment sequence, rollback procedure, backup/restore checklist, monitoring requirements, and incident-response runbook. Complete and evidence every required gate there before using this setup guide for production.

## GitHub Setup

1. Create a private or public GitHub repository for `SelahEmber`.
2. Confirm `.env`, `.env.local`, and `.env*.local` remain ignored.
3. Commit source, migrations, and documentation only.
4. Push after local lint, build, and beta verification pass.

## Vercel Setup

1. Import the GitHub repository into Vercel.
2. Select the Next.js framework preset.
3. Use the default build command:

```bash
npm run build
```

4. Use the default install command unless dependency policy changes.
5. Do not expose the service role key to client-side code.

## Environment Variables

Set these in Vercel project settings:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://selahember.com
NEXT_PUBLIC_APP_URL=https://selahember.com
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are safe for browser usage. `SUPABASE_SERVICE_ROLE_KEY` must remain server-only.

## Supabase Production Checks

- Back up the production database before applying migrations.
- Apply every file currently present in `sql/migrations` in numeric order and verify the migration history afterward.
- For Study Rooms, confirm migrations `0039`, `0040`, and `0041` are applied before deploying the web code, then verify `study_room_moderation_audit` exists and Platform report actions create durable audit rows. See `docs/STUDY_ROOMS.md`.
- Confirm RLS remains enabled on all application tables, including profiles, legacy communities and memberships, groups and memberships, prayer requests, events and RSVPs, notifications, messages, discussions, community posts, media, moderation, and platform tables.
- Confirm public reads are intentional only for the open community content, published legacy pages/media, public study groups, and public event details.
- Confirm storage buckets and policies exist for `profile-avatars`, `message-media`, `community-media`, and `community-feed-media`.
- Confirm Auth email settings and redirect URLs include `https://selahember.com` and do not depend on the Vercel deployment URL.
- Confirm `NEXT_PUBLIC_SITE_URL` exactly matches `https://selahember.com` so metadata, sitemap, robots, PWA, and auth callback URLs use the canonical production origin. `NEXT_PUBLIC_APP_URL` remains useful for local/staging compatibility but production code hard-falls back to `https://selahember.com` rather than a Vercel deployment URL.
- Confirm no development-only users or records are required for the app to boot.
- Confirm the service-role key appears only in server-side environment configuration and never in browser bundles or logs.

## Launch Verification

- Homepage loads on the production domain.
- Signup, signin, and signout work.
- Profile creation and editing work.
- The open community feed loads publicly; signed-in post, comment, reaction, and deletion permissions work.
- Legacy public community pages remain readable where records exist, but retired creation/application routes are not linked from active navigation.
- Prayer request creation and visibility rules work.
- Study group creation, discovery, join/leave, and group discussions work.
- Event creation and RSVP create, update, and delete work.
- Notifications create, list, mark read, and mark all read.
- Direct-message text, link, image, video, reaction, archive, report, and block flows work.
- Media uploads and signed media playback work for every supported file type and size limit.
- Platform-engineer pages reject normal users and permit authorized moderation/support workflows.
- Keyboard navigation, mobile menus, focus visibility, and reduced-motion behavior pass manual review.
- Loading, unavailable, restricted, deleted, archived, error, and empty states render without exposing internal details.
- `/not-a-real-page` shows the branded 404.
- Vercel build logs contain no secret values.
- Production browser console and network logs show no unexpected errors during the complete QA journey.
