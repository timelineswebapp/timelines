# Source Authority

## Authority

Sources provide citation context for events. Events are the only content unit that directly owns source relationships.

Source records alone are not sufficient evidence of citation coverage. Citation coverage exists only when `event_sources` links sources to events.

## Scope

This document governs:

- `sources`
- `event_sources`
- import source parsing
- source reuse
- source credibility scores
- public source rendering
- source backfill and repair

## Data Model

Core tables:

```text
sources(id, publisher, url, credibility_score)
event_sources(event_id, source_id)
```

`sources.url` is unique. `event_sources` is the source of truth for event-to-source citation relationships.

## Ownership

Backend-owned:

- Source URL validation.
- Source publisher normalization.
- Source creation and reuse.
- `event_sources` persistence.
- Source relationship backfill.

Frontend-owned:

- Displaying resolved event sources.
- Submitting source inputs through validated admin APIs.

## Source Parsing Rules

Import source fields:

```text
source_publisher
source_url
source_credibility
```

Rules:

- Empty `source_url` means no source relationship for the row.
- URL must be normalized before validation.
- URL values missing `http://` or `https://` may receive `https://` only when they look like domain URLs.
- Publisher is required for persisted source records.
- Publisher may be inferred from the URL hostname only when missing.
- Credibility score must be numeric and bounded between 0 and 1.

## Persistence Rules

For every accepted imported event with a valid source URL:

1. Create or reuse a `sources` row by URL.
2. Insert `event_sources(event_id, source_id)`.
3. Use conflict-safe insertion for relationship rows.

Creating source records without relationship rows is invalid for content imports.

## Public Behavior

Timeline detail:

- Event source lists are resolved through `event_sources`.

Milestone pages:

- Citation lists are resolved through `event_sources`.

Metadata:

- Social metadata and JSON-LD citation fields depend on event source relationships.

Search:

- Milestone search includes source publisher text in memory mode.
- Production citation visibility depends on relationship rows.

## Backfill Policy

If production has source records but no `event_sources`, recover relationships from original source CSVs.

Correct recovery path:

1. Read original CSV files.
2. Match CSV rows to existing events by timeline slug, chronology signature, and normalized title.
3. Create or reuse source rows by URL.
4. Insert missing `event_sources` rows.
5. Produce audit reports for matched, unmatched, ambiguous, inserted, and pre-existing relationships.

Do not infer event-source relationships from the `sources` table alone.

## Deletion Policy

No source cleanup may run in the same operation as relationship recovery.

Unused source records may be reviewed only after:

- relationship backfill is complete
- public citation samples pass
- audit reports have been retained
- rollback window has passed

## Validation Checklist

Before source-related releases:

- `event_sources` count is non-zero in production.
- Sample timeline pages show citations.
- Sample milestone pages show citations.
- JSON-LD includes citation data for sourced milestones.
- Source URL uniqueness remains enforced.
- No write path creates source records without intended relationship handling.

## Change Control

Any source behavior change requires:

- Validation schema review.
- Backward compatibility review for existing CSV files.
- Dry-run report for bulk source operations.
- Rollback plan for any migration that touches source relationships.
