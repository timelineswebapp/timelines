# TiMELiNES — Platform Status

Version: 2.0

Status: ACTIVE

Authority: Tier 1

Last Updated: 2026-09-05

---

# Purpose

This document records the current verified operational status of TiMELiNES.

It describes repository-backed, certified, operational capabilities only. It does not define future architecture.

---

# Executive Summary

TiMELiNES has completed its institutional architecture and institutional certification program.

The certified institutional chain is:

Validated Evidence
→ Editorial Intelligence
→ Governance
→ Historical Library
→ Published Memory
→ Projection Engine
→ Search
→ Platform Read Models
→ Public APIs
→ Public Platform

Institutional status:

CERTIFIED WITH NO ARCHITECTURAL GAPS

Current engineering phase:

Production Launch Readiness

Remaining work is production, launch, operations, product, and future-platform work. It is not institutional architecture work.

---

# Locked Institutional Architecture

Factory
→ Editorial Intelligence
→ Governance
→ Historical Library
→ Published Memory
→ Projection Engine
→ Search
→ Platform Read Models
→ Public APIs
→ Public Platform

No separate Timeline Generation institution exists. Timeline projections are a certified Projection Engine responsibility.

---

# Institutional Certification Status

| Layer | Status | Certification |
|---|---|---|
| Factory | Certified | Covered by Editorial Intelligence and institutional publication tests |
| Editorial Intelligence | Certified | EI-005 End-to-End |
| Governance | Certified | Governance contract and publication-readiness tests |
| Historical Library | Certified | HL-000 and HL-001 |
| Published Memory | Certified | PM-001 |
| Projection Engine | Certified | PR-001 |
| Search | Certified | SR-001 |
| Platform Read Models | Certified | PL-001 |
| Public APIs | Certified | PL-001 |
| Public Platform | Certified | PL-001 |
| Institutional Completion | Certified | IC-001 audit |

---

# Certification Commands

Repository-backed machine certification commands:

* `npm run ops:editorial:certify -- --scope end-to-end`
* `npm run ops:historical-library:certify -- --scope end-to-end`
* `npm run ops:published-memory:certify -- --scope end-to-end`
* `npm run ops:projection-engine:certify -- --scope end-to-end`
* `npm run ops:search:certify -- --scope end-to-end`
* `npm run ops:platform:certify -- --scope end-to-end`

Certification test suites:

* `npm run test:editorial-certification`
* `npm run test:historical-library-certification`
* `npm run test:published-memory-certification`
* `npm run test:projection-engine-certification`
* `npm run test:search-certification`
* `npm run test:platform-certification`

---

# Certified Capabilities

## Factory and Editorial Intelligence

Status: Certified

Capabilities:

* deterministic Editorial Evidence Set preparation;
* deterministic Editorial Timeline Compiler;
* immutable Editorial Timeline Candidate persistence;
* deterministic Editorial Composition;
* immutable EditorialComposition persistence;
* Editorial Writer execution from immutable prompt, policy, provider, and binding records;
* immutable EditorialNarrative persistence;
* end-to-end Editorial Intelligence certification.

Editorial outputs remain Factory-owned technical memory until Governance.

## Governance

Status: Certified

Capabilities:

* publication packages;
* evidence verification;
* governance decisions;
* readiness certification;
* decision audit;
* lifecycle enforcement;
* prevention of Factory bypass.

## Historical Library

Status: Certified

Capabilities:

* canonical admission;
* authority records;
* immutable admission audit;
* revision, supersession, retirement, withdrawal, merge, split, and preservation lifecycle;
* authority continuity.

## Published Memory

Status: Certified

Capabilities:

* immutable publication snapshots;
* publication lifecycle;
* lineage preservation;
* projection source authority;
* recovery and audit preservation.

## Projection Engine

Status: Certified

Capabilities:

* timeline projections;
* milestone projections;
* historical object projections;
* relationship projections;
* search projections;
* sitemap projections;
* full and incremental rebuild;
* deterministic replay and recovery;
* projection preservation.

## Search

Status: Certified

Capabilities:

* projection-backed search intake;
* Firestore projection-backed search for the active public runtime;
* entity, timeline, milestone, chronology, relationship, and canonical identity indexing;
* deterministic rebuild, replay, recovery, and query consistency.

## Public Platform

Status: Certified

Capabilities:

* projection-backed Platform read models;
* public API serialization;
* routing;
* timeline rendering;
* event rendering;
* milestone rendering;
* canonical URLs;
* metadata;
* structured data;
* authority-preserving public presentation.

---

# Current Production Status

Institutional architecture: Complete and certified.

Serverless GCP data and execution migration: Deployed and certified.

Production Vercel application cutover: Deployed and certified at `https://www.timelines.sbs`.

Production engineering: Active.

Launch readiness: Active.

Remaining work belongs to:

* performance and scale hardening;
* observability and alerting;
* operational excellence;
* security hardening;
* public UX polish;
* SEO and accessibility;
* monitoring;
* monetization;
* launch documentation;
* future feature evolution.

---

# Current Priority

Complete Vercel environment configuration and production promotion for `TL-SERVERLESS-MIGRATION-001`, then execute public deployment smoke tests.

Future engineering must preserve institutional authority, provenance, governance, reproducibility, and the certified architecture.

---

# Serverless Production Runtime

The active serverless backend is deployed in Google Cloud project `tiimeliines`:

* Firestore Native mode with PITR and delete protection;
* Firebase Cloud Functions v2 on Node.js 22;
* Cloud Tasks with dedicated authenticated invoker identity;
* Cloud Scheduler with dedicated authenticated invoker identity;
* Vertex AI `gemini-2.5-flash` with Google Search grounding;
* private, versioned institutional source archive;
* public application access exclusively through the backend API.

Migration parity is certified at 157,868 source and target rows with zero table mismatches. Public API payload-hash parity, sitemap parity, duplicate-slug resolution, and search certification pass. PostgreSQL remains intact as the controlled rollback source during the cutover observation window.

Authoritative migration record: `docs/migrations/TL-SERVERLESS-MIGRATION-001.md`.
