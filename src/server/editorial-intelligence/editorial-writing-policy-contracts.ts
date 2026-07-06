export const EDITORIAL_WRITING_POLICY_SCHEMA_VERSION = "ei-004-writing-policy-v1" as const;

export type EditorialNarrativeMode =
  | "historical_article"
  | "museum"
  | "educational"
  | "academic"
  | "executive_summary";

export type EditorialWritingPolicyDefinition = Readonly<{
  policyId: string;
  version: string;
  schemaVersion: typeof EDITORIAL_WRITING_POLICY_SCHEMA_VERSION;
  locale: string;
  audience: string;
  tone: "neutral_educational" | "formal_academic" | "concise_executive";
  readingLevel: string;
  targetLength: Readonly<{ minimumWords: number; maximumWords: number }>;
  quotationPolicy: "source_verbatim_only" | "quotations_forbidden";
  chronologyPolicy: "composition_order_locked";
  causalityPolicy: "explicit_grounded_relationship_only";
  citationPolicy: "sentence_lineage_required";
  narrativeMode: EditorialNarrativeMode;
}>;

export type EditorialWritingPolicy = Readonly<
  EditorialWritingPolicyDefinition & { fingerprint: string }
>;
