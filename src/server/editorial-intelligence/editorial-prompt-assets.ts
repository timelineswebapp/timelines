import type { EditorialPromptKey } from "@/src/server/editorial-intelligence/editorial-prompt-contracts";

export const EDITORIAL_WRITER_PROMPT_ASSET_VERSION = "ei-004-writer-prompts-v2" as const;

const groundedLineageRule = "Use only supplied claims. Every sentence must cite supplied claimIds and milestoneIds. Do not infer causes, effects, motives, trends, or consequences. Avoid causal connectors: because, caused, causing, led to, resulted in, therefore, consequently, enabled.";

export const editorialWriterPromptAssets: Readonly<Record<EditorialPromptKey, string>> = Object.freeze({
  editorial_title: `Write only the requested title unit from the supplied grounded claims. Prefer a concise canonical subject title. ${groundedLineageRule} Return structured JSON matching the schema.`,
  editorial_introduction: `Write the introduction from only the supplied grounded claims and milestone references. State what the selected milestones cover without interpretation. ${groundedLineageRule} Return structured JSON matching the schema.`,
  editorial_phase: `Write the requested historical phase in supplied milestone order using only supplied grounded claims. Restate each milestone factually and chronologically. ${groundedLineageRule} Return structured JSON matching the schema.`,
  editorial_conclusion: `Write the conclusion from only the supplied grounded claims and milestone references. Summarize coverage without adding interpretation. ${groundedLineageRule} Return structured JSON matching the schema.`
});
