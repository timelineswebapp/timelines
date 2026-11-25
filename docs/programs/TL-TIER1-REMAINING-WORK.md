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
| 1. Autonomous Factory and historical research | Authority-First Factory V2, bounded acquisition, SSRF/robots/access controls, immutable lineage, outcome/deferment and re-entry contracts are implemented. | Functions unit/contract suite; Factory editorial certification 64/64 and authenticated mutation boundary tests 3/3 pass; sealed `.70` evidence produced one valid San Francisco CKS and correctly failed Berlin closed. | No four-subject same-release certification; research/dispatch remains deliberately inactive. | P0 — certification boundary, not launch-path code | Founder-governed Berlin identity/capacity disposition | Preserve block; do not claim Phase 2. Independent work proceeds without this run. |
| 2. Public-evidence acquisition and verification | HTTPS-only bounded retrieval, source snapshots, authority/evidence gates, provider resilience, and source-submission candidate flow exist. | Functions tests cover retrieval, authority, lineage, source submission, and no-bypass constraints. | No current live provider/registry health proof; no authorized active acquisition. | P1 | Production Cloud identity, secrets, controlled non-production canary authorization | A bounded, authorized shadow canary proves configured providers, archive, Firestore, and failure telemetry without institutional/public writes. |
| 3. Deferred topics, retries, and operational resilience | Versioned terminal outcomes, deferred projections, relevant-change/retry requests, transaction-owned consumption, bounded retries, and read-only Admin visibility exist. | Root/Functions tests cover retry isolation, corruption rejection, lineage, and authorization. | Runtime consumer/worker dispatch remains intentionally unactivated; no live queue/recovery observation. | P1 | Production operations environment; separate activation authorization | Staging proves retries exhaust, recover, alert, and remain non-publishing; activation is separately approved. |
| 4. Governance and institutional authorization | Governance, Library, institutional actor-resolution, audit, and approval routes/services are implemented. | Institutional suites and isolated PostgreSQL actor-resolution tests are recorded/passing. | No governed production appointments; no live end-to-end institutional transaction evidence. | P0 | Founder appointment/activation authority; staging database | One governed staging journey shows server-resolved institutional actor attribution, rejection/revocation behavior, and no client actor override. |
| 5. Historical Library and Published Memory | Admission, immutable snapshots, lifecycle/continuity, projections, and certification services are implemented. | Historical Library and Published Memory certification suites are repository-certified. | No current production-data parity and recovery proof. | P0 | Migrated production/staging data and verified backups | Isolated restore reproduces Library/Published Memory counts, hashes, lineage, and active projection continuity. |
| 6. Projection Engine, public APIs, and Search | Projection, sitemap, public DTOs, bounded queries, canonical routes, and search contracts are implemented. | Relevant certification and public contract tests pass locally; synthetic projection browser journeys exercise reader/search DTO consumption. | No live serverless migration/parity verification or post-deploy crawl/API smoke evidence. | P0 | Serverless migration and staging deployment | `serverless:migrate:verify` and `serverless:api:verify` pass against the intended environment; smoke validates health, catalog, detail, search, sitemap, and canonical redirects. |
| 7. Public website and reader experience | Apple Liquid Glass reader components, timeline/milestone/object/search routes, structured metadata, error/retry states, accessibility-focused unit tests, and the exact Analytics CSP collector origin exist. | Local UI/route tests, emitted-CSP assertion, optimized production build, and production-mode browser journeys over synthetic projection fixtures pass. | No device/browser assistive-technology audit, production Core Web Vitals/load proof, or representative real-content journey proof. | P0 | Staging deployment with representative published projections | Pass mobile/desktop keyboard, screen-reader, visual regression, SEO, and Lighthouse performance/accessibility journey gates. |
| 8. Founder/Admin experience | Server-owned Admin routes, RBAC, CSRF, auditing, Factory/Governance/Library controls, Founder dashboard, production legacy-token denial, and production MFA guard exist. | Local route/auth tests plus production-mode HTTP checks verify anonymous/legacy denial, MFA denial, named MFA token success, signed MFA session success, expiry denial, role isolation, attribution, bounded controls, and failure handling. | No production identity/session provisioning, named-operator enrollment, or live revocation/audit-persistence evidence. | P0 | Founder decision on production admin identity; secret provisioning | Named, MFA-attested operator/session identity is provisioned; revocation and audit persistence are proved in staging. |
| 9. Monetization | Ad campaign repository/Admin APIs and labelled public placements exist; telemetry/analytics scaffolding exists. | Local behavior is indirectly covered by application tests. | Commercial policy, consent/privacy review, inventory/contract review, live measurement, and activation are deferred. | P2 — exclude from minimum launch | Founder commercial/privacy decision | No ads are enabled until policy, consent, disclosure, third-party configuration, and measurement acceptance are approved and tested. |
| 10. Security and infrastructure | Strict validation, server repositories, security headers, CSRF/RBAC, rate limits, signed internal bridges, Firestore rules, deployment script, migrations/rollbacks, and security gate exist. | Local security gate and security route suites pass. | Live secret inventory/rotation, IAM/firestore-rule deployment verification, host hardening, auth assurance, and external security assessment are unproved. | P0 | Access to intended Vercel/GCP/GitHub accounts; Founder authorization for deploy/security vendors | Production configuration review finds no missing/overbroad secret or IAM binding; external authenticated/unauthenticated penetration test has no unresolved high/critical issue. |
| 11. Performance and scalability | Bounded pagination, indexes/migrations, rate limits, queues, provider limits, and performance analytics are implemented. | Unit tests assert bounded query and scale contracts; isolated fixture load baseline passed homepage p95 96 ms and search p95 60 ms at 10-way concurrency with zero failures. | No measured database connection/concurrency, queue throughput, projection rebuild, or search-load evidence on representative production-like data. | P0 | Representative staging corpus and load environment | At target launch concurrency: public read p95 ≤250 ms excluding edge transit, search p95 ≤500 ms, error rate <0.1%, and no unbounded query/queue saturation; document tested load and capacity ceiling. |
| 12. Monitoring, backup, and disaster recovery | Machine-readable dashboards/alerts/retention/severity policies, cron routes, scheduler workflow, backup/restore scripts, PITR policy, and recovery queries exist. | Local monitoring and production-hardening validators pass; isolated PostgreSQL backup → checksum → restore → recovery-query and three-severity webhook-delivery drills passed with the real code. | Real alert route delivery, scheduled execution, deployed-data backup/restore, provider PITR state, RPO/RTO evidence, and on-call ownership are unverified. | P0 | Production secrets, backup target, restore target, operations owner | Deliver one successful backup, checksum verification, isolated restore, recovery-query report, live test alert delivery, and named on-call/incident owner; restore drill is ≤30 days old. |
| 13. End-to-end integration | Services and routes implement Factory → Governance → Library → Published Memory → Projection → Platform boundaries. | Component/institutional certification suites prove deterministic contracts; current Historical Library, Published Memory, Projection, Search, and Platform suites pass 37/37. | No current deployed, production-like full journey from approved input through public reader/search; Phase 2 cannot be used to fill this gap. | P0 | Staging environment, governed test fixture/appointment, approved non-production procedure | Run a non-provider, synthetic or fixture-backed staging journey through all boundaries; verify immutable lineage, public rendering/search, and absence of direct DB/client bypass. |
| 14. Production deployment readiness | Deployment runbook, GCP deploy script, migration/parity scripts, GitHub scheduler workflow, Vercel configuration, and rollback policy are present. | Local validators, optimized production build, and full isolated migration-ledger/rollback-reapply evidence exist; no deployment was performed. | Real staging/prod environment convergence, scheduler secret verification, migration status, exact artifact promotion, rollback rehearsal, and launch checklist are unproved. | P0 | Founder deployment authorization and cloud account access | Promote a signed/identified build to staging, pass all listed live gates, perform rollback rehearsal, then promote that exact artifact with recorded approvals. |
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

