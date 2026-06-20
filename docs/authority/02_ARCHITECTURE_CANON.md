# Architecture Canon

Authority Level: Canonical
Governed System: Implemented software architecture and target architectural direction.
Describes: Both

## Scope
This document defines the architectural boundaries for application, API, service, repository, validation, and database access layers.

## Non-Scope
This document does not replace detailed API reference, schema reference, or deployment runbooks.

## Verified Implementation
- Frontend and routes use Next.js App Router under `app/`.
- Components live under `components/`.
- Shared types and utilities live under `src/lib/`.
- Server services live under `src/server/services/`.
- Repository modules own database access under `src/server/repositories/`.
- SQL client setup lives in `src/server/db/client.ts`.
- Zod schemas live in `src/server/validation/schemas.ts`.
- Public APIs live in `app/api/*`.
- Admin APIs live in `app/api/admin/*` and require token auth.
- Development without `DATABASE_URL` falls back to deterministic memory/sample data outside production.

## Future Architecture
The platform should separate publishing runtime from authoritative registry generation:
- Registry/source artifacts become rebuild inputs.
- Factory services create validated batches.
- Publishing database receives approved projections.
- APIs continue to expose bounded, indexed, validated reads and writes.

## Dependencies
- `docs/architecture/*`
- `docs/references/API_REFERENCE.md`
- `src/server/db/client.ts`
- `src/server/api/admin-auth.ts`
- `next.config.mjs`

## Open Questions
- Should registry/factory services run inside the Next.js app or as separate workers?
- What durable queue or job runner should own factory workflows?
- How will multi-admin permissions be represented?

## Future Evolution Guidance
Preserve strict separation: UI renders and submits; APIs validate and authorize; services coordinate; repositories persist; registries govern canonical identity.
