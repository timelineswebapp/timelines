# TL-TIER1-REMAINING-WORK — Tier-1 Completion Gap Assessment

**Status:** Current completion assessment; no runtime authority granted
**Date:** 2026-10-17
**Authority:** Subordinate to `Knowledge/AUTHORITY_INDEX.md`, the V2 canons, locked institutional records, and the Phase-2 boundary in `TL-SUPERGOAL-001`.
**Scope:** Repository and evidence assessment only. No provider-backed certification, discovery, Governance, publication, deployment, Registry, Community Identity, or appointment was activated or changed.

## Executive readiness verdict

**TiMELiNES is implementation-complete for its core institutional architecture and has strong local/shadow verification. It is not Tier-1 production ready and must not launch.**

The shortest credible path is not an architecture redesign and does not reopen Factory, Governance, Library, Published Memory, Projection, Search, or the locked Phase-2 benchmark. It is: reconcile the current release/evidence record; provision and independently verify the real production environment; enroll named MFA-attested Admin operators and prove revocation/audit persistence; run isolated recovery and staging-to-production journey evidence; complete browser/device reader qualification; then obtain the required Founder launch authorization.

`IMPLEMENTED` means code/contracts/configuration exist in the repository. `VERIFIED` means deterministic local tests or a sealed artifact prove the stated behavior. `CERTIFIED` is a named certification with its own bounded claim; it is not a production-environment claim. `PRODUCTION READY` requires the implemented capability, local verification, live environment proof, operational ownership, and an authorized launch decision.

The repository itself contains conflicting historical status prose. In particular, the opening `.70` ledger text in `TL-TIER1-COMPLETION-001.md` says no `.70` run is sealed, while its later dated record and `TL-SUPERGOAL-001.md` identify a sealed `.70` run. The latter sealed artifact references are controlling for this assessment. The contradiction must be reconciled before any release or launch attestation.

## Evidence basis

Repository evidence reviewed includes the V2 Product Experience and Execution Canons; Product/Architecture/Data authority records; Factory, Historical Library, and Operations constitutions; `TL-SUPERGOAL-001`; `TL-TIER1-COMPLETION-001`; `TL-AUTONOMY-001`; institutional certification services/contracts; current public, Admin, cron, Functions, and repository boundaries; migrations/rollbacks; deployment, monitoring, backup, recovery, incident, and retention records; and preserved Phase-2 artifacts.

This assessment independently ran only non-provider, non-mutating local gates on 2026-10-17:

- Root strict typecheck, mandatory test suite (**298 passed**), lint, Tier-1 security gate, monitoring validator, and production-hardening validator: passed.
- Functions strict typecheck and suite (**374 passed, 2 intentional emulator-only skips**): passed.
- Security gate reported zero high/critical runtime findings in root and Functions production dependency audits. The one accepted advisory remains tooling-only and must be reviewed per release.

These checks do not prove a deployed database, Cloud/ Vercel configuration, GitHub scheduler secrets, alert delivery, real backup, restore, performance under load, accessible production UI, or a provider-backed run.

## Prioritized Tier-1 completion matrix

