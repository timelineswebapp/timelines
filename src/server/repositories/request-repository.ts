import crypto from "node:crypto";
import type { TimelineRequestRecord, TimelineRequestStatus, TimelineRequestType } from "@/src/lib/types";
import { normalizeQuery } from "@/src/lib/utils";
import { getSql, getWriteSql } from "@/src/server/db/client";
import { memoryStore } from "@/src/server/dev/memory-store";

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

type TimelineRequestRow = {
  id: number;
  query: string;
  normalized_query: string;
  ip_hash: string;
  language: string;
  request_type: TimelineRequestType;
  email: string | null;
  message: string | null;
  target_timeline: string | null;
  sources_scope: string | null;
  metadata: Record<string, unknown>;
  status: TimelineRequestStatus;
  created_at: string;
};

export type CreateTimelineRequestInput = {
  query: string;
  language: string;
  ip: string;
  requestType?: TimelineRequestType;
  email?: string | null;
  message?: string | null;
  targetTimeline?: string | null;
  sourcesScope?: string | null;
  metadata?: Record<string, unknown>;
};

function mapTimelineRequest(row: TimelineRequestRow): TimelineRequestRecord {
  return {
    id: row.id,
    query: row.query,
    normalizedQuery: row.normalized_query,
    ipHash: row.ip_hash,
    language: row.language,
    requestType: row.request_type,
    email: row.email,
    message: row.message,
    targetTimeline: row.target_timeline,
    sourcesScope: row.sources_scope,
    metadata: row.metadata,
    status: row.status,
    createdAt: row.created_at
  };
}

export const requestRepository = {
  hashIp,

  async list(): Promise<TimelineRequestRecord[]> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getRequests();
    }

    const rows = await sql<TimelineRequestRow[]>`
      SELECT
        id,
        query,
        normalized_query,
        ip_hash,
        language,
        request_type,
        email,
        message,
        target_timeline,
        sources_scope,
        metadata,
        status,
        created_at::text
      FROM timeline_requests
      ORDER BY created_at DESC
      LIMIT 200
    `;

    return rows.map(mapTimelineRequest);
  },

  async countByIpSince(ipHash: string, sinceIso: string): Promise<number> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getRequests().filter((request) => request.ipHash === ipHash && request.createdAt >= sinceIso).length;
    }

    const [row] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM timeline_requests
      WHERE ip_hash = ${ipHash} AND created_at >= ${sinceIso}
    `;

    return row?.count || 0;
  },

  async create(input: CreateTimelineRequestInput): Promise<TimelineRequestRecord> {
    const sql = getSql();
    const ipHash = hashIp(input.ip);
    const normalized = normalizeQuery(input.query);
    const requestType = input.requestType || "timeline_request";
    const metadata = input.metadata || {};

    if (!sql) {
      const request: TimelineRequestRecord = {
        id: memoryStore.nextRequestId(),
        query: input.query,
        normalizedQuery: normalized,
        ipHash,
        language: input.language,
        requestType,
        email: input.email || null,
        message: input.message || null,
        targetTimeline: input.targetTimeline || null,
        sourcesScope: input.sourcesScope || null,
        metadata,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      memoryStore.setRequests([request, ...memoryStore.getRequests()]);
      return request;
    }

    const [row] = await sql<TimelineRequestRow[]>`
      INSERT INTO timeline_requests (
        query,
        normalized_query,
        ip_hash,
        language,
        request_type,
        email,
        message,
        target_timeline,
        sources_scope,
        metadata,
        status
      )
      VALUES (
        ${input.query},
        ${normalized},
        ${ipHash},
        ${input.language},
        ${requestType},
        ${input.email || null},
        ${input.message || null},
        ${input.targetTimeline || null},
        ${input.sourcesScope || null},
        ${sql.json(metadata as any)},
        'pending'
      )
      RETURNING
        id,
        query,
        normalized_query,
        ip_hash,
        language,
        request_type,
        email,
        message,
        target_timeline,
        sources_scope,
        metadata,
        status,
        created_at::text
    `;

    if (!row) {
      throw new Error("Timeline request insert failed.");
    }

    return mapTimelineRequest(row);
  },

  async updateStatus(id: number, status: TimelineRequestStatus): Promise<TimelineRequestRecord | null> {
    const sql = getWriteSql("request status update");

    const [row] = await sql<TimelineRequestRow[]>`
      UPDATE timeline_requests
      SET status = ${status}
      WHERE id = ${id}
      RETURNING
        id,
        query,
        normalized_query,
        ip_hash,
        language,
        request_type,
        email,
        message,
        target_timeline,
        sources_scope,
        metadata,
        status,
        created_at::text
    `;

    return row ? mapTimelineRequest(row) : null;
  }
};
