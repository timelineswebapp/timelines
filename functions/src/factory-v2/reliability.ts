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
  discoveryText?: string;
};

export type AuthorityEligibility = "ELIGIBLE_FOR_EVIDENCE" | "ORIENTATION_ONLY" | "PROVISIONAL" | "CATEGORICALLY_PROHIBITED";
export type CoverageAdmissionComponents = {
  gapRelevance: number;
  temporalFit: number;
  eventUtility: number;
  authorityEligibility: number;
  publisherQuality: number;
  roleAndClass: number;
  retrievability: number;
};
export type CoverageAdmissionDecision = DiscoveredSourceCandidate & {
  questionId: string;
  authorityEligibility: AuthorityEligibility;
  components: CoverageAdmissionComponents;
  matchedTemporalSignals: string[];
  matchedEventSignals: string[];
  admissionScore: number;
  rank: number;
  disposition: "RETRIEVAL_CANDIDATE" | "EXCLUDED_PROHIBITED" | "EXCLUDED_BUDGET";
  exclusionReason: string | null;
};

export function selectUsableCoverageCandidates<T extends { canonicalKey: string; admissionScore: number; usable: boolean }>(candidates: readonly T[], maximum = 2): T[] {
  return candidates.filter((candidate) => candidate.usable)
    .sort((left, right) => right.admissionScore - left.admissionScore || left.canonicalKey.localeCompare(right.canonicalKey))
    .slice(0, Math.min(3, Math.max(1, maximum)));
}

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

const EVENT_TERMS = ["launch", "launched", "release", "released", "adopt", "adopted", "approve", "approved", "announce", "announced", "introduce", "introduced", "create", "created", "publish", "published", "standard", "standardized", "opened", "founded", "decision", "agreement", "conference", "deploy", "deployed", "shutdown", "shut down"];

function authorityEligibility(candidate: DiscoveredSourceCandidate, publisher: PublisherAuthorityVersion | undefined): AuthorityEligibility {
  if (candidate.domain === "wikipedia.org" || candidate.domain.endsWith(".wikipedia.org")) return "CATEGORICALLY_PROHIBITED";
  if (publisher?.accessLimitations.includes("ORIENTATION_ONLY")) return "ORIENTATION_ONLY";
  return publisher?.state === "VERIFIED" ? "ELIGIBLE_FOR_EVIDENCE" : "PROVISIONAL";
}

function yearRange(question: ResearchMap["questions"][number], map: ResearchMap): { minimum: number; maximum: number } | null {
  const labels = question.phaseIds.flatMap((id) => map.phases.filter((phase) => phase.phaseId === id).map((phase) => `${phase.label} ${phase.temporalRule}`));
  const years = labels.flatMap((label) => [...label.matchAll(/\b(?:1[0-9]{3}|20[0-9]{2})\b/gu)].map((match) => Number(match[0])));
  if (years.length === 0) return null;
  return { minimum: Math.min(...years), maximum: Math.max(...years) };
}

function coverageComponents(candidate: DiscoveredSourceCandidate, question: ResearchMap["questions"][number], map: ResearchMap, publisher: PublisherAuthorityVersion | undefined, eligibility: AuthorityEligibility) {
  const text = normalizedIdentityText(`${candidate.title} ${candidate.canonicalUrl} ${candidate.discoveryText || ""}`);
  const phaseLabels = question.phaseIds.flatMap((id) => map.phases.filter((phase) => phase.phaseId === id).map((phase) => phase.label));
  const dimensionLabels = question.dimensionIds.flatMap((id) => map.dimensions.filter((dimension) => dimension.dimensionId === id).map((dimension) => dimension.label));
  const specificTerms = terms([...phaseLabels, ...dimensionLabels].join(" ")).filter((term) => !["history", "world", "wide", "web", "present", "development"].includes(term));
  const questionTerms = terms(question.text).filter((term) => !["history", "world", "wide", "web", "authoritative", "dated", "evidence", "establishes", "locked", "phase", "dimension", "chronology"].includes(term));
  const matchedTerms = [...new Set([...specificTerms, ...questionTerms].filter((term) => text.includes(term)))];
  const range = yearRange(question, map);
  const observedYears = [...text.matchAll(/\b(?:1[0-9]{3}|20[0-9]{2})\b/gu)].map((match) => Number(match[0]));
  const inRangeYears = range ? [...new Set(observedYears.filter((year) => year >= range.minimum && year <= range.maximum))].sort() : [];
  const matchedPhaseLabels = phaseLabels.map(normalizedIdentityText).filter((label) => text.includes(label));
  const matchedEventSignals = EVENT_TERMS.filter((term) => new RegExp(`\\b${term.replace(" ", "\\s+")}\\b`, "u").test(text));
  const genericPage = /^(?:home|homepage|welcome|world wide web consortium|w3c)$/u.test(normalizedIdentityText(candidate.title));
  const components: CoverageAdmissionComponents = {
    gapRelevance: Math.min(160, matchedTerms.length * 12 + matchedPhaseLabels.length * 40),
    temporalFit: Math.min(120, inRangeYears.length * 24 + matchedPhaseLabels.length * 40),
    eventUtility: Math.min(120, matchedEventSignals.length * 15),
    authorityEligibility: eligibility === "ELIGIBLE_FOR_EVIDENCE" ? 100 : eligibility === "PROVISIONAL" ? 30 : -1000,
    publisherQuality: publisher?.state === "VERIFIED" ? (publisher.primarySecondaryTendency === "PRIMARY" ? 70 : 55) : 15,
    roleAndClass: (candidate.role === "AUTHORITY_TARGETED" ? 20 : candidate.role === "PHASE_DIMENSION" ? 15 : 5) + (candidate.intendedSourceClass === "PRIMARY_INSTITUTIONAL" ? 20 : candidate.intendedSourceClass === "SCHOLARLY_SECONDARY" ? 15 : 5),
    retrievability: candidate.canonicalUrl.startsWith("https://") ? (genericPage ? -30 : 10) : -200
  };
  return { components, matchedTemporalSignals: [...matchedPhaseLabels, ...inRangeYears.map(String)], matchedEventSignals };
}