| Workstream | Implemented | Verified | Missing | Priority | Dependency | Acceptance criterion |
|---|---|---|---|---|---|---|
| 1. Autonomous Factory and historical research | Authority-First Factory V2, bounded acquisition, SSRF/robots/access controls, immutable lineage, outcome/deferment and re-entry contracts are implemented. | Functions unit/contract suite; sealed `.70` evidence produced one valid San Francisco CKS and correctly failed Berlin closed. | No four-subject same-release certification; research/dispatch remains deliberately inactive. | P0 — certification boundary, not launch-path code | Founder-governed Berlin identity/capacity disposition | Preserve block; do not claim Phase 2. Independent work proceeds without this run. |
| 2. Public-evidence acquisition and verification | HTTPS-only bounded retrieval, source snapshots, authority/evidence gates, provider resilience, and source-submission candidate flow exist. | Functions tests cover retrieval, authority, lineage, source submission, and no-bypass constraints. | No current live provider/registry health proof; no authorized active acquisition. | P1 | Production Cloud identity, secrets, controlled non-production canary authorization | A bounded, authorized shadow canary proves configured providers, archive, Firestore, and failure telemetry without institutional/public writes. |
| 3. Deferred topics, retries, and operational resilience | Versioned terminal outcomes, deferred projections, relevant-change/retry requests, transaction-owned consumption, bounded retries, and read-only Admin visibility exist. | Root/Functions tests cover retry isolation, corruption rejection, lineage, and authorization. | Runtime consumer/worker dispatch remains intentionally unactivated; no live queue/recovery observation. | P1 | Production operations environment; separate activation authorization | Staging proves retries exhaust, recover, alert, and remain non-publishing; activation is separately approved. |
| 4. Governance and institutional authorization | Governance, Library, institutional actor-resolution, audit, and approval routes/services are implemented. | Institutional suites and isolated PostgreSQL actor-resolution tests are recorded/passing. | No governed production appointments; no live end-to-end institutional transaction evidence. | P0 | Founder appointment/activation authority; staging database | One governed staging journey shows server-resolved institutional actor attribution, rejection/revocation behavior, and no client actor override. |
| 5. Historical Library and Published Memory | Admission, immutable snapshots, lifecycle/continuity, projections, and certification services are implemented. | Historical Library and Published Memory certification suites are repository-certified. | No current production-data parity and recovery proof. | P0 | Migrated production/staging data and verified backups | Isolated restore reproduces Library/Published Memory counts, hashes, lineage, and active projection continuity. |
| 6. Projection Engine, public APIs, and Search | Projection, sitemap, public DTOs, bounded queries, canonical routes, and search contracts are implemented. | Relevant certification and public contract tests pass locally. | No live serverless migration/parity verification or post-deploy crawl/API smoke evidence. | P0 | Serverless migration and staging deployment | `serverless:migrate:verify` and `serverless:api:verify` pass against the intended environment; smoke validates health, catalog, detail, search, sitemap, and canonical redirects. |
| 7. Public website and reader experience | Apple Liquid Glass reader components, timeline/milestone/object/search routes, structured metadata, error/retry states, accessibility-focused unit tests, and the exact Analytics CSP collector origin exist. | Local UI/route tests, emitted-CSP assertion, local public smoke, and optimized production build pass. | No device/browser accessibility audit, production Core Web Vitals/load proof, or real-content journey proof. | P0 | Staging deployment with representative published projections | Pass mobile/desktop keyboard, screen-reader, visual regression, SEO, and Lighthouse performance/accessibility journey gates. |
| 8. Founder/Admin experience | Server-owned Admin routes, RBAC, CSRF, auditing, Factory/Governance/Library controls, Founder dashboard, production legacy-token denial, and production MFA guard exist. | Local route/auth tests verify role, CSRF, attribution, bounded controls, legacy-token denial, pre-handler MFA denial, and failure handling. | No production identity/session provisioning, named-operator enrollment, or live revocation/audit-persistence evidence. | P0 | Founder decision on production admin identity; secret provisioning | Named, MFA-attested operator/session identity is provisioned; revocation and audit persistence are proved in staging. |
| 9. Monetization | Ad campaign repository/Admin APIs and labelled public placements exist; telemetry/analytics scaffolding exists. | Local behavior is indirectly covered by application tests. | Commercial policy, consent/privacy review, inventory/contract review, live measurement, and activation are deferred. | P2 — exclude from minimum launch | Founder commercial/privacy decision | No ads are enabled until policy, consent, disclosure, third-party configuration, and measurement acceptance are approved and tested. |
| 10. Security and infrastructure | Strict validation, server repositories, security headers, CSRF/RBAC, rate limits, signed internal bridges, Firestore rules, deployment script, migrations/rollbacks, and security gate exist. | Local security gate and security route suites pass. | Live secret inventory/rotation, IAM/firestore-rule deployment verification, host hardening, auth assurance, and external security assessment are unproved. | P0 | Access to intended Vercel/GCP/GitHub accounts; Founder authorization for deploy/security vendors | Production configuration review finds no missing/overbroad secret or IAM binding; external authenticated/unauthenticated penetration test has no unresolved high/critical issue. |
| 11. Performance and scalability | Bounded pagination, indexes/migrations, rate limits, queues, provider limits, and performance analytics are implemented. | Unit tests assert bounded query and scale contracts. | No measured p95/p99 latency, database connection/concurrency, queue throughput, projection rebuild, or search-load evidence on production-like data. | P0 | Representative staging corpus and load environment | At target launch concurrency: public read p95 ≤250 ms excluding edge transit, search p95 ≤500 ms, error rate <0.1%, and no unbounded query/queue saturation; document tested load and capacity ceiling. |
| 12. Monitoring, backup, and disaster recovery | Machine-readable dashboards/alerts/retention/severity policies, cron routes, scheduler workflow, backup/restore scripts, PITR policy, and recovery queries exist. | Local monitoring and production-hardening validators pass. | Alert webhook delivery, scheduled execution, actual backup, isolated restore drill, PITR state, RPO/RTO evidence, and on-call ownership are unverified. | P0 | Production secrets, backup target, restore target, operations owner | Deliver one successful backup, checksum verification, isolated restore, recovery-query report, live test alert delivery, and named on-call/incident owner; restore drill is ≤30 days old. |
| 13. End-to-end integration | Services and routes implement Factory → Governance → Library → Published Memory → Projection → Platform boundaries. | Component and institutional certification suites prove deterministic contracts; historic certifications are repository evidence. | No current deployed, production-like full journey from approved input through public reader/search; Phase 2 cannot be used to fill this gap. | P0 | Staging environment, governed test fixture/appointment, approved non-production procedure | Run a non-provider, synthetic or fixture-backed staging journey through all boundaries; verify immutable lineage, public rendering/search, and absence of direct DB/client bypass. |
| 14. Production deployment readiness | Deployment runbook, GCP deploy script, migration/parity scripts, GitHub scheduler workflow, Vercel configuration, and rollback policy are present. | Local validators and build/test evidence exist; no deployment performed in this assessment. | Real staging/prod environment convergence, scheduler secret verification, migration status, exact artifact promotion, rollback rehearsal, and launch checklist are unproved. | P0 | Founder deployment authorization and cloud account access | Promote a signed/identified build to staging, pass all listed live gates, perform rollback rehearsal, then promote that exact artifact with recorded approvals. |
| 15. Final Tier-1 certification | Institutional certification framework and local test/certification commands exist. | Core institutional/Editorial certifications are documented; Phase 2 is explicitly uncertified. | No consolidated production readiness evidence package or authorized final Tier-1 launch certification. | P0 | Workstreams 4–14; Founder launch decision. Phase 2 remains separate and blocked. | A release dossier references passing live evidence for every P0 row and Founder approves production launch; it states Phase 2 remains uncertified unless its locked criterion is later independently met. |

