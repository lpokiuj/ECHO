# Feature 11: Volunteering suspension (TBD, noted only)

Status: NOT decided, do not build yet. Depends on Feature 10 (miss counter).

## Idea
When a member reaches `n` recorded misses, their volunteering right is turned off for a period
of time. Both `n` and the period are parameters set by the project owner.

## Open questions
- Where parameters live: env vars (`.env.example`; config is env via ConfigModule today, no
  settings table) vs an admin-editable `settings` table.
- Counting rule: lifetime misses vs misses within a rolling window; does the count reset after
  a suspension ends?
- Enforcement: likely the same exclusion path as Feature 9 in `candidates()` and `assign()`
  (new skip reason `SUSPENDED`). What about services they are already assigned to?
- Suspension state: derived from absences at read time vs stored `suspended_until` on users.
- Can ADMIN lift a suspension manually?
- Add to `apps/api/PLAN.md` "Open questions" when this is picked up.
