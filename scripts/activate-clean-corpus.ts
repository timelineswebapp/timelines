import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { getApps, initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "tiimeliines";
const RESET_ID = "TL-CONTENT-RESET-001";
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const verifyOnly = args.has("--verify");
const corpusId = process.env.ACTIVE_CORPUS_ID || "";
const publicIdBase = Number(process.env.PUBLIC_ID_BASE);

if (!/^[a-z0-9][a-z0-9-]{2,62}$/u.test(corpusId)) {
  throw new Error("ACTIVE_CORPUS_ID must be explicitly set to a 3-63 character lowercase identifier.");
}
if (!Number.isSafeInteger(publicIdBase) || publicIdBase < 1_000_000_000) {
  throw new Error("PUBLIC_ID_BASE must be explicitly set to a safe integer of at least 1000000000.");
}
if ((process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || PROJECT_ID) !== PROJECT_ID) {
  throw new Error("Refusing to inspect or activate a corpus outside tiimeliines.");
}

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();
const CONTROL_COLLECTIONS = new Set(["corpora", "corpusRegistry", "corpusActivations", "runtimeConfiguration"]);

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

function stableHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

async function collectionInventory() {
  const collections = (await db.listCollections())
    .map((collection) => collection.id)
    .filter((name) => !CONTROL_COLLECTIONS.has(name))
    .sort();
  const entries = await Promise.all(collections.map(async (name) => {
    const count = (await db.collection(name).count().get()).data().count;
    return [name, count] as const;
  }));
  return Object.fromEntries(entries) as Record<string, number>;
}

async function activeCorpusInventory() {
  const root = db.collection("corpora").doc(corpusId);
  const collections = (await root.listCollections()).sort((left, right) => left.id.localeCompare(right.id));
  const entries = await Promise.all(collections.map(async (collection) => {
    const count = (await collection.count().get()).data().count;
    return [collection.id, count] as const;
  }));
  return Object.fromEntries(entries) as Record<string, number>;
}

async function assertReservedIdRange() {
  const conflicting = await db.collection("platformReadModels")
    .where("publicId", ">=", publicIdBase)
    .orderBy("publicId", "asc")
    .limit(1)
    .get();
  if (!conflicting.empty) throw new Error(`PUBLIC_ID_BASE ${publicIdBase} overlaps a legacy public ID.`);
}

async function controlState() {
  const [pointer, registry] = await Promise.all([
    db.collection("runtimeConfiguration").doc("activeCorpus").get(),
    db.collection("corpusRegistry").doc(corpusId).get()
  ]);
  return { pointer: pointer.exists ? pointer.data() : null, registry: registry.exists ? registry.data() : null };
}

function assertEmptyActiveInventory(inventory: Record<string, number>) {
  const populated = Object.entries(inventory).filter(([, count]) => count !== 0);
  if (populated.length > 0) throw new Error(`Refusing clean activation because the target corpus is populated: ${JSON.stringify(populated)}.`);
}

async function activate(legacyInventory: Record<string, number>) {
  const pointerRef = db.collection("runtimeConfiguration").doc("activeCorpus");
  const registryRef = db.collection("corpusRegistry").doc(corpusId);
  const activationRef = db.collection("corpusActivations").doc(`${RESET_ID}--${corpusId}`);
  await db.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(pointerRef, registryRef, activationRef);
    const pointer = snapshots[0]!;
    const registry = snapshots[1]!;
    const activation = snapshots[2]!;
    if (pointer.exists && pointer.data()?.activeCorpusId !== corpusId) {
      throw new Error(`An active corpus pointer already exists for ${String(pointer.data()?.activeCorpusId)}.`);
    }
    const now = Timestamp.now();
    const registryRecord = {
      corpusId,
      lifecycle: "ACTIVE",
      isolationPolicy: "NO_LEGACY_CONTENT_REUSE",
      pipelineEntry: "VERTEX_GOOGLE_SEARCH_GROUNDING",
      authorityChain: ["EVIDENCE_PROVENANCE", "FACTORY", "GOVERNANCE", "HISTORICAL_LIBRARY", "PUBLISHED_MEMORY", "PROJECTIONS"],
      storageRoot: `corpora/${corpusId}`,
      publicIdBase,
      legacyRootDisposition: "PRESERVED_READ_ONLY_ROLLBACK_ARCHIVE",
      resetId: RESET_ID,
      createdAt: now
    };
    if (registry.exists && stableHash({ ...registry.data(), createdAt: null }) !== stableHash({ ...registryRecord, createdAt: null })) {
      throw new Error("Existing corpus registry is incompatible with the requested activation.");
    }
    if (!registry.exists) transaction.create(registryRef, registryRecord);
    if (!activation.exists) {
      transaction.create(activationRef, {
        activationId: activationRef.id,
        resetId: RESET_ID,
        activeCorpusId: corpusId,
        previousCorpus: "legacy-root",
        legacyInventory,
        legacyInventoryHash: stableHash(legacyInventory),
        preservationPolicy: "NO_DELETE_NO_OVERWRITE",
        activatedAt: now,
        immutable: true
      });
    }
    if (!pointer.exists) {
      transaction.create(pointerRef, {
        activeCorpusId: corpusId,
        activationId: activationRef.id,
        publicIdBase,
        activatedAt: now
      });
    }
  });
}

async function main() {
  const startedAt = new Date().toISOString();
  const [legacyInventoryBefore, activeInventoryBefore, stateBefore] = await Promise.all([
    collectionInventory(),
    activeCorpusInventory(),
    controlState()
  ]);
  assertEmptyActiveInventory(activeInventoryBefore);
  await assertReservedIdRange();
  if (verifyOnly && stateBefore.pointer?.activeCorpusId !== corpusId) {
    throw new Error("Active corpus pointer does not match the requested corpus.");
  }
  if (apply) await activate(legacyInventoryBefore);
  const [legacyInventoryAfter, activeInventoryAfter, stateAfter] = await Promise.all([
    collectionInventory(),
    activeCorpusInventory(),
    controlState()
  ]);
  if (stableHash(legacyInventoryBefore) !== stableHash(legacyInventoryAfter)) {
    throw new Error("Legacy root collection counts changed during corpus activation.");
  }
  if ((apply || verifyOnly) && (
    stateAfter.pointer?.activeCorpusId !== corpusId ||
    stateAfter.registry?.lifecycle !== "ACTIVE" ||
    stateAfter.registry?.isolationPolicy !== "NO_LEGACY_CONTENT_REUSE" ||
    stateAfter.registry?.pipelineEntry !== "VERTEX_GOOGLE_SEARCH_GROUNDING" ||
    stateAfter.registry?.publicIdBase !== publicIdBase
  )) throw new Error("Corpus activation control records failed verification.");
  const report = {
    resetId: RESET_ID,
    mode: apply ? "apply" : verifyOnly ? "verify" : "plan",
    projectId: PROJECT_ID,
    corpusId,
    publicIdBase,
    startedAt,
    completedAt: new Date().toISOString(),
    legacyInventoryBefore,
    legacyInventoryAfter,
    legacyInventoryHash: stableHash(legacyInventoryAfter),
    activeInventoryBefore,
    activeInventoryAfter,
    stateBefore,
    stateAfter,
    legacyPreserved: true,
    targetWasEmpty: true,
    passed: true
  };
  await mkdir("ops/migration-reports", { recursive: true });
  const reportPath = `ops/migration-reports/${RESET_ID}-${report.mode}.json`;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));
}

main();
