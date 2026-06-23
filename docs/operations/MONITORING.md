# Monitoring

Authority Level: Operations
Governed System: Platform, database, Source Authority, publication pipeline, projection, and error monitoring.
Describes: Implementation

## Scope
This document defines repository-owned monitoring signals and alert definitions. It preserves existing services and architecture.

## Implemented Health Endpoint
`/api/health` validates:

- Required environment: `DATABASE_URL`.
- Database connectivity with `SELECT 1`.
- No-cache response semantics.
- Structured error logging for failed probes.

## Monitoring Configuration
Machine-readable alert configuration lives at:

```text
ops/monitoring/alerts.json
ops/alerts/delivery.json
ops/observability/dashboards.json
```

Verification command:

```bash
npm run ops:monitoring:verify
npm run ops:production:verify
```

## Observability Dashboards
Operational dashboard definitions are repository-owned and machine-readable:

- Platform health: `/api/health`, structured errors, and public platform availability.
- Publication pipeline: blocked Governance packages and publication-flow delay visibility.
- Provider health: persisted Source Authority provider cooldowns and failure streaks.
- Database health: database probe latency and PITR readiness.
- Projection health: projection rebuild failures and active projection coverage.

Dashboard definitions are diagnostic only. They do not mutate Governance, Historical Library, Published Memory, projections, or Platform publication state.

## Health Metrics
Required metrics:

- `platform.health.ok`: `/api/health` returns HTTP 200 and `{ ok: true }`.
- `database.probe.latency_ms`: database probe latency target is under 250 ms.
- `source_authority.provider.cooldown_active`: any provider has persisted cooldown.
- `source_authority.provider.consecutive_failures`: provider failure streak.
- `publication.pipeline.blocked_packages`: blocked publication packages.
- `projection.rebuild.failed`: latest projection rebuild failures.
- `projection.coverage.empty`: no active timeline projections.
- `errors.structured.rate`: structured operational error rate.

## Alert Definitions
Critical alerts:

- Platform health unavailable for two consecutive checks.
- Source provider consecutive failures `>= 3`.
- Publication pipeline blocked for 30 minutes.
- Projection rebuild failure in latest report.
- Empty active timeline projection coverage.

Warning alerts:

- Database latency over 250 ms for 5 minutes.
- Any Source Authority provider in active persisted cooldown.
- Structured operational error rate above provider threshold.

## Alert Delivery
Alert delivery is configured in `ops/alerts/delivery.json`.

- Critical alerts route to `OPERATIONS_CRITICAL_WEBHOOK_URL`.
- Warning alerts route to `OPERATIONS_WARNING_WEBHOOK_URL`.
- Informational alerts route to `OPERATIONS_INFO_WEBHOOK_URL`.

Webhook delivery sends structured JSON payloads containing severity, alert key, message, and details. Missing webhook variables fail delivery explicitly.

## Source Authority Monitoring
Provider health is persisted in `provider_runtime_state`, including:

- Consecutive failures.
- Active cooldown.
- Last failure and reason.
- Last success.
- Total failures.
- Total successes.
- Recovery count and timestamp.

This preserves Source Authority resilience without changing snapshot lineage or authority-bearing evidence records.

## Publication Pipeline Monitoring
Monitor Governance publication packages and Historical Library admission state. Alerts must detect blocked packages without mutating package lifecycle or certification state.

## Projection Monitoring
Monitor `published_memory_projection_rebuild_reports` and active `published_memory_projections`. Projection alerts are diagnostic only and must not auto-publish or auto-certify content.
