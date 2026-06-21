# Architecture Canon V2

## Status
Status: Active starter architecture canon

Authority Level: Highest architecture authority

Version: 2.0 starter

## Purpose
This document defines the canonical architecture principles and system boundaries for TiMELiNES. It translates product doctrine into durable technical structure.

## Scope
This document governs:
- System layering.
- Service and repository boundaries.
- Backend/frontend separation.
- Authority ownership boundaries.
- Integration principles.
- Capability sequencing.

Out of scope:
- Exact schema definitions.
- Visual design details.
- Deployment secrets.
- One-off implementation tactics.

## Authority
The canonical architecture preserves this separation:

```text
Product Doctrine
  -> Architecture
    -> Schema
      -> Services
        -> Routes
          -> UI
```

Backend services own business logic and database access. Frontend components render approved read models and never access the database directly.

## Ownership
Owner: Architecture authority steward

Contributors:
- Product authority steward
- Data/schema authority steward
- Engineering execution steward

## Principles
- Keep business logic on the server.
- Use repository patterns for database access.
- Validate all route inputs before repository execution.
- Preserve additive migration discipline.
- Keep authority mutation paths administrative and authenticated.
- Public reads must be bounded and shaped for presentation.
- Do not mix Factory Production Memory, Historical Library Published Memory, and Platform presentation responsibilities.
- New capabilities must respect locked platform layers: Chronology, Authority, Context.

## Canonical Layers
1. Presentation: Next.js pages and components.
2. API routes: request parsing, validation, authorization.
3. Services: use-case orchestration.
4. Repositories: database access and transactional persistence.
5. Database: durable authority, chronology, and platform data.
6. Documentation: constitutional and architectural authority.

## References
- `AUTHORITY_INDEX.md`
- `01_PRODUCT_CONSTITUTION_V2.md`
- `03_SCHEMA_CANON_V2.md`
- `05_EXECUTION_CANON_V2.md`
- `docs/architecture/APPLICATION_ARCHITECTURE.md`
- `docs/architecture/DOMAIN_MODEL.md`
- `docs/architecture/PLATFORM_CAPABILITIES.md`

## Change Management
Architecture changes must:
- Identify affected layers.
- Preserve separation of concerns.
- Include migration and rollback implications when persistence changes.
- Include compatibility impact for timeline, milestone, search, SEO, sitemap, import, and public rendering.
- Be reflected in schema and execution canon when applicable.
