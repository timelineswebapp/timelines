import type {
  EvidenceValidationCheck,
  EvidenceValidationProvenance,
  ValidateEvidenceInput
} from "@/src/server/evidence-validation/contracts";
import {
  evidenceValidationRepository,
  type EvidenceValidationSubject
} from "@/src/server/repositories/evidence-validation-repository";

function hasObjectValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

const GROUNDING_STOP_WORDS = new Set(["a", "an", "and", "of", "the", "to", "in", "on", "for", "history"]);

function groundingTerms(value: string): string[] {
  return [...new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(
    (term) => term.length > 2 && !GROUNDING_STOP_WORDS.has(term)
  ))];
}

export function assessEvidenceGrounding(subject: EvidenceValidationSubject, topic: string) {
  const topicTerms = groundingTerms(topic);
  const evidenceTerms = new Set(groundingTerms(`${subject.quoteText} ${subject.normalizedClaim}`));
  const matches = topicTerms.filter((term) =>
    [...evidenceTerms].some((candidate) => candidate === term || candidate.startsWith(term) || term.startsWith(candidate))
  );
  const topicRelevance = topicTerms.length ? matches.length / topicTerms.length : 0;
  const normalizedQuote = subject.quoteText.replace(/\s+/g, " ").trim().toLowerCase();
  const normalizedClaim = subject.normalizedClaim.replace(/\s+/g, " ").trim().toLowerCase();
  const claimGrounded = normalizedClaim === normalizedQuote || normalizedQuote.includes(normalizedClaim);
  const citationGrounded = subject.corpusDocumentExists && subject.sourceSnapshotExists && subject.sourceRecordExists;
  const chronologySupported = /\b(?:1[0-9]{3}|20[0-9]{2})\b|\b(?:century|year|date|era|period|before|after|during)\b/i.test(subject.quoteText);
  const relevance = hasObjectValue(subject.sourceProvenance)
    ? subject.sourceProvenance.relevanceAssessment
    : null;
  const authorityGrounded = hasObjectValue(relevance) && relevance.accepted === true &&
    typeof relevance.authorityRelevance === "number" && relevance.authorityRelevance >= 0.8;
  const publicationSuitable = topicRelevance > 0 && claimGrounded && citationGrounded && authorityGrounded;
  const evidenceQualityScore = Number((
    topicRelevance * 0.35 +
    (claimGrounded ? 0.25 : 0) +
    (citationGrounded ? 0.15 : 0) +
    (authorityGrounded ? 0.15 : 0) +
    (chronologySupported ? 0.1 : 0)
  ).toFixed(3));
  const rejectionReasons: string[] = [];
  if (topicRelevance === 0) rejectionReasons.push("Evidence does not materially relate to the Topic.");
  if (!claimGrounded) rejectionReasons.push("Normalized claim is not supported by the persisted quote.");
  if (!citationGrounded) rejectionReasons.push("Citation lineage cannot resolve to corpus, snapshot, and source authority.");
  if (!authorityGrounded) rejectionReasons.push("Source lacks an accepted Source Relevance Authority assessment.");
  if (!publicationSuitable) rejectionReasons.push("Evidence is not suitable for publication.");
  return {
    topic,
    topicRelevance: Number(topicRelevance.toFixed(3)),
    claimGrounded,
    citationGrounded,
    chronologySupported,
    authorityGrounded,
    publicationSuitable,
    evidenceQualityScore,
    unsupportedClaims: claimGrounded ? [] : [subject.normalizedClaim],
    rejectionReasons
  };
}

export function canonicalEvidenceTimestamp(value: unknown): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const postgresTimestamp = trimmed.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2})(?::?(\d{2}))?$/);
  const normalized = postgresTimestamp
    ? `${postgresTimestamp[1]}T${postgresTimestamp[2]}${postgresTimestamp[3]}:${postgresTimestamp[4] || "00"}`
    : trimmed;
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function timestampsMatch(left: unknown, right: unknown): boolean {
  const normalizedLeft = canonicalEvidenceTimestamp(left);
  const normalizedRight = canonicalEvidenceTimestamp(right);
  return normalizedLeft !== null && normalizedRight !== null && normalizedLeft === normalizedRight;
}

