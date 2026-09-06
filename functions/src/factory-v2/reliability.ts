import type { EvidenceSegment, PublisherAuthorityVersion, ResearchMap, SourceDocument } from "./contracts";
import { normalizedIdentityText } from "./contracts/builders";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "did", "do", "for", "from", "how", "in", "is", "it", "of", "on", "or", "that", "the", "their", "to", "was", "were", "what", "when", "which", "who", "why", "with"
]);

function terms(value: string): string[] {
  return [...new Set(normalizedIdentityText(value).split(/[^\p{L}\p{N}]+/u).filter((term) => term.length >= 3 && !STOP_WORDS.has(term)))];
}

function phraseScore(text: string, needles: readonly string[]): number {
  const normalized = normalizedIdentityText(text);
  return needles.reduce((score, needle) => score + (normalized.includes(needle) ? Math.min(8, 2 + needle.split(" ").length) : 0), 0);
}

export type EvidencePacket = {
  segments: EvidenceSegment[];
  score: number;
  characterCount: number;
};

/** Deterministic lexical evidence selection. Exact segment objects are retained;
 * only their bounded order and admission are changed. */
export function selectEvidencePacket(input: {
  question: ResearchMap["questions"][number];
  segments: readonly EvidenceSegment[];
  entityNames?: readonly string[];
  maximumSegments?: number;
  maximumCharacters?: number;
}): EvidencePacket {
  const maximumSegments = Math.min(16, Math.max(1, input.maximumSegments ?? 12));
  const maximumCharacters = Math.min(16_000, Math.max(1_000, input.maximumCharacters ?? 9_000));
  const questionTerms = terms(input.question.text);
  const phraseNeedles = [...input.entityNames || [], ...input.question.geography]
    .map(normalizedIdentityText)
    .filter((value) => value.length >= 3);
  const ranked = input.segments.map((segment, index) => {
    const normalized = normalizedIdentityText(segment.exactText);
    const overlap = questionTerms.reduce((score, term) => score + (normalized.includes(term) ? 3 : 0), 0);
    const dates = input.question.dateCritical && /\b(?:1[0-9]{3}|20[0-9]{2})\b/u.test(segment.exactText) ? 4 : 0;
    const boilerplate = /^(?:skip to|home|blog|about|menu|search|sign in|cookie|privacy|contact|navigation)\b/iu.test(normalized) ? 12 : 0;
    const score = overlap + phraseScore(segment.exactText, phraseNeedles) + dates - boilerplate;
    return { segment, index, score };
  }).filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index || left.segment.evidenceSegmentId.localeCompare(right.segment.evidenceSegmentId));

  const selected: EvidenceSegment[] = [];
  let characterCount = 0;
  let score = 0;
  for (const item of ranked) {
    if (selected.length >= maximumSegments) break;
    if (characterCount + item.segment.exactText.length > maximumCharacters) continue;
    selected.push(item.segment);
    characterCount += item.segment.exactText.length;
    score += item.score;
  }
  return { segments: selected, score, characterCount };
}

export type DiscoveredSourceCandidate = {
  canonicalUrl: string;
  originalUrl: string;
  title: string;
  domain: string;
  queryId: string;
  researchQuestionIds: string[];
  role: "ORIENTATION" | "PHASE_DIMENSION" | "AUTHORITY_TARGETED" | "SOURCE_RETRIEVAL";
  intendedSourceClass: SourceDocument["sourceClass"];
  discoveryOrder: number;
};

function publisherForDomain(domain: string, publishers: readonly PublisherAuthorityVersion[]): PublisherAuthorityVersion | undefined {
  const hostname = domain.toLocaleLowerCase("en-US").replace(/^www\./u, "");
  return publishers.find((publisher) => publisher.knownDomains.some((known) => hostname === known || hostname.endsWith(`.${known}`)));
}

