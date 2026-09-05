# TL-SERVERLESS-MIGRATION-001

Status: Complete; GCP migration and Vercel production cutover certified

Executed: 2026-09-04 UTC

Authority: Operations migration record

## Decision

TiMELiNES moves its active public read path and new topic-generation runtime from the local/PostgreSQL execution model to a server-mediated serverless architecture:

```text
Next.js on Vercel
  -> Firebase Cloud Functions v2 public API
    -> Firestore projection/read models

Topic intake
  -> transactional Firestore topic ledger
    -> Cloud Tasks
      -> grounded Vertex AI generation
        -> Factory -> Governance -> Historical Library
          -> Published Memory -> Projection Engine
```

This is an operational substrate migration. It does not move or weaken institutional authority. Factory output remains non-public until Governance admission, Historical Library admission, Published Memory creation, and projection materialization complete.

## Fixed production topology

| Resource | Production value |
|---|---|
| Google Cloud project | `tiimeliines` |
| Deploy identity | `timelineswebapp@gmail.com` |
| Firestore | Native mode, `(default)`, `nam5`, PITR and delete protection enabled |
| Cloud Functions and Tasks region | `us-central1` |
| Vertex AI location/model | `global` / `gemini-2.5-flash` |
| Public API | `https://us-central1-tiimeliines.cloudfunctions.net/timelines-public-api` |
| Archive bucket | `gs://tiimeliines-institutional-archive` |
| Scheduler | `topic-discovery-daily`, 03:00 UTC |

Functions are Node.js 22 second-generation functions. `timelines-public-api` is the only unauthenticated function. Generation, institutional-transition, and discovery functions require the dedicated Tasks or Scheduler invoker identity. Firestore and Firebase Storage rules deny all client access; application access is server mediated.

## Data migration evidence

The PostgreSQL source inventory contained 178 tables and 157,868 rows, of which 83 tables were non-empty. The migration used deterministic per-row SHA-256 hashes, legacy primary-key metadata, migration identity, and bounded 250-operation batches.

Final verification:

| Check | Result |
|---|---:|
| PostgreSQL source rows | 157,868 |
| Verified Firestore migration rows | 157,868 |
| Table count mismatches | 0 |
| Active primary projections | 43 / 43 |
| Search documents | 15 |
| Sitemap documents | 15 |
| Immutable audit events | 152,474 |
| Large archived immutable payloads | 78 |

Large payloads over 300 KiB are held in the private institutional archive with object versioning, uniform bucket-level access, public-access prevention, and a one-year retention policy. Nested arrays that Firestore cannot represent are stored as canonical JSON strings with an integrity hash.

Evidence files:

- `ops/migration-reports/TL-SERVERLESS-MIGRATION-001-dry-run.json`
- `ops/migration-reports/TL-SERVERLESS-MIGRATION-001-apply.json`
- `ops/migration-reports/TL-SERVERLESS-MIGRATION-001-verify.json`
- `ops/migration-reports/TL-SERVERLESS-MIGRATION-001-public-api.json`
- `ops/migration-reports/TL-SERVERLESS-MIGRATION-001-vercel-production.json`

## Public compatibility certification

The production serverless API was compared to PostgreSQL by source count and canonical payload-hash multiset:

| Projection | Source | Target | Result |
|---|---:|---:|---|
| Timeline | 7 | 7 | Pass |
| Milestone | 15 | 15 | Pass |
| Historical object | 7 | 7 | Pass |
| Relationship | 14 | 14 | Pass |
| Sitemap | 15 | 15 | Pass |

Duplicate active slugs resolve deterministically to the newest projection. Search query `pandemic` returned all eight expected results. Public DTO contracts, numeric IDs, envelopes, pagination, and search behavior are frozen in `src/server/platform/public-api-contracts.test.ts`.

## Generation certification

A non-persisting production Vertex v2 smoke test used Google Search grounding and native structured JSON output. It returned 24 search queries, 46 durable HTTPS sources, 38 attributable exact grounding segments, and 15 schema-valid events citing 23 evidence segments. Every cited source was attributable through a cited segment, and every event contained a distinct evidence summary. Earlier invalid responses failed closed without persistence or publication.

