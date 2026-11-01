
## Machine-readable error codes for PATCH /users/:id 400s (feature 8)
- Two 400 responses have only a plain English `message` string and no field name or `code`: changing your own role/isActive, and making a team leader PEMBINA. The frontend can't tell them apart without parsing English text, so it shows one combined Indonesian sentence. Request: add an error `code` (like the other coded errors) to each. Priority: low.
