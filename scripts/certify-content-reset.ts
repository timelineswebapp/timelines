import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "tiimeliines";
const RESET_ID = "TL-CONTENT-RESET-001";
const API_BASE_URL = "https://us-central1-tiimeliines.cloudfunctions.net/timelines-public-api";
const SITE_URL = "https://www.timelines.sbs";
const corpusId = process.env.ACTIVE_CORPUS_ID || "";

if (!/^[a-z0-9][a-z0-9-]{2,62}$/u.test(corpusId)) throw new Error("ACTIVE_CORPUS_ID is required.");
if ((process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || PROJECT_ID) !== PROJECT_ID) {
  throw new Error("Refusing certification outside tiimeliines.");
}
if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const envelope = await response.json() as { ok: boolean; data?: T; apiVersion?: string };
  if (!response.ok || !envelope.ok || envelope.data === undefined) throw new Error(`Public API certification failed for ${path}: ${response.status}.`);
  if (envelope.apiVersion !== "serverless-public-api-v2-clean-corpus") throw new Error(`Unexpected API version for ${path}.`);
  return envelope.data;
}

async function currentLegacyInventory() {
  const control = new Set(["corpora", "corpusRegistry", "corpusActivations", "runtimeConfiguration"]);
  const collections = (await db.listCollections()).map((entry) => entry.id).filter((name) => !control.has(name)).sort();
  const entries = await Promise.all(collections.map(async (name) => [name, (await db.collection(name).count().get()).data().count] as const));
  return Object.fromEntries(entries) as Record<string, number>;
}

async function main() {
  const checkedAt = new Date().toISOString();
  const [activation, pointer, registry, legacyTimelines, activeCollections] = await Promise.all([
    db.collection("corpusActivations").doc(`${RESET_ID}--${corpusId}`).get(),
    db.collection("runtimeConfiguration").doc("activeCorpus").get(),
    db.collection("corpusRegistry").doc(corpusId).get(),
    db.collection("platformReadModels").where("projectionType", "==", "timeline").limit(200).get(),
    db.collection("corpora").doc(corpusId).listCollections()
  ]);
  if (!activation.exists || !pointer.exists || !registry.exists) throw new Error("Corpus activation control records are incomplete.");
  if (pointer.data()?.activeCorpusId !== corpusId || registry.data()?.isolationPolicy !== "NO_LEGACY_CONTENT_REUSE") {
    throw new Error("Corpus activation policy mismatch.");
  }
  const expectedLegacyInventory = activation.data()?.legacyInventory as Record<string, number>;
  const actualLegacyInventory = await currentLegacyInventory();
  if (hash(expectedLegacyInventory) !== hash(actualLegacyInventory)) throw new Error("Legacy collection inventory changed after activation.");
  const activeInventory = Object.fromEntries(await Promise.all(activeCollections.map(async (collection) => [collection.id, (await collection.count().get()).data().count] as const)));
  if (Object.values(activeInventory).some((count) => count !== 0)) throw new Error("Active corpus was not empty at initial public-read certification.");

  const [health, timelines, milestones, objects, relationships, search, sitemap, categories, tags, homepage] = await Promise.all([
    api<{ activeCorpusId: string; isolationPolicy: string }>("/health"),
    api<unknown[]>("/read-models?type=timeline&limit=200"),
    api<unknown[]>("/read-models?type=milestone&limit=200"),
    api<unknown[]>("/read-models?type=historical_object&limit=200"),
    api<unknown[]>("/read-models?type=relationship&limit=200"),
    api<{ total: number; items: unknown[] }>("/search?q=pandemic&limit=50"),
    api<unknown[]>("/sitemap"),
    api<unknown[]>("/categories"),
    api<unknown[]>("/tags"),
    fetch(`${SITE_URL}/?reset-certification=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) })
  ]);
  if (health.activeCorpusId !== corpusId || health.isolationPolicy !== "NO_LEGACY_CONTENT_REUSE") throw new Error("Public health corpus identity mismatch.");
  if ([timelines, milestones, objects, relationships, sitemap, categories, tags].some((items) => items.length !== 0) || search.total !== 0 || search.items.length !== 0) {
    throw new Error("A public endpoint exposed content during clean-corpus certification.");
  }
  if (!homepage.ok) throw new Error(`Production homepage failed with ${homepage.status}.`);
  const homepageHtml = await homepage.text();
  const legacySlugs = legacyTimelines.docs.map((document) => String(document.data().slug || "")).filter(Boolean);
  if (legacySlugs.some((slug) => homepageHtml.includes(`/timeline/${slug}`))) throw new Error("Production homepage contains a legacy timeline route.");
  const legacyRouteChecks = await Promise.all(legacySlugs.slice(0, 25).map(async (slug) => {
    const response = await fetch(`${SITE_URL}/timeline/${encodeURIComponent(slug)}`, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15_000) });
    return { slug, status: response.status };
  }));
  const exposedRoute = legacyRouteChecks.find((entry) => entry.status !== 404);
  if (exposedRoute) throw new Error(`Legacy route remained public: ${exposedRoute.slug} returned ${exposedRoute.status}.`);

  const report = {
    resetId: RESET_ID,
    checkedAt,
    projectId: PROJECT_ID,
    corpusId,
    apiBaseUrl: API_BASE_URL,
    siteUrl: SITE_URL,
    apiVersion: "serverless-public-api-v2-clean-corpus",
    legacyInventoryHash: hash(actualLegacyInventory),
    legacyCollectionCount: Object.keys(actualLegacyInventory).length,
    legacyDocumentCount: Object.values(actualLegacyInventory).reduce((total, count) => total + count, 0),
    activeInventory,
    publicReadCounts: { timelines: timelines.length, milestones: milestones.length, objects: objects.length, relationships: relationships.length, search: search.total, sitemap: sitemap.length, categories: categories.length, tags: tags.length },
    homepage: { status: homepage.status, legacyRouteLinks: 0 },
    legacyRoutesChecked: legacyRouteChecks.length,
    legacyRoutesExposed: 0,
    passed: true
  };
  await mkdir("ops/migration-reports", { recursive: true });
  const reportPath = `ops/migration-reports/${RESET_ID}-production-certification.json`;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));
}

main();
