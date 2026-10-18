# TL-TIER1-FINAL-QUALIFICATION — Production Readiness

**Date:** 2026-10-18  
**Authority:** TL-TIER1-FINAL-QUALIFICATION Founder directive  
**Scope:** Isolated TiMELiNES staging only; no production resource was modified, deployed, or launched.

## Executive verdict

**Not production-ready and not Tier-1 certified.** The isolated staging implementation is substantially qualified: governed synthetic publication, PostgreSQL-to-Firestore parity, staging Admin/MFA controls, controlled alert receipt, logical restore, rollback, canonical reader behavior, structural responsive accessibility, and measured synthetic-corpus service latency all have direct evidence. The remaining launch gates require evidence that cannot be truthfully inferred from the available environment: qualified human assistive-technology testing, a representative staged workload, a recovery window satisfying the written PITR policy, and production-only promotion controls. The Berlin Phase-2 certification boundary is independently blocked and remains uncertified.

## Accessibility qualification

**Automated/technical result: PARTIALLY_VERIFIED.** Staging keyboard, focus-return, dialog, labels, reader controls, mobile layout, and zero-console-warning checks passed. The synthetic reader retained its heading plus labeled navigation, event-detail, and copy-link controls at 320×568, 768×1024, and 1440×900. Homepage, synthetic timeline, milestone, search/empty state, canonical metadata, and noindex behavior were previously verified in the isolated staging release.

**Human assistive-technology result: NOT_EXECUTED.** The repository has no executable browser/DOM accessibility runner; its only `axe-core` copy is transitive to linting and cannot inspect the deployed document. VoiceOver was not active on the available workstation. Enabling a macOS system accessibility setting requires the user’s action-time confirmation, and a technical VoiceOver traversal would still not substitute for a qualified human screen-reader assessment. No claim beyond the completed structural/keyboard evidence is made.

## Representative capacity qualification

`060d0a9` adds four bounded, staging-only Factory seed profiles that remain fail-closed on `timelines-staging` / `timelines-staging-primary` and preserve the Factory → Governance → Historical Library → Published Memory path:

| Profile | Historical period | Milestones | Sources | Purpose |
|---|---:|---:|---:|---|
| `capacity-ancient-short` | 240 onward | 3 | 2 | short chronology |
| `capacity-early-modern-medium` | 1492 onward | 12 | 3 | medium chronology |
| `capacity-industrial-long` | 1800 onward | 30 | 4 | long chronology |
| `capacity-modern-dense` | 1960 onward | 60 | 5 | dense chronology |

The profile implementation passed strict TypeScript and the focused governed Factory/Library/Published-Memory/public-contract matrix (**114/114**). It has **not** been run against staging: the only local `DATABASE_URL` identifies a different Neon database (`neondb`), and the available native Chrome session is a BookTown/Firebase account rather than the TiMELiNES Neon session. It was deliberately not used. Therefore representative staging workload, pagination, database-query, and concurrent-reader measurements are **NOT_EXECUTED**, not failed or passed.

The prior authorised synthetic workload remains useful but narrower: Cloud Run server-side p95 was 66.16 ms for timeline list, 145.86 ms for detail, 100.20 ms for search, and 37.92 ms for sitemap; all 400 requests returned HTTP 200. This passes the declared server target for the one-timeline corpus only and is not presented as representative capacity evidence.

## Recovery acceptance

**Logical recoverability: PASSED.** The isolated staging primary-to-restore rehearsal created a verified logical backup (801,809 bytes), restored it to the distinct restore database, and recovered 179 public tables. The broader repository recovery drill also verified manifest checksums and all nine required recovery query groups. Staging rollback of the Vercel alias was rehearsed and restored to the accepted release.

**PITR acceptance: BLOCKED_FOUNDER.** `ops/recovery/pitr.json` requires provider PITR, a **minimum 24-hour recovery window**, a restore drill within 30 days, a verified manifest, and an isolated restore target. Neon Free offers only six hours of history. The repository does not define a measured backup cadence, RPO, or restore-duration/RTO objective that could make the logical drill equivalent to the 24-hour provider requirement. Consequently the logical procedure proves recoverability, not compliance with the required PITR window. Meeting that policy requires a Founder decision to authorize at least 24-hour database recovery retention; no upgrade was purchased.

## Current staging verification

Read-only revalidation on 2026-10-18 found:

- GCP project `timelines-staging` (project number `673364478850`) is `ACTIVE`; `topic-discovery-daily` remains `PAUSED` on its `0 3 * * *` schedule.
- `https://timelines-staging.vercel.app` resolves to ready isolated deployment `dpl_9WCvzzTjXQ52HagWMmNr8DUVtX5c` in `timelines-app/timelines-staging`.
- The staging website health endpoint returned 200.
- The staging public Function returned 200 for its GET health (`/`), timeline read-model, search, and sitemap contracts. Earlier 404 observations were traced to an incorrect `HEAD` method and non-existent `/api/v2/*` paths; the deployed Function intentionally exposes GET-only `/`, `/read-models`, `/search`, and `/sitemap` routes.
- Discovery remains paused; no Factory research, provider-backed research, real appointment, real publication, or production target was activated.

