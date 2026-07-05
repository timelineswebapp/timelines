import { createHash } from "node:crypto";
import {
  EDITORIAL_FOUNDATION_ALGORITHM_VERSION,
  type EditorialEvidenceSet,
  type EditorialEvidenceSubject,
  type EditorialScore
} from "@/src/server/editorial-intelligence/contracts";

const STOP_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "is", "it", "of", "on", "or", "the", "to", "was", "were", "with"]);
const TURNING_TERMS = /\b(first|founded|invented|introduced|launched|revolution|war|independence|reform|breakthrough|adopted|established|collapsed|ended|began|discovered)\b/i;
const CONSEQUENCE_TERMS = /\b(because|caused|enabled|led to|resulted|transformed|changed|therefore|impact|legacy|influence)\b/i;

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
const terms = (value: string) => normalize(value).split(" ").filter((term) => term.length > 2 && !STOP_WORDS.has(term));

export function extractChronologyYears(value: string): number[] {
  const years = new Set<number>();
  for (const match of value.matchAll(/\b(\d{1,4})\s*(BCE|BC|CE|AD)?\b/gi)) {
    const number = Number(match[1]);
    if (number === 0 || number > 2999) continue;
    years.add(/BCE|BC/i.test(match[2] || "") ? -number : number);
  }
  return [...years].sort((a, b) => a - b);
}

function duplicateKey(subject: EditorialEvidenceSubject): string {
  return normalize(subject.evidence.normalizedClaim || subject.evidence.quoteText);
}

function canonicalSubject(topic: string, subjects: readonly EditorialEvidenceSubject[]) {
  const topicTerms = terms(topic);
  const supporting = subjects.filter((subject) => {
    const haystack = new Set(terms(`${subject.evidence.normalizedClaim} ${subject.evidence.quoteText}`));
    return topicTerms.some((term) => haystack.has(term));
  }).map((subject) => subject.evidence.evidenceRecordId).sort();
  return {
    label: topic.trim().replace(/\s+/g, " "),
    confidence: clamp(subjects.length ? supporting.length / subjects.length * 100 : 0),
    supportingEvidenceRecordIds: supporting
  };
}

function score(subject: EditorialEvidenceSubject, topic: string, duplicate: boolean, sourceCount: number, chronologyYears: readonly number[]): EditorialScore {
  const text = `${subject.evidence.normalizedClaim} ${subject.evidence.quoteText}`;
  const topicSet = new Set(terms(topic));
  const textSet = new Set(terms(text));
  const centrality = topicSet.size ? [...topicSet].filter((term) => textSet.has(term)).length / topicSet.size : 0;
  const evidenceStrength = (subject.validation.groundingAssessment?.evidenceQualityScore ?? subject.sourceAuthorityScore) * 100;
  const chronologicalImportance = chronologyYears.length ? 100 : 20;
  const narrativeContribution = (TURNING_TERMS.test(text) ? 55 : 20) + (CONSEQUENCE_TERMS.test(text) ? 45 : 0);
  const historicalSignificance = 0.45 * narrativeContribution + 0.35 * evidenceStrength + 0.2 * chronologicalImportance;
  const novelty = duplicate ? 0 : 100;
  const redundancy = duplicate ? 100 : 0;
  const sourceDiversity = sourceCount > 1 ? 100 : 50;
  const coverageContribution = clamp((chronologyYears.length ? 60 : 20) + (duplicate ? 0 : 40));
  const subjectCentrality = centrality * 100;
  const total = clamp(
    historicalSignificance * 0.25 + chronologicalImportance * 0.15 + narrativeContribution * 0.15 +
    coverageContribution * 0.1 + novelty * 0.1 - redundancy * 0.1 + sourceDiversity * 0.05 +
    evidenceStrength * 0.15 + subjectCentrality * 0.15
  );
  return {
    historicalSignificance: clamp(historicalSignificance), chronologicalImportance: clamp(chronologicalImportance),
    narrativeContribution: clamp(narrativeContribution), coverageContribution, novelty, redundancy,
    sourceDiversity, evidenceStrength: clamp(evidenceStrength), subjectCentrality: clamp(subjectCentrality), total
  };
}

