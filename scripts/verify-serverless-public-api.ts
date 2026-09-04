import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

loadEnvConfig(process.cwd());

const MIGRATION_ID = "TL-SERVERLESS-MIGRATION-001";
const API_BASE_URL = process.env.SERVERLESS_API_BASE_URL || "https://us-central1-tiimeliines.cloudfunctions.net/timelines-public-api";
const READ_MODEL_TYPES = ["timeline", "milestone", "historical_object", "relationship"] as const;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for source parity verification.");
if (new URL(API_BASE_URL).hostname !== "us-central1-tiimeliines.cloudfunctions.net") {
  throw new Error(`Refusing to verify an unexpected API host: ${API_BASE_URL}.`);
}

const sql = postgres(process.env.DATABASE_URL, { max: 2, connect_timeout: 15, idle_timeout: 20 });

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { signal: AbortSignal.timeout(15_000) });
  const envelope = await response.json() as { ok: boolean; data?: T; error?: { code: string; message: string }; apiVersion?: string };
  if (!response.ok || !envelope.ok || envelope.data === undefined) {
    throw new Error(`API verification failed for ${path}: ${response.status} ${envelope.error?.code || "INVALID_ENVELOPE"}.`);
  }
  if (envelope.apiVersion !== "serverless-public-api-v1") throw new Error(`Unexpected API version for ${path}.`);
  return envelope.data;
}

async function main() {
  const typeResults = [];
  for (const type of READ_MODEL_TYPES) {
    const [source, target] = await Promise.all([
      sql<Array<{ payload: Record<string, unknown> }>>`
        SELECT payload FROM published_memory_projections
        WHERE lifecycle='active' AND projection_type=${type}
        ORDER BY created_at DESC, id DESC
      `,
      api<Array<{ payload: Record<string, unknown> }>>(`/read-models?type=${type}&limit=200`)
    ]);
    const sourceHashes = source.map((row) => hash(row.payload)).sort();
    const targetHashes = target.map((row) => hash(row.payload)).sort();
    if (stableJson(sourceHashes) !== stableJson(targetHashes)) throw new Error(`${type} DTO hash parity failed.`);
    typeResults.push({ type, source: source.length, target: target.length, payloadHashSet: hash(sourceHashes) });
  }

  const [sourceSitemap, targetSitemap] = await Promise.all([
    sql<Array<{ payload: { entries?: Array<Record<string, unknown>> } }>>`
      SELECT payload FROM published_memory_projections
      WHERE lifecycle='active' AND projection_type='sitemap'
      ORDER BY created_at DESC, id DESC
    `,
    api<Array<Record<string, unknown>>>("/sitemap")
  ]);
  const sourceEntries = sourceSitemap.flatMap((row) => row.payload.entries || []).map(hash).sort();
  const targetEntries = targetSitemap.map((entry) => hash({
    kind: entry.kind,
    ...(entry.id === undefined ? {} : { id: entry.id }),
    ...(entry.title === undefined ? {} : { title: entry.title }),
    ...(entry.slug === undefined ? {} : { slug: entry.slug }),
    updatedAt: entry.updatedAt
  })).sort();
  if (stableJson(sourceEntries) !== stableJson(targetEntries)) throw new Error("Sitemap entry hash parity failed.");

  const [latestTimeline] = await sql<Array<{ slug: string; payload: Record<string, unknown> }>>`
    SELECT slug, payload FROM published_memory_projections
    WHERE lifecycle='active' AND projection_type='timeline' AND slug='history-of-pandemics'
    ORDER BY created_at DESC, id DESC LIMIT 1
  `;
  const [latestObject] = await sql<Array<{ slug: string; payload: Record<string, unknown> }>>`
    SELECT slug, payload FROM published_memory_projections
    WHERE lifecycle='active' AND projection_type='historical_object' AND slug='pandemic'
    ORDER BY created_at DESC, id DESC LIMIT 1
  `;
  if (!latestTimeline || !latestObject) throw new Error("Expected duplicate-slug certification fixtures are unavailable.");
  const [timelineLookup, objectLookup] = await Promise.all([
    api<{ payload: Record<string, unknown> }>(`/read-model?type=timeline&slug=${encodeURIComponent(latestTimeline.slug)}`),
    api<{ payload: Record<string, unknown> }>(`/read-model?type=historical_object&slug=${encodeURIComponent(latestObject.slug)}`)
  ]);
  if (hash(timelineLookup.payload) !== hash(latestTimeline.payload)) throw new Error("Newest timeline slug resolution failed.");
  if (hash(objectLookup.payload) !== hash(latestObject.payload)) throw new Error("Newest historical-object slug resolution failed.");

  const search = await api<{ query: string; total: number; items: unknown[] }>("/search?q=pandemic&limit=12&offset=0");
  if (search.query !== "pandemic" || search.total < 1 || search.items.length < 1) throw new Error("Live search contract failed.");

  const report = {
    migrationId: MIGRATION_ID,
    checkedAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    apiVersion: "serverless-public-api-v1",
    readModels: typeResults,
    sitemap: { source: sourceEntries.length, target: targetEntries.length, payloadHashSet: hash(sourceEntries) },
    duplicateSlugResolution: { timeline: latestTimeline.slug, historicalObject: latestObject.slug },
    search: { query: search.query, total: search.total, returned: search.items.length },
    passed: true
  };
  await mkdir("ops/migration-reports", { recursive: true });
  const reportPath = `ops/migration-reports/${MIGRATION_ID}-public-api.json`;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));
}

main().finally(() => sql.end({ timeout: 5 }));