function sourceCandidateScore(candidate: DiscoveredSourceCandidate, publisher: PublisherAuthorityVersion | undefined): number {
  return (publisher?.state === "VERIFIED" ? 100 : 0)
    + (candidate.role === "AUTHORITY_TARGETED" ? 35 : candidate.role === "PHASE_DIMENSION" ? 20 : 5)
    + (candidate.intendedSourceClass === "PRIMARY_INSTITUTIONAL" ? 20 : candidate.intendedSourceClass === "SCHOLARLY_SECONDARY" ? 15 : candidate.intendedSourceClass === "ESTABLISHED_JOURNALISM" ? 10 : 0)
    + (publisher?.primarySecondaryTendency === "PRIMARY" ? 15 : publisher?.primarySecondaryTendency === "SECONDARY" ? 8 : 0)
    - (candidate.domain.includes("wikipedia.org") ? 80 : 0);
}

/** The 60-document budget is a ceiling. Admit at most two diverse candidates
 * for every critical/important question, then fill only if no question has a
 * candidate. Unknown publishers remain eligible. */
export function admitSourcesByQuestion(input: {
  candidates: readonly DiscoveredSourceCandidate[];
  map: ResearchMap;
  publishers: readonly PublisherAuthorityVersion[];
  maximumSources: number;
  perQuestion?: number;
}): Array<DiscoveredSourceCandidate & { admissionScore: number; admittedQuestionIds: string[] }> {
  const ceiling = Math.min(60, Math.max(1, input.maximumSources));
  const perQuestion = Math.min(3, Math.max(1, input.perQuestion ?? 2));
  const deduplicated = new Map<string, DiscoveredSourceCandidate>();
  for (const candidate of input.candidates) {
    const existing = deduplicated.get(candidate.canonicalUrl);
    if (!existing) deduplicated.set(candidate.canonicalUrl, { ...candidate, researchQuestionIds: [...new Set(candidate.researchQuestionIds)] });
    else existing.researchQuestionIds = [...new Set([...existing.researchQuestionIds, ...candidate.researchQuestionIds])];
  }
  const ranked = [...deduplicated.values()].map((candidate) => {
    const publisher = publisherForDomain(candidate.domain, input.publishers);
    return { ...candidate, admissionScore: sourceCandidateScore(candidate, publisher), admittedQuestionIds: [] as string[] };
  }).sort((left, right) => right.admissionScore - left.admissionScore || left.discoveryOrder - right.discoveryOrder || left.canonicalUrl.localeCompare(right.canonicalUrl));

  const admitted = new Map<string, typeof ranked[number]>();
  const questions = input.map.questions.filter((question) => question.priority !== "SUPPORTING");
  for (const question of questions) {
    const usedDomains = new Set<string>();
    for (const candidate of ranked.filter((item) => item.researchQuestionIds.includes(question.questionId))) {
      if (usedDomains.has(candidate.domain)) continue;
      const current = admitted.get(candidate.canonicalUrl) || candidate;
      if (!current.admittedQuestionIds.includes(question.questionId)) current.admittedQuestionIds.push(question.questionId);
      admitted.set(candidate.canonicalUrl, current);
      usedDomains.add(candidate.domain);
      if (usedDomains.size >= perQuestion || admitted.size >= ceiling) break;
    }
    if (admitted.size >= ceiling) break;
  }
  if (admitted.size === 0) for (const candidate of ranked.slice(0, Math.min(ceiling, 6))) admitted.set(candidate.canonicalUrl, candidate);
  return [...admitted.values()].slice(0, ceiling);
}

export function claimPropositionKey(claim: Pick<SourceDocument, never> & {
  subject: { kind: string; id: string | null; label: string };
  predicate: string;
  object: { kind: string; id: string | null; value: unknown };
  temporal: unknown;
  qualifiers: Array<{ key: string; value: string }>;
}): string {
  return JSON.stringify({
    subject: { ...claim.subject, label: normalizedIdentityText(claim.subject.label) },
    predicate: claim.predicate,
    object: { ...claim.object, value: typeof claim.object.value === "string" ? normalizedIdentityText(claim.object.value) : claim.object.value },
    temporal: claim.temporal,
    qualifiers: claim.qualifiers.filter((item) => item.key !== "researchQuestionId").map((item) => ({ key: normalizedIdentityText(item.key), value: normalizedIdentityText(item.value) })).sort((a, b) => `${a.key}:${a.value}`.localeCompare(`${b.key}:${b.value}`))
  });
}
