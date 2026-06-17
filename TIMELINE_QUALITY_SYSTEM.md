# Timeline Quality System

## Authority

Timeline quality is measured by correctness, completeness, chronology integrity, source coverage, taxonomy coverage, and public rendering reliability.

Quality checks must be deterministic and auditable. They must not silently mutate production data unless an explicit repair mode is requested.

## Scope

This document governs:

- content integrity audits
- duplicate event detection
- orphan event detection
- chronology drift detection
- source and tag relationship coverage
- timeline ordering quality
- import and backfill validation
- production readiness checks

## Quality Dimensions

### Chronology Integrity

Required:

- Every event has valid chronology fields.
- Timeline ordering is deterministic.
- BCE and approximate dates are handled consistently.
- Duplicate detection uses the canonical chronology signature.

### Relationship Integrity

Required:

- Timeline membership exists through `timeline_events`.
- Source relationships exist through `event_sources`.
- Tag relationships exist through `event_tags`.
- Source and tag dimension records must not be treated as coverage without relationship rows.

### Editorial Completeness

Required:

- Timeline title, slug, description, and category are non-empty.
- Event title and description are non-empty.
- Events have appropriate importance values.
- Curated timelines have enough milestones to justify publication.

### Search Quality

Required:

- Timeline search includes timeline text, event text, and tag text.
- Milestone search includes event text and tag text.
- Missing `event_tags` is a search quality failure.

### SEO Quality

Required:

- Public timeline pages render meaningful metadata.
- Milestone pages render stable canonical paths.
- Tag pages should not be mass-indexed as empty pages without an explicit SEO decision.
- JSON-LD should include source and tag context when available.

## Audit Tooling

Current audit and repair script:

```text
scripts/check-and-fix-data.ts
```

Current relationship recovery utility:

```text
scripts/backfill-event-relationships.ts
```

Default mode for audit and backfill tools must be read-only or dry-run.

## Production Quality Gates

Before production release:

```text
npm run lint
npm run typecheck
npm run build
```

Before bulk data changes:

- Run dry-run.
- Persist audit output.
- Review unmatched and ambiguous rows.
- Confirm no deletion statements are present unless explicitly approved.
- Confirm rollback strategy.

## Minimum Production Health Metrics

Required non-zero counts:

- `timeline_events`
- `event_sources` after source relationship recovery
- `event_tags` after tag relationship recovery

Required consistency:

- `timeline_events.event_id` references existing events.
- `timeline_events.timeline_id` references existing timelines.
- `event_sources.source_id` references existing sources.
- `event_tags.tag_id` references existing tags.

## Defect Classification

Critical:

- Event IDs lost.
- Timeline membership lost.
- Milestone URLs broken.
- Import writes dimension rows without relationship rows.
- Production pages fail to render.

High:

- `event_sources` or `event_tags` empty in production.
- Search loses tag or source relevance.
- Tag sitemap includes mass empty pages.
- Chronology parser regression.

Medium:

- Orphaned source or tag records.
- Duplicate taxonomy candidates.
- Partial source coverage.

Low:

- Minor metadata copy issues.
- Admin-only count mismatch with known cause.

## Remediation Order

For relationship failures:

1. Stop creating new bad data.
2. Fix importer behavior.
3. Recover relationships from source CSVs.
4. Validate public pages and search.
5. Normalize taxonomy/source cleanup only after relationship recovery.

For chronology failures:

1. Audit drift.
2. Confirm parser behavior.
3. Run repair in dry-run.
4. Apply only explicit canonicalization.

## Reporting Requirements

Audit reports must include:

- total rows inspected
- matched rows
- unmatched rows
- ambiguous rows
- inserted rows in apply mode
- pre-existing rows
- invalid rows
- output file paths
- execution mode
- timestamp

## Change Control

Any quality-system change requires:

- A deterministic check or report.
- Clear dry-run semantics.
- No hidden writes.
- Production runbook for apply mode.
- Verification commands and expected results.
