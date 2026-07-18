# Study Rooms

Study Rooms provide structured, room-scoped Bible study participation for small groups. They are organized around Studies, shared notes, discussions, prayer, external resources, membership workflows, reporting, and Platform Engineer moderation.

## Routes

- `/study-rooms`: authenticated Study Room discovery and personal room list.
- `/study-rooms/new`: create a Study Room.
- `/study-rooms/[roomId]`: room detail with Overview, Studies, Shared Notes, Discussion, Prayer, Resources, Members, and Settings sections.
- `/platform`: Platform Engineer dashboard with the Study Rooms moderation section.

## Roles

- Owner: full room management, ownership transfer, role changes, archiving, settings, Studies, resources, and moderation.
- Leader: Study and resource management plus room moderation where permitted.
- Moderator: participation moderation, reports inside the room, and discussion pin/lock where permitted.
- Member: create and manage own participation content, private bookmarks, prayer acknowledgements, and reports.
- Platform Engineer: explicit support/moderation access through Platform tooling only; this is not silent ordinary membership.

Application checks remain server-side authoritative. UI controls mirror permissions but are not trusted for authorization.

## Visibility and Membership

Visibility modes:

- Public: discoverable and readable where the room status permits.
- Unlisted: reachable by direct link where allowed.
- Private: readable only to members and Platform Engineers.

Membership modes:

- Open join: signed-in users can join directly.
- Request to join: leaders review join requests.
- Invite only: leaders invite eligible profiles through debounced profile discovery by display name or username.

Invitation discovery does not expose email addresses or private profile fields, excludes current members and pending invitees, enforces a minimum query length, and limits results.

## Studies

Leaders can create and edit Studies with status, Scripture reference, schedule, leader notes, and closing reflection. The room Overview highlights current and next Study. Members can update their own progress, and leaders can view aggregate completion counts.

Completed rooms remain writable unless explicitly archived. Archived rooms remain readable to authorized users and reject new writes.

## Participation

Shared Notes support room-level and Study-specific notes with title, body, optional Scripture reference, authorship, own-edit/delete, moderator removal, sorting, and private bookmarks.

Discussions support structured threads, optional Study association, replies, own-edit/delete, moderator removal, pinning, locking, private bookmarks, and reports. Locked threads remain readable and reject new replies.

Prayer supports room-scoped requests, optional Study association, categories, prayer acknowledgements, answered status, answered updates, own-edit/delete, moderator removal, filtering, and reports. Room prayer does not flow into public community prayer.

Resources support authorized external links only. They require HTTP or HTTPS URLs, safe target attributes, categories, optional Study association, leader create/edit, and moderator removal.

Private bookmarks are scoped to the current user, have no public counts, create no notifications, and are removed during account deletion.

## Reporting and Moderation

Members can report Shared Notes, Discussion Threads, Discussion Replies, Prayer Requests, and Resources with a reason and optional details. Report targets are validated server-side and must belong to the stated room.

Platform Engineers review Study Room reports in `/platform`. The dashboard shows bounded report lists with filters, room context, target preview, content author, reporter identity for Platform use, created timestamp, status, and safe links to the room section. Actions include mark reviewed, resolve, dismiss, soft-delete reported content, lock reported threads, and archive a room for serious abuse. Destructive actions require typed confirmation.

Room moderators can remove room content within their own room according to Phase B permissions. Room moderator removal, content author deletion, and Platform Engineer moderation are separate workflows with separate audit events.

Restore is not implemented. Phase E/F removal is one-way soft-delete.

## Audit and Account Deletion

Migrations:

- `0039_study_rooms.sql`: base Study Rooms schema, participation tables, reporting, RLS, and account deletion compatibility.
- `0040_study_rooms_phase_b_hardening.sql`: owner consistency, service-role RPC hardening, RLS parity, and archived-room write protections.
- `0041_study_rooms_phase_e_moderation_audit.sql`: durable non-sensitive moderation audit rows for room and Platform moderation actions.

Audit rows intentionally avoid full private notes, prayer content, report details, messages, emails, tokens, credentials, and other sensitive free text. They store stable target identifiers, action names, target types, nullable actor/report references, and short non-sensitive notes.

Account deletion removes private state such as bookmarks and prayer support, deletes submitted reports, nulls reviewer/actor references where designed, anonymizes retained authored content, preserves archive continuity, and keeps ownership valid through the existing deletion functions.

## Deployment Order

1. Back up the database.
2. Apply migrations `0039`, `0040`, and `0041` in order.
3. Verify `study_room_moderation_audit` exists and Platform moderation creates audit rows.
4. Deploy the web application.
5. Run Study Rooms Playwright suites and the production-like smoke flow against a safe development environment.

Do not point mutation-heavy Study Room tests at production.

## Known Limitations

- Study Room lists and moderation loads are bounded rather than infinitely paginated.
- Restore of soft-deleted Study Room content is not supported.
- Platform moderation is functional and auditable, but Phase F does not add analytics or broad moderation dashboards.
- This web feature does not require Android package or signing changes.