## Security and operational readiness

The staging canonical URL, Open Graph identity, and server-owned host policy remain isolated. Staging Admin acceptance demonstrated valid MFA access (200), expiry denial (401), wrong-role denial (403), durable revocation denial (401), and correlated audit persistence. Institutional test principals were server-resolved and immutably revoked after the bounded governed chain. The staging alert receiver accepted one signed critical test (201) and returned an idempotent result on its exact retry (200). These results qualify staging only; they do not configure production identities, notification channels, on-call ownership, or production recovery.

## Historical Factory certification

**Staging synthetic institutional journey: PASSED.** Run `tl-staging-004-20261018-a2` completed Factory → Governance → Historical Library → Published Memory → projection → Search → public reader using clearly labelled synthetic evidence, immutable provenance, server-owned institutional actors, and rejection/revocation tests. PostgreSQL-to-Firestore materialisation then passed corpus-scoped parity (179 tables, 135 rows, 2/2 active projections), followed by deployed API and reader validation. This neither activates autonomous discovery nor certifies real historical publication.

**Phase 2 historical certification: BLOCKED_FOUNDER.** Berlin’s Founder-governed affected-community identity/capacity requirement remains unchanged, unresolved, and not certified.

## Final readiness matrix

| Gate | Status | Evidence / exact boundary |
|---|---|---|
| Staging isolation and release provenance | PASSED | Separate GCP/Neon/Vercel resources; ready Vercel deployment and paused discovery reverified. |
| Staging Admin identity, MFA, RBAC, expiry, revocation, audit | PASSED | Synthetic end-to-end session matrix recorded at `8b94506`. |
| Database migration, Firestore/API parity, public projection path | PASSED | Corpus-scoped staging migration, 179 tables/135 rows/2 of 2 projections; deployed reader/API evidence. |
| Governed synthetic institutional integration | PASSED | Factory through public reader chain, provenance, unauthorized denial, and immutable revocation. |
| Monitoring and actual controlled alert delivery | PASSED | Signed receiver: 201 then idempotent 200; staging only. |
| Logical backup/restore and staging rollback | PASSED | Separate restore database, verified logical restore, and staging alias rollback rehearsal. |
| Recovery policy / PITR | BLOCKED_FOUNDER | Policy minimum is 24 hours; Neon Free is six hours. |
| Structural accessibility, keyboard, responsive reader | PASSED | Desktop/mobile plus three-viewport AX and keyboard evidence. |
| Qualified human screen-reader assessment | BLOCKED_EXTERNAL | Qualified participant and macOS action-time system-setting confirmation required. |
| Representative synthetic capacity workload | BLOCKED_EXTERNAL | Profiles are implemented/tested but staging credential/session is currently unavailable. |
| Existing one-timeline service-latency target | PASSED | 400-request Cloud Run telemetry, all 200; restricted to the authorised corpus. |
| Representative corpus/public-Internet capacity | NOT_EXECUTED | Requires the staged fixture corpus and bounded operational test window; no uncontrolled load test run. |
| Production identity, alerting, recovery, promotion | BLOCKED_FOUNDER | Production mutation is expressly unauthorized. |
| Phase-2 Berlin certification | BLOCKED_FOUNDER | Locked Founder-governed affected-community identity/capacity requirement. |

## One recommended path to production

1. Restore only the existing `timelines-staging-primary` connection in the intended TiMELiNES Neon session, run and revoke the four governed capacity profiles, materialise the staging corpus, then execute bounded API/database/concurrent-reader/pagination measurements.
2. Conduct a qualified human screen-reader review of the isolated staging reader and Admin critical route; record findings and correct any verified defect.
3. If the written recovery policy remains mandatory, authorize database retention of at least 24 hours and repeat the isolated restore drill; otherwise formally change no policy—the six-hour limitation remains a launch blocker.
4. After every staging gate is accepted, obtain separate Founder authorization for a production identity/alert/recovery review and a promotion window. Do not deploy until then.

## Durable evidence

- [`TL-STAGING-003.md`](TL-STAGING-003.md)
- [`TL-TIER1-REMAINING-WORK.md`](TL-TIER1-REMAINING-WORK.md)
- [`TL-SUPERGOAL-001.md`](TL-SUPERGOAL-001.md)
- `060d0a9` — bounded staging capacity fixture profiles
- `dpl_9WCvzzTjXQ52HagWMmNr8DUVtX5c` — current isolated staging website deployment

## Final repository regression

After the capacity-profile change, strict TypeScript and the complete mandatory root suite passed (**307 tests, 0 failures**). The Tier-1 security gate also passed with zero high/critical runtime findings in both root and Functions production audits. The recorded lint-tooling-only advisory remains subject to its existing release-review conditions and is not a runtime exception.
