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
    const checks = checkEvidence(subject);
    const status = checks.every((check) => check.passed) ? "passed" : "failed";
    const provenance: EvidenceValidationProvenance = {
      validationType: "structural_evidence_validation",
      evidenceRecordId: subject.evidenceRecordId,
      corpusDocumentId: subject.corpusDocumentId,
      sourceSnapshotId: subject.sourceSnapshotId,
      sourceRecordId: subject.sourceRecordId,
      provider: subject.provider,
      validatedAt: new Date().toISOString(),
      validator: input.actor,
      authorityDecision: false,
      publicationReadinessDecision: false
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
