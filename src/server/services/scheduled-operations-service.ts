import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { getWriteSql } from "@/src/server/db/client";
import { reliabilityRepository } from "@/src/server/repositories/reliability-repository";
import { schedulerRepository, type ScheduledOperationKey } from "@/src/server/repositories/scheduler-repository";
import { reliabilityService } from "@/src/server/services/reliability-service";

type Definition = { key: ScheduledOperationKey; cadenceMs: number; timeoutMs: number };
export const scheduledOperationDefinitions: Definition[] = [
  { key: "workflow_maintenance", cadenceMs: 5 * 60_000, timeoutMs: 60_000 },
  { key: "projection_verification", cadenceMs: 15 * 60_000, timeoutMs: 120_000 },
  { key: "publication_verification", cadenceMs: 15 * 60_000, timeoutMs: 120_000 },
  { key: "health_verification", cadenceMs: 60_000, timeoutMs: 60_000 },
  { key: "backup_execution", cadenceMs: 24 * 60 * 60_000, timeoutMs: 30 * 60_000 },
  { key: "restore_verification", cadenceMs: 7 * 24 * 60 * 60_000, timeoutMs: 30 * 60_000 },
  { key: "synthetic_publication_verification", cadenceMs: 60 * 60_000, timeoutMs: 120_000 },
  { key: "seo_validation", cadenceMs: 60 * 60_000, timeoutMs: 120_000 }
];

function scheduleBucket(now: number, cadenceMs: number): string {
  return new Date(Math.floor(now / cadenceMs) * cadenceMs).toISOString();
}

