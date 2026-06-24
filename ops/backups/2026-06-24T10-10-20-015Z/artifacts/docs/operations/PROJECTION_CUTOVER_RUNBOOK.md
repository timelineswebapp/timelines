# Projection Cutover Runbook

## Authority Boundaries

- Historical Library remains the authority for Published Memory.
- Platform read models consume Published Memory projections only.
- Governance and Factory workflows are not changed by cutover operations.
- Public routes and public URLs are not changed by this runbook.

## Migration Order

Apply migrations in filename order after confirming the following dependency order:

1. `20260621_historical_library_foundation.sql`
2. `20260621_historical_library_lifecycle.sql`
3. `20260621_published_memory_projections.sql`
4. `20260622_projection_lifecycle_correction.sql`
5. `20260623_projection_cutover_operations.sql`

`20260622_projection_lifecycle_correction.sql` contains database guards that fail the migration if projection tables or lifecycle tables have not been created first.

## Rebuild Procedure

1. Deploy code and migrations together.
2. Confirm the admin API is authenticated.
3. Run `POST /api/admin/historical-library/projections/rebuild`.
4. Capture the returned rebuild report id.
5. Run `GET /api/admin/historical-library/projections/metrics`.
6. Confirm projection coverage is `100`.
7. Confirm `dto_validation_failures` and `rebuild_failures` are empty in the rebuild report response.

The rebuild processes Published Memory snapshots, retirements, and merges in batches. It does not depend on legacy public-read fallbacks.

## Validation Procedure

Required validation checks:

- `npm run typecheck`
- `npm test`
- `npm run build`
- migration order check
- projection rebuild report status is `completed`
- projection coverage percentage is `100`
- search projection count is non-zero when searchable Published Memory exists
- sitemap projection count is non-zero when public timeline or milestone projections exist
- continuity projection count matches published retirements plus merges

## Cutover Procedure

Proceed only when validation passes and the latest rebuild report has no failures.

1. Apply migrations in the required order.
2. Deploy the projection-only public-read build.
3. Run the projection rebuild endpoint.
4. Run the projection metrics endpoint.
5. Smoke-test public timeline, milestone, object, search, and sitemap routes.
6. Monitor server errors for projection DTO contract violations and projection lookup failures.

## Rollback Procedure

Rollback is forward-only because Published Memory and projection records are append-only.

1. Stop cutover before public traffic if migrations fail.
2. If the rebuild fails, do not reintroduce legacy fallback paths.
3. Fix the reported DTO or rebuild failure, redeploy, and rerun the rebuild.
4. If public serving fails after deployment, roll back the application build to the previous release while preserving migration state.
5. After application rollback, run metrics again and retain the failed rebuild report for audit.

Projection tables must not be manually deleted or truncated in production.
