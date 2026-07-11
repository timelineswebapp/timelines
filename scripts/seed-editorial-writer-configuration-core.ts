import { createHash } from "node:crypto";
import {
  fingerprintEditorialProviderProvenance,
  fingerprintEditorialWritingPolicy
} from "@/src/server/editorial-intelligence/editorial-writer-input-builder";
import {
  editorialPromptRepository,
  editorialProviderConfigurationRepository,
  editorialWritingPolicyRepository
} from "@/src/server/repositories/editorial-writer-configuration-repository";
import { editorialWriterConfigurationBindingRepository } from "@/src/server/repositories/editorial-writer-binding-repository";
import { editorialWriterPromptAssets } from "@/src/server/editorial-intelligence/editorial-prompt-assets";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const stableHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const seededEditorialPromptContent = Object.freeze({
  editorial_title: editorialWriterPromptAssets.editorial_title,
  editorial_introduction: editorialWriterPromptAssets.editorial_introduction,
  editorial_phase: editorialWriterPromptAssets.editorial_phase,
  editorial_conclusion: editorialWriterPromptAssets.editorial_conclusion
});

const promptIds = {
  editorial_title: "10000000-0000-4000-8000-000000000001",
  editorial_introduction: "10000000-0000-4000-8000-000000000002",
  editorial_phase: "10000000-0000-4000-8000-000000000003",
  editorial_conclusion: "10000000-0000-4000-8000-000000000004"
} as const;

type Dependencies = {
  prompts: typeof editorialPromptRepository;
  policies: typeof editorialWritingPolicyRepository;
  providers: typeof editorialProviderConfigurationRepository;
  bindings: typeof editorialWriterConfigurationBindingRepository;
};

const dependencies: Dependencies = {
  prompts: editorialPromptRepository,
  policies: editorialWritingPolicyRepository,
  providers: editorialProviderConfigurationRepository,
  bindings: editorialWriterConfigurationBindingRepository
};

export async function seedEditorialWriterConfiguration(input: {
  modelName: string;
  actor?: string;
  dependencies?: Dependencies;
}) {
  const repos = input.dependencies || dependencies;
  const actor = input.actor || "editorial-writer-configuration-seed";
  const policy = fingerprintEditorialWritingPolicy({
    policyId: "default-en-historical-article",
    version: "1",
    schemaVersion: "ei-004-writing-policy-v1",
    locale: "en",
    audience: "general",
    tone: "neutral_educational",
    readingLevel: "grade-9",
    targetLength: { minimumWords: 300, maximumWords: 1800 },
    quotationPolicy: "source_verbatim_only",
    chronologyPolicy: "composition_order_locked",
    causalityPolicy: "explicit_grounded_relationship_only",
    citationPolicy: "sentence_lineage_required",
    narrativeMode: "historical_article"
  });
  const persistedPolicy = await repos.policies.createPolicy({
    policyId: policy.policyId,
    version: policy.version,
    schemaVersion: policy.schemaVersion,
    locale: policy.locale,
    tone: policy.tone,
    audience: policy.audience,
    readingLevel: policy.readingLevel,
    sectionLimits: { maximumSections: 202, maximumParagraphsPerSection: 1000, maximumSentencesPerParagraph: 1000 },
    targetLength: policy.targetLength,
    quotationPolicy: policy.quotationPolicy,
    chronologyPolicy: policy.chronologyPolicy,
    causalityPolicy: policy.causalityPolicy,
    citationPolicy: policy.citationPolicy,
    narrativeMode: policy.narrativeMode,
    fingerprint: policy.fingerprint,
    createdBy: actor
  });
  const promptVersions = await Promise.all(
    (Object.keys(seededEditorialPromptContent) as Array<keyof typeof seededEditorialPromptContent>).map(async (promptKey) => {
      const content = seededEditorialPromptContent[promptKey];
      const contentFingerprint = hash(content);
      const activePrompt = await repos.prompts.getActivePrompt(promptKey);
      if (activePrompt?.contentFingerprint === contentFingerprint) return activePrompt;
      return repos.prompts.createPrompt({
        promptId: promptIds[promptKey],
        promptKey,
        version: activePrompt ? activePrompt.version + 1 : 1,
        content,
        contentFingerprint,
        inputSchemaVersion: "ei-004-writer-input-v1",
        outputSchemaVersion: "ei-004-generation-output-v1",
        policyId: policy.policyId,
        policyVersion: policy.version,
        supersedesPromptVersionId: activePrompt?.promptVersionId,
        createdBy: actor
      });
    })
  );
  const provider = fingerprintEditorialProviderProvenance({
    schemaVersion: "ei-004-provider-provenance-v1",
    provider: "qwen14",
    providerVersion: "factory-runtime-v1",
    model: input.modelName,
    modelVersion: input.modelName,
    structuredOutputSchemaVersion: "ei-004-generation-output-v1",
    temperature: 0,
    seed: 7
  });
  const persistedProvider = await repos.providers.createProviderConfiguration({
    providerId: "factory-qwen14",
    providerKey: "qwen14",
    schemaVersion: provider.schemaVersion,
    providerVersion: provider.providerVersion,
    model: provider.model,
    modelVersion: provider.modelVersion,
    providerType: "ollama",
    runtimeVersion: "factory-runtime-v1",
    structuredOutputVersion: provider.structuredOutputSchemaVersion,
    timeoutMs: 120000,
    retryLimit: 2,
    temperature: provider.temperature,
    seed: provider.seed,
    provenanceFingerprint: provider.runtimeFingerprint,
    createdBy: actor
  });
  const byKey = new Map(promptVersions.map((item) => [item.promptKey, item]));
  const bindingIdentity = {
    titlePromptVersionId: byKey.get("editorial_title")!.promptVersionId,
    introductionPromptVersionId: byKey.get("editorial_introduction")!.promptVersionId,
    phasePromptVersionId: byKey.get("editorial_phase")!.promptVersionId,
    conclusionPromptVersionId: byKey.get("editorial_conclusion")!.promptVersionId,
    writingPolicyVersionId: persistedPolicy.policyVersionId,
    providerConfigurationId: persistedProvider.providerConfigurationId,
    locale: "en",
    narrativeMode: "historical_article" as const
  };
  const active = await repos.bindings.getActiveWriterConfigurationBinding();
  const bindingFingerprint = stableHash(bindingIdentity);
  if (active) {
    if (active.bindingFingerprint === bindingFingerprint) {
      return { prompts: promptVersions, policy: persistedPolicy, provider: persistedProvider, binding: active, reused: true };
    }
  }
  const binding = await repos.bindings.createWriterConfigurationBinding({
    ...bindingIdentity,
    bindingFingerprint,
    supersedesBindingId: active?.bindingId,
    createdBy: actor
  });
  return { prompts: promptVersions, policy: persistedPolicy, provider: persistedProvider, binding, reused: false };
}
