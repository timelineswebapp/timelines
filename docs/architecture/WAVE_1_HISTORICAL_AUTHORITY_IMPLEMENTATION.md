# Wave 1 Historical Authority Implementation

Status: Implemented server-side foundation

Program: PT-WAVE-1-IMPLEMENTATION-001

## Implementation Architecture

Wave 1 adds Historical Object Authority and Participation Authority as Historical Library-owned backend authority. It is additive and does not alter public milestone, timeline, search, SEO, import, or rendering behavior.

Authority ownership:
- Historical Objects are persisted in `historical_objects`.
- Participation is persisted in `milestone_participations`.
- Revision, merge, retirement, dispute, and preservation history are stored as append-only authority evidence.
- Public Timeline Views continue to consume existing `timelines`, `events`, `timeline_events`, `tags`, and `sources`.

Component boundaries:
- Persistence: `db/migrations/20260620_historical_object_participation_authority.sql`.
- Repository: `src/server/repositories/historical-authority-repository.ts`.
- Service boundary: `src/server/services/admin-service.ts`.
- Admin API: `app/api/admin/historical-authority/**`.
- No frontend public route, sitemap, structured data, search index, or import dependency is introduced in Wave 1.

## Schema Design

Historical Object persistence:
- `historical_objects` stores canonical identity, primary type, lifecycle status, authority state, provenance, revision counter, merge target, retirement reason, and preservation reason.
- `historical_object_aliases` stores preserved aliases with provenance.

Participation persistence:
- `milestone_participations` stores the object-to-milestone authority, role, meaning summary, lifecycle status, authority state, provenance, and revision counter.
- It references `events(id)` as the current milestone table without changing event IDs or chronology.

Lifecycle and provenance persistence:
- `historical_object_revisions`, `historical_object_merges`, `historical_object_retirements`, `milestone_participation_revisions`, and `milestone_participation_disputes` preserve authority history.
- JSONB provenance is stored explicitly through backend validation and repository writes.

No-delete doctrine:
- SQL triggers prevent deletes from all Historical Object and Participation authority tables.
- Operational correction must use revise, merge, retire, dispute, or preserve workflows.

## Repository Design

Repository ownership:
- `historicalAuthorityRepository` owns all database access for Historical Object and Participation authority.
- Existing timeline, event, tag, source, search, sitemap, and import repositories remain unchanged.

Repository boundaries:
- The repository validates canonical slug derivation, lifecycle mutation, transactional writes, and revision append behavior.
- It does not expose public discovery behavior or direct frontend database access.

Reuse strategy:
- Follows the existing server repository pattern: `getSql`, `getWriteSql`, typed records, Zod request schemas, and admin-only route wrappers.

## Service Design

Service ownership:
- `adminService` exposes authority methods only for admin API routes.

Authority management:
- Create and revise Historical Objects.
- Merge and retire Historical Objects.
- Create and revise milestone participations.
- Dispute and retire milestone participations.
- Read authority governance snapshots.

Validation responsibilities:
- Request schemas bound text lengths, UUIDs, milestone IDs, object types, provenance shape, and actor/reason requirements.
- SQL constraints enforce canonical lifecycle states and referential integrity.

## Administrative Design

Create workflow:
- Admin creates a Historical Object with canonical name, type, description, aliases, provenance, actor, and reason.
- Admin creates Participation with object ID, milestone ID, role, summary, provenance, actor, and reason.

Validate workflow:
- Admin reads `GET /api/admin/historical-authority` to audit object and participation counts, lifecycle state, and recent records.

Merge workflow:
- Admin posts to `/api/admin/historical-authority/objects/{id}/merge`.
- Source object is marked merged and inactive.
- Merge history is preserved.
- Non-conflicting participation rows move to the target object; conflicting rows remain preserved on the merged source object.

Retire workflow:
- Admin posts to `/api/admin/historical-authority/objects/{id}/retire` or `/participations/{id}/retire`.
- Authority state becomes inactive.
- Historical trace remains queryable.

Audit workflow:
- Revision, merge, retirement, and dispute tables provide immutable audit history.
- Physical deletes are blocked by database triggers.

## Migration Plan

Phase sequencing:
1. Deploy additive tables, indexes, triggers, and constraints.
2. Deploy backend repository, service, validation, and admin routes.
3. Backfill Historical Objects and Participation in controlled batches after data review.
4. Add admin UI only after authority data and workflows are verified.

Deployment order:
- Run `20260620_historical_object_participation_authority.sql` before using admin routes in production.
- Deploy application code after migration succeeds.

Rollback strategy:
- Application rollback is safe because no public code depends on new tables.
- Database rollback must preserve data. Do not drop authority tables after production writes. Disable admin routes or revoke admin access if rollback is needed.

## Validation Plan

Regression testing:
- `npm run typecheck`.
- Existing timeline, milestone, search, SEO, sitemap, and import flows must remain unchanged because no public repository or route was modified.

Authority testing:
- Create object.
- Revise object.
- Merge object.
- Retire object.
- Create participation.
- Revise participation.
- Dispute participation.
- Retire participation.
- Attempt physical delete and verify SQL trigger rejection.

Data integrity testing:
- Verify all participation rows reference existing `events`.
- Verify all participation rows reference preserved historical objects.
- Verify merged objects have `merged_into_id`.
- Verify retired authorities are inactive.
- Verify revision numbers are monotonic per authority.

## Production Rollout Plan

Safe deployment strategy:
- Ship Wave 1 behind admin-only APIs with no public UI integration.
- Keep public timeline and milestone behavior unchanged.
- Backfill in bounded batches and monitor write errors.

Monitoring requirements:
- Track admin API 4xx/5xx rates.
- Log migration failures and constraint violations.
- Monitor duplicate slug conflicts and participation unique constraint conflicts.

Success criteria:
- Historical Object Authority exists and is writable through admin API.
- Participation Authority exists and is writable through admin API.
- Revisions, merges, retirements, and disputes are preserved.
- No public route, SEO, sitemap, search, or timeline rendering behavior changes.

## Final Verdict

Recommended implementation architecture: server-only Historical Library authority layer with admin-only API access.

Recommended persistence model: additive PostgreSQL authority tables with JSONB provenance, strict lifecycle checks, revision tables, merge/retirement/dispute history, indexed foreign keys, and no-delete triggers.

Recommended migration sequence: deploy additive schema first, deploy backend admin routes second, backfill authority data later in bounded reviewed batches.

Recommended rollout strategy: release with no public experience integration, verify admin workflows, then progressively add admin UI and backfill tooling.

Can Wave 1 be implemented safely without affecting production behavior? Yes. The implementation is additive, admin-only, and does not modify milestone IDs, chronology, timeline routes, public rendering, search, SEO, sitemap generation, or import requirements.
