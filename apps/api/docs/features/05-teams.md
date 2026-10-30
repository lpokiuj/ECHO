# Feature 5: Teams + membership + leader flag

Scope: teams and membership only. No service or assignment endpoints (features 6 and 7).
Rule 9 (cleanup on removal) belongs here. Tests insert service and assignment rows
directly into the DB as fixtures, because those endpoints don't exist yet.

## Access
- All five routes below are ADMIN only.
- PEMBINA: 403. MEMBER: 403. A team leader: 403, including on their own team (a leader
  cannot add or remove members). No token: 401.
- `:id` and `:userId` must be UUIDs (400 otherwise).

## Teams
- `POST /teams` body `{ name }`: 201 `{ id, name }`. Name is trimmed, 1 to 100 characters,
  else 400. Duplicate name: 409 (from the unique constraint, not a pre-check).
- `GET /teams`: 200, all teams ordered by name, each `{ id, name }`.
- `PATCH /teams/:id` body `{ name }`: 200 with the updated team. 404 for an unknown id.
  409 for a duplicate name. Same validation as create.
- There is no delete-team endpoint in v1.

## Membership
- `PUT /teams/:id/members/:userId` body `{ isLeader? }` (boolean, default false):
  200 `{ teamId, userId, isLeader }`, both when creating and when updating.
  - Calling it again with a different `isLeader` updates the row. There is never a
    duplicate row.
  - Unknown team or unknown user: 404. Non-boolean `isLeader`: 400.
  - Adding an inactive user: 400.
  - `isLeader: true` for a user whose role is PEMBINA: 400. PEMBINA can never be a team
    leader. A PEMBINA can still be a plain member (`isLeader` false).
  - A team may have several leaders, or none. No constraint beyond the primary key.
  - One person can lead team A and be a plain member of team B (test it).

## Removal (rule 9)
- `DELETE /teams/:id/members/:userId`: 204. 404 if the team or user doesn't exist, or the
  user is not a member of that team.
- In ONE transaction it also deletes that team's assignments for that user on future
  services (`services.starts_at > now`). Verify by reading the code.
- Past assignments (`starts_at <= now`) are kept.
- Not deleted: the same user's assignments made by other teams, and other users'
  assignments made by this team.
- Removing a leader, or the last leader, is allowed.

## Tests that must exist
- Every route: 401 without a token; 403 for PEMBINA, MEMBER, and a leader of that same team.
- Every `:id` / `:userId` that is not a UUID: 400.
- Teams: create returns 201 `{ id, name }`; name trimmed; empty name and 101-character name
  are 400; duplicate name is 409 on POST and on PATCH; `GET /teams` ordered by name;
  PATCH unknown id is 404.
- Membership: `PUT` creates (200) and updates (200); calling it twice leaves exactly one
  row; changing `isLeader` updates the row; unknown team and unknown user are 404;
  inactive user is 400; non-boolean `isLeader` is 400; PEMBINA with `isLeader: true` is
  400, PEMBINA with `isLeader: false` is 200.
- A team can have several leaders and no leader; one person leads team A and is a plain
  member of team B.
- Removal: 204; 404 for unknown team, unknown user, and a user who is not a member;
  removing a leader and the last leader are allowed.
- Rule 9: a future assignment is deleted, a past one is kept, another team's assignment
  for the same user is kept, other users' assignments by this team are kept.
- The removal is one transaction: if the member delete fails, the assignment delete is
  rolled back (or verified by reading the code, as stated above).