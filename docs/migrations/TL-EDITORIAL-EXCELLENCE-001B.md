# TL-EDITORIAL-EXCELLENCE-001B — Reader Transport Simplification

Date: 2026-09-08

Verdict: **PRODUCTION READER CANARY: FAIL**

## Contract change

The old provider contract required Vertex to reproduce the complete nested canonical reader artifact. The new provider contract is a flat object containing nine explicit criterion verdict scalars, nine explicit rationale scalars, `findings_json`, `informed_reader_verdict`, and `summary`.

The production path is now: Vertex → shallow provider JSON → strict provider parser → deterministic canonical adapter → unchanged canonical Zod schema → unchanged deterministic semantic verifier.

The adapter maps every criterion verdict and rationale one-to-one, parses only the provider-supplied findings string, and copies the provider's publication verdict and summary. It does not infer missing criteria, normalize unknown values, change failures to passes, repair contradictions, or synthesize findings or prose. Adversarial tests prove each prohibited case fails closed.

## Provider canary

Configuration: project `tiimeliines`, location `global`, model `gemini-2.5-flash`, prompt version `historical-research-v5-editorial-excellence`, schema version `serverless-schema-v3`.

The known-valid fixture reached Vertex and received a complete shallow response on all three bounded attempts, but canonical validation rejected explicit non-canonical values:

1. `CONTENT_MISMATCH` was supplied as a finding code.
2. `not_publication_worthy` was supplied as the `publication_worthiness` criterion verdict instead of `passed` or `failed`.
3. `SCOPE_DEVIATION` and `OMISSION_MATERIAL` were supplied as finding codes.

The valid canary therefore did not reach semantic acceptance. Total Vertex calls: 3 (initial call plus two retries). Per the controlling stop condition, the invalid provider canary was not invoked and no additional call was made.

Exact remaining incompatibility: the provider reliably satisfies the shallow structural envelope but does not reliably preserve the canonical substantive enum vocabulary embedded in `findings_json` and criterion verdict fields. The adapter correctly refuses to reinterpret those judgments.

## Verification and production safety

- Functions suite: 131/131 pass.
- Functions strict typecheck: pass.
- Functions build: pass.
- `git diff --check`: pass.
- Discovery remained `PAUSED`.
- Before/after counts were identical: topic ledgers 9, Factory objects 351, Governance packages 8, Governance decisions 4, Historical Library 0, Published Memory 4, platform read models 46.
- Suez, CRISPR, and Vaccination remained `FAILED`.
- Cuban Missile Crisis and Apollo 13 remained `AWAITING_REVIEW`.
- No topic, candidate, institutional record, projection, or public timeline was created or modified by the canary.

Active revisions: `autonomous-topic-generation-00017-hel` and `institutional-transitions-00015-qus`.

## Decision

The transport remains fail-closed but is not proven provider-compatible. It is not ready for a newly authorized Editorial Excellence live certification set. Do not begin another certification run.
