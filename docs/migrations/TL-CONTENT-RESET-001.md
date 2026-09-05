# TL-CONTENT-RESET-001 — Clean active corpus isolation

Status: implementation validated; production activation pending

## Decision

TiMELiNES uses a structural Firestore namespace boundary for the reset. The new active corpus is stored only below:

`corpora/timelines-clean-2026-09-v1/{collection}/{document}`

All pre-reset root collections are the immutable legacy rollback/archive corpus. They are not copied, deleted, updated, queried by the active runtime, included in discovery summaries, or used as model input.

A document-level `corpusId` filter was rejected because a missed query predicate could expose legacy data. A database-wide destructive reset was rejected because it would violate rollback and archive preservation. The structural parent path makes omission of the boundary impossible in normal repository access.

## Runtime controls

- Every function deployment requires explicit `ACTIVE_CORPUS_ID` and `PUBLIC_ID_BASE` values.
- Runtime access fails closed unless `runtimeConfiguration/activeCorpus` and `corpusRegistry/{ACTIVE_CORPUS_ID}` match the environment.
- The corpus registry locks `NO_LEGACY_CONTENT_REUSE` and `VERTEX_GOOGLE_SEARCH_GROUNDING` policies.
- Topic hashes and Cloud Task names are corpus-scoped.
- Every task payload carries a corpus ID. Pre-reset/unscoped and inactive-corpus tasks are acknowledged without execution.
- Public reads, search, taxonomy, sitemap, continuity, topic status, Factory, evidence, Governance, Historical Library, Published Memory, and projections all resolve through the same active namespace.
- Public API responses use `Cache-Control: no-store` during the reset boundary.
- Public IDs for the clean corpus begin at `4000000001`, outside the certified legacy range.

## Certified authority path

The only active-corpus publication path is:

Vertex AI Gemini 2.5 Flash with Google Search Grounding → immutable source snapshot and corpus document → evidence records and validation → Factory objects → Governance package/decision/approval/audit → Historical Library admission → Published Memory → public/search/sitemap projections.

Autonomous discovery reads only active-corpus topic ledgers. An empty clean corpus therefore supplies no legacy topic titles or factual content to discovery.

## Preservation and rollback

- Pre-reset code tag: `pre-content-reset-001`
- Pre-reset commit: `94705e3ff6fdf573a1dd7a66688ef8560b3da478`
- Legacy Firestore root collections remain in place under Firestore PITR and delete protection.
- The institutional archive bucket remains versioned, retention protected, and private.
- Rollback consists of deploying the pre-reset tag/revision. It does not require a data restore because legacy root data is retained in place.

## Activation protocol

1. Capture and hash a count inventory of every legacy root collection.
2. Prove the target namespace is empty and the public-ID range is disjoint.
3. Pause Cloud Scheduler and all three Cloud Tasks queues.
4. Deploy corpus-aware functions with an explicit corpus ID and ID base.
5. Atomically create the immutable corpus registry/activation record and active pointer.
6. Verify the legacy inventory is unchanged and the target namespace remains unseeded.
7. Resume queues and Scheduler; legacy queued tasks are safely rejected by the new task contract.
8. Redeploy the Next.js application to eliminate pre-reset static/ISR output.
9. Certify public API and website reads contain no legacy projections, search results, sitemap entries, taxonomy, or legacy topic status.

## Pre-activation evidence

- Root application tests: 244/244 passed.
- Serverless corpus and institutional contract tests: 7/7 passed.
- Root and functions TypeScript checks: passed.
- Root lint: passed.
- Root and functions production builds: passed.
- Target namespace inventory: empty.
- Legacy collection inventory hash: `08bb46bb865a34911d93ca77143f8959bc09abdecfe6fdb8457653f621b85981`.
- Plan report: `ops/migration-reports/TL-CONTENT-RESET-001-plan.json`.

Production deployment and post-cutover evidence will be appended after activation.