function runCommand(command: string, args: string[], timeoutMs: number): Promise<Record<string, unknown>> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error(`${command} timed out after ${timeoutMs}ms.`)); }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${String(chunk)}`.slice(-20_000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${String(chunk)}`.slice(-20_000); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolveRun({ command, exitCode: code, stdout: stdout.trim() });
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(-4000)}`));
    });
  });
}

async function executeOperation(key: ScheduledOperationKey, timeoutMs: number): Promise<Record<string, unknown>> {
  const sql = getWriteSql(`executing scheduled ${key}`);
  if (key === "health_verification") return reliabilityService.collectAndEvaluate();
  if (key === "workflow_maintenance") {
    const expired = await sql`UPDATE factory_topic_work_items SET status='failed',lease_owner=NULL,lease_expires_at=NULL,
      heartbeat_at=NULL,last_error='Worker lease expired during scheduled maintenance.',next_attempt_at=NOW(),updated_at=NOW()
      WHERE status='running' AND lease_expires_at < NOW()`;
    const stale = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM factory_topic_work_items
      WHERE status IN ('queued','failed','waiting') AND updated_at < NOW()-INTERVAL '30 minutes'`;
    if ((stale[0]?.count || 0) > 0) await reliabilityRepository.upsertAlert({
      alertKey: "stuck-workflows", severity: "warning", message: `${stale[0]?.count} workflows are stale.`,
      deduplicationKey: "scheduled:stuck-workflows", details: { stale: stale[0]?.count || 0 }
    });
    return { expiredLeasesRecovered: expired.count, staleWorkflows: stale[0]?.count || 0 };
  }
  if (key === "projection_verification") {
    const [result] = await sql<{ snapshots: number; missing: number; failures: number }[]>`
      SELECT COUNT(DISTINCT s.id)::int AS snapshots,
      COUNT(DISTINCT s.id) FILTER (WHERE p.id IS NULL)::int AS missing,
      (SELECT COALESCE(SUM(failed),0)::int FROM published_memory_projection_rebuild_reports WHERE created_at >= NOW()-INTERVAL '24 hours') AS failures
      FROM historical_library_published_snapshots s LEFT JOIN published_memory_projections p
      ON p.published_snapshot_id=s.id AND p.lifecycle='active'`;
    if (!result || result.missing > 0 || result.failures > 0) throw new Error(`Projection integrity failed: ${JSON.stringify(result || {})}`);
    return result;
  }
  if (key === "publication_verification") {
    const [result] = await sql<{ publications: number; invalid: number }[]>`
      SELECT COUNT(DISTINCT a.id)::int AS publications,
      COUNT(DISTINCT a.id) FILTER (WHERE timeline.id IS NULL OR search.id IS NULL OR sitemap.id IS NULL)::int AS invalid
      FROM historical_library_admissions a
      LEFT JOIN historical_library_published_snapshots s ON s.admission_id=a.id
      LEFT JOIN published_memory_projections timeline ON timeline.published_snapshot_id=s.id AND timeline.projection_type='timeline' AND timeline.lifecycle='active'
      LEFT JOIN published_memory_projections search ON search.published_snapshot_id=s.id AND search.projection_type='search' AND search.lifecycle='active'
      LEFT JOIN published_memory_projections sitemap ON sitemap.published_snapshot_id=s.id AND sitemap.projection_type='sitemap' AND sitemap.lifecycle='active'`;
    if (!result || result.invalid > 0) throw new Error(`Publication integrity failed: ${JSON.stringify(result || {})}`);
    return result;
  }
  if (key === "backup_execution") return runCommand("npm", ["run", "ops:backup"], timeoutMs);
  if (key === "restore_verification") {
    if (!process.env.RESTORE_DATABASE_URL) throw new Error("RESTORE_DATABASE_URL is required for isolated scheduled restore verification.");
    return runCommand("npm", ["run", "ops:restore:scheduled"], timeoutMs);
  }
  if (key === "seo_validation") {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is required for SEO validation.");
    const projections = await sql<Array<{ slug: string; payload: Record<string, unknown> }>>`
      SELECT slug,payload FROM published_memory_projections
      WHERE projection_type='timeline' AND lifecycle='active' AND slug IS NOT NULL
      ORDER BY created_at DESC LIMIT 5`;
    const failures: Array<{ slug: string; checks: string[] }> = [];
    for (const projection of projections) {
      const metadata = projection.payload.seo_metadata as Record<string, unknown> | undefined;
      const og = projection.payload.og_metadata as Record<string, unknown> | undefined;
      const checks: string[] = [];
      if (!metadata?.title || !metadata.description) checks.push("metadata_incomplete");
      if (!og?.title || !og.description) checks.push("open_graph_incomplete");
      const response = await fetch(new URL(`/timeline/${projection.slug}`, siteUrl), { signal: AbortSignal.timeout(10_000) });
      const html = await response.text();
      if (!response.ok || !html.includes('rel="canonical"')) checks.push("canonical_url_missing");
      if (!html.includes("application/ld+json")) checks.push("structured_data_missing");
      if (!html.includes('property="og:')) checks.push("open_graph_markup_missing");
      if (checks.length) failures.push({ slug: projection.slug, checks });
    }
    if (failures.length) throw new Error(`SEO validation failed: ${JSON.stringify(failures)}`);
    return { checked: projections.length, failures: [] };
  }
  const [synthetic] = await sql<Record<string, number>[]>`
    SELECT
      (SELECT COUNT(*)::int FROM factory_pipeline_runs) AS factory,
      (SELECT COUNT(*)::int FROM governance_publication_packages) AS governance,
      (SELECT COUNT(*)::int FROM historical_library_admissions) AS library,
      (SELECT COUNT(*)::int FROM historical_library_published_snapshots) AS memory,
      (SELECT COUNT(*)::int FROM published_memory_projections WHERE lifecycle='active') AS projection`;
  if (!synthetic) throw new Error("Synthetic institutional read traversal returned no result.");
  return { mode: "read_only_non_canonical", institutions: synthetic };
}

export const scheduledOperationsService = {
  async runDue(now = Date.now()) {
    const workerId = `scheduler-${randomUUID()}`;
    const outcomes: Array<{ key: ScheduledOperationKey; status: string }> = [];
    for (const definition of scheduledOperationDefinitions) {
      const run = await schedulerRepository.claim(definition.key, scheduleBucket(now, definition.cadenceMs), workerId, Math.ceil(definition.timeoutMs / 1000) + 30);
      if (!run) continue;
      const started = Date.now();
      try {
        const result = await executeOperation(definition.key, definition.timeoutMs);
        await schedulerRepository.complete(run.id, workerId, { ...result, durationMs: Date.now() - started });
        outcomes.push({ key: definition.key, status: "completed" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Scheduled operation failed.";
        await schedulerRepository.fail(run.id, workerId, message, { durationMs: Date.now() - started });
        await reliabilityRepository.upsertAlert({
          alertKey: `scheduled-${definition.key}-failed`, severity: "critical", message,
          deduplicationKey: `scheduled:${definition.key}`, details: { operationKey: definition.key }
        });
        outcomes.push({ key: definition.key, status: "failed" });
      }
    }
    return outcomes;
  },
  listRuns: schedulerRepository.list.bind(schedulerRepository)
};
