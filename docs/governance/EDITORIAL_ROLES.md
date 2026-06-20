# Editorial Roles

Authority Level: Governance
Governed System: Future editorial identity, role, and approval boundaries.
Describes: Both

## Scope
This document defines current role limitations and future editorial roles.

## Non-Scope
This document does not implement authentication, authorization, or user accounts.

## Current Reality
- Admin access is token-based.
- No implemented user, role, permission, reviewer, or approver model exists.
- Admin APIs can create, update, and delete editorial records when the token is valid.

## Future Architecture
Future roles should separate content authorship, editorial review, publication approval, data operations, and system administration.

## Future Role Set
- Operator: runs imports, recovery, and operational checks.
- Editor: drafts and edits timelines, milestones, sources, and tags.
- Reviewer: validates evidence, chronology, and taxonomy.
- Publisher: approves public visibility.
- Administrator: manages roles, secrets-adjacent settings, and destructive operations.

## Dependencies
- `docs/governance/EDITORIAL_GOVERNANCE.md`
- `docs/governance/PUBLICATION_LIFECYCLE.md`
- `docs/operations/ADMIN_OPERATIONS.md`
- `src/server/api/admin-auth.ts`

## Open Questions
- Which role can approve factory output?
- Which role can delete public milestones?

## Future Evolution
Introduce role documentation before implementing role-based access control.
