export type EvidenceValidationStatus = "passed" | "failed";

export type EvidenceValidationCheckKey =
  | "corpus_document_reference"
  | "source_snapshot_reference"
  | "source_record_reference"
  | "provenance_complete"
  | "lineage_complete"
  | "span_boundaries_valid"
  | "content_non_empty"
  | "topic_grounding"
  | "claim_grounding"
  | "citation_grounding"
  | "authority_grounding"
  | "publication_suitability";

export type EvidenceValidationCheck = {
  checkKey: EvidenceValidationCheckKey;
  passed: boolean;
  message: string;
};

export type EvidenceValidationProvenance = {
  validationType: "structural_and_grounding_validation";
  evidenceRecordId: string;
  corpusDocumentId: string | null;
  sourceSnapshotId: string | null;
  sourceRecordId: string | null;
  provider: string | null;
  validatedAt: string;
  validator: string;
  authorityDecision: false;
  publicationReadinessDecision: false;
  groundingAssessment: {
    topic: string;
    topicRelevance: number;
    claimGrounded: boolean;
    citationGrounded: boolean;
    chronologySupported: boolean;
    authorityGrounded: boolean;
    publicationSuitable: boolean;
    evidenceQualityScore: number;
    unsupportedClaims: string[];
    rejectionReasons: string[];
  };
};

export type EvidenceValidationRecord = {
  validationRecordId: string;
  evidenceRecordId: string;
  status: EvidenceValidationStatus;
  checks: EvidenceValidationCheck[];
  provenance: EvidenceValidationProvenance;
  createdBy: string;
  createdAt?: string;
};

export type ValidateEvidenceInput = {
  evidenceRecordId: string;
  actor: string;
  topic: string;
};
