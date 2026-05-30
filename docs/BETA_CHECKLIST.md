# Beta Readiness Checklist

Use this checklist before inviting real beta users.

## Account and Profile

- Create a new account with email and password.
- Sign in with the new account.
- Complete or update the profile display name, avatar URL, and bio.
- Sign out and sign back in.

## Communities

- Create a community with name, description, location, and optional banner URL.
- Confirm the community appears on `/communities`.
- Confirm the community appears on `/discover`.
- Open the public community page at `/c/[slug]`.
- Join a community as a second user.
- Confirm the joined community appears on `/communities`.
- Leave a joined community as a non-owner.
- Confirm an owner cannot leave their own community through the normal leave action.

## Prayer Requests

- Create a public prayer request.
- Create a private prayer request.
- Attach a prayer request to a community.
- Confirm public requests display in the prayer list.
- Confirm private requests remain visible only to the owner.

## Study Groups

- Create a study group attached to a community.
- Confirm the group appears on `/groups`.
- Confirm the group appears on `/discover/groups`.
- Open the public group page at `/groups/[id]`.
- Join a group as a second user.
- Confirm the joined group appears on `/groups`.
- Leave a joined group as a non-owner.
- Confirm a group owner/leader cannot leave through the normal leave action.

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
- Join a community and confirm the owner receives a notification.
- Join a group and confirm the owner/leader receives a notification.
- RSVP to an event and confirm the event owner receives a notification.
- Create a public community prayer request and confirm the community owner receives a safe notification.
- Mark a single notification as read.
- Mark all notifications as read.
- Confirm the unread count updates.

## Leader Dashboard

- Confirm signed-out users cannot access `/leader`.
- Confirm community owners can access `/leader`.
- Open `/leader/communities/[id]` for an owned community.
- Confirm a non-owner cannot access another owner's management page.
- Update community name, description, location, and banner URL.
- Confirm updated details appear on `/c/[slug]`.
- Confirm member count, prayer requests, groups, events, and membership list display where available.

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
- Leader dashboard loads.
- Signout works.
