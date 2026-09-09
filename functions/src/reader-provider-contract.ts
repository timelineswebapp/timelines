import { z } from "zod";
import { readerEditorialReviewSchema, type ReaderEditorialReview } from "./schemas";

const criterionMappings = [
  ["scope fidelity", "scope_fidelity", "SCOPE_DRIFT"],
  ["chronological intelligibility", "chronological_intelligibility", "CHRONOLOGY_UNCLEAR"],
  ["milestone significance", "milestone_significance", "INSIGNIFICANT_MILESTONE"],
  ["narrative progression", "narrative_progression", "NARRATIVE_DISCONTINUITY"],
  ["omission severity", "omission_severity", "MATERIAL_OMISSION"],
  ["redundancy", "redundancy", "SUBSTANTIVE_REDUNDANCY"],
  ["temporal balance", "temporal_balance", "TEMPORAL_IMBALANCE"],
  ["title and summary fidelity", "title_summary_fidelity", "TITLE_SUMMARY_MISMATCH"],
  ["publication worthiness", "publication_worthiness", "NOT_PUBLICATION_WORTHY"]
] as const;

type CanonicalCriterion = typeof criterionMappings[number][1];
type FindingCode = typeof criterionMappings[number][2];

function normalizedToken(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/[\s_-]+/gu, " ");
}

const judgmentAllowlist = new Map<string, "passed" | "failed">([
  ["pass", "passed"], ["passed", "passed"], ["yes", "passed"],
  ["fail", "failed"], ["failed", "failed"], ["no", "failed"]
]);
const publicationAllowlist = new Map<string, "publication_worthy" | "not_publication_worthy">([
  ["publication worthy", "publication_worthy"], ["publishable", "publication_worthy"],
  ["not publication worthy", "not_publication_worthy"], ["not publishable", "not_publication_worthy"]
]);
const criterionAllowlist = new Map<string, { criterion: CanonicalCriterion; findingCode: FindingCode }>(
  criterionMappings.map(([label, criterion, findingCode]) => [label, { criterion, findingCode }])
);

const providerShape: z.ZodRawShape = {
  material_findings_json: z.string().trim().min(2).max(20_000),
  overall_publication_judgment: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(40).max(1600)
};
for (let index = 1; index <= 9; index += 1) {
  providerShape[`criterion_${index}_identity`] = z.string().trim().min(3).max(80);
  providerShape[`criterion_${index}_judgment`] = z.string().trim().min(2).max(20);
  providerShape[`criterion_${index}_explanation`] = z.string().trim().min(20).max(1200);
}

export const readerProviderResponseSchema = z.object(providerShape).strict();

const semanticFindingSchema = z.object({
  criterion: z.string().trim().min(3).max(80),
  text: z.string().trim().min(20).max(1200),
  eventTitles: z.array(z.string().trim().min(3).max(240)).max(20).default([])
}).strict();

function requiredAllowlistValue<T>(allowlist: Map<string, T>, value: string, label: string): T {
  const result = allowlist.get(normalizedToken(value));
  if (result === undefined) throw new Error(`Unknown or ambiguous ${label}: ${value}`);
  return result;
}

export function adaptReaderProviderResponse(input: unknown): ReaderEditorialReview {
  const provider = readerProviderResponseSchema.parse(input) as Record<string, string>;
  const seen = new Set<CanonicalCriterion>();
  const criteria: ReaderEditorialReview["criteria"] = [];
  for (let index = 1; index <= 9; index += 1) {
    const identity = provider[`criterion_${index}_identity`]!;
    const mapping = requiredAllowlistValue(criterionAllowlist, identity, "criterion identity");
    if (seen.has(mapping.criterion)) throw new Error(`Duplicate reader criterion: ${identity}`);
    seen.add(mapping.criterion);
    criteria.push({
      criterion: mapping.criterion,
      verdict: requiredAllowlistValue(judgmentAllowlist, provider[`criterion_${index}_judgment`]!, "criterion judgment"),
      rationale: provider[`criterion_${index}_explanation`]!
    });
  }
  if (seen.size !== criterionMappings.length) throw new Error("Every reader criterion must be supplied exactly once.");

  let rawFindings: unknown;
  try {
    rawFindings = JSON.parse(provider.material_findings_json!);
  } catch {
    throw new Error("Reader provider material_findings_json must be valid JSON.");
  }
  const findings = z.array(semanticFindingSchema).max(30).parse(rawFindings).map((finding) => {
    const mapping = requiredAllowlistValue(criterionAllowlist, finding.criterion, "finding criterion identity");
    return { code: mapping.findingCode, severity: "material" as const, eventTitles: finding.eventTitles, rationale: finding.text };
  });

  return readerEditorialReviewSchema.parse({
    criteria,
    findings,
    informedReaderVerdict: requiredAllowlistValue(publicationAllowlist, provider.overall_publication_judgment!, "publication judgment"),
    summary: provider.summary
  });
}

export function readerProviderJsonSchema() {
  const properties = Object.fromEntries(Object.keys(providerShape).map((key) => [key, { type: "string" }]));
  return { type: "object", additionalProperties: false, required: Object.keys(properties), properties };
}

export const READER_PROVIDER_NORMALIZATION = Object.freeze({
  criteria: Object.freeze(Object.fromEntries(criterionMappings.map(([label, criterion]) => [label, criterion]))),
  judgments: Object.freeze(Object.fromEntries(judgmentAllowlist)),
  publicationJudgments: Object.freeze(Object.fromEntries(publicationAllowlist))
});
