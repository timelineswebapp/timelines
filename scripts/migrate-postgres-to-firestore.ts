import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import postgres from "postgres";

loadEnvConfig(process.cwd());

const PROJECT_ID = "tiimeliines";
const MIGRATION_ID = "TL-SERVERLESS-MIGRATION-001";
const BATCH_SIZE = 250;
const LARGE_DOCUMENT_BYTES = 300_000;
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const verifyOnly = args.has("--verify");
const startTable = process.argv.slice(2).find((argument) => argument.startsWith("--start-table="))?.split("=", 2)[1];

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
if ((process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || PROJECT_ID) !== PROJECT_ID) {
  throw new Error("Refusing to migrate outside tiimeliines.");
}

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID, storageBucket: process.env.STORAGE_BUCKET || `${PROJECT_ID}-institutional-archive` });
const db = getFirestore();
const sql = postgres(process.env.DATABASE_URL, { max: 2, connect_timeout: 15, idle_timeout: 20 });

type TableInfo = { tableName: string; primaryKeys: string[]; estimatedRows: number };
type MigrationCount = { source: number; written: number; hash: string };

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    if (Buffer.isBuffer(value)) return JSON.stringify(value.toString("base64"));
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
  }
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  return JSON.stringify(value);
}

function hash(value: unknown) {
  return createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
}

function slugify(value: string) {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "").toLocaleLowerCase("en-US").replace(/[’'`]/gu, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 120);
}

function topicId(title: string) {
  const normalized = title.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[’'`]/gu, "").replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/gu, " ").trim().replace(/^(?:a\s+)?(?:history|timeline|chronology|evolution|development)\s+(?:of\s+)?/iu, "");
  return { id: hash(`en:timeline:${normalized}`).slice(0, 40), normalized };
}

function safeDocumentId(value: string) {
  return value.replaceAll("/", "_").slice(0, 1400);
}

function canonicalRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value instanceof Date) return [key, value.toISOString()];
    if (Buffer.isBuffer(value)) return [key, value.toString("base64")];
    if (typeof value === "bigint") return [key, value.toString()];
    return [key, value];
  }));
}

function requiresCanonicalJson(value: unknown, arrayAncestor = false, depth = 0): boolean {
  if (depth > 15) return true;
  if (typeof value === "number" && !Number.isFinite(value)) return true;
  if (typeof value === "undefined") return true;
  if (Array.isArray(value)) {
    if (arrayAncestor) return true;
    return value.some((entry) => requiresCanonicalJson(entry, true, depth + 1));
  }
  if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return Object.values(value as Record<string, unknown>).some((entry) => requiresCanonicalJson(entry, arrayAncestor, depth + 1));
  }
  return false;
}

function collectionFor(table: string) {
  if (table === "factory_topic_work_items") return "topicLedgers";
  if (table === "factory_topic_execution_history") return "generationJobs";
  if (table === "factory_pipeline_runs") return "factoryRuns";
  if (table === "factory_objects") return "factoryObjects";
  if (table.startsWith("factory_")) return "factoryArtifacts";
  if (table === "source_authority_records") return "sourceRecords";
  if (table === "source_authority_snapshots") return "sourceSnapshots";
  if (table === "corpus_documents") return "corpusDocuments";
  if (table === "evidence_records") return "evidenceRecords";
  if (table === "evidence_validation_records") return "evidenceValidations";
  if (table.includes("evidence") || table.includes("claim")) return "claimLinks";
  if (table === "governance_publication_packages") return "governancePackages";
  if (table === "governance_decisions") return "governanceDecisions";
  if (table === "governance_approvals") return "governanceApprovals";
  if (table === "governance_queues") return "governanceQueues";
  if (table.startsWith("governance_audit")) return "governanceAudits";
  if (table.startsWith("governance_")) return "governanceAudits";
  if (table === "historical_library_admissions") return "libraryAdmissions";
  if (table === "historical_library_published_snapshots") return "publishedMemory";
  if (table.startsWith("historical_library_")) return "publicationLifecycle";
  if (table === "published_memory_projection_lineage") return "platformReadModelHistory";
  if (table === "published_memory_projections") return "platformReadModelHistory";
  if (table.startsWith("published_memory_")) return "publicationLifecycle";
  if (table === "admin_security_audit_events") return "auditEvents";
  if (table.startsWith("operational_metric") || table.startsWith("operational_health")) return "operationalMetrics";
  if (table.includes("failure") || table.includes("error")) return "failureRecords";
  if (table.startsWith("operational_") || table.startsWith("admin_")) return "adminOperations";
  return "institutionalArchive";
}

