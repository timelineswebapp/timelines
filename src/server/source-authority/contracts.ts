export type SourceAuthorityProvider = "wikidata" | "dbpedia" | "library_of_congress" | "nara";

export type SourceAuthorityOrigin = {
  provider: SourceAuthorityProvider;
  providerRecordId: string;
  providerUrl: string;
  discoveredFromQuery: string;
  discoveredAt: string;
};

export type SourceAuthorityRegistryRecord = {
  sourceRecordId: string;
  provider: SourceAuthorityProvider;
  providerRecordId: string;
  canonicalUrl: string;
  title: string;
  description: string | null;
  sourceType: string;
  origin: SourceAuthorityOrigin;
  provenance: Record<string, unknown>;
  createdBy: string;
  createdAt?: string;
};

export type SourceAuthoritySnapshot = {
  snapshotId: string;
  sourceRecordId: string;
  version: number;
  retrievalUrl: string;
  contentType: string;
  contentHash: string;
  contentText: string;
  rawMetadata: Record<string, unknown>;
  provenance: SourceRetrievalProvenance;
  retrievedBy: string;
  retrievedAt?: string;
};

export type SourceRetrievalProvenance = {
  provider: SourceAuthorityProvider;
  sourceRecordId: string;
  retrievalUrl: string;
  retrievedAt: string;
  httpStatus: number;
  contentType: string;
  contentLength: number;
  staleSource?: boolean;
  reusedSnapshotId?: string;
  liveRetrievalFailure?: string;
};

export type SourceDiscoveryResult = {
  provider: SourceAuthorityProvider;
  providerRecordId: string;
  canonicalUrl: string;
  title: string;
  description: string | null;
  sourceType: string;
  originUrl: string;
  raw: Record<string, unknown>;
};

export type SourceDiscoveryInput = {
  query: string;
  providers?: SourceAuthorityProvider[];
  limit?: number;
  actor: string;
};

export type SourceRelevanceAssessment = {
  accepted: boolean;
  relevanceScore: number;
  topicalRelevance: number;
  historicalRelevance: number;
  semanticRelevance: number;
  authorityRelevance: number;
  publicationSuitability: number;
  rejectionReasons: string[];
  semanticMismatch: string | null;
};

export type SourceRelevanceDiagnostic = {
  diagnosticId: string;
  provider: SourceAuthorityProvider;
  providerRecordId: string;
  canonicalUrl: string;
  title: string;
  discoveryQuery: string;
  assessment: SourceRelevanceAssessment;
  repositoryEvidence: Record<string, unknown>;
  evaluatedBy: string;
  createdAt?: string;
};

export type SourceRetrievalInput = {
  sourceRecordId: string;
  actor: string;
};
