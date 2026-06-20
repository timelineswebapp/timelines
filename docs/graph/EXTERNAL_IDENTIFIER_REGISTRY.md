# External Identifier Registry

Authority Level: Graph
Governed System: Future mappings to external authority identifiers.
Describes: Future Architecture

## Scope
This document defines the future registry for external IDs.

## Non-Scope
This document does not claim external identifier mappings exist today.

## Current Reality
No implemented tables or documented fields store Wikidata, VIAF, Library of Congress, GeoNames, DOI, ISBN, ORCID, or similar external authority IDs.

## Future Architecture
External identifiers should map canonical TiMELiNES entities, concepts, milestones, source documents, and works to external authority systems with provenance and confidence.

## Registry Requirements
- Internal entity type and ID.
- External authority name.
- External ID.
- External URL.
- Confidence/status.
- Source of mapping.
- Review metadata.

## Dependencies
- `docs/graph/ENTITY_REGISTRY.md`
- `docs/graph/CONCEPT_REGISTRY.md`
- `docs/graph/SOURCE_REGISTRY.md`
- `docs/graph/ONTOLOGY_AUTHORITY.md`

## Open Questions
- Which external authority system is primary for places?
- Should mappings be required before public graph exposure?

## Future Evolution
Add external IDs after canonical internal identity exists.
