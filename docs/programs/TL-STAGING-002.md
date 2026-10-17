# TL-STAGING-002 — Staging Infrastructure Provisioning Plan

**Status:** Founder approval package; planning only

**Date:** 2026-10-17

**Authority:** TL-STAGING-002 Founder directive. This document authorizes neither resource creation nor deployment.

## Recommendation

Create one dedicated GCP project, `timelines-staging`, one separate Neon project/database pair, and one separate Vercel project, `timelines-staging`, in the existing `timelines-app` team. Keep the staging URL on its generated Vercel hostname; do not buy a staging domain. Deploy the same five Cloud Run Functions architecture as production, but use only synthetic data, private workers, paused discovery, and disabled Governance/publication workflows.

This is the smallest design that independently isolates every writable production dependency while preserving the actual application topology. It does not add a provider: GCP, Neon PostgreSQL, and Vercel are the existing production technologies.

## Isolation invariants

1. `TIMELINES_ENVIRONMENT=staging` and `GOOGLE_CLOUD_PROJECT=timelines-staging`; the Functions guard rejects `tiimeliines` in staging.
2. A distinct Neon project contains `timelines-staging-primary` and `timelines-staging-restore`; neither uses production URLs, roles, branches, backups, or credentials.
3. A distinct Vercel project has no production domains, no production environment variables, and no production deployment target.
4. All GCP service accounts, Secret Manager secrets, Firestore data, Cloud Tasks queues, Scheduler job, and archive objects live only in `timelines-staging`.
5. `topic-discovery-daily` is created paused; Factory discovery, Governance submission, and publication stay disabled. Synthetic records never establish constitutional authority.
6. Every mutation requires the existing `TIMELINES_STAGING_ISOLATION_VERIFIED=true` and `TIMELINES_INFRASTRUCTURE_MUTATION_APPROVED=true` interlocks, an attributable deployment principal, and an approval record.

## Exact resource inventory

| Resource | Identifier/configuration | Isolation and IAM | Usage / cleanup |
|---|---|---|---|
| GCP project | `timelines-staging`; billing account explicitly approved; `us-central1` services | Separate project and billing budget; no production service account, secret, or IAM member is copied. | One project. Delete only after exports are retained and Founder approves teardown. |
| Cloud Run Functions v2 | `timelines-public-api`, `priority-topic-generation`, `autonomous-topic-generation`, `institutional-transitions`, `topic-discovery`; Node 22; `us-central1`; same CPU/memory/concurrency caps as repository deploy script | `timelines-runtime@timelines-staging`; public invoker only for public API; task invoker only for the three private workers; scheduler invoker only for discovery. | Scale to zero; discovery scheduler paused. Delete service revisions/project at teardown. |
| Firestore | Default database in `timelines-staging`, location `nam5`, Standard edition, deployed rules/indexes, PITR and delete protection enabled | New project means a physically separate database. Runtime service account gets only `roles/datastore.user`; browser access remains denied by rules. | Synthetic corpus only; export/retain acceptance evidence, then delete project. |
| PostgreSQL | Neon project `timelines-staging`; databases `timelines-staging-primary` and `timelines-staging-restore` | Separate Neon project and credentials; TLS required; distinct least-privilege app/migration/restore roles. `RESTORE_DATABASE_URL` always names the restore database. | 1 GiB initial data ceiling per database; destroy databases/project after retention approval. |
| Cloud Storage | `timelines-staging-institutional-archive`, regional `us-central1`, Standard class, uniform bucket access, public-access prevention, versioning, 7-day soft delete, 90-day lifecycle for staging backups | Runtime account only; no production bucket IAM. No public object ACLs. | 20 GiB ceiling; lifecycle delete after 90 days; destroy with project. |
| Cloud Tasks | `priority-topic-generation`, `autonomous-topic-generation`, `institutional-transitions` in `us-central1`, repository rates (5/1/10 dispatches/sec, max attempts 5) | Runtime enqueues; task-invoker invokes only corresponding private services. Queue remains empty except fixture tests. | Pause queues before teardown; delete with project. |
| Cloud Scheduler | `topic-discovery-daily`, `us-central1`, paused at creation | `timelines-scheduler` has invoker only on discovery; no manual run. | Keep paused; delete with project. |
| Service accounts | `timelines-runtime`, `timelines-tasks-invoker`, `timelines-scheduler` under `timelines-staging` | Runtime roles: datastore user, Cloud Tasks enqueuer, Vertex AI user, log writer, Secret Manager accessor. Add only service-account-user binding needed for task OIDC. No Editor/Owner. | Disable then delete with project. |
| Secrets | GCP: `IP_HASH_SALT`, `BACKEND_SHARED_SECRET`; Vercel: all variables listed below | Generate new values; never copy a production secret. Runtime account accesses only the two GCP secrets. | Rotate after testing; delete with project/project settings. |
| Monitoring | Cloud Logging/Monitoring in staging project; one staging-only email or webhook notification channel approved by Founder | Alert policies for health, error rate, queue/retry, auth denial, database, capacity, and recovery. No production recipient. | Test once per acceptance run; delete channel/policies with project. |
| Vercel | New `timelines-staging` project, generated `*.vercel.app` URL, Preview/Production within this project only | Team MFA, least-privilege project access, deployment protection for reviewers, `X-Robots-Tag: noindex, nofollow`, robots disallow, no production domain aliases. | Instant rollback to prior staging deployment; delete project at teardown. |

