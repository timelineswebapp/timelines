# TL-EVIDENCE-FIRST-GENERATION-001 — Shadow Certification Protocol

Date frozen: 2026-09-09

Status: **FROZEN BEFORE EXECUTION**

Execution mode: **NON-PUBLIC SHADOW ONLY**

## Safety boundary

The run must use the same evidence-first knowledge, completion, selection, Event Lock, composition, Timeline Quality, final Source Authority, and reader implementation intended for a later production release. Shadow persistence is immutable Factory Production Memory only.

The runner must not import or invoke Governance transition, Historical Library, Published Memory, projection, search-publication, or public-timeline mutation functions. Before/after counts for those collections must be captured. Any increase attributable to the run is an authority-boundary violation and an automatic certification failure.

Autonomous discovery must remain paused. The three `001D` subjects are non-public regression subjects and do not reuse or mutate their preserved production ledgers or artifacts.

## Frozen corpus

The machine-readable corpus is `docs/programs/TL-EVIDENCE-FIRST-GENERATION-001-SHADOW-CORPUS.json`. It contains exactly 30 subjects, all fixed before execution, with every required topic class represented and deliberately difficult subjects included.

## Predeclared certification thresholds

All denominators are the complete frozen 30-subject corpus. A terminal provider failure counts as failure for every downstream rate; it is never removed from the denominator.

| Measure | SHADOW_CERTIFIED threshold |
|---|---:|
| Valid Completed Knowledge Set | at least 27/30 (90%) |
| Subjects with at least six evidence-eligible canonical EVENT candidates after completion | at least 27/30 (90%) |
| Passing comparative deterministic selection | at least 27/30 (90%) |
| Passing Event Lock integrity and constrained composition | at least 27/30 (90%) |
| Passing Timeline Quality | at least 27/30 (90%) |
| Passing final Source Authority | at least 27/30 (90%) |
| Publication-worthy independent reader assessment | at least 27/30 (90%) |
| Complete end-to-end shadow-gate pass | at least 26/30 (86.7%) |
| Each major topic class end-to-end pass rate | at least 75%, with no class wholly failing |
| Lineage verification | 30/30, zero corruption |
| Scope immutability | 30/30, zero accepted expansion |
| Public/institutional writes | zero |
| Authority-boundary violations | zero |
| Priority/autonomous release-parity defects | zero |
| Known systematic provider defects | zero |
| Terminal provider/system failures | no more than 1/30 and no repeated same-signature failure across two subjects |
| Retrieval/provider call budget | 100% of subjects remain within the frozen per-subject budgets |
| Latency | median no more than 12 minutes; p95 no more than 20 minutes; no subject over the 1,200-second worker bound |
| Usage | every provider execution records call count and available token usage |
| Monetary cost | record actual or estimated cost when exposed; otherwise record `NOT_MEASURABLE`, never zero |

The three `001D` regressions must each produce a valid Completed Knowledge Set, pass deterministic selection without non-events or padding, preserve exact Event Lock lineage, and reach all three independent downstream assessments. Any one of these regressions failing is an automatic `NOT_SHADOW_CERTIFIED` result even if aggregate rates pass.

Every subject considered publication-worthy by automated gates must receive human-style inspection. At minimum, inspect all three `001D` regressions and at least one representative from every topic class. Human inspection must find meaningful historical development, faithful title/scope delivery, defensible opening and endpoint, no material omission, no redundancy, readable progression, and no context/state description masquerading as an event. A material human finding is an automatic failure for that subject and is included in the end-to-end rate.

## Stop rule

Thresholds are immutable for this run. If any mandatory zero-defect rule, regression rule, class rule, or aggregate threshold fails, verdict is `NOT_SHADOW_CERTIFIED`; stop without lowering thresholds or starting live certification.

## Frozen failure-injection matrix

The repository gate must cover every required failure class before the provider-backed corpus run. Existing Factory V2 tests remain authoritative for acquisition, retrieval, claims, conflicts, entity/event resolution, coverage, comparative selection, and retry exhaustion; the evidence-first suites add release, Event Lock, composition, unchanged-gate adapter, and authority-boundary coverage.

| Required class | Required behavior | Repository evidence |
|---|---|---|
| Scope expansion or mutation | reject; never silently reopen scope | Factory V2 contract/acquisition/selection tests |
| Sparse or inaccessible evidence | bounded gap completion, then fail closed | Factory V2 acquisition, coverage, reliability tests |
| Conflicting/duplicate claims | resolve immutably or block | Factory V2 authority/resolution tests |
| Duplicate/non-event candidates | deduplicate or exclude before selection | Factory V2 resolution/selection tests |
| Unsupported or mixed-precision dates | reject unsupported claims; preserve supported precision | Factory V2 authority/contracts and Event Lock tests |
| Omission, temporal concentration, stale endpoint | explicit completeness finding or selection failure | Factory V2 coverage/selection tests |
| Source-rich minor versus source-poor major event | evidence eligibility precedes comparative significance | Factory V2 selection tests |
| Long-duration, ongoing, and candidate pressure | phase-aware selection within 6–20; no padding | Factory V2 coverage/selection tests plus frozen corpus |
| Biography, crisis, institution, technology, science, culture | heterogeneous live behavior | frozen 30-subject corpus; provider run required |
| Composition invents facts or changes Event Lock | one wording repair from the same lock, then fail closed | evidence-first contracts/composition tests |
| Final Source Authority or reader failure | fail closed; no institutional transition | unchanged gate tests and shadow orchestration |
| Provider failure/retry exhaustion | bounded attempts and explicit terminal failure | Factory V2 reliability/vertex and composition tests |
| Immutable lineage corruption | reject hash, identity, membership, or version skew | completed-knowledge-set, release, and Event Lock tests |
| Priority/autonomous revision skew | deployment preflight/postflight refuses release | generation-release tests and deploy script checks |
| Institutional/public write attempt | prohibited dependency and zero before/after deltas | evidence-first boundary tests and shadow runner |
