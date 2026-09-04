import { createHash } from "node:crypto";

const TOPIC_PREFIX_PATTERN = /^(?:a\s+)?(?:history|timeline|chronology|evolution|development)\s+(?:of\s+)?/iu;

export type NormalizedTopic = {
  topicId: string;
  normalizedTitle: string;
  displayTitle: string;
  scope: string;
  slug: string;
  aliases: string[];
};

function normalizeSpaces(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

export function slugifyTopic(value: string) {
  return normalizeSpaces(
    value
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .toLocaleLowerCase("en-US")
      .replace(/[’'`]/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
  )
    .replace(/\s+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 120);
}

export function normalizeTopic(input: string, language = "en"): NormalizedTopic {
  const displayTitle = normalizeSpaces(input.normalize("NFKC"));
  const punctuationNormalized = normalizeSpaces(
    displayTitle
      .toLocaleLowerCase("en-US")
      .replace(/[’'`]/gu, "")
      .replace(/[\p{P}\p{S}]+/gu, " ")
  );
  const withoutPrefix = normalizeSpaces(punctuationNormalized.replace(TOPIC_PREFIX_PATTERN, ""));
  const normalizedTitle = withoutPrefix || punctuationNormalized;
  const scope = `${language.toLocaleLowerCase("en-US")}:timeline:${normalizedTitle}`;
  const topicId = createHash("sha256").update(scope).digest("hex").slice(0, 40);
  const aliases = Array.from(new Set([punctuationNormalized, normalizedTitle])).filter(Boolean);

  return {
    topicId,
    normalizedTitle,
    displayTitle,
    scope,
    slug: slugifyTopic(normalizedTitle),
    aliases
  };
}

export function hashValue(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
