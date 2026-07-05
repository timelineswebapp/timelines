# TiMELiNES — Current Execution

Version: 1.0

Purpose

This document is the operational control center for active engineering work.

Unlike the Product Constitution, Architecture Canon, Platform Status, and Master Roadmap, this document changes frequently.

It defines exactly what Codex should work on next.

Only one roadmap item should normally be active at any given time.

---

# Current Platform State

Institutional Publishing Platform

Production-capable

Current maturity:

Editorial Intelligence — Level 1

Current production status:

Factory
✓ Certified

Governance
✓ Certified

Historical Library
✓ Certified

Published Memory
✓ Certified

Platform Publication
✓ Certified

Public Timeline Rendering
✓ Certified

Editorial Intelligence
In Progress

---

# Current Phase

Phase 2

Editorial Intelligence

Objective

Raise publication quality from institutionally correct to editorially excellent while preserving historical authority and institutional architecture.

---

# Active Epic

EI-001

Editorial Foundation

Status

In Progress

Priority

Critical

Objective

Create deterministic editorial intelligence foundations that prepare grounded historical evidence for editorial composition without generating public editorial content.

---

# Current Task

Implement the next uncertified deliverable of EI-001.

Work must remain inside Editorial Intelligence.

Do not implement future Editorial Intelligence epics until EI-001 is fully certified.

---

# Scope

Allowed

✓ Editorial evidence ranking

✓ Historical significance scoring

✓ Turning-point detection

✓ Duplicate suppression

✓ Canonical subject scoring

✓ Coverage analysis

✓ Chronology balance

✓ Editorial metadata

✓ Editorial repositories

✓ Factory editorial preparation

✓ Deterministic algorithms

✓ Tests

✓ Migrations

✓ Rollbacks

Not Allowed

✗ Editorial Timeline Compiler

✗ Editorial Writer

✗ Timeline titles

✗ Timeline summaries

✗ Milestone summaries

✗ Public UI changes

✗ Projection redesign

✗ Governance changes

✗ Historical Library changes

✗ Published Memory redesign

✗ Source Authority redesign

✗ Schema redesign outside Editorial Foundation

---

# Definition of Done

EI-001 is complete only when:

✓ Editorial evidence ranking exists.

✓ Historical significance scoring exists.

✓ Turning-point detection exists.

✓ Duplicate suppression exists.

✓ Canonical subject scoring exists.

✓ Chronology coverage analysis exists.

✓ Editorial metadata is persisted.

✓ Deterministic behavior is verified.

✓ Multi-topic regression tests pass.

✓ Publication certification passes.

Only then may EI-001 be marked Certified.

---

# Current Blocker

None.

If blocked:

Stop immediately.

Report:

1. First repository-backed blocker.

2. Root cause.

3. Smallest architecturally correct fix.

Do not continue beyond the blocker.

---

# Next Epic

EI-002

Editorial Compiler

Do not begin until EI-001 has been certified.

---

# Permanent Rules

Always obey:

01_PRODUCT_CONSTITUTION_V2.md

02_ARCHITECTURE_CANON_V2.md

03_SCHEMA_CANON_V2.md

04_PRODUCT_EXPERIENCE_CANON_V2.md

05_EXECUTION_CANON_V2.md

06_PERMANENT_CONTEXT_V2.md

07_PLATFORM_STATUS.md

08_MASTER_EXECUTION_ROADMAP.md

This file (09_CURRENT_EXECUTION.md) controls only the active execution state.

If this document conflicts with any constitutional document, the constitutional document wins.

---

# Execution Protocol

For every implementation:

1. Read all relevant Project Sources.

2. Read this document.

3. Execute only the current task.

4. Modify the minimum required code.

5. Preserve institutional boundaries.

6. Run:

• lint

• typecheck

• relevant tests

• git diff --check

• certification (when applicable)

7. Stop.

Report:

✓ Completed

✓ Blocked

✓ Remaining work

Do not automatically begin the next roadmap item.