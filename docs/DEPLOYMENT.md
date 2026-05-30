# Deployment Guide

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
NEXT_PUBLIC_APP_URL=https://your-production-domain.example
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are safe for browser usage. `SUPABASE_SERVICE_ROLE_KEY` must remain server-only.

## Supabase Production Checks

- Apply migrations `0001` through `0011` in order.
- Confirm RLS is enabled on profiles, churches, church memberships, study groups, group memberships, prayer requests, events, event RSVPs, and notifications.
- Confirm public reads are intentional for published communities, public study groups, and events.
- Confirm Auth email settings and redirect URLs include the Vercel production domain.
- Confirm no development-only users or records are required for the app to boot.

## Launch Verification

- Homepage loads on the production domain.
- Signup, signin, and signout work.
- Profile creation and editing work.
- Community creation, discovery, join, and leave work.
- Prayer request creation and visibility rules work.
- Study group creation, discovery, join, and leave work.
- Event creation and RSVP create, update, and delete work.
- Notifications create, list, mark read, and mark all read.
- Leader dashboard owner access and community update work.
- `/not-a-real-page` shows the branded 404.
- Vercel build logs contain no secret values.