## Current technical maturity

The codebase is **Tier-1 architecture and local-verification mature; production-operations immature**. The strongest evidence is the separation of Factory, Governance, Historical Library, Published Memory, Projection, and Platform ownership; strict server-side validation; deterministic contracts; extensive local tests; and fail-closed historical integrity behavior. The limiting evidence is environmental: `.env.local` supplies only local database/Qwen values, `vercel.json` is empty, and repository configuration validators inspect declared JSON policy rather than a live provider state. This is correct fail-closed engineering, but it is not production proof.

The former Google Analytics CSP collector mismatch is corrected locally and covered by an exact-origin assertion. Browser verification remains required before analytics-dependent launch claims. Reader experience also requires real browser/device/accessibility evidence; the Product Experience Canon requires chronology-first navigation, truthful empty states, mobile/desktop behavior, text fit, and overflow validation.

## Exact outstanding engineering work packages

### WP-01 — Evidence and release-record reconciliation (P0)

Reconcile superseded or contradictory program/operations assertions into one current release dossier. Correct the `.70` ledger contradiction; explicitly classify historical certifications versus current production evidence; inventory the exact source revisions, migrations, serverless migration state, and deployment artifact. This is documentation and verification work, not a canon change.

**Acceptance:** an auditable dossier has no contradictory current-status claim and links every launch assertion to an artifact, command report, timestamp, environment, and owner.

