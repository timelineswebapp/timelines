# Revision History Policy

Authority Level: Governance
Governed System: Future content revision governance.
Describes: Both

## Scope
This document governs the policy expectation for future revisions to timelines, milestones, sources, taxonomy, and publication states.

## Non-Scope
This document does not implement revision storage or change existing update behavior.

## Current Reality
- `timeline_slug_history` preserves old timeline slugs.
- There is no implemented revision history for timelines, events, sources, tags, citations, or admin actions.
- Current update operations mutate publishing records directly.

## Future Architecture
Revision history should preserve before/after values, actor, timestamp, reason, affected public URLs, source evidence changes, and rollback reference.

## Revision Requirements
- Preserve canonical IDs.
- Record reason for material content changes.
- Link revisions to editorial roles and approvals.
- Support audit and rollback.

## Dependencies
- `docs/data/REVISION_MODEL.md`
- `docs/governance/EDITORIAL_ROLES.md`
- `docs/governance/PUBLICATION_LIFECYCLE.md`
- `timeline_slug_history`

## Open Questions
- Which fields require public revision disclosure?
- Should minor copy edits require approval?

## Future Evolution
Define revision schema only after editorial role and publication state requirements are finalized.