The repository’s real backup, checksum, restore, and recovery-validation commands have passed against two isolated temporary PostgreSQL instances. Run the same procedures, PITR, alert-delivery, and scheduler procedures against real non-production/production-authorized operational targets. Assign an incident commander and service owners and record tested RPO/RTO.

**Acceptance:** a dated successful backup and isolated restore; recovery query counts/hashes reconcile; test critical and warning alerts reach configured routes; scheduler executes all three institution routes in order; restore drill is within 30 days.

### WP-05 — Public and Admin journey qualification (P0)

Production-mode local browser journeys have passed over a synthetic, read-only projection fixture: homepage/search empty state, navigation dialog/focus return, timeline rendering, milestone dialog, direct milestone route, positive search result, canonical metadata, JSON-LD, external-link isolation, emitted CSP, and mobile overflow checks. Execute the remaining browser/device accessibility, visual, and authenticated Admin operational journeys against staging with representative projections. The GA CSP collector mismatch is corrected locally and browser-visible. Preserve all server-owned boundaries and do not activate discovery, publication, or Governance.

**Acceptance:** keyboard and screen-reader success on public timeline/search/detail and Admin critical flows; mobile/desktop visual approval; no console/network CSP failures; canonical/structured-data checks pass; all failure/retry messages are truthful and accessible.

### WP-06 — Capacity and performance qualification (P0)

The first local baseline used the production server, temporary PostgreSQL, and synthetic public projections: 100 requests at concurrency 10 completed with zero failures; homepage p95 was 96 ms and search p95 was 60 ms. This proves only local fixture behavior. Load-test bounded public reads, search, telemetry, database connections, scheduler contention, and projection rebuild using a representative published corpus and launch traffic model. Tune only demonstrated hot paths, indexes, and concurrency; do not redesign the architecture.

**Acceptance:** measured targets in matrix row 11 are met at the declared launch load, database/queue limits are documented, and alerts fire before saturation.

### WP-07 — Non-provider institutional integration certification (P0)

Current non-provider certification suites passed 37/37 tests across Historical Library, Published Memory, Projection Engine, Search, and Platform; Factory editorial certification passed 64/64, and Admin Factory mutation boundaries passed 3/3. Together they verify deterministic lifecycle/failure invariants, Factory-only non-authoritative work, server-derived actor attribution, and projection-backed public rendering while explicitly preserving each institution’s boundary. Run an isolated, fixture-backed staging journey through Factory-owned candidate → governed decision → Historical Library admission → Published Memory → projections → API/search/reader. This must use an explicit governed staging actor/appointment and preserve the no-direct-DB/no-client-authority boundary. It is not a Phase-2 run and does not make a publication decision.

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
2. No deployed-data backup, provider PITR state, or environment-owned restore drill is evidenced. The local isolated fixture drill is not a substitute for this operational proof.
3. No production identity/session provisioning, named operator enrollment, or live MFA/revocation/audit-persistence evidence exists.
4. No device/assistive-technology accessibility audit, representative real-content reader qualification, or production-like load/capacity measurement exists. Local browser and load proof are fixture-backed only.
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

**P0 local checkpoint:** `76ac68b` (`fix: harden P0 admin and release build gates`). This immutable repository checkpoint contains the scoped P0-A/P0-E remediation, the route-contract build correction, and the evidence updates recorded below. It is not a staging or production release artifact.

### 2026-10-17 — P0-A secure Admin identity: local/isolated completion

Implemented the two production guards required before any Admin route can be treated as launch-safe:

- `ADMIN_API_TOKEN` is now a non-production compatibility path only. In production, a shared legacy bearer token cannot resolve a super-admin identity.
- Every `withAdminAuth` route now rejects an authenticated identity without server-attested MFA in production, before RBAC or handler execution. Cron and machine-to-machine paths retain their separate authenticated boundaries.

The environment example now declares the required named-operator and signed-session configuration keys. Focused route/security tests prove legacy-token denial in production, MFA denial before handler invocation, role denial, signed-session expiry/revocation, CSRF, and audit behavior. A production-mode HTTP server with fixture-only credentials separately returned 401 for anonymous and legacy shared-token requests, 403/`MFA_REQUIRED` for a named non-MFA operator, 200 for a named MFA operator, 200 for a valid MFA signed session, 401 for an expired session, and 403/`FORBIDDEN` for an MFA signed session without the required role. The isolated PostgreSQL institutional-actor harness passed valid, missing, expired, revoked, wrong-institution, wrong-scope, ambiguous, concurrent-revocation, server-attribution, forged-client-actor, rollback, and repeatability scenarios. No appointment was created outside the temporary fixture database.

**Status:** implementation and local/isolated verification complete. Production identity-provider provisioning, named operator enrollment, and live audit/revocation persistence remain Founder/environment blockers.

### 2026-10-17 — P0-B/P0-D configuration and migration verification: local completion

