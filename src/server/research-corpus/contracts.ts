import type { SourceAuthorityProvider, SourceRetrievalProvenance } from "@/src/server/source-authority/contracts";

export type CorpusDocument = {
  corpusDocumentId: string;
  sourceSnapshotId: string;
  sourceRecordId: string;
  provider: SourceAuthorityProvider;
  title: string;
  contentType: string;
  normalizedText: string;
  contentHash: string;
  sourceLineage: CorpusSourceLineage;
  createdBy: string;
  createdAt?: string;
};

export type CorpusSourceLineage = {
  sourceSnapshotId: string;
  sourceRecordId: string;
  provider: SourceAuthorityProvider;
  retrievalTimestamp: string;
  snapshotVersion: number;
  retrievalUrl: string;
  retrievalProvenance: SourceRetrievalProvenance;
};

export type EvidenceRecord = {
  evidenceRecordId: string;
  corpusDocumentId: string;
  sourceSnapshotId: string;
  sourceRecordId: string;
  provider: SourceAuthorityProvider;
  retrievalTimestamp: string;
  spanStart: number;
  spanEnd: number;
  quoteText: string;
  normalizedClaim: string;
  provenance: EvidenceProvenance;
  createdBy: string;
  createdAt?: string;
};

export type EvidenceProvenance = {
  corpusDocumentId: string;
  sourceSnapshotId: string;
  sourceRecordId: string;
  provider: SourceAuthorityProvider;
  retrievalTimestamp: string;
  retrievalProvenance: SourceRetrievalProvenance;
};

export type GenerateCorpusDocumentInput = {
  sourceSnapshotId: string;
  actor: string;
};

export type ExtractEvidenceInput = {
  corpusDocumentId: string;
  actor: string;
  maxEvidenceRecords?: number;
};

export type FactoryEvidenceReference = {
  evidenceRecordId: string;
  corpusDocumentId: string;
  sourceSnapshotId: string;
  sourceRecordId: string;
  provider: SourceAuthorityProvider;
  retrievalTimestamp: string;
};
