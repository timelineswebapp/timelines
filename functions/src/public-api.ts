import type { Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "./firestore";
import { PUBLIC_API_VERSION } from "./config";
import { normalizeTopic } from "./normalization";
import { topicRequestSchema } from "./schemas";
import { captureVisitorRequest, intakeTopic } from "./topic-ledger";

const readModelTypes = new Set(["timeline", "milestone", "historical_object", "relationship", "search", "sitemap"]);

function boundedInteger(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(parsed)));
}

function jsonValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, jsonValue(entry)]));
  return value;
}

function success(response: Response, data: unknown, status = 200) {
  response.status(status).json({ ok: true, data: jsonValue(data), apiVersion: PUBLIC_API_VERSION });
}

function failure(response: Response, status: number, code: string, message: string, details?: unknown) {
  response.status(status).json({ ok: false, error: { code, message, ...(details === undefined ? {} : { details: jsonValue(details) }) }, apiVersion: PUBLIC_API_VERSION });
}

function verifiedClientIp(request: Request) {
  const clientIp = request.header("x-timelines-client-ip") || "";
  const timestamp = request.header("x-timelines-timestamp") || "";
  const supplied = request.header("x-timelines-signature") || "";
  const secret = process.env.BACKEND_SHARED_SECRET;
  const timestampMs = Number(timestamp);
  if (!secret || secret.length < 32 || !clientIp || !Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) return null;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${clientIp}.${JSON.stringify(request.body)}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer) ? clientIp : null;
}

function readModelSnapshot(document: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  const data = document.data()!;
  return {
    projectionId: document.id,
    publishedSnapshotId: data.publishedMemoryId || data.publishedSnapshotId || document.id,
    projectionType: data.projectionType,
    slug: data.slug || null,
    payload: data.payload,
    projectionVersion: data.projectionVersion || 1,
    projectionHash: data.projectionHash,
    lifecycle: data.lifecycle || "active",
    sourceEventType: data.sourceEventType || "publication",
    sourceEventId: data.sourceEventId || data.publishedMemoryId || document.id,
    auditRecordId: data.auditRecordId || null,
    createdAt: data.sortTimestamp || data.updatedAt
  };
}

async function listReadModels(request: Request, response: Response) {
  const type = String(request.query.type || "");
  if (!readModelTypes.has(type)) return failure(response, 400, "VALIDATION_FAILED", "Invalid read-model type.");
  const limit = Math.max(1, boundedInteger(request.query.limit, 12, 200));
  const offset = boundedInteger(request.query.offset, 0, 10_000);
  const snapshot = await db.collection("platformReadModels")
    .where("projectionType", "==", type)
    .where("lifecycle", "==", "active")
    .orderBy("sortTimestamp", "desc")
    .offset(offset)
    .limit(limit)
    .get();
  return success(response, snapshot.docs.map(readModelSnapshot));
}

async function getReadModel(request: Request, response: Response) {
  const type = String(request.query.type || "");
  const slug = String(request.query.slug || "");
  const id = boundedInteger(request.query.id, 0, Number.MAX_SAFE_INTEGER);
  if (!readModelTypes.has(type)) return failure(response, 400, "VALIDATION_FAILED", "Invalid read-model type.");
  const documentId = type === "milestone" && id > 0 ? `milestone--${id}` : slug ? `${type.replace("historical_object", "historical-object")}--${slug}` : "";
  if (!documentId) return failure(response, 400, "VALIDATION_FAILED", "A slug or numeric milestone ID is required.");
  let snapshot = await db.collection("platformReadModels").doc(documentId).get();
  if (!snapshot.exists && (slug || id > 0)) {
    let lookup: FirebaseFirestore.Query = db.collection("platformReadModels").where("projectionType", "==", type).where("lifecycle", "==", "active");
    lookup = slug ? lookup.where("slug", "==", slug) : lookup.where("publicId", "==", id);
    const query = await lookup.orderBy("sortTimestamp", "desc").limit(1).get();
    snapshot = query.docs[0] || snapshot;
  }
  return snapshot.exists ? success(response, readModelSnapshot(snapshot)) : failure(response, 404, "NOT_FOUND", "Published read model not found.");
}