`npm run ops:migrations:dry-run` passed and enumerated the complete ordered migration plan through `20260730_institutional_actor_appointments`. The real migration runner subsequently applied all 58 migrations to an isolated PostgreSQL database initialized from the current schema; a repeat invocation was idempotent; `20260730_institutional_actor_appointments` rolled back; and the runner reapplied it with the full 58-entry ledger restored. The Firebase Functions TypeScript production build also passed locally without contacting or deploying to Firebase. Monitoring and production-hardening validators passed (27 metrics, 15 alerts; dashboards, alert routes, PITR policy, retention, promotion/rollback, and severity definitions valid). The real alert delivery function also posted critical, warning, and info synthetic payloads to three separate local-only collectors and received HTTP 202 from each. These validate local repository/fixture contracts only; they do not prove a deployed migration ledger, Firestore/API parity, real webhook delivery, scheduler secrets, provider PITR, or an actual environment-owned restore.

**Status:** local configuration verification complete. Staging migration/parity and operational delivery remain environment-bound blockers.

### 2026-10-17 — P0-C backup and recovery: isolated full-command verification

Ran the repository’s actual `ops:backup`, backup-manifest checksum verification, `ops:restore`, and `ops:recovery:verify` commands against two distinct, temporary PostgreSQL instances. The source was seeded only with an isolated synthetic timeline. The backup copied and checksum-verified 91 artifacts; the restore target received the custom PostgreSQL dump; all nine required recovery validation queries completed successfully, including the authority, Historical Library, Published Memory, projection, and provider-runtime tables. Source and restored timeline counts both equalled one. The temporary PostgreSQL instances were stopped at completion. No configured database, provider, or production resource was accessed or changed.

**Status:** implementation and isolated fixture acceptance evidence complete. This does not establish provider PITR, deployed-data recoverability, RPO/RTO, scheduled restoration, alert delivery, or operational ownership; those environment-bound gates remain open.

### 2026-10-17 — P0-E public experience: targeted implementation and local smoke verification

Corrected the documented Google Analytics collection CSP mismatch by allowing only `https://www.google.com` in addition to the existing Analytics and Tag Manager origins; wildcard sources remain prohibited. The release build also exposed and corrected a Next 16 route-contract violation: the health route no longer exports a non-route test seam. The default build command now intentionally uses the stable Webpack production compiler because the installed Next 16.3.8 Turbopack compiler reproducibly fails resolving `next/font/google` after a clean cache; this is a bounded build-tool workaround, not a runtime architecture change. A local development smoke confirmed 200 responses for homepage and search, canonical and structured metadata, health response, and the emitted exact CSP. Root typecheck, the root suite (298 passed), Functions typecheck, Functions suite (374 passed, 2 intentional emulator-only skips), lint, security gate, monitoring validator, production-hardening validator, and optimized Webpack production build passed for the increment.

**Status:** local implementation and browser-fixture verification complete. This is not a device/assistive-technology accessibility audit, production performance measurement, or staging proof; those acceptance gates remain open.

### 2026-10-17 — P0-E public reader: production-mode synthetic browser journey

Ran the production build under `next start` against a disposable localhost serverless projection fixture. The fixture exposed only synthetic, read-only public timeline/milestone/category/tag/search/sitemap data and did not contact any provider or configured publication system. Browser checks passed for: homepage semantics and structured metadata; the no-results search state; navigation-dialog open/close with Escape and focus returning to its trigger; a positive timeline reader route; keyboard-dismissable milestone detail; direct canonical milestone route; positive search result; canonical metadata and JSON-LD on timeline/milestone/search; `noopener noreferrer` on source links; exact emitted CSP; and mobile-width absence of horizontal overflow. The production-mode console had no errors or warnings for the fixture server. The development server was deliberately excluded from this interactive result because its strict production CSP blocks React development-only `eval`; that is an expected development-runtime incompatibility, not a production build failure.

**Status:** browser-fixture acceptance evidence complete. Device/assistive-technology testing, visual review, representative staged content, Core Web Vitals, and load evidence remain environment-bound acceptance gates.

### 2026-10-17 — P0-E/P0-06 production-server fixture performance baseline

Ran ApacheBench against the optimized production server backed exclusively by temporary PostgreSQL and a disposable local public-projection fixture. After warm-up, each route received 100 requests at concurrency 10. Homepage: 0 failed requests, 196.06 requests/second, mean 51.005 ms, p95 96 ms, maximum 119 ms. Search: 0 failed requests, 241.34 requests/second, mean 41.435 ms, p95 60 ms, maximum 62 ms. Temporary processes were stopped after the drill.

**Status:** local fixture performance baseline complete and within the matrix latency objectives at the declared local load. It is not a production capacity claim: representative corpus, edge/network effects, Cloud/Firestore, connection limits, scheduler contention, projection rebuild, and saturation alerts remain staging/operations acceptance gates.

### 2026-10-17 — P0-F institutional boundary certification refresh

Ran the current non-provider certification suites without invoking their provider-backed commands or operational workflows: Historical Library 7/7, Published Memory 7/7, Projection Engine 7/7, Search 8/8, and Public Platform 8/8 (37/37 total). Factory editorial certification separately passed 64/64, and Factory Admin operation/runtime mutation tests passed 3/3. The suites establish deterministic Tier-A corpus behavior, lifecycle and failure-injection coverage, immutable persistence registration, Factory-only non-authoritative work, server-derived actor attribution, boundary-scoped commands, and projection-backed public rendering. Each suite intentionally stops at the next institution; none creates a Governance appointment, submits Governance work, publishes data, or represents a full live institutional journey.

**Status:** repository certification evidence refreshed. The full synthetic staging journey remains blocked pending an explicitly authorized non-production governed fixture/appointment procedure; it must not be simulated by activating the restricted Governance or publication operations.

### 2026-10-17 — P0-G final local release gate

Ran the complete authorized local release gate from the current repository state: root strict typecheck; mandatory root suite (**298/298 passed**); lint; Tier-1 security gate; optimized Webpack production build; and the full Functions suite (**374 passed, 2 intentional emulator-only skips**). The security gate again reported zero high/critical runtime production dependency findings; `GHSA-vfj7-8cjw-p6xm` remains the already documented repository-owned lint-tooling-only exception. The first build encountered only a stale generated `.next/server/app/api` removal race (`ENOTEMPTY`). That generated cache alone was moved recoverably to `/Users/solofilms/.Trash/Timelines-next-p0-release-20261017092940`; the subsequent clean build compiled successfully and generated 58 static pages. No source, configuration, provider, deployment, institutional, Registry, public, or historical data changed during cache recovery.

