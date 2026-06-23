import "@/src/server/operations/environment";
import { validateMonitoringConfiguration, alertDefinitions, operationalMetrics } from "@/src/server/operations/monitoring";

const result = validateMonitoringConfiguration();
if (!result.ok) {
  console.error(JSON.stringify({ ok: false, component: "monitoring_verification", result }));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  component: "monitoring_verification",
  metrics: operationalMetrics.length,
  alerts: alertDefinitions.length
}));