function searchTokens(query: string) {
  return Array.from(new Set(query.normalize("NFKD").replace(/\p{M}+/gu, "").toLocaleLowerCase("en-US").split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2)));
}

async function search(request: Request, response: Response) {
  const rawQuery = String(request.query.q || "").trim();
  const tokens = searchTokens(rawQuery);
  if (!rawQuery || tokens.length === 0) return success(response, { query: "", total: 0, items: [] });
  const limit = Math.max(1, boundedInteger(request.query.limit, 12, 50));
  const offset = boundedInteger(request.query.offset, 0, 10_000);
  const anchor = [...tokens].sort((left, right) => right.length - left.length || left.localeCompare(right))[0]!;
  const snapshot = await db.collection("searchDocuments").where("tokens", "array-contains", anchor).where("published", "==", true).orderBy("updatedAt", "desc").limit(200).get();
  const ranked = snapshot.docs.map((document) => {
    const data = document.data();
    const documentTokens = new Set<string>(Array.isArray(data.tokens) ? data.tokens : []);
    const matches = tokens.filter((token) => documentTokens.has(token)).length;
    const title = String(data.title || "").toLocaleLowerCase("en-US");
    const rank = matches / tokens.length + (title === rawQuery.toLocaleLowerCase("en-US") ? 2 : title.includes(rawQuery.toLocaleLowerCase("en-US")) ? 1 : 0);
    return { rank, payload: data.payload };
  }).filter((item) => item.rank > 0).sort((left, right) => right.rank - left.rank);
  const items = ranked.slice(offset, offset + limit).map((item) => ({ ...item.payload, rank: item.rank }));
  return success(response, { query: rawQuery.toLocaleLowerCase("en-US"), total: ranked.length, items });
}

async function listTaxonomy(request: Request, response: Response, kind: "category" | "tag") {
  const collection = kind === "category" ? "categoryDocuments" : "tagDocuments";
  const limit = Math.max(1, boundedInteger(request.query.limit, 200, 500));
  const snapshot = await db.collection(collection).orderBy("updatedAt", "desc").limit(limit).get();
  return success(response, snapshot.docs.map((document) => document.data()));
}

