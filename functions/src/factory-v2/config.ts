import { z } from "zod";
import { db } from "../firestore";
import { V2_POLICY_VERSION, V2_PROMPT_VERSION, V2_SCHEMA_VERSION, researchBudgetSchema } from "./contracts";

export const factoryV2ConfigSchema = z.object({
  operatingMode: z.enum(["OFF", "SHADOW"]),
  killSwitch: z.boolean(),
  pipelineVersion: z.literal("factory-v2-a.11"),
  artifactPolicyBundle: z.object({ schemaVersion: z.literal(V2_SCHEMA_VERSION), policyVersion: z.literal(V2_POLICY_VERSION), promptVersion: z.literal(V2_PROMPT_VERSION) }).strict(),
  budgetBundle: researchBudgetSchema,
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
  return factoryV2ConfigSchema.parse({ operatingMode: "SHADOW", killSwitch: false, pipelineVersion: "factory-v2-a.11", artifactPolicyBundle: { schemaVersion: V2_SCHEMA_VERSION, policyVersion: V2_POLICY_VERSION, promptVersion: V2_PROMPT_VERSION }, budgetBundle: DEFAULT_V2_BUDGET, autonomousDiscoveryEnabled: false, publicationEnabled: false, governanceSubmissionEnabled: false, updatedAt });
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
