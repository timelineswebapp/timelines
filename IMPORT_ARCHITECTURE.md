# Import Architecture

## Authority

The import pipeline is the only supported bulk-ingestion path for curated timeline content.

Imports must preserve existing production milestones, validate all input before persistence, and write complete relationship data for events, timelines, sources, and tags. Import behavior is backend-owned and must not depend on client-side assumptions.

## Scope

This document governs:

- Admin CSV, JSON, and text import payloads.
- Preview versus approval behavior.
- Timeline creation and event insertion.
- Source and tag parsing.
- `timeline_events`, `event_sources`, and `event_tags` persistence.
- Duplicate handling.
- Backfill utilities that consume original source CSVs.

## Current Implementation

Primary implementation:

- `src/server/services/import-service.ts`
- `app/api/admin/import/preview/route.ts`
- `app/api/admin/import/execute/route.ts`
- `src/server/validation/schemas.ts`

The import service owns parsing, validation, duplicate detection, event creation, dimension resolution, and relationship insertion. API routes only authenticate, pass input to the service, and revalidate affected public paths after successful execution.

## Import Flow

```text
admin upload
  -> import preview route
    -> parse payload
    -> validate rows
    -> compute duplicate signatures
    -> report rows, warnings, source counts, tag counts

admin approval
  -> import execute route
    -> parse payload again
    -> validate rows again
    -> open database transaction
    -> create/reuse timeline
    -> create event
    -> create/reuse sources
    -> create/reuse tags
    -> insert timeline_events
    -> insert event_sources
    -> insert event_tags
    -> update timeline timestamp
    -> commit
```

Preview is read-only. Approval is the only import mode that writes database records.

## CSV Contract

Canonical CSV columns:

```text
timeline_title
timeline_slug
timeline_description
category
event_order
date
date_precision
title
description
importance
location
image_url
source_publisher
source_url
source_credibility
tags
```

Supported aliases are implemented in the import service. Any new alias must be explicit and tested.

## Tag Parsing

CSV tags are split on:

```text
semicolon ;
comma ,
pipe |
```

Required behavior:

- Trim whitespace.
- Ignore empty values.
- Deduplicate by normalized slug.
- Enforce validation limits.
- Never persist delimiter-composite tags from import input.

## Source Parsing

CSV source fields:

- `source_url`
- `source_publisher`
- `source_credibility`

Required behavior:

- Normalize URLs with an explicit scheme when safe.
- Infer publisher from URL only when publisher is absent.
- Validate source URL before persistence.
- Reuse sources by URL.

## Duplicate Handling

Duplicate detection uses chronology signature plus normalized event title within a timeline. Duplicate rows may be skipped during normal import.

Important invariant:

Duplicate skipping must not be used for relationship recovery. If an existing event lacks `event_sources` or `event_tags`, a normal duplicate-skipping re-import will not repair those relationships because skipped rows bypass relationship creation.

Relationship repair must use a dedicated additive backfill utility.

## Persistence Invariants

For every accepted imported event:

- One `events` row must exist.
- One `timeline_events` row must link it to the target timeline.
- Zero or more `sources` rows may exist.
- Every resolved source must be linked through `event_sources`.
- Zero or more `tags` rows may exist.
- Every resolved tag must be linked through `event_tags`.

Creating `sources` or `tags` without creating their event relationship rows is invalid except during explicit taxonomy/source administration.

## Transactions

Import execution must run inside a database transaction. If event, timeline, source, tag, or relationship persistence fails, the import must fail visibly and roll back.

Relationship insertion failures must not be swallowed.

## Operational Rules

- Dry-run import preview must never write data.
- Approval must re-parse and re-validate payloads.
- Production imports must produce structured diagnostic output on failure.
- Backfill scripts must default to dry-run.
- Backfill scripts must be additive-only unless a separate destructive migration has been approved.

## Change Control

Any import behavior change requires:

- Tests for parser behavior.
- Tests for duplicate handling.
- Verification that `event_sources` and `event_tags` are written for accepted events.
- Contract review if CSV headers, aliases, or validation limits change.
- Production dry-run before bulk remediation.