async function tableInventory(): Promise<TableInfo[]> {
  const rows = await sql<Array<{ table_name: string; primary_keys: string[] | null; estimated_rows: string }>>`
    SELECT tables.table_name,
      ARRAY_REMOVE(ARRAY_AGG(columns.column_name ORDER BY columns.ordinality), NULL) AS primary_keys,
      COALESCE(stats.n_live_tup, 0)::bigint::text AS estimated_rows
    FROM information_schema.tables AS tables
    LEFT JOIN LATERAL (
      SELECT attribute.attname AS column_name, key.ordinality
      FROM pg_index index_definition
      JOIN LATERAL unnest(index_definition.indkey) WITH ORDINALITY key(attribute_number, ordinality) ON true
      JOIN pg_attribute attribute ON attribute.attrelid=index_definition.indrelid AND attribute.attnum=key.attribute_number
      WHERE index_definition.indrelid=(quote_ident(tables.table_schema)||'.'||quote_ident(tables.table_name))::regclass
        AND index_definition.indisprimary
    ) columns ON true
    LEFT JOIN pg_stat_user_tables stats ON stats.schemaname=tables.table_schema AND stats.relname=tables.table_name
    WHERE tables.table_schema='public' AND tables.table_type='BASE TABLE'
    GROUP BY tables.table_name, stats.n_live_tup
    ORDER BY tables.table_name
  `;
  return rows.map((row) => ({ tableName: row.table_name, primaryKeys: row.primary_keys || [], estimatedRows: Number(row.estimated_rows) }));
}

function legacyDocumentId(table: TableInfo, row: Record<string, unknown>) {
  const identity = table.primaryKeys.length > 0 ? table.primaryKeys.map((key) => String(row[key])).join("--") : hash(row).slice(0, 40);
  return safeDocumentId(`${table.tableName}--${identity}`);
}

async function maybeOffloadLargeBody(collection: string, documentId: string, row: Record<string, unknown>) {
  const serialized = stableJson(row);
  const originalBytes = Buffer.byteLength(serialized);
  if (originalBytes <= LARGE_DOCUMENT_BYTES && !requiresCanonicalJson(row)) return row;
  if (originalBytes <= LARGE_DOCUMENT_BYTES) {
    return { payloadEncoding: "canonical-json", payloadJson: serialized, contentHash: hash(serialized), originalBytes };
  }
  if (!apply) return { ...row, largeObjectWouldBeArchived: true, originalBytes: Buffer.byteLength(serialized) };
  const objectPath = `institutional-source-archive/${MIGRATION_ID}/${collection}/${documentId}.json`;
  await getStorage().bucket().file(objectPath).save(serialized, {
    resumable: false,
    contentType: "application/json",
    metadata: { cacheControl: "private, max-age=31536000, immutable", metadata: { sha256: hash(serialized), migrationId: MIGRATION_ID } }
  });
  return { objectPath, contentHash: hash(serialized), originalBytes, archivedAtMigration: MIGRATION_ID };
}

