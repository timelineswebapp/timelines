import { reliabilityRepository, type InstitutionHealth, type MetricSample } from "@/src/server/repositories/reliability-repository";

function metricMap(samples: MetricSample[]) {
  return Object.fromEntries(samples.map((sample) => [sample.key, sample.value]));
}

export function evaluateInstitutionHealth(samples: MetricSample[]): InstitutionHealth[] {
  const m = metricMap(samples);
  const assessment = (institution: string, checks: Array<[boolean, "warning" | "critical", string]>, metrics: string[]): InstitutionHealth => {
    const failures = checks.filter(([failed]) => failed);
    return {
      institution,
      status: failures.some(([, severity]) => severity === "critical") ? "critical" : failures.length ? "warning" : "healthy",
      reasons: failures.map(([, , reason]) => reason),
      metrics: Object.fromEntries(metrics.map((key) => [key, m[key] || 0]))
    };
  };
  return [
    assessment("factory", [
      [(m["factory.dead_letter.depth"] || 0) > 0, "critical", "dead_letter_entries"],
      [(m["factory.queue.oldest_age_seconds"] || 0) > 1800, "warning", "stale_queue"],
      [(m["factory.worker.utilization"] || 0) > 0.95, "warning", "worker_saturation"]
    ], ["factory.queue.depth", "factory.queue.oldest_age_seconds", "factory.worker.utilization", "factory.dead_letter.depth"]),
    assessment("governance", [[(m["governance.latency_ms"] || 0) > 86_400_000, "warning", "governance_latency_high"]], ["governance.latency_ms"]),
    assessment("historical_library", [[(m["publication.latency_ms"] || 0) > 86_400_000, "warning", "publication_latency_high"]], ["publication.latency_ms"]),
    assessment("published_memory", [[(m["projection.failures"] || 0) > 0, "critical", "projection_generation_failed"]], ["publication.throughput_hour", "projection.failures"]),
    assessment("projection", [
      [(m["projection.failures"] || 0) > 0, "critical", "projection_failures"],
      [(m["projection.duration_ms"] || 0) > 300_000, "warning", "projection_duration_high"]
    ], ["projection.duration_ms", "projection.failures"]),
    assessment("platform_runtime", [
      [(m["workflow.retry_count"] || 0) > 20, "warning", "retry_volume_high"],
      [(m["workflow.active"] || 0) > 16, "warning", "workflow_concurrency_high"]
    ], ["workflow.active", "workflow.retry_count"])
  ];
}

export const reliabilityService = {
  async collectAndEvaluate() {
    const samples = await reliabilityRepository.collectCurrentMetrics();
    await reliabilityRepository.persistMetrics(samples);
    const health = evaluateInstitutionHealth(samples);
    await reliabilityRepository.persistHealth(health);
    for (const item of health.filter((entry) => entry.status !== "healthy")) {
      await reliabilityRepository.upsertAlert({
        alertKey: "unhealthy-institution", institution: item.institution,
        severity: item.status === "critical" ? "critical" : "warning",
        message: `${item.institution} is ${item.status}: ${item.reasons.join(", ")}`,
        details: { reasons: item.reasons, metrics: item.metrics },
        deduplicationKey: `institution:${item.institution}`
      });
    }
    const metrics = metricMap(samples);
    const runtimeAlerts = [
      { when: (metrics["factory.dead_letter.depth"] || 0) > 0, key: "dead-letter-entries", severity: "critical" as const, message: "Dead-letter queue is not empty." },
      { when: (metrics["factory.queue.oldest_age_seconds"] || 0) > 1800, key: "stale-queue", severity: "warning" as const, message: "Oldest queued topic exceeds 30 minutes." },
      { when: (metrics["projection.failures"] || 0) > 0, key: "failed-projections", severity: "critical" as const, message: "Projection failures occurred in the last 24 hours." },
      { when: (metrics["workflow.retry_count"] || 0) > 20, key: "retry-exhaustion-risk", severity: "warning" as const, message: "Workflow retry volume exceeds the safe threshold." }
    ];
    for (const alert of runtimeAlerts.filter((candidate) => candidate.when)) {
      await reliabilityRepository.upsertAlert({ alertKey: alert.key, severity: alert.severity, message: alert.message, deduplicationKey: `runtime:${alert.key}`, details: metrics });
    }
    return { samples, health };
  },
  dashboard: reliabilityRepository.dashboard.bind(reliabilityRepository),
  transitionAlert: reliabilityRepository.transitionAlert.bind(reliabilityRepository)
};
