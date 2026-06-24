# Cost Governance

Authority Level: Operations
Governed System: Retention, archival, cleanup, and storage budgeting.
Describes: Implementation

## Scope
Defines operational retention and cost controls without changing authority ownership or publication workflows.

## Machine-Readable Policy
```text
ops/cost/retention.json
```

## Retention Classes
- Source snapshots.
- Corpus documents.
- Evidence records.
- Runtime executions.
- Audit events.
- Backups.
- Projections.

## Cleanup and Archival Procedure
Cleanup is operational only. It must not delete authority-bearing institutional records. Policies marked `archive` move artifacts to lower-cost storage after the retention window. Backup pruning requires a verified successor backup. Superseded projections may be archived only when active projection continuity remains intact.

## Storage Budgeting
Storage budget thresholds are configured in `ops/cost/retention.json`. Budget review cadence is 30 days.

## Verification
```bash
npm run ops:production:verify
```