async function migrateTables(inventory: TableInfo[]) {
  const counts: Record<string, MigrationCount> = {};
  const bulkWriter = db.bulkWriter();
  bulkWriter.onWriteError((error) => {
    const retryable = [4, 8, 10, 13, 14].includes(error.code);
    console.error(JSON.stringify({
      event: "firestore_write_error",
      code: error.code,
      failedAttempts: error.failedAttempts,
      documentPath: error.documentRef.path,
      retryable
    }));
    return retryable && error.failedAttempts < 5;
  });
  const startIndex = startTable ? inventory.findIndex((table) => table.tableName === startTable) : 0;
  if (startIndex < 0) throw new Error(`Unknown --start-table value: ${startTable}.`);
  for (const table of inventory.slice(startIndex)) {
    const collection = collectionFor(table.tableName);
    let source = 0;
    let written = 0;
    const digest = createHash("sha256");
    const order = table.primaryKeys.length > 0 ? ` ORDER BY ${table.primaryKeys.map((key) => `"${key.replaceAll('"', '""')}"`).join(",")}` : "";
    const cursor = sql.unsafe(`SELECT * FROM "${table.tableName.replaceAll('"', '""')}"${order}`).cursor(BATCH_SIZE);
    for await (const rows of cursor) {
      for (const raw of rows as Record<string, unknown>[]) {
        const row = canonicalRow(raw);
        source += 1;
        digest.update(stableJson(row));
        if (!apply) continue;
        const id = legacyDocumentId(table, row);
        const payload = await maybeOffloadLargeBody(collection, id, row);
        bulkWriter.set(db.collection(collection).doc(id), {
          migrationId: MIGRATION_ID,
          legacyTable: table.tableName,
          legacyPrimaryKey: Object.fromEntries(table.primaryKeys.map((key) => [key, row[key]])),
          sourceHash: hash(row),
          payload,
          immutable: true
        });
        written += 1;
      }
      if (apply) await bulkWriter.flush();
      if (source > 0 && source % 5_000 === 0) {
        console.log(JSON.stringify({ event: "table_progress", table: table.tableName, source, written }));
      }
    }
    counts[table.tableName] = { source, written, hash: digest.digest("hex") };
    console.log(JSON.stringify({ event: "table_migrated", table: table.tableName, collection, source, written }));
  }
  if (apply) await bulkWriter.close();
  return counts;
}

function legacyProjectionDocumentId(type: string, slug: string | null, payload: Record<string, unknown>) {
  if (type === "timeline" && slug) return `timeline--${slug}`;
  if (type === "milestone" && typeof payload.id === "number") return `milestone--${payload.id}`;
  if (type === "historical_object" && slug) return `historical-object--${slug}`;
  if (type === "relationship" && typeof payload.relationship_id === "string") return `relationship--${payload.relationship_id}`;
  return null;
}

function tokens(value: string) {
  return Array.from(new Set(value.normalize("NFKD").replace(/\p{M}+/gu, "").toLocaleLowerCase("en-US").split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2))).slice(0, 200);
}