Grounding supports are preserved as immutable exact response segments with stable evidence IDs, character offsets, and their attributable source IDs. Generated claims must cite those evidence IDs, and every cited source must be attributable through a cited segment. The public description and model-written evidence summary are retained separately from exact evidence; neither is mislabeled as a source quotation.

Prompts, provider responses, model identity, location, schema version, and prompt version are represented by immutable execution metadata and cryptographic hashes. Generated evidence links both the immutable source snapshot and corpus document.

## Idempotency and failure handling

- Canonical topic identity is the first 160 bits of a deterministic SHA-256 digest of Unicode-, punctuation-, case-, and whitespace-normalized input.
- Topic intake and rate-limit updates are transactional.
- Cloud Task names are deterministic and delivery is at least once.
- Every pipeline stage uses deterministic identities and create-if-absent persistence.
- Leases prevent concurrent generation ownership.
- Failed enqueue state is explicit and retryable; it is never silently treated as success.
- Queues use five bounded attempts with 30-to-900-second exponential backoff.
- Routine governance decisions continue automatically; exceptional packages stop in the exceptional queue.

## Recovered migration incidents

1. A 700 KiB Firestore write threshold allowed a request to approach the 10 MiB batch limit. The run was stopped safely, the threshold was reduced to 300 KiB, and the idempotent migration resumed.
2. Firestore rejected nested arrays. The encoding was changed to canonical JSON plus integrity hash, and the run resumed.
3. Legacy active projections contained duplicate slugs. Projection document identities were made unique while newest-by-slug API behavior remained deterministic.
4. A materialization attempt included stale search/sitemap projection artifacts. Parity validation detected the 73-versus-43 discrepancy, and only artifacts owned by this migration were removed before a clean rebuild.
5. The first Vercel secret transfer used shell command substitution, which removed the Secret Manager value's terminal line feed. Public reads remained healthy, but the signed intake smoke test failed closed with HTTP 401. The exact 65-byte value was transferred without shell normalization, Preview and Production were redeployed, and signed existing-topic intake then returned `AVAILABLE` without enqueuing generation.

No PostgreSQL production rows were modified by these recoveries.

## Rollback boundary

Rollback reference: annotated Git tag `pre-serverless-migration-001` at pre-migration commit `36c0ba7bc587cc1f40caab20e203c596395241da`.

PostgreSQL and its legacy administration paths remain intact during the observation window. `DATABASE_URL` must not be removed until production cutover has been observed and rollback authority explicitly closes the window. Application rollback is a Vercel promotion to the pre-migration release; serverless resources and migrated Firestore data must be preserved for investigation rather than destructively removed.

## Vercel production cutover evidence

Production cutover completed on 2026-09-05 from application code commit `4cf45ff6df12c881fe400839c4d8d7cb88f7eb1e`.

| Check | Result |
|---|---|
| Vercel project | `timelines-app/timelines` |
| Preview deployment | `dpl_FizZbtGbhKFEP54J1UKrSLULxdjk` — READY |
| Production deployment | `dpl_9ScCbDkQ9qfgQp8orCnhtUHzdyGP` — READY |
| Canonical production URL | `https://www.timelines.sbs` |
| Production aliases | `www.timelines.sbs`, `timelines.sbs`, and Vercel project aliases |
| Preview smoke certification | Pass — public compatibility plus signed intake |
| Production smoke certification | Pass — 15 application/API checks |
| Production cold-cache maximum / p95 | 2,624 ms / 2,624 ms |

`SERVERLESS_API_BASE_URL` and `BACKEND_SHARED_SECRET` are configured for both Preview and Production. The signing secret was transferred directly from Google Secret Manager using a short-lived shell variable; it was not printed, written to the repository, or recorded in deployment documentation. `DATABASE_URL` remains configured solely to preserve the documented observation and rollback boundary.

The production smoke certification verified the homepage, timeline, milestone, category, tag, and search pages; timeline list/detail, homepage, tag, and search API contracts; sitemap and robots output; numeric DTO identities; SEO metadata; JSON-LD; Open Graph metadata; fail-closed request validation; and the signed Vercel-to-Functions topic-intake boundary. All expected success routes returned HTTP 200, the invalid topic request returned HTTP 400 without persistence, the certified `pandemic` search fixture returned eight results, and a certification request for an existing published topic returned `AVAILABLE` without enqueuing generation.