### WP-02 — Production identity, secrets, and least privilege (P0)

Provision the production Vercel, GCP/Firestore/Cloud Tasks, GitHub scheduler, database, archive, webhook, and Admin identity configuration. The legacy static `ADMIN_API_TOKEN` super-admin fallback is already disabled in production code. Use named operator identities with enforced MFA, short-lived/session-bound authentication, revocation persistence, minimum roles, secret rotation records, and no secrets in logs.

**Acceptance:** staging tests prove authenticated and unauthenticated behavior, MFA enforcement, role isolation, session revocation, audit persistence, cron authentication, private function IAM, and Firestore deny-by-default rules. No unresolved high/critical external security finding remains.

### WP-03 — Data and serverless cutover proof (P0)

Execute the existing migration/parity procedure only in an authorized staging environment: dry-run review, idempotent apply, verify, API parity, and bounded real-data smoke tests. Preserve PostgreSQL rollback posture until the defined observation window ends; do not delete Firestore, Tasks, archives, or audit data.

**Acceptance:** zero migration mismatches, public API DTO/hash parity, canonical route/search/sitemap validation, and an approved rollback artifact for the exact release.

### WP-04 — Recovery and operational telemetry proof (P0)

Run the existing backup, checksum, isolated restore, recovery validation, PITR, alert-delivery, and scheduler procedures against real non-production/production-authorized operational targets. Assign an incident commander and service owners and record tested RPO/RTO.

**Acceptance:** a dated successful backup and isolated restore; recovery query counts/hashes reconcile; test critical and warning alerts reach configured routes; scheduler executes all three institution routes in order; restore drill is within 30 days.

### WP-05 — Public and Admin journey qualification (P0)

Execute browser/device accessibility, SEO, visual, error-state, and authenticated Admin operational journeys against staging with representative projections. The GA CSP collector mismatch is already corrected locally and must be browser-verified. Preserve all server-owned boundaries and do not activate discovery, publication, or Governance.

**Acceptance:** keyboard and screen-reader success on public timeline/search/detail and Admin critical flows; mobile/desktop visual approval; no console/network CSP failures; canonical/structured-data checks pass; all failure/retry messages are truthful and accessible.

### WP-06 — Capacity and performance qualification (P0)

Load-test bounded public reads, search, telemetry, database connections, scheduler contention, and projection rebuild using a representative published corpus and launch traffic model. Tune only demonstrated hot paths, indexes, and concurrency; do not redesign the architecture.

**Acceptance:** measured targets in matrix row 11 are met at the declared launch load, database/queue limits are documented, and alerts fire before saturation.

### WP-07 — Non-provider institutional integration certification (P0)

Run an isolated, fixture-backed staging journey through Factory-owned candidate → governed decision → Historical Library admission → Published Memory → projections → API/search/reader. This must use an explicit governed staging actor/appointment and preserve the no-direct-DB/no-client-authority boundary. It is not a Phase-2 run and does not make a publication decision.

**Acceptance:** immutable lineage resolves at every hop, revocation/rejection is fail-closed, public projections render/search only admitted data, and the run is reproducible from recorded fixtures.

