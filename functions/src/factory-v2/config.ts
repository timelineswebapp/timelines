import { z } from "zod";
import { db } from "../firestore";
import { V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION, V2_PIPELINE_VERSION, V2_POLICY_VERSION, V2_PROMPT_VERSION, researchBudgetSchema } from "./contracts";
import { DEFAULT_PROVIDER_CAPACITY_POLICY, PROVIDER_CAPACITY_POLICY_VERSION } from "./provider-capacity";

export const providerCapacityPolicySchema = z.object({
  policyVersion: z.literal(PROVIDER_CAPACITY_POLICY_VERSION),
  maximumConcurrentOperations: z.number().int().min(1).max(3),
  maximumAttempts: z.number().int().min(1).max(3),
  minimumBackoffMs: z.number().int().min(250).max(10_000),
  maximumBackoffMs: z.number().int().min(1_000).max(60_000),
  maximumRetryTimeMs: z.number().int().min(1_000).max(120_000),
  circuitFailureThreshold: z.number().int().min(1).max(5),
  circuitCooldownMs: z.number().int().min(1_000).max(120_000)
}).strict().superRefine((policy, context) => {
  if (policy.maximumBackoffMs < policy.minimumBackoffMs) context.addIssue({ code: z.ZodIssueCode.custom, path: ["maximumBackoffMs"], message: "Maximum backoff must not be below minimum backoff." });
});

export const factoryV2ConfigSchema = z.object({
  operatingMode: z.enum(["OFF", "SHADOW"]),
  killSwitch: z.boolean(),
  pipelineVersion: z.literal(V2_PIPELINE_VERSION),
  artifactPolicyBundle: z.object({ schemaVersion: z.literal(V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION), policyVersion: z.literal(V2_POLICY_VERSION), promptVersion: z.literal(V2_PROMPT_VERSION) }).strict(),
  budgetBundle: researchBudgetSchema,
  providerCapacityPolicy: providerCapacityPolicySchema,
  autonomousDiscoveryEnabled: z.literal(false),
  publicationEnabled: z.literal(false),
  governanceSubmissionEnabled: z.literal(false),
  updatedAt: z.string().datetime()
}).strict();

export type FactoryV2Config = z.infer<typeof factoryV2ConfigSchema>;

export const DEFAULT_V2_BUDGET: FactoryV2Config["budgetBundle"] = {
  maximumGroundingCalls: 7,
  maximumProviderQueries: 40,
  maximumSourceDocuments: 60,
  maximumAtomicClaims: 300,
  maximumSemanticRepairs: 2,
  maximumTransportAttemptsPerCall: 3,
  maximumConcurrency: 3,
  maximumWorkerSeconds: 1200
};

export function shadowConfig(updatedAt = new Date().toISOString()): FactoryV2Config {
  return factoryV2ConfigSchema.parse({ operatingMode: "SHADOW", killSwitch: false, pipelineVersion: V2_PIPELINE_VERSION, artifactPolicyBundle: { schemaVersion: V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION, policyVersion: V2_POLICY_VERSION, promptVersion: V2_PROMPT_VERSION }, budgetBundle: DEFAULT_V2_BUDGET, providerCapacityPolicy: { policyVersion: PROVIDER_CAPACITY_POLICY_VERSION, ...DEFAULT_PROVIDER_CAPACITY_POLICY }, autonomousDiscoveryEnabled: false, publicationEnabled: false, governanceSubmissionEnabled: false, updatedAt });
}

export function authorityFirstRunDeadlineAt(startedAt: number, maximumWorkerSeconds: number): number {
  return startedAt + maximumWorkerSeconds * 1000;
}

export async function loadFactoryV2Config(): Promise<FactoryV2Config> {
  const snapshot = await db.collection("factoryV2").doc("config").get();
  if (!snapshot.exists) throw new Error("Factory V2 is OFF because factoryV2/config is absent.");
  return factoryV2ConfigSchema.parse(snapshot.data());
}

export function assertV2AShadowEnabled(config: FactoryV2Config): void {
  const parsed = factoryV2ConfigSchema.parse(config);
  if (parsed.operatingMode !== "SHADOW" || parsed.killSwitch || parsed.autonomousDiscoveryEnabled || parsed.publicationEnabled || parsed.governanceSubmissionEnabled) {
    throw new Error("Factory V2-A refuses to execute outside non-public SHADOW mode.");
  }
}
