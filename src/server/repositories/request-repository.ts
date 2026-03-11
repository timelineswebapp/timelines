import crypto from "node:crypto";
import type { TimelineRequestRecord, TimelineRequestStatus } from "@/src/lib/types";
import { normalizeQuery } from "@/src/lib/utils";
import { getSql, getWriteSql } from "@/src/server/db/client";
import { memoryStore } from "@/src/server/dev/memory-store";

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export const requestRepository = {
  hashIp,

  async list(): Promise<TimelineRequestRecord[]> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getRequests();
    }

    const rows = await sql<{
      id: number;
      query: string;
      normalized_query: string;
      ip_hash: string;
      language: string;
      status: TimelineRequestStatus;
      created_at: string;
    }[]>`
      SELECT id, query, normalized_query, ip_hash, language, status, created_at::text
      FROM timeline_requests
      ORDER BY created_at DESC
      LIMIT 200
    `;

    return rows.map((row) => ({
      id: row.id,
      query: row.query,
      normalizedQuery: row.normalized_query,
      ipHash: row.ip_hash,
      language: row.language,
      status: row.status,
      createdAt: row.created_at
    }));
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

  async create(input: { query: string; language: string; ip: string }): Promise<TimelineRequestRecord> {
    const sql = getSql();
    const ipHash = hashIp(input.ip);
    const normalized = normalizeQuery(input.query);

    if (!sql) {
      const request: TimelineRequestRecord = {
        id: memoryStore.nextRequestId(),
        query: input.query,
        normalizedQuery: normalized,
        ipHash,
        language: input.language,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      memoryStore.setRequests([request, ...memoryStore.getRequests()]);
      return request;
    }

    const [row] = await sql<{
      id: number;
      query: string;
      normalized_query: string;
      ip_hash: string;
      language: string;
      status: TimelineRequestStatus;
      created_at: string;
    }[]>`
      INSERT INTO timeline_requests (query, normalized_query, ip_hash, language, status)
      VALUES (${input.query}, ${normalized}, ${ipHash}, ${input.language}, 'pending')
      RETURNING id, query, normalized_query, ip_hash, language, status, created_at::text
    `;

    if (!row) {
      throw new Error("Timeline request insert failed.");
    }

    return {
      id: row.id,
      query: row.query,
      normalizedQuery: row.normalized_query,
      ipHash: row.ip_hash,
      language: row.language,
      status: row.status,
      createdAt: row.created_at
    };
  },

  async updateStatus(id: number, status: TimelineRequestStatus): Promise<TimelineRequestRecord | null> {
    const sql = getWriteSql("request status update");

    const [row] = await sql<{
      id: number;
      query: string;
      normalized_query: string;
      ip_hash: string;
      language: string;
      status: TimelineRequestStatus;
      created_at: string;
    }[]>`
      UPDATE timeline_requests
      SET status = ${status}
      WHERE id = ${id}
      RETURNING id, query, normalized_query, ip_hash, language, status, created_at::text
    `;

    return row
      ? {
          id: row.id,
          query: row.query,
          normalizedQuery: row.normalized_query,
          ipHash: row.ip_hash,
          language: row.language,
          status: row.status,
          createdAt: row.created_at
        }
      : null;
  }
};