async function taxonomyDetail(request: Request, response: Response, kind: "category" | "tag") {
  const slug = String(request.query.slug || "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) return failure(response, 400, "VALIDATION_FAILED", "Invalid taxonomy slug.");
  const collection = kind === "category" ? "categoryDocuments" : "tagDocuments";
  const taxonomy = await db.collection(collection).doc(slug).get();
  if (!taxonomy.exists) return failure(response, 404, "NOT_FOUND", `${kind} not found.`);
  let query: FirebaseFirestore.Query = db.collection("platformReadModels").where("projectionType", "==", "timeline").where("lifecycle", "==", "active");
  query = kind === "category" ? query.where("categorySlug", "==", slug) : query.where("tagSlugs", "array-contains", slug);
  const timelines = await query.limit(200).get();
  const summaries = timelines.docs.map((document) => {
    const payload = document.data().payload as Record<string, unknown>;
    const { events: _events, relatedTimelines: _related, ...summary } = payload;
    return summary;
  });
  return success(response, kind === "category"
    ? { category: { ...taxonomy.data(), count: summaries.length }, timelines: summaries }
    : { tag: taxonomy.data(), timelines: summaries });
}

async function listSitemap(response: Response) {
  const snapshot = await db.collection("sitemapDocuments").where("published", "==", true).limit(5_000).get();
  return success(response, snapshot.docs.map((document) => document.data()));
}

async function continuity(request: Request, response: Response) {
  const sourcePublishedSnapshotId = String(request.query.sourcePublishedSnapshotId || "");
  if (!/^[A-Za-z0-9-]{1,128}$/u.test(sourcePublishedSnapshotId)) {
    return failure(response, 400, "VALIDATION_FAILED", "Invalid published snapshot ID.");
  }
  const snapshot = await db.collection("continuityDocuments").doc(sourcePublishedSnapshotId).get();
  return snapshot.exists ? success(response, snapshot.data()) : success(response, null);
}

async function relationships(request: Request, response: Response) {
  const key = String(request.query.authorityKey || "");
  const relationshipId = String(request.query.relationshipId || "");
  if (relationshipId) {
    let snapshot = await db.collection("platformReadModels").doc(`relationship--${relationshipId}`).get();
    if (!snapshot.exists) {
      const query = await db.collection("platformReadModels").where("projectionType", "==", "relationship").where("lifecycle", "==", "active").where("relationshipId", "==", relationshipId).orderBy("sortTimestamp", "desc").limit(1).get();
      snapshot = query.docs[0] || snapshot;
    }
    return snapshot.exists ? success(response, readModelSnapshot(snapshot)) : failure(response, 404, "NOT_FOUND", "Relationship not found.");
  }
  if (!/^[a-z_]+:[A-Za-z0-9-]+$/u.test(key)) return failure(response, 400, "VALIDATION_FAILED", "Invalid authority key.");
  const limit = Math.max(1, boundedInteger(request.query.limit, 25, 100));
  const snapshot = await db.collection("platformReadModels").where("projectionType", "==", "relationship").where("lifecycle", "==", "active").where("authorityKeys", "array-contains", key).orderBy("sortTimestamp", "desc").limit(limit).get();
  return success(response, snapshot.docs.map(readModelSnapshot));
}

export async function handlePublicApi(request: Request, response: Response) {
  response.set("Cache-Control", request.method === "GET" ? "public, max-age=60, s-maxage=300, stale-while-revalidate=86400" : "no-store");
  try {
    if (request.method === "GET" && (request.path === "/" || request.path === "/health")) return success(response, { status: "ok", project: "tiimeliines" });
    if (request.method === "GET" && request.path === "/read-models") return await listReadModels(request, response);
    if (request.method === "GET" && request.path === "/read-model") return await getReadModel(request, response);
    if (request.method === "GET" && request.path === "/search") return await search(request, response);
    if (request.method === "GET" && request.path === "/categories") return await listTaxonomy(request, response, "category");
    if (request.method === "GET" && request.path === "/tags") return await listTaxonomy(request, response, "tag");
    if (request.method === "GET" && request.path === "/category") return await taxonomyDetail(request, response, "category");
    if (request.method === "GET" && request.path === "/tag") return await taxonomyDetail(request, response, "tag");
    if (request.method === "GET" && request.path === "/sitemap") return await listSitemap(response);
    if (request.method === "GET" && request.path === "/relationships") return await relationships(request, response);
    if (request.method === "GET" && request.path === "/continuity") return await continuity(request, response);
    if (request.method === "GET" && request.path === "/topic-status") {
      const query = String(request.query.q || "");
      const topic = normalizeTopic(query);
      const ledger = await db.collection("topicLedgers").doc(topic.topicId).get();
      if (!ledger.exists) return failure(response, 404, "NOT_FOUND", "Topic not found.");
      const data = ledger.data()!;
      return success(response, {
        topicId: topic.topicId,
        status: data.state,
        route: data.state === "PUBLISHED" && data.slug ? `/timeline/${String(data.slug)}` : undefined
      });
    }
    if (request.method === "POST" && request.path === "/topics") {
      const clientIp = verifiedClientIp(request);
      if (!clientIp) return failure(response, 401, "UNAUTHORIZED", "Signed server request required.");
      const input = topicRequestSchema.parse(request.body);
      const result = input.requestType === "timeline_request"
        ? await intakeTopic(input, clientIp)
        : await captureVisitorRequest(input, clientIp);
      return success(response, result, result.status === "QUEUED" ? 202 : 200);
    }
    return failure(response, 404, "NOT_FOUND", "Endpoint not found.");
  } catch (error) {
    if (error instanceof z.ZodError) return failure(response, 400, "VALIDATION_FAILED", "Validation failed.", error.flatten());
    if (error instanceof Error && error.name === "RateLimitExceeded") return failure(response, 429, "RATE_LIMITED", error.message);
    console.error(JSON.stringify({ severity: "ERROR", component: "public_api", path: request.path, method: request.method, message: error instanceof Error ? error.message : String(error) }));
    return failure(response, 500, "INTERNAL_ERROR", "Internal server error.");
  }
}
