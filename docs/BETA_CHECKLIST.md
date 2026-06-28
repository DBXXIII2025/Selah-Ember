# Phase 16 Production Browser Checklist

Use this checklist before inviting real beta users.

## Account and Profile

- Create a new account with email and password.
- Sign in with the new account.
- Complete or update the profile display name, profile photo, and bio.
- Sign out and sign back in.

## Open Community

- Confirm `/community` loads while signed out.
- Sign in and create text, link, image, and video posts.
- Add and remove reactions and comments.
- Confirm users can delete only content allowed by current ownership/moderation rules.
- Confirm `/discover` and retained `/c/[slug]` legacy public pages load where records exist.
- Confirm retired community creation and role-application routes are not linked from active navigation.

## Prayer Requests

- Create a public prayer request.
- Create a private prayer request.
- Optionally attach a prayer request to an existing legacy community record.
- Confirm public requests display in the prayer list.
- Confirm private requests remain visible only to the owner.

## Study Groups

- Create a study group, with and without an optional community attachment.
- Confirm the group appears on `/groups`.
- Confirm the group appears on `/discover/groups`.
- Open the public group page at `/groups/[id]`.
- Join a group as a second user.
- Confirm the joined group appears on `/groups`.
- Leave a joined group as a non-owner.
- Confirm a group owner/leader cannot leave through the normal leave action.
- Create a group discussion, reply, reaction, report, and deletion using disposable content.
- Confirm non-members cannot open group discussions.

## Events and RSVP

- Create an event attached to a community or group.
- Confirm the event appears on `/events`.
- Open the event detail page at `/events/[id]`.
- RSVP Going.
- Change RSVP to Interested.
- Remove the RSVP.
- Confirm RSVP counts update after each action.

## Notifications

- Confirm `/notifications` redirects signed-out users to `/signin`.
- Confirm the empty state appears when there are no notifications.
- Join a group and confirm the owner/leader receives a notification.
- RSVP to an event and confirm the event owner receives a notification.
- Mark a single notification as read.
- Mark all notifications as read.
- Confirm the unread count updates.

## Messages and Media

- Start a direct conversation and send text, safe links, images, and video.
- Confirm reactions, read state, archive/restore, report, block, and owned-message deletion.
- Confirm message and media signed URLs load and expire safely.
- Create, edit, publish, and delete disposable managed media.

## Platform Engineer

- Confirm normal users cannot access `/platform` or `/platform/messages`.
- Confirm platform navigation appears only for `platform_engineer`.
- Test announcements, support conversations, moderation, temporary bans, and typed destructive confirmations with disposable records.
- Confirm legacy management pages do not grant access without platform authorization.

## Accessibility and Responsive Behavior

- Complete the primary journeys using keyboard only.
- Confirm skip links, current navigation state, visible focus, Escape dismissal, and focus restoration.
- Test 320px, 375px, 768px, 1024px, and desktop widths without horizontal overflow.
- Enable reduced motion and confirm smooth scrolling/repeating motion is suppressed.

## Regression Pass

- Homepage loads.
- Dashboard loads.
- Profile loads.
- Communities load.
- Prayer loads.
- Groups load.
- Events load.
- Discover pages load.
- Notifications load.
- Legacy leader transition pages remain informational and do not expose retired application workflows.
- Messages and media load.
- Platform pages load for a platform engineer and reject a normal user.
- Branded loading, unavailable, restricted, deleted, archived, error, and 404 states render.
- Signout works.
