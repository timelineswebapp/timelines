# Editorial Governance

Authority Level: Governance
Governed System: Editorial ownership and review expectations.
Describes: Both

## Scope
Defines editorial governance target.

## Non-Scope
Does not implement roles.

## Verified Implementation
Admin users can create/update/delete timelines, events, tags, ads, requests, imports, and recovery via token-protected APIs. No user/role model or editorial approval table exists.

## Future Architecture
Add editor identities, reviewer assignment, approval records, audit logs, and publication authority.

## Dependencies
`components/admin/*`, `app/api/admin/*`.

## Open Questions
- What roles are required: editor, reviewer, admin, operator?

## Future Evolution Guidance
Separate content authorship from publication approval.