export function prepareEditorialEvidenceSet(topic: string, input: readonly EditorialEvidenceSubject[]): EditorialEvidenceSet {
  const subjects = [...input].sort((a, b) => a.evidence.evidenceRecordId.localeCompare(b.evidence.evidenceRecordId));
  const canonical = canonicalSubject(topic, subjects);
  const firstByDuplicateKey = new Map<string, string>();
  const sourceCount = new Set(subjects.map((item) => item.evidence.sourceRecordId)).size;
  const rows = subjects.map((subject) => {
    const key = duplicateKey(subject);
    const duplicateOfEvidenceRecordId = firstByDuplicateKey.get(key) || null;
    if (!duplicateOfEvidenceRecordId) firstByDuplicateKey.set(key, subject.evidence.evidenceRecordId);
    const chronologyYears = extractChronologyYears(`${subject.evidence.normalizedClaim} ${subject.evidence.quoteText}`);
    return {
      evidenceRecordId: subject.evidence.evidenceRecordId,
      validationRecordId: subject.validationRecordId,
      duplicateOfEvidenceRecordId,
      chronologyYears,
      score: score(subject, topic, duplicateOfEvidenceRecordId !== null, sourceCount, chronologyYears)
    };
  }).sort((a, b) => b.score.total - a.score.total || a.evidenceRecordId.localeCompare(b.evidenceRecordId));
  const rankedEvidence = rows.map((row, index) => ({ rank: index + 1, ...row }));
  const uniqueRows = rankedEvidence.filter((row) => !row.duplicateOfEvidenceRecordId);
  const representedYears = [...new Set(uniqueRows.flatMap((row) => row.chronologyYears))].sort((a, b) => a - b);
  const gaps = representedYears.slice(1).map((year, index) => ({
    afterYear: representedYears[index]!, beforeYear: year, spanYears: year - representedYears[index]!
  })).filter((gap) => gap.spanYears > 1);
  const bucketCounts = new Map<number, number>();
  for (const year of representedYears) bucketCounts.set(Math.floor(year / 100), (bucketCounts.get(Math.floor(year / 100)) || 0) + 1);
  const counts = [...bucketCounts.values()];
  const balanceScore = counts.length < 2 ? (counts.length ? 50 : 0) : clamp(Math.min(...counts) / Math.max(...counts) * 100);
  const identifiedTurningPoints = uniqueRows.filter((row) => row.score.narrativeContribution >= 55)
    .map((row) => ({ evidenceRecordId: row.evidenceRecordId, year: row.chronologyYears[0] ?? null, score: row.score.historicalSignificance }))
    .sort((a, b) => b.score - a.score || a.evidenceRecordId.localeCompare(b.evidenceRecordId));
  const candidateMilestonesRanked = uniqueRows.filter((row) => row.chronologyYears.length > 0)
    .map((row) => ({ evidenceRecordId: row.evidenceRecordId, year: row.chronologyYears[0]!, importanceScore: row.score.historicalSignificance }))
    .sort((a, b) => b.importanceScore - a.importanceScore || (a.year ?? 0) - (b.year ?? 0) || a.evidenceRecordId.localeCompare(b.evidenceRecordId))
    .map((row, index) => ({ rank: index + 1, ...row }));
  const fingerprint = createHash("sha256").update(JSON.stringify({
    algorithmVersion: EDITORIAL_FOUNDATION_ALGORITHM_VERSION, topic: normalize(topic),
    inputs: subjects.map((subject) => [subject.evidence.evidenceRecordId, subject.validationRecordId])
  })).digest("hex");
  return {
    topic: topic.trim(), algorithmVersion: EDITORIAL_FOUNDATION_ALGORITHM_VERSION, inputFingerprint: fingerprint, rankedEvidence,
    coverageAnalysis: {
      uniqueEvidenceCount: uniqueRows.length, duplicateEvidenceCount: rows.length - uniqueRows.length, uniqueSourceCount: sourceCount,
      sourceDiversityScore: clamp(sourceCount / Math.max(1, uniqueRows.length) * 100),
      chronologyEvidenceRatio: Number((uniqueRows.filter((row) => row.chronologyYears.length).length / Math.max(1, uniqueRows.length)).toFixed(3))
    },
    timelineCoverage: {
      earliestYear: representedYears[0] ?? null, latestYear: representedYears.at(-1) ?? null, representedYears, gaps, balanceScore
    },
    identifiedTurningPoints, canonicalSubject: canonical,
    canonicalHistoricalObject: { label: canonical.label, supportingEvidenceRecordIds: canonical.supportingEvidenceRecordIds },
    candidateMilestonesRanked,
    editorialMetadata: {
      authorityDecision: false, publicationReadinessDecision: false, compilerOutput: false,
      evidenceRecordCount: subjects.length, scoringScale: "integer_0_100"
    }
  };
}
