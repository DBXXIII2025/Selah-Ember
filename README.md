# Selah Ember

Selah Ember is a digital fellowship platform for churches, groups, and believers. It helps communities create shared spaces, gather prayer requests, organize Bible study groups, publish events, track RSVPs, and notify leaders about meaningful activity.

## Features Through Phase 12

- Supabase email/password authentication.
- Profile creation and editing.
- Community creation, public discovery, public community pages, membership join/leave, and membership counts.
- Prayer request creation with public/private visibility and community attachment.
- Study group creation, public discovery, group detail pages, membership join/leave, and membership counts.
- Event creation, event detail pages, RSVP Going/Interested/Remove flows, and RSVP counts.
- Lightweight in-app notifications with unread count and read-state actions.
- Church leader dashboard for owned communities, member counts, recent attached activity, and owner-only community detail updates.
- Branded loading, error, and not-found states.
- Production metadata and favicon wiring.
- Beta and deployment documentation.

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

Apply migrations in `sql/migrations` in order. Phase 12 did not require an additional SQL migration after the security/RLS review.

## Verification

Run the standard checks before committing or deploying:

```bash
npm run lint
npm run build
```

Use `docs/BETA_CHECKLIST.md` for the end-to-end user journey pass.

## Deployment

Deploy with Vercel after GitHub setup. Configure the required environment variables in Vercel and keep `SUPABASE_SERVICE_ROLE_KEY` server-only. See `docs/DEPLOYMENT.md` for the full deployment checklist.
