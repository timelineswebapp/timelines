import { ApiError } from "@/src/server/api/responses";
import { createHmac } from "node:crypto";

type BackendEnvelope<T> =
  | { ok: true; data: T; apiVersion?: string }
  | { ok: false; error: { code: string; message: string; details?: unknown }; apiVersion?: string };

function baseUrl() {
  const configured = process.env.SERVERLESS_API_BASE_URL?.trim().replace(/\/$/u, "");
  if (configured) return configured;
  if (process.env.VERCEL_ENV) throw new Error("SERVERLESS_API_BASE_URL is required in deployed environments.");
  return null;
}

async function request<T>(path: string, init?: RequestInit, allowNotFound = false): Promise<T | null> {
  const base = baseUrl();
  if (!base) return null;
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { accept: "application/json", ...(init?.headers || {}) },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store"
  });
  const payload = (await response.json()) as BackendEnvelope<T>;
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok || !payload.ok) {
    const error = payload.ok ? null : payload.error;
    throw new ApiError(response.status, error?.code || "SERVERLESS_BACKEND_ERROR", error?.message || "Serverless backend request failed.", error?.details);
  }
  return payload.data;
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
  return search.toString();
}

function requireSharedSecret() {
  const secret = process.env.BACKEND_SHARED_SECRET;
  if (!secret || secret.length < 32) throw new Error("BACKEND_SHARED_SECRET is required for serverless internal requests.");
  return secret;
}

function internalSignature(secret: string, timestamp: string, method: string, path: string, serializedBody = "") {
  return createHmac("sha256", secret).update(`${timestamp}.${method.toUpperCase()}.${path}.${serializedBody}`).digest("hex");
}

async function internalRequest<T>(path: string): Promise<T[]> {
  if (!baseUrl()) return [];
  const secret = requireSharedSecret();
  const timestamp = String(Date.now());
  const signature = internalSignature(secret, timestamp, "GET", path.split("?")[0] || path);
  return (await request<T[]>(path, {
    headers: {
      "x-timelines-internal-timestamp": timestamp,
      "x-timelines-internal-signature": signature
    }
  })) || [];
}

export const serverlessBackendClient = {
  listReadModels<T>(type: string, limit: number, offset = 0) {
    return request<T[]>(`/read-models?${query({ type, limit, offset })}`);
  },
  getReadModel<T>(type: string, input: { slug?: string; id?: number }) {
    return request<T>(`/read-model?${query({ type, ...input })}`, undefined, true);
  },
  search<T>(searchQuery: string, limit: number, offset: number) {
    return request<T>(`/search?${query({ q: searchQuery, limit, offset })}`);
  },
  listCategories<T>() {
    return request<T[]>("/categories?limit=500");
  },
  listTags<T>() {
    return request<T[]>("/tags?limit=500");
  },
  getCategory<T>(slug: string) {
    return request<T>(`/category?${query({ slug })}`, undefined, true);
  },
  getTag<T>(slug: string) {
    return request<T>(`/tag?${query({ slug })}`, undefined, true);
  },
  listSitemap<T>() {
    return request<T[]>("/sitemap");
  },
  getRelationships<T>(input: { authorityKey?: string; relationshipId?: string; limit?: number }) {
    return request<T | T[]>(`/relationships?${query(input)}`, undefined, Boolean(input.relationshipId));
  },
  getContinuity<T>(sourcePublishedSnapshotId: string) {
    return request<T>(`/continuity?${query({ sourcePublishedSnapshotId })}`);
  },
  listDeferredFactoryV2Topics<T>(limit = 25) {
    return internalRequest<T>(`/internal/factory-v2/deferred?${query({ limit })}`);
  },
  submitTopic<T>(body: unknown, clientIp: string) {
    const secret = requireSharedSecret();
    const timestamp = String(Date.now());
    const serializedBody = JSON.stringify(body);
    const signature = createHmac("sha256", secret).update(`${timestamp}.${clientIp}.${serializedBody}`).digest("hex");
    return request<T>("/topics", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-timelines-client-ip": clientIp,
        "x-timelines-timestamp": timestamp,
        "x-timelines-signature": signature
      },
      body: serializedBody
    });
  }
};