async function materializeActiveProjections() {
  const [projections, continuityRows] = await Promise.all([
    sql<Array<Record<string, unknown>>>
      `SELECT id::text, published_snapshot_id::text, projection_type, slug, payload, projection_version::int, projection_hash, lifecycle, source_event_type, source_event_id::text, audit_record_id::text, created_at::text
       FROM published_memory_projections WHERE lifecycle='active' ORDER BY created_at,id`,
    sql<Array<Record<string, unknown>>>
      `SELECT DISTINCT ON (source_published_snapshot_id)
         source_published_snapshot_id::text, target_published_snapshot_id::text, continuity_type,
         continuity_path, source_event_id::text, projection_hash, audit_record_id::text, created_at::text
       FROM published_memory_continuity_projections
       ORDER BY source_published_snapshot_id, created_at DESC, id DESC`
  ]);
  const bulk = db.bulkWriter();
  let maxTimelineId = 0;
  let maxEventId = 0;
  let maxSourceId = 0;
  let maxTagId = 0;
  const categoryCounts = new Map<string, { name: string; count: number; updatedAt: string }>();
  const tags = new Map<string, { id: number; slug: string; name: string }>();
  for (const row of projections) {
    const type = String(row.projection_type);
    const payload = row.payload as Record<string, unknown>;
    const legacyId = legacyProjectionDocumentId(String(row.projection_type), typeof row.slug === "string" ? row.slug : null, row.payload as Record<string, unknown>);
    if (legacyId) bulk.delete(db.collection("platformReadModels").doc(safeDocumentId(legacyId)));
    if (!new Set(["timeline", "milestone", "historical_object", "relationship"]).has(type)) {
      bulk.delete(db.collection("platformReadModels").doc(`projection--${String(row.id)}`));
    }
    if (type === "timeline" && typeof payload.id === "number") bulk.delete(db.collection("sitemapDocuments").doc(`timeline--${payload.id}`));
    if (type === "milestone" && typeof payload.id === "number") bulk.delete(db.collection("sitemapDocuments").doc(`milestone--${payload.id}`));
  }
  for (const row of projections) {
    const type = String(row.projection_type);
    const slug = typeof row.slug === "string" ? row.slug : null;
    const payload = row.payload as Record<string, unknown>;
    const id = new Set(["timeline", "milestone", "historical_object", "relationship"]).has(type) ? `projection--${String(row.id)}` : null;
    const sortTimestamp = Timestamp.fromDate(new Date(String(row.created_at)));
    if (id) {
      const authorityKeys = type === "relationship"
        ? [payload.source_authority_ref, payload.target_authority_ref].flatMap((ref) => ref && typeof ref === "object" ? [`${String((ref as Record<string, unknown>).authorityType)}:${String((ref as Record<string, unknown>).authorityId)}`] : [])
        : typeof payload.id === "number" ? [`${type}:${payload.id}`] : [];
      bulk.set(db.collection("platformReadModels").doc(safeDocumentId(id)), {
        projectionType: type,
        lifecycle: "active",
        slug,
        publicId: typeof payload.id === "number" ? payload.id : null,
        categorySlug: type === "timeline" && typeof payload.category === "string" ? slugify(payload.category) : null,
        tagSlugs: Array.isArray(payload.tags) ? payload.tags.map((tag) => slugify(String((tag as Record<string, unknown>)?.name || tag))).filter(Boolean) : [],
        authorityKeys,
        relationshipId: type === "relationship" && typeof payload.relationship_id === "string" ? payload.relationship_id : null,
        payload,
        publishedMemoryId: row.published_snapshot_id,
        projectionHash: row.projection_hash,
        projectionVersion: row.projection_version,
        sourceEventType: row.source_event_type,
        sourceEventId: row.source_event_id,
        auditRecordId: row.audit_record_id,
        migrationId: MIGRATION_ID,
        sortTimestamp,
        updatedAt: sortTimestamp
      });
    }
    if (type === "timeline" && typeof payload.id === "number") {
      maxTimelineId = Math.max(maxTimelineId, payload.id);
      const category = String(payload.category || "History");
      const categorySlug = slugify(category);
      const current = categoryCounts.get(categorySlug);
      categoryCounts.set(categorySlug, { name: category, count: (current?.count || 0) + 1, updatedAt: String(payload.updatedAt || row.created_at) });
      const topic = topicId(String(payload.title || slug));
      bulk.set(db.collection("topicLedgers").doc(topic.id), {
        topicId: topic.id, normalizedTitle: topic.normalized, displayTitle: payload.title, scope: `en:timeline:${topic.normalized}`, slug,
        aliases: [topic.normalized], origin: "migration", priority: 0, state: "PUBLISHED", currentStage: "published", timelineId: payload.id,
        activeJobId: null, deterministicTaskIdentity: null, leaseOwner: null, leaseExpiresAt: null, attemptCount: 0, maximumAttempts: 5,
        nextRetryAt: null, lastError: null, generation: 1, createdAt: sortTimestamp, updatedAt: sortTimestamp, publishedAt: sortTimestamp,
        publishedMemoryId: row.published_snapshot_id
      });
      for (const tag of (Array.isArray(payload.tags) ? payload.tags : [])) {
        if (!tag || typeof tag !== "object") continue;
        const record = tag as Record<string, unknown>;
        if (typeof record.id === "number" && typeof record.slug === "string" && typeof record.name === "string") {
          tags.set(record.slug, { id: record.id, slug: record.slug, name: record.name });
          maxTagId = Math.max(maxTagId, record.id);
        }
      }
    }
    if (type === "milestone" && typeof payload.id === "number") {
      maxEventId = Math.max(maxEventId, payload.id);
    }
    if (type === "search") {
      const searchable = String(payload.searchableText || payload.searchable_text || stableJson(payload));
      const entityType = String(payload.type || payload.entity_type || "search");
      const publicId = Number(payload.id || payload.entity_id || 0);
      const searchId = publicId > 0 ? `${entityType}--${publicId}` : `legacy--${row.id}`;
      bulk.set(db.collection("searchDocuments").doc(safeDocumentId(searchId)), {
        type: entityType, publicId, slug: payload.slug || slug, title: payload.title || "", searchableText: searchable,
        tokens: tokens(searchable), payload, published: true, publishedMemoryId: row.published_snapshot_id, updatedAt: sortTimestamp
      });
    }
    if (type === "sitemap" && Array.isArray(payload.entries)) {
      payload.entries.forEach((entry, index) => {
        if (!entry || typeof entry !== "object") return;
        bulk.set(db.collection("sitemapDocuments").doc(`projection--${String(row.id)}--${index}`), {
          ...(entry as Record<string, unknown>),
          published: true,
          publishedMemoryId: row.published_snapshot_id,
          migrationId: MIGRATION_ID
        });
      });
    }
    const sourceList = Array.isArray(payload.sources) ? payload.sources : [];
    for (const source of sourceList) if (source && typeof source === "object" && typeof (source as Record<string, unknown>).id === "number") maxSourceId = Math.max(maxSourceId, Number((source as Record<string, unknown>).id));
  }
  for (const [slug, category] of categoryCounts) bulk.set(db.collection("categoryDocuments").doc(slug), { slug, ...category, updatedAt: Timestamp.fromDate(new Date(category.updatedAt)) });
  for (const tag of tags.values()) bulk.set(db.collection("tagDocuments").doc(tag.slug), { ...tag, updatedAt: Timestamp.now() });
  for (const row of continuityRows) {
    const sourcePublishedSnapshotId = String(row.source_published_snapshot_id);
    bulk.set(db.collection("continuityDocuments").doc(sourcePublishedSnapshotId), {
      sourcePublishedSnapshotId,
      targetPublishedSnapshotId: row.target_published_snapshot_id || null,
      continuityType: row.continuity_type,
      continuityPath: row.continuity_path || {},
      sourceEventId: row.source_event_id,
      projectionHash: row.projection_hash,
      auditRecordId: row.audit_record_id || null,
      createdAt: Timestamp.fromDate(new Date(String(row.created_at)))
    });
  }
  bulk.set(db.collection("counters").doc("publicIds"), { timeline: maxTimelineId, event: maxEventId, source: maxSourceId, tag: maxTagId, migrationId: MIGRATION_ID, updatedAt: Timestamp.now() });
  await bulk.close();
  return { activeProjections: projections.length, continuity: continuityRows.length, maxTimelineId, maxEventId, maxSourceId, maxTagId, categories: categoryCounts.size, tags: tags.size };
}

