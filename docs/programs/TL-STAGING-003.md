# TL-STAGING-003 — Staging Deployment and Acceptance Report

**Status:** Isolated staging website deployed; core URL, database, API-health, and MFA acceptance passed; remaining data-bearing and recovery gates are incomplete

**Date:** 2026-10-17

**Authority:** Founder authorization TL-STAGING-003.

## Scope and production protection

All provider mutations in this record targeted `timelines-staging` only. The production GCP project `tiimeliines`, production Vercel project, production databases, production credentials, production scheduler, and production deployment were not modified. Autonomous discovery, Governance submission, publication, Registry changes, and real appointments remain disabled.

## Resources created and verified

| Resource | Identity / configuration | Evidence | Status |
|---|---|---|---|
| GCP project | `timelines-staging` / project number `673364478850`; separate active billing account | Project labels identify `environment=staging`, `program=tlstaging003`, `system=timelines`. | Verified |
| Budget controls | `TiMELiNES staging monthly ceiling`; USD 50/month; scoped to project `673364478850`; Pub/Sub delivery only | Budget `df8c5155-72ee-44c6-91aa-feee241415e2`; default billing recipients disabled; topic `timelines-staging-budget-alerts`; 7-day acceptance subscription. | Implemented; provider notifications are asynchronous and not yet received |
| Firestore | Default Native database in `nam5` with PITR and delete protection | `DELETE_PROTECTION_ENABLED`; `POINT_IN_TIME_RECOVERY_ENABLED`. | Verified |
| Archive storage | `timelines-staging-institutional-archive` in `US-CENTRAL1` | Uniform access and public-access prevention configured; deployment policy applies versioning, 7-day soft delete, and 90-day deletion lifecycle. | Implemented / location verified |
| Queues | `priority-topic-generation` (5/5), `autonomous-topic-generation` (1/2), `institutional-transitions` (10/10) | Staging-only Cloud Tasks queues created with bounded dispatch and retry policy. | Verified |
| Service identities | `timelines-runtime`, `timelines-tasks-invoker`, `timelines-scheduler` | Runtime has only datastore user, Cloud Tasks enqueuer, logging writer, and Secret Manager accessor. No Vertex AI role. | Verified |
| Secrets | `IP_HASH_SALT`, `BACKEND_SHARED_SECRET` | Newly generated in staging Secret Manager; no production secret was copied. | Verified |
| Functions | Five Gen 2 Functions in `us-central1`: public API, three private workers, discovery | All active. Task invoker binding is restricted to private workers. | Verified |
| Discovery scheduler | `topic-discovery-daily` | Created with the required schedule and **PAUSED** state. No discovery run occurred. | Verified |
| Neon project | `timelines-staging` / `hidden-darkness-27048706`; AWS US East 2 (Ohio); branch `production` / `br-patient-mud-b5qz4y9i` | Created in Neon organization `timelines`, distinct from the production project in AWS US East 1. | Verified |
| Neon databases | `timelines-staging-primary`; `timelines-staging-restore` | Separate empty databases on the staging branch. The provider-created `neondb` default database was deleted after both required databases existed. | Verified |
| Neon roles | `timelines_staging_app`, `timelines_staging_migration`, `timelines_staging_restore` | Staging-only credentials; application role authenticated and had required read access after schema grants. | Partially verified |
| Vercel project | `timelines-app/timelines-staging` (`prj_tnEeiyefyvp5GGOoFT554vB233an`) | Separate Hobby-plan Next.js project. Isolated primary/restore database URLs and staging-only service, cron, admin-session, MFA-test-operator, canonical-origin, and route variables are configured in Production and Preview. No production value was copied. | Verified |

## Release identity

The staged Function deployment was rebuilt and postflight-verified from source revision `cacb292ceacb41cacc2e3abec10c486673fa5ec0` with generation release identity `d42a12e495305c03885cd817865b8a466df301b7c0bd15b47b89240431db643f` and source-tree SHA-256 `13ac7fe865b5d73030201482d1d09c00e5c8e08ca3fba96cc13e7f3d51cf3bad`.

The Function suite passed in staging configuration: **374 passed, 0 failed, 2 intentional emulator skips**. Focused staging deployment-safety tests passed **9/9**.

The staging public API was rolled to revision `timelines-public-api-00003-dkv`, serving 100% of its staging traffic and reading the current staging Secret Manager values. The verified web deployment is Vercel deployment `dpl_J5a1xMfc2EW9srHYS13gpo6J86jq`, commit `d3d8fc8`, aliased only to `https://timelines-staging.vercel.app` and protected by Vercel authentication.

The release verification matrix completed at this checkpoint: repository tests **305/305**, public-site canonical regression tests **5/5**, TypeScript typecheck, ESLint, the Tier-1 security gate, and a production-mode Next.js build with `TIMELINES_ENVIRONMENT=staging` and the declared staging origin. The security gate reports zero high/critical production findings; its documented development-lint tooling exception remains unchanged.

## Cost and isolation assessment

The active GCP billing account is USD-denominated and separate from the production project. The project-scoped USD 50 GCP budget is below the Founder-approved USD 100/month tax-excluded ceiling. Pub/Sub budget delivery is isolated to the staging project; GCP budget notifications are not a hard spending cap, so the deployment also constrains Functions by max instances, queues by bounded dispatch, storage by lifecycle, and excludes provider-backed research.

The Vercel team is on an active Hobby plan with no contract commitment reported by the provider. The staging project introduced no upgrade or paid product. The Neon project is explicitly on the **Free** plan at **USD 0/month**. The Founder directed on 2026-10-17 that staging remain on the Free plan. Its provider limits include 1 GiB storage per project, scale-to-zero, up to 2 CU, 10 branches, and only six hours of history retention. No upgrade, Launch plan, paid PITR retention, or additional paid provider was accepted.

