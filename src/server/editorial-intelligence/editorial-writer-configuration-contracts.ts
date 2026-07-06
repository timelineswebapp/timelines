export const EDITORIAL_WRITER_CONFIGURATION_CONTRACT_VERSION = "ei-003a-writer-configuration-v1" as const;

export type EditorialPromptRegistryRecord = Readonly<{
  promptVersionId: string;
  promptId: string;
  promptKey: "editorial_title" | "editorial_introduction" | "editorial_phase" | "editorial_conclusion";
  version: number;
  content: string;
  contentFingerprint: string;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  policyId: string;
  policyVersion: string;
  lifecycle: "active" | "superseded";
  createdBy: string;
  createdAt?: string;
}>;

export type CreateEditorialPromptInput = Readonly<
  Omit<EditorialPromptRegistryRecord, "promptVersionId" | "lifecycle" | "createdAt"> & {
    supersedesPromptVersionId?: string | null;
  }
>;

export type EditorialWritingPolicyRegistryRecord = Readonly<{
  policyVersionId: string;
  policyId: string;
  version: string;
  schemaVersion: string;
  locale: string;
  tone: string;
  audience: string;
  readingLevel: string;
  sectionLimits: Readonly<Record<string, number>>;
  targetLength: Readonly<{ minimumWords: number; maximumWords: number }>;
  quotationPolicy: string;
  chronologyPolicy: string;
  causalityPolicy: string;
  citationPolicy: string;
  narrativeMode: "historical_article" | "museum" | "educational" | "academic" | "executive_summary";
  fingerprint: string;
  createdBy: string;
  createdAt?: string;
}>;

export type CreateEditorialWritingPolicyInput = Readonly<
  Omit<EditorialWritingPolicyRegistryRecord, "policyVersionId" | "createdAt">
>;

export type EditorialProviderConfiguration = Readonly<{
  providerConfigurationId: string;
  providerId: string;
  providerKey: string;
  schemaVersion: string;
  providerVersion: string;
  model: string;
  modelVersion: string;
  providerType: string;
  runtimeVersion: string;
  structuredOutputVersion: string;
  timeoutMs: number;
  retryLimit: number;
  temperature: number;
  seed: number | null;
  provenanceFingerprint: string;
  createdBy: string;
  createdAt?: string;
}>;

export type CreateEditorialProviderConfigurationInput = Readonly<
  Omit<EditorialProviderConfiguration, "providerConfigurationId" | "createdAt">
>;

export type EditorialPromptRegistry = Readonly<{
  getPromptById(promptVersionId: string): Promise<EditorialPromptRegistryRecord | null>;
  getPromptVersion(promptId: string, version: number): Promise<EditorialPromptRegistryRecord | null>;
  getActivePrompt(promptKey: EditorialPromptRegistryRecord["promptKey"]): Promise<EditorialPromptRegistryRecord | null>;
  createPrompt(input: CreateEditorialPromptInput): Promise<EditorialPromptRegistryRecord>;
}>;

export type EditorialWritingPolicyRegistry = Readonly<{
  getPolicyById(policyVersionId: string): Promise<EditorialWritingPolicyRegistryRecord | null>;
  getPolicyVersion(policyId: string, version: string): Promise<EditorialWritingPolicyRegistryRecord | null>;
  createPolicy(input: CreateEditorialWritingPolicyInput): Promise<EditorialWritingPolicyRegistryRecord>;
}>;

export type EditorialProviderConfigurationRegistry = Readonly<{
  getProviderConfiguration(providerKey: string, runtimeVersion: string): Promise<EditorialProviderConfiguration | null>;
  getProviderConfigurationById(providerConfigurationId: string): Promise<EditorialProviderConfiguration | null>;
  createProviderConfiguration(input: CreateEditorialProviderConfigurationInput): Promise<EditorialProviderConfiguration>;
}>;

export type EditorialWriterConfigurationBinding = Readonly<{
  bindingId: string;
  titlePromptVersionId: string;
  introductionPromptVersionId: string;
  phasePromptVersionId: string;
  conclusionPromptVersionId: string;
  writingPolicyVersionId: string;
  providerConfigurationId: string;
  locale: string;
  narrativeMode: EditorialWritingPolicyRegistryRecord["narrativeMode"];
  bindingFingerprint: string;
  lifecycle: "active" | "superseded";
  createdBy: string;
  createdAt?: string;
}>;

export type CreateEditorialWriterConfigurationBindingInput = Readonly<
  Omit<EditorialWriterConfigurationBinding, "bindingId" | "lifecycle" | "createdAt"> & {
    supersedesBindingId?: string | null;
  }
>;

export type EditorialWriterConfigurationBindingRegistry = Readonly<{
  createWriterConfigurationBinding(input: CreateEditorialWriterConfigurationBindingInput): Promise<EditorialWriterConfigurationBinding>;
  getWriterConfigurationBindingById(bindingId: string): Promise<EditorialWriterConfigurationBinding | null>;
  getActiveWriterConfigurationBinding(): Promise<EditorialWriterConfigurationBinding | null>;
}>;

export type ValidatedEditorialGenerationUnit = Readonly<{
  generationUnitId: string;
  executionKey: string;
  unitType: "title" | "subtitle" | "introduction" | "phase" | "conclusion";
  unitSequence: number;
  promptVersionId: string;
  inputFingerprint: string;
  outputFingerprint: string;
  validatedOutput: Readonly<Record<string, unknown>>;
  groundingValidationReport: Readonly<Record<string, unknown>>;
  diagnostics: Readonly<Record<string, unknown>>;
  status: "validated";
  createdBy: string;
  createdAt?: string;
}>;

export type CreateValidatedEditorialGenerationUnitInput = Readonly<
  Omit<ValidatedEditorialGenerationUnit, "generationUnitId" | "status" | "createdAt">
>;

export type EditorialGenerationUnitPersistence = Readonly<{
  createValidatedGenerationUnit(input: CreateValidatedEditorialGenerationUnitInput): Promise<ValidatedEditorialGenerationUnit>;
  getValidatedGenerationUnit(
    executionKey: string,
    unitType: ValidatedEditorialGenerationUnit["unitType"],
    unitSequence: number
  ): Promise<ValidatedEditorialGenerationUnit | null>;
  getValidatedGenerationUnitsByExecutionKey(executionKey: string): Promise<readonly ValidatedEditorialGenerationUnit[]>;
}>;
