# Media Policy

Selah Ember does not allow unlimited file uploads or unlimited video length. Unlimited media creates predictable abuse, storage cost, malware, and performance risks.

## Current Limits

- Profile avatars: JPG, PNG, or WebP only, maximum 5MB.
- Future post/message images: JPG, PNG, or WebP only, maximum 10MB.
- Future beta video uploads: MP4, WebM, or MOV only, maximum 250MB.
- Larger videos should be shared through external links such as YouTube, Vimeo, or Google Drive.
- Next.js Server Actions are capped at 250mb in `next.config.ts` so uploads can reach, but not exceed, the beta video limit before app-level validation runs.

## Link Safety

User-rendered links must pass basic URL validation and use `target="_blank"` with `rel="noopener noreferrer"` when opened externally.

## Security Notes

- Service role keys must stay in server-only code.
- Storage policies must keep users scoped to their own upload folders.
- RLS must not be weakened to support media features.
