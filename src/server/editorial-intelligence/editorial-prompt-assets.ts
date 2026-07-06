import type { EditorialPromptKey } from "@/src/server/editorial-intelligence/editorial-prompt-contracts";

export const EDITORIAL_WRITER_PROMPT_ASSET_VERSION = "ei-004-writer-prompts-v1" as const;

export const editorialWriterPromptAssets: Readonly<Record<EditorialPromptKey, string>> = Object.freeze({
  editorial_title: "Write only the requested title unit from the supplied grounded claims. Return structured JSON matching the schema.",
  editorial_introduction: "Write the introduction from only the supplied grounded claims and milestone references. Return structured JSON matching the schema.",
  editorial_phase: "Write the requested historical phase in supplied milestone order using only supplied grounded claims. Return structured JSON matching the schema.",
  editorial_conclusion: "Write the conclusion from only the supplied grounded claims and milestone references. Return structured JSON matching the schema."
});
