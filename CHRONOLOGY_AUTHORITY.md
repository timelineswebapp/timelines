# Chronology Authority

## Authority

Chronology is the ordering backbone of TiMELiNES. Every event must have deterministic historical date metadata suitable for display, sorting, duplicate detection, search, and canonical milestone URLs.

Events are the atomic knowledge unit. Chronology belongs to events.

## Scope

This document governs:

- event date parsing
- date precision
- legacy date values
- display dates
- historical sort fields
- event ordering
- duplicate signatures
- milestone paths
- chronology repair scripts

## Data Model

Core event chronology fields:

```text
events.date
events.date_precision
events.sort_year
events.sort_month
events.sort_day
events.display_date
timeline_events.event_order
```

`timeline_events.event_order` is the per-timeline sequence field. It is required because one event may appear in more than one timeline.

## Parsing Authority

Primary parser:

```text
src/lib/historical-date.ts
```

All write paths must use the shared historical date parser. Ad hoc date parsing is not allowed in import, admin, seed, backfill, or repair scripts.

## Supported Precision

Supported precision values:

```text
year
month
day
approximate
```

Precision must be explicit or safely inferred by the shared parser.

## Display Versus Sort

Display and sort are separate concerns.

Display fields:

- `display_date`
- formatted labels in UI and metadata

Sort fields:

- `sort_year`
- `sort_month`
- `sort_day`
- `date_precision`
- `event_order` where editorial ordering is active

Display labels must not be used as the only ordering source.

## Duplicate Signature

Import and backfill duplicate matching must use:

```text
timeline_slug
sort_year
sort_month
sort_day
date_precision
normalized event title
```

This signature is strict enough to prevent accidental cross-timeline matches while stable enough for source CSV backfills.

## Timeline Ordering Modes

Chronology mode:

- Historical sort fields are the ordering authority.
- `event_order` may act as deterministic tie-breaker.

Editorial mode:

- `timeline_events.event_order` is the primary ordering authority.
- Historical chronology remains stored and searchable.

Ordering behavior must remain explicit. Silent fallbacks are not allowed for production content.

## BCE and Non-Modern Dates

Historical dates may include BCE dates and approximate chronology. BCE handling must remain parser-owned.

Rules:

- No year zero.
- BCE values must sort before CE values.
- Display labels must preserve historical meaning.
- Database writes must preserve canonical legacy and sort fields.

## Milestone URLs

Milestone URLs use stable event IDs:

```text
/milestone/{eventId}/{slug}
```

Preserving event IDs preserves milestone URLs. Bulk repair and backfill operations must not delete and recreate events when relationship-only recovery is needed.

## Repair Policy

Chronology repair scripts may:

- detect chronology drift
- canonicalize date fields
- resequence timeline event order

Chronology repair scripts must not:

- delete events
- recreate events
- change milestone IDs
- infer missing relationship data without source evidence

## Validation Checklist

Before chronology-affecting releases:

- Typecheck passes.
- Build passes.
- Sample BCE, approximate, year, month, and day dates parse correctly.
- Timeline event ordering is deterministic.
- Duplicate detection still matches expected import rows.
- Existing milestone URLs remain stable.

## Change Control

Any chronology parser change requires:

- Regression tests for supported date formats.
- Import duplicate detection review.
- Backfill matching review.
- Public URL stability review.
- Data repair plan for any canonicalization changes.
