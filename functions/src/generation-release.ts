import { z } from "zod";
import { GOVERNANCE_POLICY_VERSION, PIPELINE_VERSION, PROMPT_VERSION, QUALITY_POLICY_VERSION, SCHEMA_VERSION } from "./config";
import { READER_EDITORIAL_POLICY_VERSION } from "./editorial-reader";
import { EVIDENCE_FIRST_PIPELINE_VERSION, COMPOSITION_SCHEMA_VERSION, EVENT_LOCK_SCHEMA_VERSION } from "./evidence-first/contracts";
import { V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION, V2_PIPELINE_VERSION, V2_POLICY_VERSION, V2_PROMPT_VERSION } from "./factory-v2/contracts";
import { V2_B_PIPELINE_VERSION, V2_B_SCHEMA_VERSION, V2_B_SELECTION_POLICY_VERSION } from "./factory-v2/contracts/assembly";
import { COMMUNITY_IDENTITY_POLICY_VERSION, COMMUNITY_IDENTITY_REGISTRY_VERSION } from "./factory-v2/community-identity";
import { payloadHash } from "./factory-v2/hashing";
import { SOURCE_AUTHORITY_POLICY_VERSION } from "./source-authority";
import { tier1SecurityGateBundle, tier1SecurityGateBundleSchema } from "./security-gate";

const hash = z.string().regex(/^[a-f0-9]{64}$/u);

export const generationReleaseManifestSchema = z.object({
  manifestSchemaVersion: z.literal("generation-release-manifest-v2"),
  sourceRevision: z.string().regex(/^[a-f0-9]{40}$/u),
  sourceTreeSha256: hash,
  dependencyLocks: z.object({ rootSha256: hash, functionsSha256: hash }).strict(),
  configurationBundleHash: hash,
  securityGateBundle: tier1SecurityGateBundleSchema,
  generationCapability: z.literal(EVIDENCE_FIRST_PIPELINE_VERSION),
  legacyPipelineVersion: z.literal(PIPELINE_VERSION),
  knowledgeBundle: z.object({ pipelineVersion: z.literal(V2_PIPELINE_VERSION), policyVersion: z.literal(V2_POLICY_VERSION), promptVersion: z.literal(V2_PROMPT_VERSION), schemaVersion: z.literal(V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION) }).strict(),
  communityIdentityBundle: z.object({ registryVersion: z.literal(COMMUNITY_IDENTITY_REGISTRY_VERSION), policyVersion: z.literal(COMMUNITY_IDENTITY_POLICY_VERSION) }).strict(),
  selectionBundle: z.object({ pipelineVersion: z.literal(V2_B_PIPELINE_VERSION), policyVersion: z.literal(V2_B_SELECTION_POLICY_VERSION), schemaVersion: z.literal(V2_B_SCHEMA_VERSION) }).strict(),
  compositionBundle: z.object({ eventLockSchemaVersion: z.literal(EVENT_LOCK_SCHEMA_VERSION), compositionSchemaVersion: z.literal(COMPOSITION_SCHEMA_VERSION) }).strict(),
  institutionalGateBundle: z.object({ promptVersion: z.literal(PROMPT_VERSION), generatedTimelineSchemaVersion: z.literal(SCHEMA_VERSION), timelineQualityPolicyVersion: z.literal(QUALITY_POLICY_VERSION), sourceAuthorityPolicyVersion: z.literal(SOURCE_AUTHORITY_POLICY_VERSION), readerPolicyVersion: z.literal(READER_EDITORIAL_POLICY_VERSION), governancePolicyVersion: z.literal(GOVERNANCE_POLICY_VERSION) }).strict()
}).strict();

export type GenerationReleaseManifest = z.infer<typeof generationReleaseManifestSchema>;

export type GenerationRelease = { generationReleaseId: string; manifest: GenerationReleaseManifest };

export function buildGenerationReleaseManifest(input: {
  sourceRevision: string;
  sourceTreeSha256: string;
  rootDependencyLockSha256: string;
  functionsDependencyLockSha256: string;
  configurationBundle: Record<string, unknown>;
}): GenerationRelease {
  const manifest = generationReleaseManifestSchema.parse({
    manifestSchemaVersion: "generation-release-manifest-v2",
    sourceRevision: input.sourceRevision,
    sourceTreeSha256: input.sourceTreeSha256,
    dependencyLocks: { rootSha256: input.rootDependencyLockSha256, functionsSha256: input.functionsDependencyLockSha256 },
    configurationBundleHash: payloadHash(input.configurationBundle),
    securityGateBundle: tier1SecurityGateBundle(),
    generationCapability: EVIDENCE_FIRST_PIPELINE_VERSION,
    legacyPipelineVersion: PIPELINE_VERSION,
    knowledgeBundle: { pipelineVersion: V2_PIPELINE_VERSION, policyVersion: V2_POLICY_VERSION, promptVersion: V2_PROMPT_VERSION, schemaVersion: V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION },
    communityIdentityBundle: { registryVersion: COMMUNITY_IDENTITY_REGISTRY_VERSION, policyVersion: COMMUNITY_IDENTITY_POLICY_VERSION },
    selectionBundle: { pipelineVersion: V2_B_PIPELINE_VERSION, policyVersion: V2_B_SELECTION_POLICY_VERSION, schemaVersion: V2_B_SCHEMA_VERSION },
    compositionBundle: { eventLockSchemaVersion: EVENT_LOCK_SCHEMA_VERSION, compositionSchemaVersion: COMPOSITION_SCHEMA_VERSION },
    institutionalGateBundle: { promptVersion: PROMPT_VERSION, generatedTimelineSchemaVersion: SCHEMA_VERSION, timelineQualityPolicyVersion: QUALITY_POLICY_VERSION, sourceAuthorityPolicyVersion: SOURCE_AUTHORITY_POLICY_VERSION, readerPolicyVersion: READER_EDITORIAL_POLICY_VERSION, governancePolicyVersion: GOVERNANCE_POLICY_VERSION }
  });
  return { generationReleaseId: payloadHash(manifest), manifest };
}

export function assertGenerationReleaseParity(left: GenerationRelease, right: GenerationRelease): void {
  const parsedLeft = { generationReleaseId: left.generationReleaseId, manifest: generationReleaseManifestSchema.parse(left.manifest) };
  const parsedRight = { generationReleaseId: right.generationReleaseId, manifest: generationReleaseManifestSchema.parse(right.manifest) };
  if (parsedLeft.generationReleaseId !== payloadHash(parsedLeft.manifest) || parsedRight.generationReleaseId !== payloadHash(parsedRight.manifest)) throw new Error("GENERATION_RELEASE_MANIFEST_HASH_INVALID");
  if (parsedLeft.generationReleaseId !== parsedRight.generationReleaseId) throw new Error("GENERATION_RELEASE_PARITY_MISMATCH");
}

export function assertPinnedGenerationRelease(expectedReleaseId: string, runtimeRelease: GenerationRelease): void {
  if (runtimeRelease.generationReleaseId !== payloadHash(runtimeRelease.manifest)) throw new Error("GENERATION_RELEASE_MANIFEST_HASH_INVALID");
  if (expectedReleaseId !== runtimeRelease.generationReleaseId) throw new Error("STALE_GENERATION_RELEASE");
}