**Status:** authorized local P0-G release evidence is complete. This is not a deployable-release attestation: exact-artifact promotion, live secret/IAM review, staging migration/API parity, real backup/PITR and alert delivery, representative accessibility/performance qualification, governed staging journey, rollback rehearsal, and Founder launch approval remain mandatory open gates. Phase 2 remains blocked and uncertified.

### 2026-10-17 — P0 staging-capability audit: no authorized target established

Performed a read-only local capability audit without invoking any provider API, deployment, certification, or mutation. The workspace contains only `.env.local` entries for a local database, local model/runtime settings, and Vercel OIDC; it has no staging or production environment file. The configured Firebase project mapping is `tiimeliines`, while the locally selected GCP CLI project is `booktown-ai-staging`; this proves neither access to nor parity with the intended TiMELiNES target. A local Vercel project mapping exists, but no deployed environment, secret inventory, release identity, or promotion approval was queried or assumed.

**Status:** the environment prerequisite is explicitly unproved, not failed. Founder authorization is required to identify the intended staging target and permit bounded read-only configuration inspection and subsequent non-production verification. Until then, migration/API parity, real alert delivery, deployed backup/PITR recovery, authenticated identity persistence, governed staging integration, and promotion/rollback evidence cannot be truthfully executed. No provider state changed.

### 2026-10-17 — P0 deployed-artifact smoke: current production is stale

Performed a minimal unauthenticated, read-only HTTP smoke against the Vercel-reported public URL and the newest failed preview. The public homepage and `/api/health` returned HTTP 200; health reported only `{ ok: true, db: true, env: true }`. The public homepage’s emitted `connect-src` omits `https://www.google.com`, although the current repository’s verified CSP contains that exact origin. Therefore, the live production artifact is not the validated local release and cannot supply current P0 acceptance evidence. The newest preview deployment is marked `Error` by Vercel and resolves to Vercel’s generic, noindex error surface rather than a TiMELiNES preview; it is not a staging environment.

**Status:** public availability is observed, but release parity and staging are not established. Do not patch or promote the live environment outside the controlled promotion procedure. Founder authorization is required to create or select a non-production target, deploy the exact reviewed artifact, and run the bounded staging gates before any production promotion.

### 2026-10-17 — P0-G Vercel build-contract remediation

Read-only inspection of the newest failed preview identified a deterministic build failure: Vercel installed only root dependencies, then Next type-checked imports from `functions/**`; Functions-only `@google/genai` and `@google-cloud/tasks` packages were absent. The preview was built from commit `c458062` with the old default Next 16.3.4 Turbopack command and never produced a TiMELiNES artifact. The release configuration now explicitly performs the two independently locked installs (`npm ci && npm --prefix functions ci`) before invoking the verified root Webpack build. A hardening regression locks both commands.

Verified the contract from a fresh, isolated copy with no pre-existing root or Functions dependencies: root `npm ci`, Functions `npm --prefix functions ci`, then the optimized production build completed successfully with all routes and 57 static pages. Root strict typecheck, mandatory suite (**298/298**), lint, Tier-1 security gate (zero high/critical runtime findings), and Functions TypeScript build also passed. The temporary isolated copy is retained under `/tmp/timelines-vercel-install-contract-HsUgp5` for local audit only; no deployment was triggered.