## Acceptance results

| Gate | Result | Evidence / limitation |
|---|---|---|
| Isolated GCP topology | Pass | New project IDs, service accounts, secrets, data store, queues, bucket, Functions, and scheduler; deployment interlocks required explicit staging/project/approval inputs. |
| Provider-research prohibition | Pass | Staging deploy rejects `TIMELINES_ENABLE_PROVIDER_RESEARCH` other than `false`; no Vertex role/service was enabled. |
| Function release parity | Pass | All five Functions became active; priority/autonomous postflight verified the exact content-addressed release identity. |
| Discovery protection | Pass | Scheduler is paused; no manual run. |
| Staging web project isolation | Pass | `TIMELINES_ENVIRONMENT=staging` plus the exact staging Vercel origin resolve all canonical, Open Graph, sitemap, JSON-LD, and share URLs server-side. Missing/invalid staging configuration throws; request host headers are ignored. Live homepage canonical and Open Graph URLs are both `https://timelines-staging.vercel.app`. |
| Staging website deployment | Pass | Next.js framework preset was corrected from generic output to Next.js after the first staging-only deployment served provider 404s. The current authenticated deployment serves app routes; Vercel unauthenticated access returns SSO protection and `X-Robots-Tag: noindex`. |
| PostgreSQL migration parity | Pass | `db/schema.sql` applied to the isolated primary database; `npm run ops:migrations` then completed successfully through `20260730_institutional_actor_appointments`. The app role authenticated as `timelines_staging_app` with schema read access. |
| PostgreSQL least privilege | Partial | `PUBLIC` database access was revoked; app, migration, and restore database/schema grants were applied. Neon denied default-privilege changes for the separate migration role, so future migration object grants require an explicit owner-controlled step and are not yet automated. |
| API health / empty-corpus contract | Pass | The fresh Function revision and staging website health endpoint both returned healthy configuration/database status. The public API returns the clean-corpus v2 envelope and an empty read-model/sitemap collection after guarded synthetic corpus activation. |
| Full API parity | Incomplete | The established parity verifier now permits only the exact declared staging API base and v2 clean-corpus contract, but requires synthetic published-projection fixtures (including duplicate-slug/search fixtures). None were created because Governance/publication remains disabled. |
| Admin/MFA | Pass | A newly rotated staging-only named MFA operator received HTTP 200 from read-only `/api/admin/timelines`; the same request without credentials received HTTP 401. No administrative mutation was sent. |
| Institutional-boundary journey | Incomplete | No synthetic institutional fixture or appointment was created. Real appointments and Governance/publication remain prohibited. |
| Monitoring alert delivery | Partially verified | Staging-only budget Pub/Sub topic/subscription exists and accepted/consumed a `TL-STAGING-003_TRANSPORT_TEST` event. Actual provider budget delivery may take hours; application alert endpoints await staging configuration. |
| Backup/restore and rollback rehearsal | Not run | The isolated primary/restore destinations now exist, but Free-plan history is six hours and cannot demonstrate the planned paid-PITR criterion. A synthetic logical backup/restore rehearsal remains possible after a safe web release. |
| Browser/accessibility/performance | Partial | Authenticated HTTP smoke confirms rendered homepage, canonical/Open Graph isolation, health, sitemap, and robots behavior. A desktop browser session rendered the TiMELiNES homepage at the staging origin; navigation and search have accessible names, and keyboard Tab traversal reached the labeled search field. Ten protected health samples had 519 ms minimum, 1,048 ms p95, and 1,048 ms maximum. This is a smoke sample, not a capacity qualification; responsive-browser, screen-reader, and representative load testing remain open. |

## Remaining blockers and next action

1. **P0 — Free-plan recovery boundary:** Neon Free provides only six-hour history. The former Launch/PITR acceptance criterion cannot be met while the Founder’s Free-plan direction stands. Do not represent it as passed; use a synthetic logical backup/restore rehearsal only, or obtain a later Founder decision for paid retention.
2. **P1 — data-bearing API and institutional acceptance:** create only an explicitly authorized synthetic published-projection fixture set and its synthetic institutional boundary records, then run full DTO/search/duplicate-slug parity and rejection-path checks. Do not activate discovery, Governance submission, or publication.
3. **P1 — accessibility and representative performance:** run interactive keyboard, screen-reader, responsive-browser, and representative load tests through the protected staging deployment. The present ten-request health sample is not sufficient for capacity certification.
4. **P1 — recovery and rollback:** run a synthetic logical PostgreSQL backup/restore into `timelines-staging-restore` and a staging Vercel rollback rehearsal. Record six-hour Neon Free history as a limitation, never as paid-PITR certification.
5. **P1 — migration-role provisioning:** codify an owner-controlled post-migration grant/default-privilege step, or obtain supported Neon role-management configuration. Do not elevate the application role as a workaround.
6. **P1 — budget-email threshold alerts:** Google requires an approved staging-only email notification channel before it accepts 50/80/100 threshold rules. The staging-only Pub/Sub budget feed is configured; an explicit staging-only recipient is still required for email threshold delivery.

## Production-readiness verdict

**Not production-ready.** The isolated staging website is now deployed and core isolation, migration, health, API-empty-corpus, and MFA checks pass. It is not a completed Tier-1 acceptance environment: data-bearing API/institutional fixtures, full browser/accessibility/capacity tests, recovery/rollback rehearsal, and real alert delivery remain open. Neon Free history is six hours and cannot satisfy paid-PITR acceptance. Phase 2 certification remains blocked by the Berlin Founder-governed affected-community identity/capacity requirement and is not certified.
