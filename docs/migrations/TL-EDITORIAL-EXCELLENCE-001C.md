# TL-EDITORIAL-EXCELLENCE-001C — Semantic Reader Interface

Date: 2026-09-08

Verdict: **PRODUCTION READER CANARY: PASS**

Editorial Excellence remains **NOT_CERTIFIED**. No historical certification set was started.

## Production contract

The provider-facing reader interface now asks for nine numbered, ordinary-language criterion identities, a binary judgment and explanation for each criterion, an ordinary-language material-findings JSON string, an overall publication judgment, and a summary. It does not expose the canonical criterion keys, finding codes, severity vocabulary, or canonical publication enum.

The exact production path is `generateReaderEditorialReview` → Vertex `generateContent` with the shallow provider JSON schema → response-text extraction → `parseReaderEditorialJson` → strict `readerProviderResponseSchema` → `adaptReaderProviderResponse` → unchanged `readerEditorialReviewSchema` → deterministic reader assessment.

The deterministic adapter uses bounded exact allowlists only. It normalizes case plus whitespace/underscore/hyphen separators, maps explicit criterion identities and judgments, maps a finding's explicitly named criterion to the existing canonical finding code, rejects missing/duplicate/unknown values, and never manufactures findings or prose.

## Provider canary

Production configuration: project `tiimeliines`, location `global`, model `gemini-2.5-flash`, prompt version `historical-research-v5-editorial-excellence`, schema version `generated-timeline-v2`.

- Valid fixture: passed all nine criteria, strict provider parsing, canonical Zod validation, and deterministic semantic verification.
- Invalid fixture: failed closed. The synthetic replacement opening was rejected with deterministic `SELECTION_COMPOSITION_MISMATCH`, in addition to the provider's explicit scope/title/publication findings.
- Evaluator invocations: 2 (valid, then invalid).
- Vertex HTTP attempts: 3 total. The valid invocation used one bounded retry after its first response exceeded the strict 20-character limit for criterion 9's judgment; its second attempt passed. The invalid invocation passed provider parsing on its first attempt and then failed at the semantic verifier as designed.
- Persistence: none. The canary runner calls the reader evaluator directly and contains no repository, Governance, publication, or projection write path.

## Verification and production safety

- Functions suite: 132/132 pass.
- Functions strict typecheck: pass.
- Functions build: pass.
- `git diff --check`: pass.
- Discovery remained `PAUSED` (`topic-discovery-daily`, `0 3 * * *`, UTC).
- Before/after production counts were identical: topic ledgers 9, Factory objects 351, Governance packages 8, Governance decisions 4, Historical Library 0, Published Memory 4, platform read models 46.
- Suez Crisis, CRISPR, and Vaccination remained `FAILED`.
- Cuban Missile Crisis and Apollo 13 remained `AWAITING_REVIEW`.
- No topic, candidate, Governance decision, Historical Library entry, Published Memory entry, search/read projection, or public timeline was created or modified by the canary.

Active revisions: `autonomous-topic-generation-00018-sum` and `institutional-transitions-00016-nit`, both serving 100% traffic.

## Decision

The exact deployed reader transport is proven provider-compatible and fail-closed for a future, separately founder-authorized Editorial Excellence certification set. This result does not certify Editorial Excellence and does not authorize a new certification run.
