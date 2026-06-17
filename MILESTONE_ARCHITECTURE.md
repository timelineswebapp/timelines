# Milestone Architecture

## Authority

Milestones are public event pages. The underlying database entity is `events`; the public milestone route exposes an event with timeline context, source context, tag context, and stable sharing metadata.

Event IDs are stable public identifiers and must be preserved.

## Scope

This document governs:

- event records as milestones
- milestone routes
- milestone share URLs
- milestone search
- milestone metadata and JSON-LD
- source and tag rendering on milestones
- relationship recovery impact on milestones

## Data Model

Milestone data is composed from:

```text
events
timeline_events
timelines
event_sources
sources
event_tags
tags
```

The event row is the atomic knowledge unit. Timeline context is attached through `timeline_events`.

## Public URL Contract

Canonical milestone path:

```text
/milestone/{eventId}/{slug}
```

Rules:

- `eventId` is the durable identifier.
- Slug is human-readable and derived from title.
- Changing title may change generated slug, but ID preserves resolvability.
- Backfill and relationship repair must never recreate events solely to restore tags or sources.

## Milestone Composition

A milestone page should include:

- title
- date label
- date precision
- description
- location when present
- image when present
- source citations
- tags
- timeline links
- metadata
- JSON-LD

Missing `event_sources` means citations disappear. Missing `event_tags` means tag context and keyword metadata disappear.

## Search

Milestone search ranks:

- exact title match
- event full-text search vector
- tag name and slug matches through `event_tags`

Tag-backed search requires event-to-tag relationships. Tags without `event_tags` do not improve milestone search.

## Metadata

Milestone metadata depends on event detail data.

Source relationships support:

- citation metadata
- trust signals
- richer JSON-LD

Tag relationships support:

- keywords
- topical context
- related discovery

## Timeline Context

A milestone may appear in one or more timelines through `timeline_events`.

The milestone route should preserve enough timeline context for:

- breadcrumb behavior
- related timeline links
- event order within a timeline
- canonical share context

## Import and Backfill Rules

Imports may create new milestones only through approved import execution.

Backfills must not create milestones. Relationship backfills may only:

- match source CSV rows to existing events
- create or reuse source records
- create or reuse tag records
- insert missing `event_sources`
- insert missing `event_tags`

Backfills must not:

- delete events
- delete timelines
- delete timeline memberships
- recreate events
- alter milestone IDs
- alter milestone URLs

## Quality Invariants

Required:

- Every public milestone has a valid event ID.
- Every milestone belongs to at least one timeline.
- Chronology fields are valid and deterministic.
- Source and tag lists are relationship-backed.
- Metadata generation must tolerate absent optional fields.

Recommended:

- Important milestones should have at least one source.
- Published milestones should have at least one relevant tag after relationship recovery.
- Titles should be concise and slug-safe.

## Failure Modes

Critical:

- Event deleted and recreated, changing public ID.
- `timeline_events` missing for published event.
- Milestone route cannot resolve event ID.

High:

- `event_sources` empty across production.
- `event_tags` empty across production.
- Milestone search loses tag matching.
- JSON-LD lacks citations and keywords at scale.

Medium:

- Source publisher missing.
- Tag coverage incomplete.
- Location/image inconsistencies.

## Validation Checklist

Before milestone-affecting releases:

- Sample milestone URLs resolve.
- Event IDs are unchanged.
- Timeline links render.
- Source citations render.
- Tags render.
- Metadata and JSON-LD build without errors.
- Search finds sampled milestones by title and tag.

## Change Control

Any milestone architecture change requires:

- Public URL stability review.
- Event ID preservation confirmation.
- Search impact review.
- Metadata/JSON-LD review.
- Relationship integrity checks for `timeline_events`, `event_sources`, and `event_tags`.