### WP-08 — Launch certification dossier and controlled promotion (P0)

Assemble WP-01 through WP-07 into one release dossier, promote the exact validated artifact from staging to production, smoke-test it, retain rollback readiness, and obtain the Founder launch decision.

**Acceptance:** every P0 criterion is evidenced and signed by its operational owner; production health/alerts are green; rollback is rehearsed; the release record explicitly says Phase 2 remains uncertified.

### WP-09 — Monetization activation (P2, not launch-critical)

Keep ads off for minimum launch. After the Founder approves commercial/privacy policy, validate disclosure, consent, advertiser review, measurement, fraud/privacy controls, and third-party scripts in a separate governed release.

**Acceptance:** activation does not degrade reading performance, accessibility, privacy posture, or historical authority boundaries.

## Dependency-aware execution order

1. **WP-01** establishes a truthful release and evidence baseline.
2. **WP-02** provisions the minimum secure environment and removes the privileged auth launch blocker.
3. Run **WP-03** and **WP-04** in parallel once the environment exists; both are required before public data or operations claims.
4. Run **WP-05**, **WP-06**, and **WP-07** in parallel against the stable staging result.
5. Complete **WP-08** only when all P0 evidence is green and the Founder authorizes promotion.
6. Execute **WP-09** only after launch, as a distinct commercial/privacy decision.

Phase 2 is intentionally outside this execution chain. Its Berlin affected-community identity/capacity requirement remains Founder-governed and unchanged. It blocks only Phase-2 certification, not the independent P0 engineering and operational qualification listed above.

## Genuine Founder-only decisions

- Decide the historically governed Berlin affected-community identity/capacity disposition, if and when Phase 2 is resumed. Do not infer an identity, alias, Registry capacity, budget, provider, or benchmark change.
- Authorize use of the named production accounts and the staging-to-production deployment/promotion window.
- Approve institutional appointments and any activation of Governance, publication, discovery, or runtime research; no appointment is created by this program.
- Approve the production Admin identity provider/assurance policy if it entails a material third-party service or commercial commitment.
- Approve launch after receiving the WP-08 evidence dossier.
- Approve monetization, privacy/consent posture, commercial integrations, and advertising activation separately.

All other tasks in WP-01 through WP-07 are engineering verification and remediation tasks that can be completed independently once the required environment access and approved non-production operational window are available.

## Production launch blockers

1. No live-environment evidence proves deployment, migrations/API parity, least-privilege IAM, scheduler secrets, alert delivery, database connectivity, or production health.
2. No actual backup plus isolated restore/PITR drill is evidenced.
3. No production identity/session provisioning, named operator enrollment, or live MFA/revocation/audit-persistence evidence exists.
4. No browser/device accessibility, real-content reader, or load/capacity qualification exists; the locally corrected CSP must be verified in a real browser journey.
5. No current production-like full institutional journey is evidenced.
6. No final release dossier, rollback rehearsal, or Founder launch authorization exists.

Phase 2 being uncertified is **not** a generic excuse to defer these blockers. It is a separate locked historical-certification boundary and must remain labeled as such.

## Recommended minimum path to Tier-1 production readiness

Complete WP-01 through WP-08, in that order and with the stated parallelization. Launch the curated/public read experience only after its data, operational controls, and reader journeys have live proof. Keep Factory discovery, autonomous research dispatch, Governance submission, and monetization inactive unless separately authorized. This path is deliberately narrow: it uses current architecture and current controls, closes only demonstrable launch gaps, and makes no claim that Phase 2 has passed.

## Proposed autonomous execution plan

When environment access and the bounded operational window are authorized, execute this program autonomously within the following rails:

