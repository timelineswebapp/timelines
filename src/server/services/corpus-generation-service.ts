import { ApiError } from "@/src/server/api/responses";
import { corpusRepository } from "@/src/server/repositories/corpus-repository";
import type { GenerateCorpusDocumentInput } from "@/src/server/research-corpus/contracts";

const MAX_CORPUS_CHARS = 500_000;
const MAX_STRUCTURED_CLAIMS = 200;
const NON_HISTORICAL_METADATA_KEYS = /(?:modified|revision|retriev|pageid|namespace|lastrevid|timestamp)$/i;
const WIKIDATA_HISTORICAL_PROPERTIES: Readonly<Record<string, string>> = {
  P569: "date of birth",
  P570: "date of death",
  P571: "inception",
  P575: "time of discovery or invention",
  P576: "dissolved, abolished, or demolished",
  P577: "publication date",
  P580: "start time",
  P582: "end time"
};
const DBPEDIA_HISTORICAL_DATE_PROPERTIES = new Set([
  "birth date",
  "death date",
  "dissolution date",
  "end date",
  "established",
  "established date",
  "formation date",
  "founded",
  "founding date",
  "introduced",
  "inception",
  "invented",
  "opening date",
  "start date"
]);

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function propertyName(uri: string): string {
  const value = decodeURIComponent(uri.split(/[\/#]/).pop() || uri);
  return value.replace(/[_-]+/g, " ").trim();
}

function wikidataTime(value: string): string {
  const normalized = value.replace(/^\+/, "");
  const match = normalized.match(/^(-?\d{4,})-(\d{2})-(\d{2})T/);
  if (!match) return normalized;
  const [, year, month, day] = match;
  if (month === "00") return year!;
  if (day === "00") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function normalizeWikidata(payload: Record<string, unknown>): string | null {
  const entities = payload.entities && typeof payload.entities === "object"
    ? Object.values(payload.entities as Record<string, unknown>)
    : [];
  const lines: string[] = [];
  for (const rawEntity of entities) {
    if (!rawEntity || typeof rawEntity !== "object") continue;
    const entity = rawEntity as Record<string, unknown>;
    const labels = entity.labels as Record<string, { value?: unknown }> | undefined;
    const descriptions = entity.descriptions as Record<string, { value?: unknown }> | undefined;
    const label = cleanText(labels?.en?.value);
    const description = cleanText(descriptions?.en?.value);
    if (label) lines.push(`Label: ${label}.`);
    if (description) lines.push(`Description: ${description}.`);
    const claims = entity.claims && typeof entity.claims === "object"
      ? entity.claims as Record<string, unknown[]>
      : {};
    for (const [property, statements] of Object.entries(claims)) {
      const historicalProperty = WIKIDATA_HISTORICAL_PROPERTIES[property];
      if (!historicalProperty) continue;
      for (const statement of Array.isArray(statements) ? statements : []) {
        const value = (statement as any)?.mainsnak?.datavalue?.value;
        const time = cleanText(value?.time);
        if (time) {
          lines.push(`${label || "Entity"} ${historicalProperty}: ${wikidataTime(time)}.`);
        }
      }
    }
  }
  return lines.length ? lines.slice(0, MAX_STRUCTURED_CLAIMS).join(" ") : null;
}

function normalizeDbpedia(payload: Record<string, unknown>): string | null {
  const lines: string[] = [];
  for (const [subject, rawProperties] of Object.entries(payload)) {
    if (!rawProperties || typeof rawProperties !== "object") continue;
    const subjectName = propertyName(subject);
    for (const [predicate, rawValues] of Object.entries(rawProperties as Record<string, unknown>)) {
      const name = propertyName(predicate);
      if (NON_HISTORICAL_METADATA_KEYS.test(name)) continue;
      for (const rawValue of Array.isArray(rawValues) ? rawValues : [rawValues]) {
        const valueObject = rawValue && typeof rawValue === "object" ? rawValue as Record<string, unknown> : null;
        const language = cleanText(valueObject?.lang);
        if (language && language !== "en") continue;
        const value = cleanText(valueObject ? valueObject.value : rawValue);
        if (!value || value.startsWith("http")) continue;
        if (name.toLowerCase() === "abstract") {
          lines.push(`Description of ${subjectName}: ${value}`);
        } else if (DBPEDIA_HISTORICAL_DATE_PROPERTIES.has(name.toLowerCase())) {
          lines.push(`${subjectName} ${name}: ${value}.`);
        }
      }
    }
  }
  return lines.length ? lines.slice(0, MAX_STRUCTURED_CLAIMS).join(" ") : null;
}

export function normalizeStructuredSourceText(
  content: string,
  contentType: string,
  provider?: string
): string {
  if (!contentType.includes("json")) return content;
  let payload: unknown;
  try {
    payload = JSON.parse(content);
  } catch {
    return content;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return content;
  const normalized = provider === "wikidata"
    ? normalizeWikidata(payload as Record<string, unknown>)
    : provider === "dbpedia"
      ? normalizeDbpedia(payload as Record<string, unknown>)
      : null;
  if (normalized) return normalized;
  if (provider === "wikidata" || provider === "dbpedia") {
    return `Structured ${provider} record contains no extractable historical claims.`;
  }
  return content;
}

function normalizeSnapshotText(content: string, contentType: string, provider?: string): string {
  const structured = normalizeStructuredSourceText(content, contentType, provider);
  const withoutMarkup = contentType.includes("html")
    ? structured
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    : structured;

  return withoutMarkup
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CORPUS_CHARS);
}

function sourceDescriptionFallback(snapshot: { sourceTitle: string; sourceDescription: string | null; provider?: string }): string | null {
  const description = cleanText(snapshot.sourceDescription);
  if (!description || /^\d{3,4}$/.test(description)) return null;
  if (snapshot.provider === "wikidata" || snapshot.provider === "dbpedia") {
    return `Description of ${snapshot.sourceTitle}: ${description}`;
  }
  return null;
}

export const corpusGenerationService = {
  async generateFromSourceSnapshot(input: GenerateCorpusDocumentInput) {
    const snapshot = await corpusRepository.requireSourceSnapshot(input.sourceSnapshotId);
    const normalizedSnapshotText = normalizeSnapshotText(snapshot.contentText, snapshot.contentType, snapshot.provider);
    const fallbackText = /^Structured (?:wikidata|dbpedia) record contains no extractable historical claims\.$/.test(normalizedSnapshotText)
      ? sourceDescriptionFallback(snapshot)
      : null;
    const normalizedText = fallbackText || normalizedSnapshotText;
    if (!normalizedText) {
      throw new ApiError(409, "CORPUS_DOCUMENT_EMPTY", "Source snapshot does not contain corpus-ready text.");
    }

    return corpusRepository.createDocument({
      snapshot,
      normalizedText,
      actor: input.actor
    });
  }
};
