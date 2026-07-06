export const EDITORIAL_PROVIDER_PROVENANCE_SCHEMA_VERSION = "ei-004-provider-provenance-v1" as const;

export type EditorialProviderProvenanceDefinition = Readonly<{
  schemaVersion: typeof EDITORIAL_PROVIDER_PROVENANCE_SCHEMA_VERSION;
  provider: string;
  providerVersion: string;
  model: string;
  modelVersion: string;
  structuredOutputSchemaVersion: string;
  temperature: number;
  seed: number | null;
}>;

export type EditorialProviderProvenance = Readonly<
  EditorialProviderProvenanceDefinition & { runtimeFingerprint: string }
>;
