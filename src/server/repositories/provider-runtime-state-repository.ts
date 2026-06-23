import { getWriteSql } from "@/src/server/db/client";
import type { SourceAuthorityProvider } from "@/src/server/source-authority/contracts";

type ProviderHealthBase = {
  provider: SourceAuthorityProvider;
  consecutiveFailures: number;
  cooldownUntil: number | null;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  lastFailureReason: string | null;
};

type ProviderRuntimeStateRow = {
  provider: SourceAuthorityProvider;
  consecutiveFailures: number;
  cooldownUntil: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  lastFailureReason: string | null;
  failureCount: string;
  successCount: string;
  recoveryCount: string;
  lastRecoveredAt: string | null;
};

export type ProviderRuntimeState = ProviderHealthBase & {
  failureCount: number;
  successCount: number;
  recoveryCount: number;
  lastRecoveredAt: number | null;
};

export type ProviderRuntimeStateUpdate =
  | {
      provider: SourceAuthorityProvider;
      outcome: "success";
      occurredAt: number;
    }
  | {
      provider: SourceAuthorityProvider;
      outcome: "failure";
      occurredAt: number;
      cooldownUntil: number;
      reason: string;
    };

function msToDate(ms: number): Date {
  return new Date(ms);
}

function dateTextToMs(value: string | null): number | null {
  return value ? new Date(value).getTime() : null;
}

function rowToState(row: ProviderRuntimeStateRow): ProviderRuntimeState {
  return {
    provider: row.provider,
    consecutiveFailures: row.consecutiveFailures,
    cooldownUntil: dateTextToMs(row.cooldownUntil),
    lastFailureAt: dateTextToMs(row.lastFailureAt),
    lastSuccessAt: dateTextToMs(row.lastSuccessAt),
    lastFailureReason: row.lastFailureReason,
    failureCount: Number(row.failureCount),
    successCount: Number(row.successCount),
    recoveryCount: Number(row.recoveryCount),
    lastRecoveredAt: dateTextToMs(row.lastRecoveredAt)
  };
}

export const providerRuntimeStateRepository = {
  async list(): Promise<ProviderRuntimeState[]> {
    const sql = getWriteSql("listing provider runtime state");
    const rows = await sql<ProviderRuntimeStateRow[]>`
      SELECT
        provider,
        consecutive_failures::int AS "consecutiveFailures",
        cooldown_until::text AS "cooldownUntil",
        last_failure_at::text AS "lastFailureAt",
        last_success_at::text AS "lastSuccessAt",
        last_failure_reason AS "lastFailureReason",
        failure_count::text AS "failureCount",
        success_count::text AS "successCount",
        recovery_count::text AS "recoveryCount",
        last_recovered_at::text AS "lastRecoveredAt"
      FROM provider_runtime_state
      ORDER BY provider
    `;
    return rows.map(rowToState);
  },

  async get(provider: SourceAuthorityProvider): Promise<ProviderRuntimeState | null> {
    const sql = getWriteSql("loading provider runtime state");
    const [row] = await sql<ProviderRuntimeStateRow[]>`
      SELECT
        provider,
        consecutive_failures::int AS "consecutiveFailures",
        cooldown_until::text AS "cooldownUntil",
        last_failure_at::text AS "lastFailureAt",
        last_success_at::text AS "lastSuccessAt",
        last_failure_reason AS "lastFailureReason",
        failure_count::text AS "failureCount",
        success_count::text AS "successCount",
        recovery_count::text AS "recoveryCount",
        last_recovered_at::text AS "lastRecoveredAt"
      FROM provider_runtime_state
      WHERE provider = ${provider}
      LIMIT 1
    `;
    return row ? rowToState(row) : null;
  },

  async record(update: ProviderRuntimeStateUpdate): Promise<ProviderRuntimeState> {
    const sql = getWriteSql("recording provider runtime state");
    if (update.outcome === "failure") {
      const reason = update.reason.slice(0, 500);
      const [row] = await sql<ProviderRuntimeStateRow[]>`
        INSERT INTO provider_runtime_state (
          provider,
          consecutive_failures,
          cooldown_until,
          last_failure_at,
          last_failure_reason,
          failure_count,
          updated_at
        )
        VALUES (${update.provider}, 1, ${msToDate(update.cooldownUntil)}, ${msToDate(update.occurredAt)}, ${reason}, 1, NOW())
        ON CONFLICT (provider) DO UPDATE
        SET
          consecutive_failures = provider_runtime_state.consecutive_failures + 1,
          cooldown_until = EXCLUDED.cooldown_until,
          last_failure_at = EXCLUDED.last_failure_at,
          last_failure_reason = EXCLUDED.last_failure_reason,
          failure_count = provider_runtime_state.failure_count + 1,
          updated_at = NOW()
        RETURNING
          provider,
          consecutive_failures::int AS "consecutiveFailures",
          cooldown_until::text AS "cooldownUntil",
          last_failure_at::text AS "lastFailureAt",
          last_success_at::text AS "lastSuccessAt",
          last_failure_reason AS "lastFailureReason",
          failure_count::text AS "failureCount",
          success_count::text AS "successCount",
          recovery_count::text AS "recoveryCount",
          last_recovered_at::text AS "lastRecoveredAt"
      `;
      return rowToState(row!);
    }

    const [row] = await sql<ProviderRuntimeStateRow[]>`
      INSERT INTO provider_runtime_state (
        provider,
        consecutive_failures,
        cooldown_until,
        last_success_at,
        last_failure_reason,
        success_count,
        updated_at
      )
      VALUES (${update.provider}, 0, NULL, ${msToDate(update.occurredAt)}, NULL, 1, NOW())
      ON CONFLICT (provider) DO UPDATE
      SET
        recovery_count = CASE
          WHEN provider_runtime_state.consecutive_failures > 0 THEN provider_runtime_state.recovery_count + 1
          ELSE provider_runtime_state.recovery_count
        END,
        last_recovered_at = CASE
          WHEN provider_runtime_state.consecutive_failures > 0 THEN EXCLUDED.last_success_at
          ELSE provider_runtime_state.last_recovered_at
        END,
        consecutive_failures = 0,
        cooldown_until = NULL,
        last_success_at = EXCLUDED.last_success_at,
        last_failure_reason = NULL,
        success_count = provider_runtime_state.success_count + 1,
        updated_at = NOW()
      RETURNING
        provider,
        consecutive_failures::int AS "consecutiveFailures",
        cooldown_until::text AS "cooldownUntil",
        last_failure_at::text AS "lastFailureAt",
        last_success_at::text AS "lastSuccessAt",
        last_failure_reason AS "lastFailureReason",
        failure_count::text AS "failureCount",
        success_count::text AS "successCount",
        recovery_count::text AS "recoveryCount",
        last_recovered_at::text AS "lastRecoveredAt"
    `;
    return rowToState(row!);
  }
};
