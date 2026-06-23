import { getWriteSql } from "@/src/server/db/client";

export type AdminSessionRevocation = {
  sessionId: string;
  operatorId: string | null;
  reason: string | null;
  revokedAt: number;
};

type AdminSessionRevocationRow = {
  sessionId: string;
  operatorId: string | null;
  reason: string | null;
  revokedAt: string;
};

function rowToRevocation(row: AdminSessionRevocationRow): AdminSessionRevocation {
  return {
    sessionId: row.sessionId,
    operatorId: row.operatorId,
    reason: row.reason,
    revokedAt: new Date(row.revokedAt).getTime()
  };
}

export const adminSessionRevocationRepository = {
  async revoke(input: { sessionId: string; operatorId?: string | null; reason?: string | null }): Promise<AdminSessionRevocation> {
    const sql = getWriteSql("revoking admin session");
    const [row] = await sql<AdminSessionRevocationRow[]>`
      INSERT INTO admin_session_revocations (
        session_id,
        operator_id,
        reason,
        revoked_at
      )
      VALUES (
        ${input.sessionId},
        ${input.operatorId ?? null},
        ${input.reason?.slice(0, 500) ?? null},
        NOW()
      )
      ON CONFLICT (session_id) DO UPDATE
      SET
        operator_id = COALESCE(admin_session_revocations.operator_id, EXCLUDED.operator_id),
        reason = COALESCE(admin_session_revocations.reason, EXCLUDED.reason)
      RETURNING
        session_id AS "sessionId",
        operator_id AS "operatorId",
        reason,
        revoked_at::text AS "revokedAt"
    `;
    return rowToRevocation(row!);
  },

  async isRevoked(sessionId: string): Promise<boolean> {
    const sql = getWriteSql("checking admin session revocation");
    const [row] = await sql<{ sessionId: string }[]>`
      SELECT session_id AS "sessionId"
      FROM admin_session_revocations
      WHERE session_id = ${sessionId}
      LIMIT 1
    `;
    return Boolean(row);
  }
};
