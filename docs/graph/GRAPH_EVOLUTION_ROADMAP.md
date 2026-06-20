# Graph Evolution Roadmap

Authority Level: Graph
Governed System: Knowledge graph migration sequence.
Describes: Both

## Scope
Defines staged graph evolution.

## Non-Scope
Does not define timelines for delivery.

## Verified Implementation
The current platform is relational publishing with limited relationship edges.

## Future Architecture
Stages:
1. Stabilize milestone/source/tag relationships.
2. Introduce concept registry.
3. Introduce entity registry.
4. Add milestone-entity relationships.
5. Add claim/citation provenance.
6. Add event-event relationships.
7. Expose graph discovery.

## Dependencies
All `docs/graph/*` documents.

## Open Questions
- What public graph view is most valuable?

## Future Evolution Guidance
Do not expose graph UI until identity and provenance are trustworthy.
