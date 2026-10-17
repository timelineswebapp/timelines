# TL-STAGING-003 — Staging Deployment and Acceptance Report

**Status:** Isolated staging foundation provisioned; web deployment and full acceptance blocked by a release-level staging-host isolation defect

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
| Vercel project | `timelines-app/timelines-staging` (`prj_tnEeiyefyvp5GGOoFT554vB233an`) | Separate Hobby-plan project. Isolated primary/restore database URLs and staging-only service, cron, admin-session, MFA-test-operator, and route variables are configured in Production and Preview. No production value was copied. | Verified; deployment blocked below |

## Release identity

The staged Function deployment was rebuilt and postflight-verified from source revision `cacb292ceacb41cacc2e3abec10c486673fa5ec0` with generation release identity `d42a12e495305c03885cd817865b8a466df301b7c0bd15b47b89240431db643f` and source-tree SHA-256 `13ac7fe865b5d73030201482d1d09c00e5c8e08ca3fba96cc13e7f3d51cf3bad`.

The Function suite passed in staging configuration: **374 passed, 0 failed, 2 intentional emulator skips**. Focused staging deployment-safety tests passed **9/9**.

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
| Staging web project isolation | Partial | Separate Vercel project and staging-only secret configuration exist. The current `src/lib/public-site.ts` hard-codes `https://www.timelines.sbs` and rejects staging/preview hosts, so deploying it would generate production canonical, share, sitemap, and scheduled-operation URLs. Deployment is correctly withheld. |
| PostgreSQL migration parity | Pass | `db/schema.sql` applied to the isolated primary database; `npm run ops:migrations` then completed successfully through `20260730_institutional_actor_appointments`. The app role authenticated as `timelines_staging_app` with schema read access. |
| PostgreSQL least privilege | Partial | `PUBLIC` database access was revoked; app, migration, and restore database/schema grants were applied. Neon denied default-privilege changes for the separate migration role, so future migration object grants require an explicit owner-controlled step and are not yet automated. |
| API parity | Not run | Requires a safe web deployment and function shared-secret rollout on a fresh Function revision. |
| Admin/MFA/institutional synthetic journey | Not run | A synthetic named MFA-attested test operator is configured only in the isolated Vercel project; exercising it requires safe web deployment and synthetic fixtures. |
| Monitoring alert delivery | Partially verified | Staging-only budget Pub/Sub topic/subscription exists and accepted/consumed a `TL-STAGING-003_TRANSPORT_TEST` event. Actual provider budget delivery may take hours; application alert endpoints await staging configuration. |
| Backup/restore and rollback rehearsal | Not run | The isolated primary/restore destinations now exist, but Free-plan history is six hours and cannot demonstrate the planned paid-PITR criterion. A synthetic logical backup/restore rehearsal remains possible after a safe web release. |
| Browser/accessibility/performance | Not run | Requires deployed staging public website. |

## Remaining blockers and next action

1. **P0 — staging-host isolation defect:** `src/lib/public-site.ts` intentionally normalizes every host, including `*.vercel.app`, to the production canonical host. Do not deploy the current web release to staging because scheduled operations and public metadata/share/sitemap URLs can target production. This requires a narrowly scoped, tested runtime change and explicit approval because the original assessment was documentation-only.
2. **P0 — Free-plan recovery boundary:** Neon Free provides only six-hour history. The former Launch/PITR acceptance criterion cannot be met while the Founder’s Free-plan direction stands. Do not represent it as passed; use a synthetic logical backup/restore rehearsal only, or obtain a later Founder decision for paid retention.
3. **P1 — serverless/API and user-journey acceptance:** after a safe web release, roll the Function revision to consume the rotated staging shared secret; run API parity, synthetic named-MFA admin authorization/rejection, institutional separation, browser/accessibility/performance, staging-only alert delivery, and rollback tests.
4. **P1 — migration-role provisioning:** codify an owner-controlled post-migration grant/default-privilege step, or obtain supported Neon role-management configuration. Do not elevate the application role as a workaround.
5. **P1 — budget-email threshold alerts:** Google requires an approved staging-only email notification channel before it accepts 50/80/100 threshold rules. The staging-only Pub/Sub budget feed is configured; an explicit staging-only recipient is still required for email threshold delivery.

## Production-readiness verdict

**Not production-ready.** The independent GCP, Vercel, and PostgreSQL staging foundation is operational and schema migration parity is established, but the web release must not be deployed until it can keep staging URLs isolated from production. Free-plan Neon history also cannot satisfy the planned paid-PITR acceptance criterion. Phase 2 certification remains blocked by the Berlin Founder-governed affected-community identity/capacity requirement and is not certified.
