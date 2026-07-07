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

## Certified Institutional Execution
As of 2026-07-07, TiMELiNES has certified execution evidence for the complete institutional publication path through the Public Platform.

Certified institutional path:

```text
Source discovery
  -> Source retrieval
    -> Immutable source snapshot persistence
      -> Corpus generation
        -> Evidence extraction
          -> Evidence validation
            -> Factory candidate creation
              -> Governance package creation
                -> Governance review and approval
                  -> Publication readiness certification
                    -> Library review
                      -> Package acceptance
                        -> Historical Library admission
                          -> Published Memory snapshot
                            -> Timeline, search, and sitemap projections
                              -> Search
                                -> Platform read models
                                  -> Public APIs
                                    -> Public Platform rendering
```

Certified early Factory runtime runs:
- Research pipeline: `1072ee3e-d8d9-459c-a35c-80f515bd2be8`.
- Extraction pipeline: `4a32aedc-b7a7-4605-aed9-08890fd42ade`.

Certified institutional execution results:
- Telephone institutional certification: certified.
- Multi-subject certification: Printing Press, Steam Engine, Internet, and World Wide Web certified.
- Scale certification: 25 and 50 subject batches passed at 100%; 100 subject batch passed at 98%.
- Projection slug revalidation: certified final known slug defects for punctuation, symbols, digits, acronyms, and non-standard titles.
- Search End-to-End certification: certified.
- Public Platform End-to-End certification: certified.
- Institutional Completion Audit: certified with no architectural gaps.

Runtime diagnostics requirements:
- Provider timeout must be environment-configurable for local Qwen14 execution.
- Timeout failures must be classified separately from generic runtime failures.
- Provider diagnostics must preserve non-secret execution metadata such as provider key, model name, timeout, elapsed time, attempt, and bounded raw response previews when available.
- Malformed model output must fail closed and preserve enough diagnostics to reconstruct parse and validation failure classes.
- Provider retries, cooldowns, failover, and stale snapshot reuse must preserve explicit source provenance.

Structured output requirements:
- Factory workers must return JSON objects only.
- Outputs must preserve `factoryOwned: true`, `publicationAllowed: false`, and `governanceSubmissionAllowed: false`.
- Outputs must include source attribution and evidence.
- Invalid outputs must be rejected before Factory Production Memory persistence.
- Valid outputs may persist only as Factory-owned candidate objects and artifacts.
- Authority-bearing Governance decisions must require passed evidence validation records and complete lineage.
- Publication package acceptance must pass through `library_review` before `accepted`.

## References
- `AUTHORITY_INDEX.md`
- `02_ARCHITECTURE_CANON_V2.md`
- `03_SCHEMA_CANON_V2.md`
- `AGENTS.md`
- `package.json`

## Change Management
Execution rules may change only when they improve correctness, security, reliability, or maintainability. Changes must not weaken validation, authorization, testing, or production safety requirements.
