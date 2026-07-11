import { randomUUID } from "node:crypto";
import { getWriteSql, withIndependentWriteTransaction } from "@/src/server/db/client";

export type DurableProviderLease = { leaseId: string; queueWaitMs: number };

export const providerCoordinationRepository = {
  async tryAcquire(input: {
    providerKey: string; ownerId: string; maxConcurrency: number; requestsPerMinute: number; leaseSeconds: number;
  }): Promise<string | null> {
    return withIndependentWriteTransaction("acquiring durable provider capacity", async () => {
      const tx = getWriteSql("acquiring durable provider capacity");
      await tx.unsafe(
        `INSERT INTO provider_execution_limits (provider_key,max_concurrency,requests_per_minute)
         VALUES ($1,$2,$3) ON CONFLICT (provider_key) DO UPDATE SET
         max_concurrency=EXCLUDED.max_concurrency,requests_per_minute=EXCLUDED.requests_per_minute,updated_at=NOW()`,
        [input.providerKey, input.maxConcurrency, input.requestsPerMinute]);
      await tx.unsafe("SELECT provider_key FROM provider_execution_limits WHERE provider_key=$1 FOR UPDATE", [input.providerKey]);
      await tx.unsafe("DELETE FROM provider_execution_leases WHERE provider_key=$1 AND expires_at < NOW()", [input.providerKey]);
      await tx.unsafe("DELETE FROM provider_rate_limit_events WHERE provider_key=$1 AND occurred_at < NOW()-INTERVAL '2 minutes'", [input.providerKey]);
      const [capacity] = await tx.unsafe<Array<{ active: number; recent: number }>>(
        `SELECT
          (SELECT COUNT(*)::int FROM provider_execution_leases WHERE provider_key=$1 AND expires_at >= NOW()) AS active,
          (SELECT COUNT(*)::int FROM provider_rate_limit_events WHERE provider_key=$1 AND occurred_at >= NOW()-INTERVAL '1 minute') AS recent`,
        [input.providerKey]);
      if (!capacity || capacity.active >= input.maxConcurrency || capacity.recent >= input.requestsPerMinute) return null;
      const leaseId = randomUUID();
      await tx.unsafe(
        "INSERT INTO provider_execution_leases (id,provider_key,owner_id,expires_at) VALUES ($1,$2,$3,NOW()+($4 * INTERVAL '1 second'))",
        [leaseId, input.providerKey, input.ownerId, input.leaseSeconds]);
      await tx.unsafe("INSERT INTO provider_rate_limit_events (provider_key) VALUES ($1)", [input.providerKey]);
      return leaseId;
    });
  },

  async acquire(input: {
    providerKey: string; ownerId: string; maxConcurrency: number; requestsPerMinute: number;
    leaseSeconds: number; waitTimeoutMs: number;
  }): Promise<DurableProviderLease> {
    const started = Date.now();
    while (Date.now() - started < input.waitTimeoutMs) {
      const leaseId = await this.tryAcquire(input);
      if (leaseId) return { leaseId, queueWaitMs: Date.now() - started };
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`PROVIDER_THROTTLED: ${input.providerKey} durable capacity wait exceeded ${input.waitTimeoutMs}ms.`);
  },

  async release(leaseId: string, ownerId: string) {
    const sql = getWriteSql("releasing durable provider capacity");
    await sql`DELETE FROM provider_execution_leases WHERE id=${leaseId} AND owner_id=${ownerId}`;
  }
};
