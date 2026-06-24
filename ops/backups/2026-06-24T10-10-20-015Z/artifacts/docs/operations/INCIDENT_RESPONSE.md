# Incident Response

Authority Level: Operations
Governed System: Incident handling.
Describes: Both

## Scope
Defines incident response foundation.

## Non-Scope
Does not define on-call staffing.

## Verified Implementation
An incident document exists for relationship recovery under `docs/incidents/`.

Machine-readable severity model:

```text
ops/incidents/severity.json
```

## Severity Levels
- `SEV1`: platform unavailable, data integrity at risk, or authority/publication corruption suspected. Response target: 15 minutes.
- `SEV2`: major admin, publication, provider, projection, or recovery function degraded. Response target: 60 minutes.
- `SEV3`: limited operational degradation with available workaround. Response target: 240 minutes.
- `SEV4`: informational defect or non-urgent operational follow-up. Response target: 1440 minutes.

## Operational Response Model
Every incident must identify:

- Incident commander.
- Severity.
- Affected service or authority boundary.
- Current mitigation.
- Validation command or evidence.
- Communications owner.

Data integrity incidents require preservation of source artifacts, backup manifests, and recovery reports.

## Escalation Model
Escalation is defined by severity in `ops/incidents/severity.json`. `SEV1` escalates to incident commander, database owner, and platform owner. `SEV2` escalates to incident commander and service owner.

## Dependencies
`docs/incidents/INCIDENT-2026-06-19-RELATIONSHIP-RECOVERY.md`.

## Future Evolution Guidance
Data integrity incidents require preservation of source artifacts and reports.
