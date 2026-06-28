import { getWriteSql } from "@/src/server/db/client";

export type ScheduledOperationKey =
  | "workflow_maintenance"
  | "projection_verification"
  | "publication_verification"
  | "health_verification"
  | "backup_execution"
  | "restore_verification"
  | "synthetic_publication_verification"
  | "seo_validation";

export type ScheduledRun = {
  id: string; operationKey: ScheduledOperationKey; scheduledFor: string; status: "running" | "completed" | "failed";
  leaseOwner: string; leaseExpiresAt: string; result: Record<string, unknown>; error: string | null;
  startedAt: string; completedAt: string | null;
};

export const schedulerRepository = {
  async claim(operationKey: ScheduledOperationKey, scheduledFor: string, workerId: string, leaseSeconds = 900): Promise<ScheduledRun | null> {
    const sql = getWriteSql("claiming scheduled operation");
    return sql.begin(async (tx) => {
      const rows = await tx.unsafe<ScheduledRun[]>(
        `INSERT INTO operational_scheduled_runs (operation_key,scheduled_for,status,lease_owner,lease_expires_at)
         VALUES ($1,$2,'running',$3,NOW()+($4 * INTERVAL '1 second'))
         ON CONFLICT (operation_key,scheduled_for) DO UPDATE SET
           status='running',lease_owner=EXCLUDED.lease_owner,lease_expires_at=EXCLUDED.lease_expires_at,
           started_at=NOW(),completed_at=NULL,error=NULL
         WHERE operational_scheduled_runs.status='running' AND operational_scheduled_runs.lease_expires_at < NOW()
         RETURNING id::text AS id,operation_key AS "operationKey",scheduled_for::text AS "scheduledFor",status,
           lease_owner AS "leaseOwner",lease_expires_at::text AS "leaseExpiresAt",result,error,
           started_at::text AS "startedAt",completed_at::text AS "completedAt"`,
        [operationKey, scheduledFor, workerId, leaseSeconds]);
      return rows[0] || null;
    });
  },

  async complete(id: string, workerId: string, result: Record<string, unknown>) {
    const sql = getWriteSql("completing scheduled operation");
    await sql`UPDATE operational_scheduled_runs SET status='completed',result=${sql.json(result as never)},completed_at=NOW()
      WHERE id=${id} AND lease_owner=${workerId} AND status='running'`;
  },

  async fail(id: string, workerId: string, error: string, result: Record<string, unknown> = {}) {
    const sql = getWriteSql("failing scheduled operation");
    await sql`UPDATE operational_scheduled_runs SET status='failed',error=${error.slice(0, 4000)},
      result=${sql.json(result as never)},completed_at=NOW() WHERE id=${id} AND lease_owner=${workerId} AND status='running'`;
  },

  async list(limit = 100) {
    const sql = getWriteSql("listing scheduled operation history");
    return sql<ScheduledRun[]>`SELECT id::text AS id,operation_key AS "operationKey",scheduled_for::text AS "scheduledFor",status,
      lease_owner AS "leaseOwner",lease_expires_at::text AS "leaseExpiresAt",result,error,
      started_at::text AS "startedAt",completed_at::text AS "completedAt"
      FROM operational_scheduled_runs ORDER BY scheduled_for DESC,operation_key LIMIT ${limit}`;
  }
};