async function verify(inventory: TableInfo[], counts?: Record<string, MigrationCount>) {
  const requiredCollections = ["topicLedgers", "factoryRuns", "factoryObjects", "factoryArtifacts", "sourceRecords", "sourceSnapshots", "corpusDocuments", "evidenceRecords", "evidenceValidations", "governancePackages", "governanceDecisions", "governanceApprovals", "libraryAdmissions", "publishedMemory", "platformReadModelHistory", "platformReadModels", "searchDocuments", "sitemapDocuments", "auditEvents"];
  const collectionCounts: Record<string, number> = {};
  for (const collection of requiredCollections) collectionCounts[collection] = (await db.collection(collection).count().get()).data().count;
  const activeProjectionCount = (await db.collection("platformReadModels").where("lifecycle", "==", "active").count().get()).data().count;
  const postgresActive = Number((await sql<Array<{ count: number }>>`SELECT COUNT(*)::int count FROM published_memory_projections WHERE lifecycle='active' AND projection_type IN ('timeline','milestone','historical_object','relationship')`)[0]?.count || 0);
  const tableParity: Array<{ table: string; collection: string; source: number; migrated: number; matches: boolean }> = [];
  for (let offset = 0; offset < inventory.length; offset += 10) {
    const group = inventory.slice(offset, offset + 10);
    const results = await Promise.all(group.map(async (table) => {
      const escapedTable = table.tableName.replaceAll('"', '""');
      const sourceRows = await sql.unsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int count FROM "${escapedTable}"`);
      const prefix = `${table.tableName}--`;
      const migrated = (await db.collection(collectionFor(table.tableName))
        .where(FieldPath.documentId(), ">=", prefix)
        .where(FieldPath.documentId(), "<", `${prefix}\uf8ff`)
        .count()
        .get()).data().count;
      const source = Number(sourceRows[0]?.count || 0);
      return { table: table.tableName, collection: collectionFor(table.tableName), source, migrated, matches: source === migrated };
    }));
    tableParity.push(...results);
  }
  const tableMismatches = tableParity.filter((table) => !table.matches);
  const result = {
    collectionCounts,
    activeProjectionCount,
    postgresActiveProjectionCount: postgresActive,
    activeProjectionParity: activeProjectionCount === postgresActive,
    tableParityPassed: tableMismatches.length === 0,
    tableMismatches,
    totalSourceRows: tableParity.reduce((total, table) => total + table.source, 0),
    totalMigratedRows: tableParity.reduce((total, table) => total + table.migrated, 0),
    sourceCounts: counts || null
  };
  if (!result.activeProjectionParity) throw new Error(`Active projection parity failed: Firestore=${activeProjectionCount} PostgreSQL=${postgresActive}.`);
  if (!result.tableParityPassed) throw new Error(`Legacy table parity failed: ${JSON.stringify(tableMismatches.slice(0, 20))}`);
  return result;
}

async function main() {
  const startedAt = new Date().toISOString();
  const inventory = await tableInventory();
  if (verifyOnly) {
    const verification = await verify(inventory);
    await mkdir("ops/migration-reports", { recursive: true });
    const reportPath = `ops/migration-reports/${MIGRATION_ID}-verify.json`;
    await writeFile(reportPath, `${JSON.stringify({ migrationId: MIGRATION_ID, mode: "verify", startedAt, completedAt: new Date().toISOString(), verification }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    console.log(JSON.stringify({ migrationId: MIGRATION_ID, mode: "verify", reportPath, verification }, null, 2));
    return;
  }
  const counts = await migrateTables(inventory);
  const materialized = apply ? await materializeActiveProjections() : null;
  const verification = apply ? await verify(inventory, counts) : null;
  const report = {
    migrationId: MIGRATION_ID,
    mode: apply ? "apply" : "dry-run",
    projectId: PROJECT_ID,
    startedAt,
    completedAt: new Date().toISOString(),
    inventory: inventory.map((table) => ({ ...table, targetCollection: collectionFor(table.tableName) })),
    counts,
    materialized,
    verification
  };
  await mkdir("ops/migration-reports", { recursive: true });
  const reportPath = `ops/migration-reports/${MIGRATION_ID}-${apply ? "apply" : "dry-run"}.json`;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(JSON.stringify({ event: "migration_complete", reportPath, materialized, verification }, null, 2));
}

main().finally(() => sql.end({ timeout: 5 }));
