# Execution Canon V2

## Status
Status: Active starter engineering execution canon

Authority Level: Highest engineering authority

Version: 2.0 starter

## Purpose
This document defines how TiMELiNES engineering work should be planned, implemented, verified, and accepted.

## Scope
This document governs:
- Implementation discipline.
- Validation expectations.
- Testing expectations.
- Security rules.
- Review and audit posture.
- Compatibility checks.
- Documentation handoff expectations.

Out of scope:
- Product strategy.
- Visual design doctrine.
- Business operations.

## Authority
Engineering work must preserve production stability, strict typing, security, and traceability. Implementation must follow the architecture and schema canons unless an approved authority program changes them.

## Ownership
Owner: Engineering execution steward

Contributors:
- Architecture authority steward
- Data/schema authority steward
- Product authority steward

## Principles
- Use TypeScript everywhere.
- Validate inputs at route boundaries.
- Keep database access in server repositories.
- Keep business logic out of frontend components.
- Prefer deterministic behavior over clever shortcuts.
- Avoid silent fallbacks that hide failures.
- Preserve backward compatibility unless explicitly authorized.
- Add tests proportional to risk.
- Run `npm run typecheck`, `npm test`, and `npm run build` for production-impacting changes.
- Never expose secrets or trust client-side data.

## Required Implementation Checklist
- Authority source reviewed.
- Scope and non-scope confirmed.
- Data ownership identified.
- Route validation added or verified.
- Repository boundary respected.
- Public reads bounded.
- Mutation paths authorized.
- Tests updated.
- Build verified.
- Compatibility checked.

## References
- `AUTHORITY_INDEX.md`
- `02_ARCHITECTURE_CANON_V2.md`
- `03_SCHEMA_CANON_V2.md`
- `AGENTS.md`
- `package.json`

## Change Management
Execution rules may change only when they improve correctness, security, reliability, or maintainability. Changes must not weaken validation, authorization, testing, or production safety requirements.