/** Coverage-completion admission keeps discovery intact, but excludes sources
 * that can never satisfy Source Authority from retrieval/extraction capacity. */
export function rankCoverageSourcesByQuestion(input: {
  candidates: readonly DiscoveredSourceCandidate[];
  map: ResearchMap;
  publishers: readonly PublisherAuthorityVersion[];
  maximumSources: number;
}): { retrievalCandidates: Array<DiscoveredSourceCandidate & { admittedQuestionIds: string[]; admissionScores: Record<string, number> }>; decisions: CoverageAdmissionDecision[] } {
  const ceiling = Math.min(60, Math.max(1, input.maximumSources));
  const deduplicated = new Map<string, DiscoveredSourceCandidate>();
  for (const candidate of input.candidates) {
    const existing = deduplicated.get(candidate.canonicalUrl);
    if (!existing) deduplicated.set(candidate.canonicalUrl, { ...candidate, researchQuestionIds: [...new Set(candidate.researchQuestionIds)] });
    else {
      existing.researchQuestionIds = [...new Set([...existing.researchQuestionIds, ...candidate.researchQuestionIds])];
      existing.discoveryText = [...new Set([existing.discoveryText, candidate.discoveryText].filter(Boolean))].join(" ").slice(0, 12_000);
    }
  }
  const decisions: CoverageAdmissionDecision[] = [];
  for (const question of input.map.questions.filter((item) => item.priority !== "SUPPORTING")) {
    const ranked = [...deduplicated.values()].filter((candidate) => candidate.researchQuestionIds.includes(question.questionId)).map((candidate) => {
      const publisher = publisherForDomain(candidate.domain, input.publishers);
      const eligibility = authorityEligibility(candidate, publisher);
      const signals = coverageComponents(candidate, question, input.map, publisher, eligibility);
      return { ...candidate, questionId: question.questionId, authorityEligibility: eligibility, ...signals, admissionScore: Object.values(signals.components).reduce((sum, value) => sum + value, 0) };
    }).sort((left, right) => right.admissionScore - left.admissionScore || left.canonicalUrl.localeCompare(right.canonicalUrl));
    ranked.forEach((candidate, index) => decisions.push({ ...candidate, rank: index + 1, disposition: candidate.authorityEligibility === "CATEGORICALLY_PROHIBITED" || candidate.authorityEligibility === "ORIENTATION_ONLY" ? "EXCLUDED_PROHIBITED" : "RETRIEVAL_CANDIDATE", exclusionReason: candidate.authorityEligibility === "CATEGORICALLY_PROHIBITED" || candidate.authorityEligibility === "ORIENTATION_ONLY" ? "SOURCE_AUTHORITY_ORIENTATION_ONLY" : null }));
  }
  const eligible = decisions.filter((decision) => decision.disposition === "RETRIEVAL_CANDIDATE");
  const selectedUrls = new Set<string>();
  const maximumRank = Math.max(0, ...eligible.map((decision) => decision.rank));
  for (let rank = 1; rank <= maximumRank && selectedUrls.size < ceiling; rank += 1) {
    for (const question of input.map.questions.filter((item) => item.priority !== "SUPPORTING")) {
      const decision = eligible.find((item) => item.questionId === question.questionId && item.rank === rank);
      if (decision) selectedUrls.add(decision.canonicalUrl);
      if (selectedUrls.size >= ceiling) break;
    }
  }
  for (const decision of decisions) if (decision.disposition === "RETRIEVAL_CANDIDATE" && !selectedUrls.has(decision.canonicalUrl)) {
    decision.disposition = "EXCLUDED_BUDGET";
    decision.exclusionReason = "SOURCE_DOCUMENT_BUDGET";
  }
  const retrievalCandidates = [...selectedUrls].map((url) => {
    const candidate = deduplicated.get(url)!;
    const admitted = decisions.filter((decision) => decision.canonicalUrl === url && decision.disposition === "RETRIEVAL_CANDIDATE");
    return { ...candidate, admittedQuestionIds: admitted.map((decision) => decision.questionId).sort(), admissionScores: Object.fromEntries(admitted.map((decision) => [decision.questionId, decision.admissionScore])) };
  });
  return { retrievalCandidates, decisions };
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