function checkEvidence(subject: EvidenceValidationSubject): EvidenceValidationCheck[] {
  const provenance = subject.provenance;
  const retrievalProvenance = hasObjectValue(provenance) ? provenance.retrievalProvenance : null;

  return [
    {
      checkKey: "corpus_document_reference",
      passed: subject.corpusDocumentExists,
      message: subject.corpusDocumentExists ? "Evidence references an existing corpus document." : "Evidence corpus document reference is missing."
    },
    {
      checkKey: "source_snapshot_reference",
      passed: subject.sourceSnapshotExists,
      message: subject.sourceSnapshotExists ? "Evidence references an existing source snapshot." : "Evidence source snapshot reference is missing."
    },
    {
      checkKey: "source_record_reference",
      passed: subject.sourceRecordExists,
      message: subject.sourceRecordExists ? "Evidence references an existing source authority record." : "Evidence source authority record reference is missing."
    },
    {
      checkKey: "provenance_complete",
      passed:
        hasObjectValue(provenance) &&
        typeof provenance.corpusDocumentId === "string" &&
        typeof provenance.sourceSnapshotId === "string" &&
        typeof provenance.sourceRecordId === "string" &&
        typeof provenance.provider === "string" &&
        typeof provenance.retrievalTimestamp === "string" &&
        hasObjectValue(retrievalProvenance),
      message: "Evidence provenance contains corpus, source, provider, retrieval timestamp, and retrieval provenance."
    },
    {
      checkKey: "lineage_complete",
      passed:
        subject.corpusDocumentId === provenance.corpusDocumentId &&
        subject.sourceSnapshotId === provenance.sourceSnapshotId &&
        subject.sourceRecordId === provenance.sourceRecordId &&
        subject.provider === provenance.provider &&
        timestampsMatch(subject.retrievalTimestamp, provenance.retrievalTimestamp),
      message: "Evidence lineage matches persisted evidence columns."
    },
    {
      checkKey: "span_boundaries_valid",
      passed:
        Number.isInteger(subject.spanStart) &&
        Number.isInteger(subject.spanEnd) &&
        subject.spanStart >= 0 &&
        subject.spanEnd > subject.spanStart &&
        (subject.corpusTextLength === null || subject.spanEnd <= subject.corpusTextLength),
      message: "Evidence span boundaries are valid for the corpus document."
    },
    {
      checkKey: "content_non_empty",
      passed: subject.quoteText.trim().length > 0 && subject.normalizedClaim.trim().length > 0,
      message: "Evidence quote and normalized claim are non-empty."
    }
  ];
}

export const evidenceValidationService = {
  async validateEvidence(input: ValidateEvidenceInput) {
    const subject = await evidenceValidationRepository.requireEvidenceSubject(input.evidenceRecordId);
    const grounding = assessEvidenceGrounding(subject, input.topic);
    const checks: EvidenceValidationCheck[] = [
      ...checkEvidence(subject),
      { checkKey: "topic_grounding", passed: grounding.topicRelevance > 0, message: grounding.topicRelevance > 0 ? "Evidence materially relates to the Topic." : "Evidence does not materially relate to the Topic." },
      { checkKey: "claim_grounding", passed: grounding.claimGrounded, message: grounding.claimGrounded ? "Claim resolves to the persisted evidence quote." : "Claim is unsupported by the persisted evidence quote." },
      { checkKey: "citation_grounding", passed: grounding.citationGrounded, message: grounding.citationGrounded ? "Citation resolves through persisted evidence lineage." : "Citation lineage is incomplete." },
      { checkKey: "authority_grounding", passed: grounding.authorityGrounded, message: grounding.authorityGrounded ? "Evidence source passed Source Relevance Authority." : "Evidence source lacks accepted relevance authority." },
      { checkKey: "publication_suitability", passed: grounding.publicationSuitable, message: grounding.publicationSuitable ? "Evidence is suitable for publication use." : "Evidence is not suitable for publication use." }
    ];
    const status = checks.every((check) => check.passed) ? "passed" : "failed";
    const provenance: EvidenceValidationProvenance = {
      validationType: "structural_and_grounding_validation",
      evidenceRecordId: subject.evidenceRecordId,
      corpusDocumentId: subject.corpusDocumentId,
      sourceSnapshotId: subject.sourceSnapshotId,
      sourceRecordId: subject.sourceRecordId,
      provider: subject.provider,
      validatedAt: new Date().toISOString(),
      validator: input.actor,
      authorityDecision: false,
      publicationReadinessDecision: false,
      groundingAssessment: grounding
    };

    return evidenceValidationRepository.createValidationRecord({
      evidenceRecordId: subject.evidenceRecordId,
      status,
      checks,
      provenance,
      actor: input.actor
    });
  }
};
