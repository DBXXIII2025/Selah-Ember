# Selah Ember

Selah Ember is an open faith community for encouragement, prayer, Bible study groups, events, and meaningful connection. Signed-in users share through one community feed, create and join groups, participate in group discussions, exchange direct messages, and maintain personal profiles.

## Features Through Phase 16

- Supabase email/password authentication.
- Profile creation and editing.
- One open community feed with text, safe links, images, video, comments, and reactions.
- Public/private prayer requests.
- Public Bible study group discovery, membership, and group-only discussions.
- Event detail pages with Going, Interested, and Remove RSVP flows.
- Notifications with unread counts and read-state actions.
- Direct messaging with links, images, video, reactions, archive, report, and block controls.
- Public and managed media-library foundations.
- Platform-engineer moderation, announcements, support messaging, and legacy-content management.
- Shared responsive UI, accessible navigation, reduced-motion support, and branded loading/error states.

Application roles are `user` and `platform_engineer`. Legacy community-management records remain supported where required, but new participation centers the open feed and user-created groups.

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example` and fill in Supabase values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Database

Apply every migration currently present in `sql/migrations` in numeric order. Do not skip legacy migrations; later compatibility migrations depend on the earlier schema.

## Verification

Run the standard checks before committing or deploying:

```bash
npm run lint
npm run build
git diff --check
```

Use `docs/BETA_CHECKLIST.md` for the end-to-end user journey pass.

## Deployment

Deploy with Vercel after GitHub setup. Configure the required environment variables in Vercel and keep `SUPABASE_SERVICE_ROLE_KEY` server-only. See `docs/DEPLOYMENT.md` for the full deployment checklist.