Read-only Vercel project inspection reports the dashboard defaults (`npm install` and the framework build default), while the repository provides explicit commands. [Vercel's static-configuration contract](https://vercel.com/docs/project-configuration/vercel-json) confirms that `vercel.json` `installCommand` and `buildCommand` override those project settings for a deployment. The current source configuration is therefore the authoritative build contract for a future preview, pending actual authorized execution.

Added the repository's first non-deployment release-gate workflow. It runs only for pull requests or explicit manual dispatch, has read-only repository permission, pins its GitHub Actions revisions, uses the project’s Vercel Node 24 major, installs both lockfiles, and runs root typecheck/test/lint/security/build plus Functions build/test. It neither calls a provider nor invokes deployment, discovery, Governance, publication, or institutional mutations. Static hardening coverage protects each command. The local equivalent passed after this addition: root mandatory suite **299/299**, Functions suite **374 passed / 2 intentional emulator-only skips**, Functions build, root typecheck, lint, security gate, optimized root build, and diff check.

Read-only GitHub API inspection established that the public repository’s default branch is `main` at `36c0ba7bc587cc1f40caab20e203c596395241da` and is not protected; the branch-protection endpoint returns no configuration. The release-gate workflow therefore provides evidence when run but cannot currently prevent direct promotion to `main`. Establishing a GitHub ruleset or branch protection requiring the `Tier-1 Release Gate`, review, and up-to-date resolution is an external Founder-owned security control; it was not changed.

**Status:** the known preview build failure is remediated and reproducibly verified locally. An authorized fresh preview must still execute this contract in Vercel before it can become staging evidence; the existing failed previews and stale production deployment remain non-qualifying.

### 2026-10-17 — P0 production-environment inventory: named Admin and operations configuration absent

Read-only Vercel environment inventory (names only; no secret values were read) finds `DATABASE_URL`, `CRON_SECRET`, `SERVERLESS_API_BASE_URL`, `BACKEND_SHARED_SECRET`, and the legacy `ADMIN_API_TOKEN` in production/preview. It does **not** contain `ADMIN_OPERATOR_TOKENS` or `ADMIN_SESSION_SECRET`; because production intentionally rejects the legacy bearer path, no named MFA-attested Admin token or signed session can currently authenticate there. This is a secure failure, but it prevents P0-A’s intended-environment Admin journey.

The same inventory lacks all canonical operational delivery keys (`OPERATIONS_CRITICAL_WEBHOOK_URL`, `OPERATIONS_WARNING_WEBHOOK_URL`, and `OPERATIONS_INFO_WEBHOOK_URL`), `RESTORE_DATABASE_URL`, `BACKUP_DIR`, and `NEXT_PUBLIC_SITE_URL`. The missing webhooks preclude real alert delivery; the missing restore target precludes scheduled isolated restore verification; and scheduled SEO validation explicitly requires `NEXT_PUBLIC_SITE_URL`. The configured public-site code safely canonicalizes reader metadata to the verified public host, but that fallback does not satisfy the scheduled-operation contract. Values and cross-provider parity remain unproved even for keys that exist.

Corrected the repository template to declare the three webhook keys and added a regression that derives every documented alert key from `ops/alerts/delivery.json`; focused hardening tests, strict typecheck, mandatory root suite (**300/300**), lint, and diff check passed. The missing Vercel configuration must be created by the authorized environment owner with named MFA-attested identities, real operation endpoints, and an isolated restore target; no secret or provider state was changed.

### 2026-10-17 — P0 serverless target inventory: active but stale Functions plane

Read-only GCP inspection using the existing non-active account selector confirms that project `tiimeliines` is active and exposes five second-generation Functions/Cloud Run services in `us-central1`: `timelines-public-api`, `institutional-transitions`, `priority-topic-generation`, `autonomous-topic-generation`, and `topic-discovery`. All report active/ready service state, but their most recent updates are 8 September 2026. The public API is on revision `timelines-public-api-00007-kic`; institutional transitions are on `institutional-transitions-00016-nit`; both run as Cloud Functions-managed Node.js 22 services. They predate the current P0 hardening, Admin identity, CSP, Vercel build-contract, and release-gate commits, and therefore cannot establish current Functions/API parity.

No function endpoint, discovery path, Governance path, publication path, task, or deployment was invoked. The existence of an active `topic-discovery` service does not authorize or demonstrate discovery: its state must remain untouched under the preserved restriction. An authorized fresh non-production deployment of the exact reviewed Functions artifact, followed by `serverless:migrate:verify` and `serverless:api:verify` against the intended target, remains mandatory.

### 2026-10-17 — P0 serverless transport and discovery-state reconciliation

Read-only Cloud Run IAM inspection verifies the expected transport boundary: `timelines-public-api` alone grants `roles/run.invoker` to `allUsers`; `institutional-transitions`, `priority-topic-generation`, and `autonomous-topic-generation` grant it only to `timelines-tasks-invoker@tiimeliines.iam.gserviceaccount.com`; `topic-discovery` grants it only to `timelines-scheduler@tiimeliines.iam.gserviceaccount.com`. This is partial infrastructure evidence, not a current-release certification, because every service remains stale.

The authoritative Cloud Scheduler job `topic-discovery-daily` is **PAUSED**, scheduled for `0 3 * * *` UTC, and targets the discovery Function through the dedicated scheduler service account. This resolves older conflicting prose that claimed it enabled and confirms that discovery has not been resumed. The three worker queues are `RUNNING` with bounded rates (autonomous 1/s, institutional 10/s, priority 5/s) and five maximum attempts, but they were not invoked and queue enablement does not authorize generation, Governance, publication, or discovery.

### 2026-10-17 — P0-C provider recovery-control inventory

Read-only GCP inspection confirms provider-side recovery controls for the active Firestore database: native-mode database `(default)` in `nam5`, delete protection enabled, point-in-time recovery enabled, and `604800s` (seven-day) version retention; the earliest currently available version is `2026-10-10T06:54:00Z`. The institutional archive bucket (`gs://tiimeliines-institutional-archive`) is US multi-region Standard storage with enforced public-access prevention, uniform bucket-level access, object versioning, seven-day soft delete, and a `31557600`-second (one-year) retention policy.

**Status:** actual provider configuration is now evidenced for the Firestore/archive portion of recovery posture. It does not prove PostgreSQL/Neon PITR, backup artifact completeness, restore access, RPO/RTO achievement, or a current end-to-end recovery drill. No data, object, backup, restore, lifecycle policy, or provider configuration was read beyond metadata or changed.

### 2026-10-17 — P0-D provider monitoring inventory: no live alert policy or channel

Read-only Google Cloud Monitoring inventory returned zero alert policies and zero notification channels in `tiimeliines`. Together with the Vercel inventory’s absence of `OPERATIONS_CRITICAL_WEBHOOK_URL`, `OPERATIONS_WARNING_WEBHOOK_URL`, and `OPERATIONS_INFO_WEBHOOK_URL`, there is no configured production provider path for the repository’s 15 declared alert conditions to reach an operator. Local webhook delivery proves only payload and route-code behavior, not provider delivery.

**Status:** P0-D remains blocked on an authorized operations owner creating approved notification channels/webhooks, mapping the critical/warning/info routes, creating the required alert policies, and delivering documented test alerts. No policy, channel, webhook, alert, log, or notification was created or contacted.

### 2026-10-17 — P0 security IAM inventory: active Functions use scoped runtime identity

Read-only project IAM and Function metadata inspection confirms all five deployed Functions use `timelines-runtime@tiimeliines.iam.gserviceaccount.com`. Its project roles are bounded to Vertex AI use, Cloud Tasks enqueue, Firestore user access, logging writer, and Secret Manager accessor. It does not hold project `Editor` or `Owner`. This is consistent with the service-level invoker restrictions recorded above and is positive active-runtime least-privilege evidence.

The project owner remains `timelineswebapp@gmail.com`; the legacy default Compute and App Engine service accounts retain project `Editor`. They are not the identity of any deployed Function, but their broad standing permissions remain a P0 security review/remediation item. Do not remove or alter these bindings without a workload inventory and Founder-authorized IAM change window. No IAM binding, service account, key, secret, or workload was changed.

### 2026-10-17 — P0-F/P0-G staging-isolation remediation and acceptance record

Founder-authorized staging execution established, by read-only inventory, that the accessible Vercel team has only the production `timelines` project and the accessible GCP account has only production `tiimeliines`. No independently enforceable staging application, PostgreSQL, Firestore, storage, queue/scheduler, service identity, alert, or URL target exists. The required staging deployment was therefore not attempted and the formal verdict in [`TL-STAGING-001.md`](TL-STAGING-001.md) is `STAGING_NOT_DEPLOYED`.

The resulting configuration defect was corrected at `264f383`, `e762a1d`, and this succeeding checkpoint: Functions now require an explicit non-production project in staging and reject `tiimeliines`; the serverless deploy script requires explicit environment, project, deploy-principal, isolation attestation, and infrastructure-mutation approval, rejects staging into production, and pauses discovery after a future deployment. The final approval interlock prevents automatic creation or mutation of service identities, IAM, secrets, queues, storage, Firestore configuration, schedulers, or Functions. The isolated Firestore emulator exercised this boundary using synthetic project `timelines-staging-fixture` on port 8180: **10/10 passed**. The isolated PostgreSQL institutional authorization/revocation/rollback fixture passed. Root typecheck, mandatory root suite (**300/300**), lint, security gate, optimized build, Functions typecheck/build, and Functions suite (**374 passed, 2 intentional emulator skips**) also passed; deployment-script syntax, explicit isolation rejection, and infrastructure-mutation interlock passed.

The succeeding production-hardening regression requires every serverless deploy interlock—environment, project, deploy principal, isolation attestation, infrastructure-mutation approval, production-target rejection, and paused discovery—to remain present. The focused suite passed **9/9** and strict root typecheck passed.

**Status:** the authorized local staging-safety and fixture work is complete. Live P0-A through P0-G evidence remains blocked by the same external prerequisite: an independently controlled non-production environment with distinct data resources, credentials, IAM, alert receiver, noindex URL, and governed synthetic-fixture procedure. The exact required Founder/environment decision is preserved in `TL-STAGING-001.md`. No production or provider state changed; Phase 2 remains blocked and uncertified.

### 2026-10-17 — TL-STAGING-003 isolated foundation deployed

Under TL-STAGING-003 Founder authorization, the separate `timelines-staging` GCP project, USD 50 project-scoped budget feed, Firestore PITR/delete protection, archive bucket, bounded queues, least-privilege service accounts, staging-only secrets, five active Functions, and paused discovery scheduler were created and verified. The separate Vercel project `timelines-staging` was created without a domain, deployment, or copied production environment values. The Functions deployment is postflight-pinned to release `d42a12e495305c03885cd817865b8a466df301b7c0bd15b47b89240431db643f` at source revision `cacb292ceacb41cacc2e3abec10c486673fa5ec0`. Complete evidence is in [`TL-STAGING-003.md`](TL-STAGING-003.md).

**Status:** GCP, Vercel, and Neon isolation are live. The staging Free-plan Neon project has separate primary/restore databases, staging-only credentials, a fully applied baseline schema, and a current migration ledger. The protected staging website is deployed and has verified staging-only canonical/Open Graph/sitemap URLs, healthy database configuration, clean-corpus API reads, and synthetic MFA authorization/rejection. The P0 canonical-host defect is closed at `d3d8fc8`. A logical primary-to-restore PostgreSQL rehearsal (801,809 bytes; 179 restored public tables) and staging-only Vercel rollback/recovery have passed. Data-bearing API/institutional fixtures, interactive accessibility/representative capacity, and live alert delivery remain open; the six-hour Free-plan recovery limitation is unchanged. See [`TL-STAGING-003.md`](TL-STAGING-003.md). No production state changed; Phase 2 remains blocked and uncertified.

### 2026-10-18 — TL-STAGING-004 synthetic institutional boundary

TL-STAGING-004 authorized bounded staging-only institutional fixtures. Checkpoint `9d10403` makes the certification harness resolve every governed actor from immutable appointment records and fail closed without exact staging/authorization/run-id inputs. Neon/GCP/project isolation was reverified; three disposable appointments (`tl-staging-004-20261018-a1` Factory, Governance, Library) resolved correctly, an unappointed actor was denied, then each appointment was revoked through immutable records. The canonical-site guard also rejected an invocation missing the staging origin before mutation. The primary database has no eligible Factory package, package, snapshot, or active projection, so no downstream transition was attempted. **Remaining authorized P0-F work:** implement a labelled synthetic Factory source/evidence seed that passes the existing editorial gates, then run the resolver-gated Factory → Governance → Library → projection → API/public journey, alert delivery, and reader/load qualification. This is engineering work, not a Founder decision. Neon Free remains a six-hour-history recovery limitation.

### 2026-10-18 — P0-F progress and active staging dependency

**Implemented and verified:** `3b73ce9` added a staging-only, labelled synthetic Factory seed; run `tl-staging-004-20261018-a2` completed Factory → Governance → Historical Library → Published Memory → projection generation with immutable provenance. It produced exactly one synthetic timeline, milestone, search document, sitemap document, canonical authority record, and published snapshot. No provider-backed research, discovery, real appointment, production write, or direct projection insertion occurred. TypeScript and focused Factory/hardening tests passed (**81/81**).

**P0-B/P0-F incomplete, not failed:** PostgreSQL-to-Firestore materialization and the staging Function/API/public-reader parity checks require the existing isolated Neon connection credential. The initial materialization attempt was correctly confined to `timelines-staging` but Firestore rejected the local non-runtime ADC. A scoped runtime-impersonation path was implemented and tested statically (`16e867a`; TypeScript and hardening **10/10**); its temporary service-account delegation was removed after the attempt. The available browser session belongs to a different Neon organisation, so the staging connection cannot be reacquired without access to the intended `timelines` Neon session. The a2 synthetic appointments remain active only in the staging database and must be revoked through the immutable revocation procedure immediately after that connection is restored.

**Next dependency-aware action:** restore access to the existing `timelines-staging-primary` connection only, run the guarded migration through the staging runtime identity, verify collection/table and active-projection parity, exercise the deployed staging API/search/public timeline, revoke the a2 fixtures, then continue alert-delivery and reader/load qualification. This is a staging-access dependency, not a request to change any constitutional authority or Phase-2 benchmark.

**P0-E partial evidence:** staging homepage, local health, and public-API health returned HTTP 200. At mobile `390×844`, navigation is exposed as a labelled dialog with keyboard-reachable controls; search has a labelled control and an accessible zero-results status. Staging canonical/Open Graph metadata remained staging-owned. A 20-request search smoke sample had 0 failures, 608 ms minimum, 787 ms p95, and 799 ms maximum. Data-bearing reader acceptance and representative capacity remain open until migration makes the certified synthetic projection visible to the deployed API.

The full repository regression suite passed at this checkpoint (**306/306**). This proves the staging-guard change did not regress the tested public, security, institutional, Factory, Library, projection, recovery, monitoring, or provider-safety contracts; it does not prove the still-pending deployed-data parity gate.

## 2026-10-18 — staging data-bearing parity closed

The intended Neon staging-primary connection was restored. The migration is now corpus-scoped and fails closed unless staging targets `staging-synthetic-corpus`. Isolated parity passed (179 tables, 135 rows, 2/2 active projections); the deployed API and reader served the synthetic timeline, search, sitemap, timeline detail, and milestone. The a2 disposable appointments were immutably revoked afterwards. Remove the former credential-restoration, deployed-data-parity, and a2-revocation blockers. Remaining production-readiness work: staging-only alert receipt, representative responsive/accessibility and load qualification, and the Founder’s Free-plan recovery-retention decision. Phase 2 remains blocked by Berlin and is not certified.

## 2026-10-18 — P0-D staging delivery closed; P0-E capacity measured, not accepted

**P0-D staging acceptance: passed.** Commit `53f65ad` provides a staging-only signed alert receiver and idempotent Firestore receipt. Functions source revision `53f65ad48f08df381e0854bbcc994da6c751ee0c` deployed to `timelines-staging`; public API revision `timelines-public-api-00004-wiv` serves staging-only secrets and corpus `staging-synthetic-corpus`, with shadow-only evidence mode and discovery scheduler `PAUSED`. A controlled critical synthetic delivery created receipt `c1365a294309503ddd3e27c5742b9750bb89762bb8468610` (HTTP 201); its exact retry returned the same receipt as `duplicate=true` (HTTP 200). The Function deployment suite passed **375/375** with **2 intentional emulator skips**. This closes the authorized staging alert-receipt/delivery gate only. Production provider policies, notification channels, on-call ownership, and alert delivery remain deliberately unconfigured and unverified.

**P0-G staging release: passed for this increment.** Vercel deployment `dpl_SUNGVfa6Rohk6XGPfpuvULEiGDEM` is `READY` in the distinct `timelines-app/timelines-staging` project and only aliases its isolated staging deployment. Environment-name inventory reconfirmed separate staging database, restore, API, admin/session, cron, and shared-secret configuration. The build compiled and completed TypeScript. No `timelines` production-project setting or production deployment was touched.

**P0-E capacity: not accepted.** A 100-request, 10-way direct staging API test had zero failures but p95s of 1,929 ms (timeline list), 1,629 ms (detail), 1,290 ms (search), and 800 ms (sitemap). A warmed 20-request sequential sample had p95 292 ms, 360 ms, 316 ms, and 306 ms respectively. These include external transit and hence do not directly measure the documented edge-excluded latency target, but the concurrent result is not credible capacity evidence. The next authorized engineering package is a bounded service/Firestore latency profile, followed by a targeted remedy and an identical rerun. Do not declare the public capacity criterion met from the existing no-failure samples.

**Open P0 boundaries:** (1) P0-E responsive assistive-technology qualification and the performance remediation/retest above; (2) P0-C Neon Free's explicitly recorded six-hour history limitation, for which logical restore is verified but paid-PITR acceptance is not eligible under the Founder’s Free-plan direction; and (3) production-only identity, notification, recovery, and promotion evidence, which remain outside this staging authorization. The locked Berlin Phase-2 affected-community requirement remains independently blocked and uncertified.

### 2026-10-18 — P0-E isolated service-latency pass; accessibility remains partial

The performance profile distinguished edge transit from the required service metric. Cloud Run telemetry for a fresh warmed 10-way rehearsal (100 requests each for list, detail, search, sitemap; all HTTP 200) reports p95 handler latencies of **66.16 ms**, **145.86 ms**, **100.20 ms**, and **37.92 ms**, respectively. This passes the stated staging server target (public reads ≤250 ms, search ≤500 ms, <0.1% errors) for the authorised one-timeline synthetic corpus. The client-observed p95s of 375/446/301/338 ms include transit and are retained separately; no unproven cache, concurrency, provider-plan, or capacity change was made. Larger representative-corpus and public Internet capacity certification remain a launch-evidence boundary, not a failed handler performance gate.

Desktop and `390×844` staging-browser checks confirmed keyboard traversal, labeled menu/dialog/tabs, focusable close control, Escape dismissal/focus return, labeled reader controls, preserved mobile reader content, and zero browser console warnings/errors. Actual screen-reader-user testing and a visual-regression device matrix remain partial P0-E acceptance work; do not label this as a complete assistive-technology audit.

### 2026-10-18 — P0-A staging Admin identity/session evidence closed

The staging canonical alias had remained pinned to an older release; it now resolves to ready deployment `dpl_9WCvzzTjXQ52HagWMmNr8DUVtX5c` only in `timelines-app/timelines-staging`. A synthetic MFA session to the read-only Admin timelines endpoint passed before revocation (200), an expired session failed closed (401), an MFA-attested `auditor` was rejected for the Admin-only route (403), and the same valid session failed closed after a durable labelled staging revocation (401). The direct staging database verification found `admin_auth_succeeded` and `admin_rbac_rejected` audit rows for the synthetic operator plus the retained revocation record. This closes P0-A in the authorised production-like staging environment; production identity/operator enrollment remains outside scope and is not represented as complete.

### 2026-10-18 — P0-E structural responsive matrix closed

The canonical isolated staging synthetic timeline route was reloaded at 320×568, 768×1024, and 1440×900. At all three viewports, the accessibility tree retained the timeline heading and labeled navigation, event-detail, and copy-link controls. This closes the authorised structural responsive-device check. A screen-reader-user audit and representative real-corpus/public-Internet capacity evidence remain launch-evidence boundaries; neither is silently promoted to verified status.

### 2026-10-18 — P0-E accessibility verification boundary revalidated

The current repository has no installed browser automation, DOM test environment, or executable accessibility runner. `axe-core` is present only transitively beneath the lint stack and cannot inspect the deployed staging document on its own. The workstation's VoiceOver process is not active. Consequently, the existing structural accessibility-tree, keyboard, responsive, and console evidence remains valid but cannot prove a screen-reader-user audit. Introducing an unreviewed test runner would be a new dependency rather than acceptance evidence; do not do so under this bounded production-readiness execution. The next valid evidence requires a qualified human assistive-technology participant on the isolated staging reader. Representative real-corpus/public-Internet capacity qualification likewise needs an approved corpus and operational test window. Neon Free's six-hour history remains a separate Founder spending decision.

### 2026-10-18 — final qualification capacity preparation and release revalidation

`060d0a9` implements four bounded, synthetic-only staging Factory capacity profiles: 3/12/30/60 milestones across 240/1492/1800/1960 periods and 2–5 labelled synthetic sources per profile. It preserves the existing Factory → Governance → Historical Library → Published Memory route and rejects any non-staging project/database/flag combination. Strict TypeScript plus the relevant governed Factory, Historical Library, Published Memory, Platform, and public-contract suites passed (**114/114**). The profiles are ready but **not executed** because the workspace has no `timelines-staging-primary` credential; its sole local URL was verified as a different Neon `neondb`, and the current native browser session is unrelated BookTown/Firebase. No cross-account action was attempted.

Read-only staging revalidation passed: `timelines-staging` project `673364478850` is active; discovery remains paused; `timelines-staging.vercel.app` resolves to ready `dpl_9WCvzzTjXQ52HagWMmNr8DUVtX5c`; website health and Function GET health/read-model/search/sitemap checks returned 200. The earlier direct-Function 404s were invalid `HEAD`/`/api/v2` probes, not production routes. Recovery is **BLOCKED_FOUNDER** by the explicit `ops/recovery/pitr.json` 24-hour minimum versus Neon Free’s six-hour history; the logical restore remains passed but is not equivalent. The complete readiness matrix is [`TL-TIER1-FINAL-QUALIFICATION-REPORT.md`](TL-TIER1-FINAL-QUALIFICATION-REPORT.md).

Final repository verification after this change passed strict TypeScript, **307/307** mandatory root tests, and the Tier-1 security gate with zero high/critical runtime findings in root and Functions production audits.

## 2026-10-18 — capacity-fixture execution update

The four authorised staging-only capacity profiles have now completed their governed database workflow (3/12/30/60 milestones; 105 capacity objects; 106 published snapshots; 5 timeline and 106 milestone/search/sitemap active projections). All 12 synthetic principals were denied after immutable revocation. This closes the **fixture-generation and institutional-lifecycle** portion of representative capacity work.

The remaining dependency is not Neon: it is a TiMELiNES staging GCP principal capable of materialising the corpus. The active local identity is a separate BookTown account and is denied runtime-service-account token creation. Do not grant cross-account IAM or use fallback production credentials. With the approved TiMELiNES staging principal, run the already guarded Firestore migration for `staging-synthetic-corpus`, verify parity, then run bounded deployed API pagination/concurrent-reader tests. Human screen-reader evidence and the 24-hour recovery-retention Founder decision remain separate blockers.

**2026-10-29 recheck:** no configured non-BookTown identity can read `timelines-staging`; `timelineswebapp@gmail.com` is denied. This is an access-configuration dependency, not a request to grant BookTown or production access. No authorised capacity action can proceed until a TiMELiNES staging principal is configured locally.

**2026-11-25 security update:** Next/Zod and Functions dependencies have been remediated and verified; both runtime production audits are now zero high/critical, with root **307/307** and Functions **375/375** tests passing (two intentional emulator skips). This closes the current source-level dependency security regression. It does not replace the required authorised staging identity, human screen-reader acceptance, 24-hour recovery policy, or production promotion authorization.

**2026-11-25 deployment-path recheck:** `timelineswebapp@gmail.com` remains denied access to `timelines-staging`, and the only locally readable account is excluded BookTown. The local Vercel CLI credential is invalid. Do not substitute either account or grant cross-account access. The shortest remaining operational action is a sign-in by an existing authorised TiMELiNES staging GCP principal and Vercel access to `timelines-app/timelines-staging`; then run the already-guarded Firestore materialisation and bounded deployed acceptance matrix. This does not clear the separate human screen-reader, recovery-policy, Berlin, or production-promotion gates.

**2026-11-25 Founder-authorised production path:** The Founder removed staging as a pre-launch prerequisite because the platform has no users or real data. The verified source release was fast-forwarded to GitHub `main` at `93f0860`, the configured production trigger. GitHub exposes neither a check run nor a provider deployment record for that commit, and the local Vercel credential is invalid; therefore production deployment status remains **NOT_YET_ATTESTED**, not verified. The next exact operational step is an authorised TiMELiNES Vercel session to confirm the production deployment and its environment, followed by the production smoke matrix. Berlin, screen-reader, recovery, and disabled autonomous-publication boundaries remain unaffected.

**2026-11-25 production smoke:** An authorised Vercel session attested the `018abc2` production deployment as ready at `https://www.timelines.sbs`, with 0% reported errors over six hours. Homepage reader navigation, `/api/health` (database and environment both true), catalog, Apollo search, and the canonical sitemap all passed directly against production. The currently visible catalog has three historical timelines, including Berlin; no content was added, amended, certified, or removed. This closes deployment attestation and the bounded reader/API smoke gate, not Berlin Phase-2 certification, qualified assistive-technology evidence, recovery-policy compliance, or ongoing operational monitoring.

**2026-11-25 production launch-gate evidence:** Direct Neon inspection establishes that production is project `timelines` / `little-leaf-72675905`, default branch `production` / `br-winter-fog-a4ih8do6`, on the Free plan with exactly **six hours** of history retention. This fails the immutable 24-hour requirement in `ops/recovery/pitr.json`; the isolated logical restore does not make it compliant. Vercel’s current production inventory (names only) lacks `OPERATIONS_CRITICAL_WEBHOOK_URL`, `OPERATIONS_WARNING_WEBHOOK_URL`, `OPERATIONS_INFO_WEBHOOK_URL`, `RESTORE_DATABASE_URL`, and `NEXT_PUBLIC_SITE_URL`. Production on-call delivery, actual alert receipt, scheduled restore verification, and scheduled canonical validation are therefore not evidenced. The Google Cloud Monitoring browser context is BookTown rather than a verified TiMELiNES production principal and was not used; provider alert policies/channels remain **NOT_VERIFIED**. The public deployment/smoke gate stays passed, but representative capacity, human screen-reader acceptance, production operator enrollment/revocation, Berlin’s certification disposition, recovery compliance, and actual on-call delivery remain launch blockers.

**2026-11-25 production telemetry recheck:** Vercel Analytics and Speed Insights are enabled for `www.timelines.sbs`, but Speed Insights currently has **zero real-user events**. The monitoring product is available; it is not yet evidence of production Core Web Vitals, representative reader latency, or public capacity. Keep the P0 capacity gate open until a deliberately bounded, representative corpus test and a qualified real-user telemetry sample are recorded.

**2026-11-25 Berlin hold:** Founder instruction is implemented as a server-owned public-publication hold for `the-fall-of-the-berlin-wall`; it is not data deletion, certification change, or workflow activation. The hold removes the timeline and its Berlin-only milestones from verified reader and sitemap surfaces, failing closed for milestone sitemap publication if the held source cannot be verified. Regression coverage and the complete release matrix passed (**308/308** root tests, TypeScript, optimized build, and zero high/critical security gate). Do not lift this hold until the existing Founder-governed Phase-2 affected-community requirement is actually satisfied and certified.

Live verification identified Berlin-derived tag sitemap entries, so the final hold now derives and suppresses the held timeline's tags too, failing closed if the source record is unavailable. This is included in the same **308/308** verified release matrix.

The tag derivation includes the held timeline's milestone tags, which is necessary to cover `east-berlin` and other event-level promotion paths.
