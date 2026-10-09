# TL-TIER1-COMPLETION-001 — Tier-1 Security Gate

Status: Active, founder-approved bounded disposition

Policy version: `tier1-security-gate.1`

Machine policy: `functions/src/security-gate.ts`
Verifier: `npm run security:gate`

## Gate

A candidate passes only when there are zero known high or critical vulnerabilities that are production-runtime reachable, materially exploitable in operational tooling, or reachable from untrusted input in the environment in which the vulnerable package executes. Unknown reachability fails closed. Root and Functions production audits remain independently required and cannot be masked by a development-tooling disposition.

## Approved bounded disposition

| Field | Recorded value |
| --- | --- |
| Advisory | `GHSA-vfj7-8cjw-p6xm` |
| CVE | `CVE-2026-93687` |
| Affected package | `braces@3.0.3` |
| Dependency path | `eslint-config-next@16.4.0 → @next/eslint-plugin-next@16.4.0 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3` |
| Scope | Root development lint tooling only |
| Reachability | `BUILD_TOOLING_ONLY_NOT_RUNTIME_REACHABLE` |
| Exploitability | No application/user-controlled input reaches lint glob patterns; repository-owned ESLint configuration controls them. |
| Disposition | `ACCEPTED_TOOLING_RISK_PENDING_UPSTREAM_FIX` |
| Founder authorization | 2026-10-09, limited to this exact advisory/path/conditions |

The advisory is retained in audit reporting. It is not suppressed, deleted, or treated as a production-runtime pass without the conditions below. `generation-release-manifest-v2` is the first release-manifest schema that binds this gate.

## Validity conditions and expiry

The disposition is valid only while all of the following hold:

- the vulnerable chain remains development/lint tooling only;
- it remains absent from deployed Next.js and Firebase Functions request paths;
- user-controlled input cannot control lint glob patterns;
- repository-owned configuration controls the relevant patterns;
- `npm audit --omit=dev --audit-level=high` and `npm --prefix functions audit --omit=dev --audit-level=high` have zero high/critical findings;
- topology has not made the chain runtime reachable; and
- upstream has not published a fix or materially changed the advisory’s exploitability analysis.

It expires automatically when an upstream compatible fix is available, when any condition fails, or when the dependency topology changes. It must be re-evaluated on every release, topology change, and upstream fix/material advisory update. A compatible patch replaces this disposition through normal maintenance; a forced downgrade is not a remedy.

## Enforcement and certification evidence

`npm run security:gate` verifies the exact lockfile topology, verifies that the only root high/critical audit findings are the approved propagated advisory entries, and independently requires zero high/critical findings in both production dependency trees. `scripts/run-authority-first-acquisition-canary.ts` invokes that command before any remote configuration, Firestore, scheduler, Cloud Run, or provider interaction. The typed gate bundle is part of `GenerationReleaseManifest`, so changing the policy/disposition changes the release identity.

The separate Firebase/UUID transitive finding is moderate and is neither part of this disposition nor grounds for a forced Firebase Admin migration.
