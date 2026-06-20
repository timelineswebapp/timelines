# Backup Recovery

Authority Level: Operations
Governed System: Backup and restore expectations.
Describes: Both

## Scope
Defines backup/recovery target.

## Non-Scope
Does not configure backups.

## Verified Implementation
No backup script or restore runbook is implemented in this repository.

## Future Architecture
Back up publishing database, registry artifacts, source artifacts, import batches, and recovery reports.

## Dependencies
`db/schema.sql`, `data/*.csv`.

## Open Questions
- Where are authoritative source artifacts stored?

## Future Evolution Guidance
Registry artifacts must be restorable independently from Neon.