## Required configuration

Vercel staging values: `DATABASE_URL`, `RESTORE_DATABASE_URL`, `SYNTHETIC_DATABASE_URL`, `CRON_SECRET`, `SERVERLESS_API_BASE_URL` pointing only to `timelines-staging`, a newly generated `BACKEND_SHARED_SECRET`, `ADMIN_OPERATOR_TOKENS` for synthetic named MFA-attested principals, `ADMIN_SESSION_SECRET`, `ADMIN_ROUTE_SLUG`, the three `OPERATIONS_*_WEBHOOK_URL` values, `BACKUP_DIR`, and the generated `NEXT_PUBLIC_SITE_URL`. Analytics and AdSense remain unset. `ADMIN_API_TOKEN` remains unset.

GCP Function values: the repository-issued release identity, staging project/region, staging task invoker, synthetic corpus ID and public-ID range, `EVIDENCE_FIRST_MODE=SHADOW`, and the two GCP Secret Manager references. Do not configure production URLs, credentials, data imports, or Vertex/provider credentials. Provider-backed Factory execution is not part of staging acceptance.

## Database and synthetic data plan

Use Neon Launch rather than a self-hosted or shared database. It preserves PostgreSQL protocol, migration semantics, TLS, independent restore destination, and provider recovery behavior with the fewest operational components. Neon publishes a typical Launch spend of $15/month for intermittent 1 GiB use, with $0.106/CU-hour and $0.35/GB-month usage pricing; confirm the account’s current plan and PITR capability before approval ([Neon pricing](https://neon.com/pricing)).

Apply all migrations to `timelines-staging-primary`; create only synthetic platform, timeline, source, projection, and governed fixture data. Run restoration solely into `timelines-staging-restore`. Use no production snapshot, institutional record, secret, operator, or appointment. The fixture appointment is a temporary database record with an unambiguously synthetic principal and is deleted after acceptance evidence is sealed.

## Cost envelope

All figures are USD and exclude tax. They are planning estimates, not billing quotes; actual account pricing, location, discounts, and usage must be rechecked in the provider calculators before approval.

| Component | Published pricing / assumption | Idle estimate | Active-test estimate |
|---|---|---:|---:|
| Neon PostgreSQL | Launch typical spend $15/month for intermittent 1 GiB; current usage rates above | $15 | $15–30 |
| Vercel | Existing team plan incremental cost is unverified. Published Pro price is $20/member/month with $20 included usage; new project cost depends on team contract ([Vercel pricing](https://vercel.com/pricing)). | $0–20 incremental | $0–20 plus overage only if account limit permits |
| Cloud Run Functions | Scale-to-zero design. Google publishes 2M requests, 400k GB-seconds, 200k GHz-seconds, and 5 GiB egress free monthly; source deployments can add Cloud Build/Artifact Registry charges ([Cloud Run Functions](https://cloud.google.com/functions)). | $0–5 | $5–15 |
| Firestore | 5 GiB synthetic data plus PITR/backup allowance; Standard `us-central1` published storage/PITR rate is $0.15/GiB-month beyond free quotas; operations expected below modest test thresholds ([Firestore pricing](https://cloud.google.com/firestore/pricing)). | $1–2 | $2–5 |
| Storage | 20 GiB regional Standard allowance at approximately $0.02/GiB-month plus low operations; 90-day retention limits growth ([Cloud Storage pricing](https://cloud.google.com/storage/pricing)). | $1 | $1–3 |
| Tasks, Scheduler, Logs, Monitoring, egress | Low-volume fixture use; price must be confirmed in the approved billing account because regional/account quotas and log volume apply. | $0–5 | $5–15 |
| **Total** | **No AI/provider research; no paid custom staging domain; no always-on compute.** | **$17–48/month** | **$28–88/month** |

Set a GCP monthly budget of **$50** with alerts at 50%, 80%, and 100%; set a Vercel hard spend limit of **$20 incremental usage**; set Neon spend limit to **$30**. The combined recommended ceiling is **$100/month including tax-excluded provider usage**, with manual review before any limit increase. Budgets alert but do not necessarily stop service requests, so enforce Cloud Run max instances, Task rates, 20 GiB bucket cap, 5 GiB Firestore data target, and no AI/provider execution. Firestore’s free quota does not cover PITR/backups/restores, and budget alerts alone do not stop requests ([Firestore billing guidance](https://cloud.google.com/firestore/pricing)).

## Provisioning and acceptance sequence

1. Founder approves the $100/month ceiling, billing account, Vercel team plan impact, Neon plan/PITR capability, and one staging-only alert recipient.
2. Create `timelines-staging`; attach the approved billing account; set budget/alerts and service quotas before workload deployment.
3. Create the three service accounts, least-privilege bindings, two GCP secrets, Firestore default database/rules/indexes/PITR, storage bucket, queues, and paused scheduler.
4. Create separate Neon project/databases/roles and separately stored TLS URLs; verify neither hostname, credential, or database identity matches production.
5. Create `timelines-staging` Vercel project with project-only environment variables, deployment protection, noindex controls, no production alias, and generated URL.
6. Set `TIMELINES_STAGING_ISOLATION_VERIFIED=true` only after the written resource-identity checklist is signed; set the existing mutation-approval flag for the attributed deployment.
7. Deploy the exact release to GCP and Vercel; verify revision identity, Function IAM, paused discovery, empty queues, database migration ledger, Firestore/API parity, and health.
8. Load synthetic fixtures; execute Admin/MFA/revocation, recovery, alert-delivery, public browser/accessibility/performance, and bounded non-provider institutional journeys.
9. Rehearse rollback to the prior staging Vercel deployment and verify the isolated restore database/health. Keep production untouched.
10. Retain evidence per policy, pause/delete queues and scheduler, revoke staging secrets and principals, then delete project/Vercel/Neon resources when staging is retired.

Codex can execute steps 3–10 only after the approval in the next section; steps 1–2 require Founder/billing authority.

## Measurable staging acceptance gates

| Gate | Pass criterion |
|---|---|
| Isolation | Resource checklist proves all IDs differ from production; credential tests show staging identities cannot write production; deployment script interlocks pass. |
| Deployment/parity | Exact commit/release identity deployed; all migrations idempotent; Functions revision, public DTO/hash, sitemap/search, and health parity pass. |
| Admin/security | Synthetic MFA Admin succeeds; anonymous/legacy/non-MFA/expired/revoked/wrong-role requests fail; server-derived synthetic institutional actor cannot be client-forged. |
| Recovery | Backup manifest checksum passes; isolated restore reconciles all nine recovery queries; measured RPO/RTO recorded. |
| Monitoring | Every declared severity emits a structured correlated event and reaches the approved staging-only destination. |
| Public product | Homepage, reader, milestone, search, empty/error, canonical/JSON-LD, keyboard/screen reader, mobile visual, and noindex checks pass. |
| Performance | At declared staging load, public p95 ≤250 ms, search p95 ≤500 ms, error rate <0.1%, and queue/database limits remain below alert thresholds. |
| Institutional/resilience | Synthetic fixture proves Factory → Governance → Library → Published Memory → Projection → Search → reader with immutable lineage; no provider research, public publication, or real authority. |
| Rollback | Previous staging Vercel deployment restores; database rollback/restore procedure completes; post-rollback health and alert test pass. |

## Exact Founder authorization requested

> Approve creation of the isolated `timelines-staging` GCP project, `timelines-staging` Vercel project, and separate Neon staging project/databases under a total tax-excluded monthly ceiling of $100. Approve the specified staging-only billing account, Vercel team-plan impact, Neon Launch/PITR plan, and one staging-only alert recipient. Authorize Codex to create only the resource inventory in this plan, configure least-privilege IAM/secrets/budgets/quotas, deploy the exact reviewed release only to those staging targets, create synthetic test principals and records, and execute the listed staging acceptance and rollback gates. Do not authorize production mutation, production credential reuse, autonomous discovery, provider-backed research, real appointments, Governance submission, publication, Registry/Community changes, Phase-2 certification, or launch.

## Planning evidence

Read-only provider inventory still exposes only the production Vercel project and `tiimeliines` GCP project. No provider resource was created, modified, or contacted beyond read-only metadata/pricing documentation. The existing repository’s deploy interlocks remain required and are not weakened.