1. Create and maintain the WP-01 release dossier from generated command reports; fail the program on any evidence contradiction or unknown artifact identity.
2. Validate configuration presence and least privilege without printing secrets. Fail closed on absent production variables, scheduler credentials, private-function constraints, or missing audit persistence.
3. Run staging migration/parity, recovery, monitoring, browser, security, performance, and fixture-backed integration gates as bounded jobs with structured artifacts.
4. Do not invoke providers, activate discovery, mutate Registry capacity/Community Identity, create appointments, submit Governance work, publish, or deploy to production without the corresponding Founder authorization.
5. Aggregate only passing, dated evidence into WP-08. If any gate fails, open a bounded defect work package, remediate the proved defect, and rerun only the affected gate plus its dependency chain.
6. Stop at the Founder launch decision. Keep Phase 2 separately blocked until its Founder-governed historical requirement is resolved and a fresh locked certification is authorized.

## Verification record for this assessment

The initial assessment changed only this document and the cross-reference in `TL-SUPERGOAL-001.md`. The subsequent P0 increment changed only scoped local code, tests, configuration documentation, and this evidence record. It did not run provider-backed certification, contact external providers, activate discovery/Governance/publication/deployment, change Registry capacity/historical requirements/institutional authority, or create appointments.

## P0 execution ledger

### 2026-10-17 — P0-A secure Admin identity: local/isolated completion

Implemented the two production guards required before any Admin route can be treated as launch-safe:

- `ADMIN_API_TOKEN` is now a non-production compatibility path only. In production, a shared legacy bearer token cannot resolve a super-admin identity.
- Every `withAdminAuth` route now rejects an authenticated identity without server-attested MFA in production, before RBAC or handler execution. Cron and machine-to-machine paths retain their separate authenticated boundaries.

The environment example now declares the required named-operator and signed-session configuration keys. Focused route/security tests prove legacy-token denial in production, MFA denial before handler invocation, role denial, signed-session expiry/revocation, CSRF, and audit behavior. The isolated PostgreSQL institutional-actor harness passed valid, missing, expired, revoked, wrong-institution, wrong-scope, ambiguous, concurrent-revocation, server-attribution, forged-client-actor, rollback, and repeatability scenarios. No appointment was created outside the temporary fixture database.

**Status:** implementation and local/isolated verification complete. Production identity-provider provisioning, named operator enrollment, and live audit/revocation persistence remain Founder/environment blockers.

### 2026-10-17 — P0-B/P0-D configuration and migration verification: local completion

`npm run ops:migrations:dry-run` passed and enumerated the complete ordered migration plan through `20260730_institutional_actor_appointments`. Monitoring and production-hardening validators passed (27 metrics, 15 alerts; dashboards, alert routes, PITR policy, retention, promotion/rollback, and severity definitions valid). These validate repository contracts only; they do not prove a deployed migration ledger, webhook delivery, scheduler secrets, provider PITR, or an actual restore.

**Status:** local configuration verification complete. Staging migration/parity and operational delivery remain environment-bound blockers.

### 2026-10-17 — P0-E public experience: targeted implementation and local smoke verification

Corrected the documented Google Analytics collection CSP mismatch by allowing only `https://www.google.com` in addition to the existing Analytics and Tag Manager origins; wildcard sources remain prohibited. The release build also exposed and corrected a Next 16 route-contract violation: the health route no longer exports a non-route test seam. The default build command now intentionally uses the stable Webpack production compiler because the installed Next 16.3.8 Turbopack compiler reproducibly fails resolving `next/font/google` after a clean cache; this is a bounded build-tool workaround, not a runtime architecture change. A local development smoke confirmed 200 responses for homepage and search, canonical and structured metadata, health response, and the emitted exact CSP. Root typecheck, the root suite (298 passed), Functions typecheck, Functions suite (374 passed, 2 intentional emulator-only skips), lint, security gate, monitoring validator, production-hardening validator, and optimized Webpack production build passed for the increment.

**Status:** local implementation verification complete. This is not a browser accessibility audit, production performance measurement, or staging proof; those acceptance gates remain open.
