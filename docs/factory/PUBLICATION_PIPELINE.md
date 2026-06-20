# Publication Pipeline

Authority Level: Factory Architecture
Governed System: Publication Package handoff from Factory to Historical Library.
Describes: Both

## Scope
This document governs the conceptual publication handoff between Factory Production Memory and Historical Library Published Memory.

## Non-Scope
This document does not define implementation infrastructure, database writes, schema, or approval roles.

## Product Identity
TiMELiNES is a Chronological Knowledge Platform. Publication exists to move approved chronological knowledge into the Historical Library for Platform presentation.

## Publication Model
The constitutional publication model is:

```text
Factory -> Publication Package -> Historical Library -> Platform
```

## Factory Doctrine
Factory owns Production Memory and prepares Publication Packages.

## Historical Library Doctrine
Historical Library owns Published Memory and admits Publication Packages into the permanent published collection.

## Publication Package Doctrine
A Publication Package is the only constitutional handoff unit from Factory to Historical Library. It may contain Historical Objects, Milestones, Timeline Views, relationships, sources, source tier evidence, validation records, and audit references.

## Feedback Package Doctrine
Editorial amendments after Library admission return through:

```text
Historical Library -> Feedback Package -> Factory
```

Feedback Packages preserve amendments, corrections, disputes, and quality signals so Factory Production Memory remains authoritative about production history.

## Current Reality
Approved admin import execution writes directly to publishing tables and revalidates public paths. That behavior is current implementation reality, not the constitutional publication doctrine.

## Future Architecture
Publication language must use Publication Package and Historical Library admission rather than generic projection-centric terminology.

## Dependencies
- `docs/factory/FACTORY_CONSTITUTION.md`
- `docs/factory/FACTORY_ARCHITECTURE.md`
- `docs/factory/FACTORY_ARTIFACT_MODEL.md`
- `docs/governance/PUBLICATION_LIFECYCLE.md`

## Open Questions
- Which non-Factory governance document owns Historical Library admission criteria?
- Which amendment classes generate Feedback Packages?

## Future Evolution
This document must preserve the Factory/Library boundary and must not define direct Factory writes as constitutional publication.
