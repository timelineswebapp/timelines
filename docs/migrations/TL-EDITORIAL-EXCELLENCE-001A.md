# TL-EDITORIAL-EXCELLENCE-001A — Production Provider Canary

Date: 2026-09-08

Verdict: **PRODUCTION READER CANARY: FAIL**

## Scope and safety

This was a non-public provider-contract canary. It used synthetic fixtures and imported only the production `generateReaderEditorialReview` transport and `assessReaderEditorialReview` verifier. It did not import or call Firestore, topic intake, Factory persistence, Governance, Historical Library, Published Memory, projection, search, or publication services.

Autonomous discovery was `PAUSED` before and after. The three preserved Editorial Excellence certification ledgers remained `FAILED`, attempt 5, with unchanged timestamps. No relevant production collection received a new document during the canary window.

## Exact path exercised

`generateReaderEditorialReview` → configured `GoogleGenAI` Vertex client → response text extraction → strict raw-object/exact-JSON-fence extraction → `JSON.parse` → `readerEditorialReviewSchema.parse` → `assessReaderEditorialReview`.

Production configuration: project `tiimeliines`, location `global`, model `gemini-2.5-flash`, prompt version `historical-research-v5-editorial-excellence`, schema version `serverless-schema-v3`.

Active deployed revisions containing the canary transport were `autonomous-topic-generation-00016-yug` and `institutional-transitions-00014-run`.

## Results

The valid canary reached Vertex and received a complete parseable JSON object on each attempt, but failed the strict server-owned Zod contract three times:

1. Vertex returned the nine criteria as top-level keys instead of the required `criteria` array and omitted `findings`, `informedReaderVerdict`, and `summary`.
2. Vertex returned `criteria` as an object and placed prose in `informedReaderVerdict` instead of the required enum.
3. Vertex returned a nine-element `criteria` array using `name`/`result` instead of `criterion`/`verdict`, and omitted `findings` and `summary`.

Total Vertex calls: 3, all consumed by the valid canary's existing bounded retry path. The valid fixture never reached deterministic semantic acceptance. Per the controlling stop condition, the invalid provider canary was not invoked and no fourth call was made. Existing deterministic tests still prove that an invalid selection/composition fixture fails closed, but that is not a substitute for the required production-provider invalid canary.

Exact incompatibility: unconstrained plain-text generation from the configured provider does not reliably follow the strict reader response shape, while constrained JSON generation is rejected by Vertex as too state-heavy. The strict schema was not weakened.

## Repository verification

- Functions tests: 128/128 pass.
- Functions strict typecheck: pass.
- Functions build: pass.
- `git diff --check`: pass.

## Decision

The reader transport is fail-closed but not provider-compatible and is not proven safe for a new founder-authorized Editorial Excellence certification set. Do not begin another live certification run.
