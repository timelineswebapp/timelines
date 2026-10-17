# TL-STAGING-003 — Staging Deployment and Acceptance Report

**Status:** Partially provisioned; full acceptance blocked on separate Neon authentication and database provisioning

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
| Vercel project | `timelines-app/timelines-staging` (`prj_tnEeiyefyvp5GGOoFT554vB233an`) | Separate Hobby-plan project; no domain, deployment, or environment variable copied from production. | Verified |

## Release identity

The staged Function deployment was rebuilt and postflight-verified from source revision `cacb292ceacb41cacc2e3abec10c486673fa5ec0` with generation release identity `d42a12e495305c03885cd817865b8a466df301b7c0bd15b47b89240431db643f` and source-tree SHA-256 `13ac7fe865b5d73030201482d1d09c00e5c8e08ca3fba96cc13e7f3d51cf3bad`.

The Function suite passed in staging configuration: **374 passed, 0 failed, 2 intentional emulator skips**. Focused staging deployment-safety tests passed **9/9**.

## Cost and isolation assessment

The active GCP billing account is USD-denominated and separate from the production project. The project-scoped USD 50 GCP budget is below the Founder-approved USD 100/month tax-excluded ceiling. Pub/Sub budget delivery is isolated to the staging project; GCP budget notifications are not a hard spending cap, so the deployment also constrains Functions by max instances, queues by bounded dispatch, storage by lifecycle, and excludes provider-backed research.

The Vercel team is on an active Hobby plan with no contract commitment reported by the provider. The staging project introduced no upgrade or paid product. Neon costs and plan capability remain unverified because its console session is not authenticated; no Neon resource was created.

## Acceptance results

| Gate | Result | Evidence / limitation |
|---|---|---|
| Isolated GCP topology | Pass | New project IDs, service accounts, secrets, data store, queues, bucket, Functions, and scheduler; deployment interlocks required explicit staging/project/approval inputs. |
| Provider-research prohibition | Pass | Staging deploy rejects `TIMELINES_ENABLE_PROVIDER_RESEARCH` other than `false`; no Vertex role/service was enabled. |
| Function release parity | Pass | All five Functions became active; priority/autonomous postflight verified the exact content-addressed release identity. |
| Discovery protection | Pass | Scheduler is paused; no manual run. |
| Staging web project isolation | Pass | Separate Vercel project exists; no production URL, domain, deployment, or environment value has been configured. |
| PostgreSQL migration/API parity | Not run | Requires independent Neon primary and restore databases and staging-only URLs. |
| Admin/MFA/institutional synthetic journey | Not run | Requires the staging Next.js deployment and synthetic PostgreSQL fixtures. |
| Monitoring alert delivery | Partially verified | Staging-only budget Pub/Sub topic/subscription exists and accepted/consumed a `TL-STAGING-003_TRANSPORT_TEST` event. Actual provider budget delivery may take hours; application alert endpoints await staging configuration. |
| Backup/restore and rollback rehearsal | Not run | Requires Neon staging primary/restore destinations and Vercel staging deployment. |
| Browser/accessibility/performance | Not run | Requires deployed staging public website. |

## Remaining blockers and next action

1. **Neon authentication and plan/PITR verification:** the pre-existing Neon console session redirects to sign-in. A new authenticated Neon session is required before a separate `timelines-staging` project and its primary/restore databases can be inspected or created. This is not bypassed and no plan upgrade is authorized.
2. **Staging database credentials:** after Neon is verified within the approved cost ceiling, create only staging app/migration/restore roles and configure the isolated Vercel project. No production URL or credential may be used.
3. **Remaining acceptance gates:** migration/API parity, synthetic admin/MFA, recovery, alert delivery, browser/accessibility/performance, institutional shadow path, and rollback remain incomplete until the separate database and Vercel deployment exist.
4. **Budget-email threshold alerts:** Google requires an approved email notification channel before it accepts 50/80/100 threshold rules. The staging-only Pub/Sub budget feed is configured; an explicit staging-only email recipient is still required for email threshold delivery.

## Production-readiness verdict

**Not production-ready.** The staging GCP and Vercel isolation foundation is operational, but the independent PostgreSQL layer and all application-level staging acceptance gates remain incomplete. Phase 2 certification remains blocked by the Berlin Founder-governed affected-community identity/capacity requirement and is not certified.
