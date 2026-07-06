export const EDITORIAL_PROMPT_SCHEMA_VERSION = "ei-004-prompt-schema-v1" as const;

export type EditorialPromptKey =
  | "editorial_title"
  | "editorial_introduction"
  | "editorial_phase"
  | "editorial_conclusion";

export type EditorialPromptDefinition = Readonly<{
  promptId: string;
  promptKey: EditorialPromptKey;
  promptVersion: number;
  templateFingerprint: string;
  schemaVersion: typeof EDITORIAL_PROMPT_SCHEMA_VERSION;
  policyId: string;
  policyVersion: string;
  lifecycle: "active" | "superseded";
}>;

export type EditorialPromptReference = Readonly<
  EditorialPromptDefinition & { promptFingerprint: string }
>;
