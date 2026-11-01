
## Machine-readable error codes for PATCH /users/:id 400s (feature 8)
- Two 400 responses have only a plain English `message` string and no field name or `code`: changing your own role/isActive, and making a team leader PEMBINA. The frontend can't tell them apart without parsing English text, so it shows one combined Indonesian sentence. Request: add an error `code` (like the other coded errors) to each. Priority: low.

## Error codes and role on team membership (feature 9)
- `PUT /teams/:id/members/:userId` 400s (PEMBINA as leader, inactive user) and `POST/PATCH /teams` 409 (duplicate name) have no `code` or field name; the roster has no `role` per member. The frontend maps by request context. Request: add error `code`s, and `role` to the roster rows. Priority: low.
