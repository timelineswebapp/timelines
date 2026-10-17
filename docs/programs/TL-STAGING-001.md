# TL-STAGING-001 — Staging Acceptance Report

**Status:** `STAGING_NOT_DEPLOYED`

**Date:** 2026-10-17

**Authority:** Founder authorization TL-STAGING-001. This record is subordinate to the constitutional, canonical, LOCK, and Phase-2 constraints referenced by `TL-SUPERGOAL-001`.

**Successor planning record:** [`TL-STAGING-002.md`](TL-STAGING-002.md) specifies the single recommended isolated staging architecture, cost ceiling, and exact next Founder authorization. The subsequent live provisioning evidence is in [`TL-STAGING-003.md`](TL-STAGING-003.md); this record remains the historical pre-provisioning assessment.

## Verdict

TiMELiNES has a reproducible, locally verified staging release candidate, but no independently isolated staging destination exists in the accessible provider accounts. No staging deployment, provider mutation, production deployment, discovery activation, Governance submission, publication, real appointment, or provider-backed research was performed.

The verified staging deployment identity is therefore **none**. The source baseline is `10dbb62b5656f354a0cd37def4f990eab92b02f6` plus the staging-isolation correction recorded below; a commit-level release identity must be created and gated before any future promotion.

## Isolation finding

Read-only provider inventory established the following:

- Vercel team `timelines-app` exposes one project, `timelines`, whose production URL is `https://www.timelines.sbs`.
- The accessible Google Cloud principal exposes only the `tiimeliines` project, which is the known production Functions/Firestore/Cloud Tasks/Storage destination.
- No separately provisioned Vercel project, PostgreSQL database, Firestore database or project, archive bucket, queue/scheduler set, service identities, alert receiver, or deployment principal was evidenced for staging.

This fails the mandatory isolation requirement. A Vercel preview in the existing project is not staging evidence because independent writable credentials and data resources were not proved. Deploying the release to either discovered target would violate TL-STAGING-001.

## Implemented staging-safety remediation

The serverless configuration previously accepted only the production project ID, preventing any genuine staging Functions revision. The release candidate now makes environment selection explicit and fail-closed:

- Production remains pinned to `tiimeliines`.
- Staging requires an explicit `GOOGLE_CLOUD_PROJECT` or `GCLOUD_PROJECT` and rejects `tiimeliines`.
- The deployment script requires explicit environment, project, deploy-principal, `TIMELINES_STAGING_ISOLATION_VERIFIED=true`, and `TIMELINES_INFRASTRUCTURE_MUTATION_APPROVED=true` inputs; it rejects staging into the production project and production outside its canonical project. The final interlock protects the resource, IAM, secret, queue, scheduler, storage, rule, and Function mutations performed by the script.
- A future deploy injects the environment identity into each Function and pauses `topic-discovery-daily` after deployment. Discovery is never activated by this change.

This is configuration safety, not staging deployment evidence.

The server-owned hardening regression statically locks these deployment requirements and passed 9/9 after the infrastructure-mutation interlock was added.

## Acceptance matrix

| Gate | Status | Evidence | Remaining blocker |
|---|---|---|---|
| Isolated deployment destination | BLOCKED | Read-only Vercel and GCP inventories show only production targets. | Founder/environment owner must provide independently isolated staging project, data resources, credentials, service identities, queues/schedulers, archive, alert destination, and URL. |
| Release provenance and reproducibility | PARTIALLY_VERIFIED | Root typecheck, 300 root tests, lint, security gate, Webpack build, Functions typecheck/build, and 374/376 Functions tests pass. | Commit the staged safety change and create a non-production deployment from that exact commit. |
| Firestore contracts and rules | PASSED_LOCAL | JDK 21 isolated Firestore emulator on port 8180: 10/10 pass using synthetic project `timelines-staging-fixture`; unauthenticated access denial, lineage, idempotency, retry isolation, and non-publication boundaries pass. | Deploy rules/indexes only after an isolated Firestore target is proved. |
| PostgreSQL migrations and institutional authorization | PASSED_LOCAL | Isolated PostgreSQL fixture verifies valid/missing/expired/revoked/wrong-scope/wrong-institution/ambiguous appointments, client-actor rejection, rollback, and migration reapply. | Dedicated staging PostgreSQL database plus synthetic appointment fixtures. |
| Secure Admin experience | PASSED_LOCAL | Existing production-mode local checks establish named MFA identity, RBAC, CSRF, expiry, revocation, and legacy-token denial. | Staging-only named principals, session secret, persistence, and browser evidence. |
| Serverless/API parity | BLOCKED | Current Functions are guarded for a non-production project and compile/test successfully. | Deploy a new revision to an isolated project; run migration/API parity against its synthetic resources. |
| Backup and recovery | PASSED_LOCAL | Prior isolated backup/checksum/restore/recovery drill is retained in the Tier-1 ledger. | Staging-only backup target and restored database; measure RPO/RTO. |
| Monitoring and alert delivery | BLOCKED | Local payload/severity drills and configuration validators pass. Provider inventory has no notification channels or alert policies. | Approved staging-only receiver, policies, test delivery, owner, and correlation evidence. |
| Public reader, accessibility, SEO, performance | PASSED_LOCAL | Existing production-mode synthetic browser and 10-way fixture benchmark evidence is retained. | Deployed staging URL, representative synthetic corpus, device/AT run, bounded load test, and noindex validation. |
| Institutional end-to-end journey | BLOCKED | Contract and isolated database tests preserve Factory → Governance → Library → Published Memory → Projection → Search boundaries. | Governed synthetic staging appointment fixture and isolated staging data; no real appointment or publication is authorized. |
| Autonomous resilience | PASSED_LOCAL | Emulator proves bounded retry isolation/nonblocking behavior; provider-backed research was not invoked. | Isolated staging queues and non-provider fixtures. |
| Rollback and promotion | BLOCKED | Rollback scripts and local migration rollback/reapply evidence exist. | Isolated deployed release, backup manifest, rollback rehearsal, health check, and Founder production-promotion decision. |

## Security and integrity status

The Tier-1 security gate reports zero high/critical runtime production dependency findings. `GHSA-vfj7-8cjw-p6xm` remains the documented lint-tooling-only exception and requires release review. The staging project guard was directly verified: staging configuration rejects `tiimeliines` and accepts an explicit synthetic project; the deploy script rejects invocation without explicit environment inputs and passes shell syntax validation.

No claim is made about live IAM, secret rotation, external security testing, staging alert delivery, staging database isolation, or provider configuration.

## Required Founder/environment decision

Provision or identify one existing, independently controlled non-production environment at no new unapproved recurring cost, with written identifiers for:

1. Vercel staging project and noindex URL;
2. staging PostgreSQL database and separate restore destination;
3. distinct GCP project, Firestore, storage bucket, Cloud Tasks, Cloud Scheduler, service identities, and least-privilege IAM;
4. staging-only secrets, named MFA test principals, and alert receiver; and
5. synthetic governed appointment fixture procedure.

After that evidence is supplied, deploy only the exact committed release to those destinations and execute the blocked gates in the matrix. Production remains untouched.

## Phase-2 boundary

Phase 2 remains blocked and uncertified. Berlin’s Founder-governed affected-community identity/capacity requirement is unchanged. This staging program neither changes the benchmark nor supplies a substitute certification result.
