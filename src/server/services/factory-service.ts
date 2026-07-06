import { randomUUID } from "node:crypto";
import { ApiError } from "@/src/server/api/responses";
import type { EvidenceValidationRecord } from "@/src/server/evidence-validation/contracts";
import type { EditorialEvidenceSet, EditorialEvidenceSubject } from "@/src/server/editorial-intelligence/contracts";
import type { EditorialTimelineCandidate } from "@/src/server/editorial-intelligence/timeline-compiler-contracts";
import {
  buildEditorialCompositionFromExactLineage,
  prepareAndPersistEditorialComposition
} from "@/src/server/editorial-intelligence/editorial-composition-adapter";
import { adaptFactoryMilestonesToCompilerInput } from "@/src/server/editorial-intelligence/timeline-compiler-adapter";
import { compileEditorialTimeline } from "@/src/server/editorial-intelligence/timeline-compiler";
import type {
  FactoryArtifact,
  FactoryArtifactType,
  FactoryAuthorityPreparation,
  FactoryConfidenceLevel,
  FactoryEditorialReview,
  FactoryEditorialReviewLifecycle,
  FactoryFeedbackLifecycle,
  FactoryGovernanceHandoffStatus,
  FactoryObjectLifecycle,
  FactoryObject,
  FactoryObjectType,
  FactoryPackageDraft,
  FactoryPackageDraftLifecycle,
  FactoryPublicationQualityMetrics,
  FactoryPackageVersion,
  FactoryPackageType,
  FactoryPipelineFailure,
  FactoryPipelineRun,
  FactoryPipelineRunStatus,
  FactoryRuntimeExecutionStatus,
  FactoryRuntimeJobStatus,
  FactoryRevisionPlanLifecycle
} from "@/src/server/factory/contracts";
import { canonicalFactoryPipelines, getCanonicalFactoryPipeline } from "@/src/server/factory/pipeline-registry";
import { getFactoryRuntimeProvider, listFactoryRuntimeProviders } from "@/src/server/factory/runtime-providers";
import {
  compactExtractionWorkerOutputContractSchema,
  compactResearchWorkerOutputContractSchema,
  specializeExtractionSchemaForEvidence,
  validateCompactExtractionWorkerOutput,
  validateCompactResearchWorkerOutput,
  validateFactoryWorkerOutput,
  type CompactExtractionWorkerOutput,
  type CompactResearchWorkerOutput,
  type ValidatedFactoryWorkerOutput
} from "@/src/server/factory/output-schemas";
import { getFactoryWorkerPromptTemplate, renderObjectExtractionCompilerPrompt } from "@/src/server/factory/worker-prompts";
import {
  allowedOperationsForWorker,
  canonicalFactoryWorkers,
  getCanonicalFactoryWorker
} from "@/src/server/factory/worker-registry";
import type { AuthorityRef, EvidenceRef, GovernanceActorRef, PublicationPackage } from "@/src/server/governance/contracts";
import type { CorpusDocument, EvidenceRecord } from "@/src/server/research-corpus/contracts";
import type { SourceAuthorityRegistryRecord, SourceAuthoritySnapshot } from "@/src/server/source-authority/contracts";
import { factoryRepository } from "@/src/server/repositories/factory-repository";
import { evidenceValidationRepository } from "@/src/server/repositories/evidence-validation-repository";
import { editorialEvidenceRepository } from "@/src/server/repositories/editorial-evidence-repository";
import { editorialCompositionRepository } from "@/src/server/repositories/editorial-composition-repository";
import { editorialTimelineCandidateRepository } from "@/src/server/repositories/editorial-timeline-candidate-repository";
import { governanceRepository, verifyValidatedEvidenceRefs } from "@/src/server/repositories/governance-repository";
import { sourceAuthorityRepository } from "@/src/server/repositories/source-authority-repository";
import { governanceService } from "@/src/server/services/governance-service";
import { sourceDiscoveryService } from "@/src/server/services/source-discovery-service";
import { sourceRetrievalService } from "@/src/server/services/source-retrieval-service";
import { corpusGenerationService } from "@/src/server/services/corpus-generation-service";
import { evidenceExtractionService } from "@/src/server/services/evidence-extraction-service";
import { evidenceValidationService } from "@/src/server/services/evidence-validation-service";
import { editorialFoundationService } from "@/src/server/services/editorial-foundation-service";
import { withWriteTransaction } from "@/src/server/db/client";

type TransitionMap<T extends string> = Record<T, readonly T[]>;

const objectTransitions: TransitionMap<FactoryObjectLifecycle> = {
  draft: ["researching", "validated", "preserved"],
  researching: ["validated", "validation_failed", "preserved"],
  validated: ["package_candidate", "preserved"],
  validation_failed: ["researching", "preserved"],
  package_candidate: ["packaged", "preserved"],
  packaged: ["submitted_to_governance", "returned_for_revision", "preserved"],
  submitted_to_governance: ["returned_for_revision", "superseded", "preserved"],
  returned_for_revision: ["researching", "validated", "preserved"],
  superseded: ["preserved"],
  preserved: []
};

const packageDraftTransitions: TransitionMap<FactoryPackageDraftLifecycle> = {
  draft: ["validating", "preserved"],
  validating: ["ready_for_governance", "draft", "preserved"],
  ready_for_governance: ["submitted_to_governance", "preserved"],
  submitted_to_governance: ["returned_for_revision", "superseded", "preserved"],
  returned_for_revision: ["revised", "preserved"],
  revised: ["validating", "preserved"],
  superseded: ["preserved"],
  preserved: []
};

const editorialReviewTransitions: TransitionMap<FactoryEditorialReviewLifecycle> = {
  generated: ["validated", "under_editorial_review", "revision_required", "preserved"],
  validated: ["under_editorial_review", "revision_required", "preserved"],
  under_editorial_review: ["editorially_approved", "revision_required", "preserved"],
  revision_required: ["under_editorial_review", "preserved"],
  editorially_approved: ["authority_prepared", "revision_required", "preserved"],
  authority_prepared: ["governance_ready", "revision_required", "preserved"],
  governance_ready: ["preserved"],
  preserved: []
};

const feedbackTransitions: TransitionMap<FactoryFeedbackLifecycle> = {
  received: ["acknowledged", "preserved"],
  acknowledged: ["triaged", "preserved"],
  triaged: ["revision_required", "revision_in_progress", "resolved", "preserved"],
  revision_required: ["revision_in_progress", "preserved"],
  revision_in_progress: ["resubmission_prepared", "resolved", "preserved"],
  resubmission_prepared: ["resolved", "preserved"],
  resolved: ["closed", "preserved"],
  closed: ["preserved"],
  preserved: []
};

const revisionPlanTransitions: TransitionMap<FactoryRevisionPlanLifecycle> = {
  draft: ["approved", "preserved"],
  approved: ["in_progress", "preserved"],
  in_progress: ["resubmission_prepared", "resolved", "preserved"],
  resubmission_prepared: ["resolved", "preserved"],
  resolved: ["closed", "preserved"],
  closed: ["preserved"],
  preserved: []
};

const runtimeJobTransitions: TransitionMap<FactoryRuntimeJobStatus> = {
  queued: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: []
};

const runtimeExecutionTransitions: TransitionMap<FactoryRuntimeExecutionStatus> = {
  created: ["started", "cancelled"],
  started: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: []
};

type ActorInput = {
  actor: string;
  reason: string;
};

export type CreateFactoryObjectInput = ActorInput & {
  objectType: FactoryObjectType;
  title: string;
  payload: Record<string, unknown>;
  provenance: Record<string, unknown>;
};

export type CreateFactoryArtifactInput = ActorInput & {
  factoryObjectId?: string | null;
  artifactType: FactoryArtifactType;
  title: string;
  payload: Record<string, unknown>;
  authoritySafe: boolean;
  modelProvider?: string | null;
  modelName?: string | null;
};

export type CreateFactoryPackageDraftInput = ActorInput & {
  title: string;
  description: string;
  packageType: FactoryPackageType;
  factoryObjectRefs: string[];
  artifactRefs: string[];
  riskSummary: {
    unresolvedAuthorityRisks: string[];
    validationWarnings: string[];
    publicationBlockers: string[];
    qualityMetrics?: FactoryPublicationQualityMetrics;
  };
  supersedesPackageId?: string | null;
};

export type SubmitFactoryPackageVersionInput = {
  packageVersionId: string;
  actor: GovernanceActorRef;
  reason: string;
};

export type IntakeFactoryFeedbackInput = ActorInput & {
  feedbackPackageId: string;
  affectedFactoryObjectIds: string[];
};

export type TransitionFactoryFeedbackInput = ActorInput & {
  feedbackConsumptionId: string;
  lifecycle: FactoryFeedbackLifecycle;
};

export type CreateFactoryRevisionPlanInput = ActorInput & {
  feedbackConsumptionId: string;
  planSummary: string;
  plannedActions: string[];
};

export type PrepareFactoryResubmissionInput = ActorInput & {
  revisionPlanId: string;
  title: string;
  description: string;
};

export type CompleteFactoryResubmissionInput = {
  revisionPlanId: string;
  actor: GovernanceActorRef;
  reason: string;
};

export type RegisterFactoryRuntimeWorkerInput = ActorInput & {
  workerKey: string;
  displayName: string;
  description: string;
  capabilities: string[];
  defaultProviderKey?: string;
};

export type RegisterFactoryRuntimePromptInput = ActorInput & {
  promptKey: string;
  title: string;
  template: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
};

export type QueueFactoryRuntimeJobInput = ActorInput & {
  workerId: string;
  promptId: string;
  providerKey?: string;
  priority?: number;
  input: Record<string, unknown>;
  configuration?: Record<string, unknown>;
};

export type TransitionFactoryRuntimeJobInput = ActorInput & {
  jobId: string;
  status: FactoryRuntimeJobStatus;
};

export type ExecuteFactoryRuntimeJobInput = ActorInput & {
  jobId: string;
};

export type StartFactoryPipelineInput = ActorInput & {
  pipelineId: string;
  input: Record<string, unknown>;
  pipelineRunId?: string;
  maxWorkers?: number;
};

export type CancelFactoryPipelineInput = ActorInput & {
  pipelineRunId: string;
};

export type PrepareFactoryGovernanceHandoffInput = ActorInput & {
  pipelineRunId?: string | null;
  factoryPackageDraftId: string;
};

export type ValidateCandidatePackageInput = ActorInput & {
  factoryPackageDraftId: string;
  reviewer: string;
  evidenceReviewed: unknown[];
  sourcesReviewed: unknown[];
  validationSummary: {
    minimumSourceCount: number;
    minimumEvidenceCount: number;
    sourceDiversity: boolean;
    dateConsistency: boolean;
    chronologyConsistency: boolean;
    relationshipConsistency: boolean;
    objectIdentityConsistency: boolean;
  };
};

export type ReviewCandidatePackageInput = ActorInput & {
  editorialReviewId: string;
  reviewer: string;
};

export type EditorialConfidenceInput = {
  confidenceLevel: FactoryConfidenceLevel;
  confidenceScore: number;
  factors: {
    sourceQuality: number;
    sourceCount: number;
    evidenceCount: number;
    crossSourceAgreement: number;
    chronologicalConsistency: number;
  };
};

export type ApproveEditorialReviewInput = ActorInput & {
  editorialReviewId: string;
  confidence: EditorialConfidenceInput;
};

export type RequireRevisionInput = ActorInput & {
  editorialReviewId: string;
  evidenceReviewed?: unknown[];
  sourcesReviewed?: unknown[];
};

export type PrepareAuthorityRecordsInput = ActorInput & {
  editorialReviewId: string;
  canonicalIdentityMapping: Record<string, unknown>;
  authorityReferences: Record<string, unknown>;
  sourceTraceability: Record<string, unknown>;
  evidenceTraceability: Record<string, unknown>;
  revisionTraceability: Record<string, unknown>;
};

export type AssessGovernanceReadinessInput = ActorInput & {
  editorialReviewId: string;
};

export type SubmitFactoryGovernanceHandoffInput = {
  handoffId: string;
  actor: GovernanceActorRef;
  reason: string;
};

type ValidatedEvidenceContext = {
  sourceRecords: SourceAuthorityRegistryRecord[];
  snapshots: SourceAuthoritySnapshot[];
  corpusDocuments: CorpusDocument[];
  evidenceRecords: EvidenceRecord[];
  validationRecords: EvidenceValidationRecord[];
  validatedEvidenceRefs: EvidenceRef[];
  allowedSourceIds: Set<string>;
  allowedEvidenceRecordIds: Set<string>;
  allowedUrls: Set<string>;
  editorialEvidenceSet: EditorialEvidenceSet | null;
};

type ResearchReasoningContext = {
  subject: string;
  evidence: Array<{
    evidenceRecordId: string;
    normalizedHistoricalClaim: string;
    excerpt?: string;
  }>;
};

type PipelineEvidenceVerifier = (refs: EvidenceRef[], context: string) => Promise<void>;

let pipelineEvidenceVerifier: PipelineEvidenceVerifier = verifyValidatedEvidenceRefs;

export function setFactoryPipelineEvidenceVerifierForTests(verifier: PipelineEvidenceVerifier | null): void {
  pipelineEvidenceVerifier = verifier || verifyValidatedEvidenceRefs;
}

function assertTransitionAllowed<T extends string>(name: string, transitions: TransitionMap<T>, from: T, to: T): void {
  if (!transitions[from]?.includes(to)) {
    throw new ApiError(409, "INVALID_FACTORY_LIFECYCLE_TRANSITION", `${name} cannot transition from ${from} to ${to}.`);
  }
}

function assertNoPublicationBlockers(draft: FactoryPackageDraft): void {
  if (draft.riskSummary.publicationBlockers.length > 0) {
    throw new ApiError(409, "FACTORY_PACKAGE_BLOCKED", "Factory package draft has publication blockers.");
  }
  const quality = draft.riskSummary.qualityMetrics;
  if (!quality || quality.publicationQualityScore < 0.75 || quality.groundingQuality < 1 ||
      quality.authorityCompleteness < 1 || quality.chronologyCompleteness < 1 ||
      quality.citationCompleteness < 1 || quality.confidence < 0.75) {
    throw new ApiError(409, "FACTORY_PUBLICATION_QUALITY_INSUFFICIENT", "Factory package draft does not meet publication-quality thresholds.");
  }
}

function extractionQualityDiagnostics(
  workerKey: string,
  output: ValidatedFactoryWorkerOutput
): FactoryPublicationQualityMetrics & { worker: string; groundingScore: number; qualityScore: number } {
  const candidates = output.candidates;
  const citations = candidates.flatMap((candidate) => candidate.evidence.flatMap((evidence) => evidence.citations));
  const cited = citations.filter((citation) => Boolean(citation.evidenceRecordId));
  const citationCompleteness = citations.length === 0 ? 0 : cited.length / citations.length;
  const chronologyCandidates = candidates.filter((candidate) => candidate.objectType === "candidate_milestone");
  const chronologyCompleteness = chronologyCandidates.every((candidate) => typeof candidate.payload.date === "string") ? 1 : 0;
  const relationshipCandidates = candidates.filter((candidate) =>
    candidate.objectType === "candidate_relationship" || candidate.objectType === "candidate_participation"
  );
  const relationshipCompleteness = relationshipCandidates.every((candidate) =>
    Array.isArray(candidate.payload.sourceRefs) && candidate.payload.sourceRefs.length > 0
  ) ? 1 : 0;
  const groundingQuality = citationCompleteness === 1 && candidates.every((candidate) =>
    Array.isArray(candidate.payload.sourceRefs) && candidate.payload.sourceRefs.length > 0
  ) ? 1 : 0;
  const authorityCompleteness = candidates.length > 0 && candidates.every((candidate) => !payloadContainsPlaceholder(candidate.payload)) ? 1 : 0;
  const publicationQualityScore = (
    groundingQuality + authorityCompleteness + chronologyCompleteness +
    relationshipCompleteness + citationCompleteness + output.confidence
  ) / 6;
  return {
    worker: workerKey,
    groundingScore: groundingQuality,
    qualityScore: publicationQualityScore,
    publicationQualityScore,
    researchQuality: groundingQuality,
    evidenceQuality: citationCompleteness,
    groundingQuality,
    authorityCompleteness,
    chronologyCompleteness,
    citationCompleteness,
    sourceDiversity: 1,
    confidence: output.confidence,
    unsupportedFields: [],
    unsupportedClaims: [],
    unsupportedChronology: [],
    unsupportedRelationships: relationshipCompleteness === 1 ? [] : ["relationship_source_refs"],
    unsupportedCitations: citationCompleteness === 1 ? [] : ["unresolved_evidence_citation"]
  };
}

function assertEditorialValidationPassed(input: ValidateCandidatePackageInput): void {
  const summary = input.validationSummary;
  const failures: string[] = [];
  if (input.sourcesReviewed.length < summary.minimumSourceCount) failures.push("minimum_source_count");
  if (input.evidenceReviewed.length < summary.minimumEvidenceCount) failures.push("minimum_evidence_count");
  if (!summary.sourceDiversity) failures.push("source_diversity");
  if (!summary.dateConsistency) failures.push("date_consistency");
  if (!summary.chronologyConsistency) failures.push("chronology_consistency");
  if (!summary.relationshipConsistency) failures.push("relationship_consistency");
  if (!summary.objectIdentityConsistency) failures.push("object_identity_consistency");
  if (failures.length > 0) {
    throw new ApiError(409, "FACTORY_EDITORIAL_VALIDATION_FAILED", `Candidate package failed editorial validation: ${failures.join(", ")}.`);
  }
}

function assertConfidenceSufficient(confidence: EditorialConfidenceInput): void {
  if (!["high", "verified"].includes(confidence.confidenceLevel) || confidence.confidenceScore < 0.75) {
    throw new ApiError(409, "FACTORY_CONFIDENCE_INSUFFICIENT", "Editorial approval requires high or verified confidence with score >= 0.75.");
  }
}

function assertTraceabilityComplete(input: PrepareAuthorityRecordsInput): void {
  for (const [key, value] of Object.entries({
    canonicalIdentityMapping: input.canonicalIdentityMapping,
    authorityReferences: input.authorityReferences,
    sourceTraceability: input.sourceTraceability,
    evidenceTraceability: input.evidenceTraceability,
    revisionTraceability: input.revisionTraceability
  })) {
    if (Object.keys(value).length === 0) {
      throw new ApiError(409, "FACTORY_AUTHORITY_TRACEABILITY_REQUIRED", `Authority preparation requires ${key}.`);
    }
  }
}

function assertWorkerExecutionPolicy(input: {
  workerKey: string;
  providerKey: string;
  configuration: Record<string, unknown>;
}): void {
  const contract = getCanonicalFactoryWorker(input.workerKey);
  if (!contract) {
    throw new ApiError(409, "FACTORY_WORKER_CONTRACT_REQUIRED", "Factory runtime jobs require a canonical worker contract.");
  }
  if (contract.provider_policy.providerId !== input.providerKey && input.providerKey !== "qwen14") {
    throw new ApiError(409, "FACTORY_WORKER_PROVIDER_FORBIDDEN", "Worker provider is not allowed by provider policy.");
  }
  const requestedOperation = input.configuration.requestedOperation;
  if (typeof requestedOperation === "string" && contract.forbidden_operations.includes(requestedOperation as never)) {
    throw new ApiError(403, "FACTORY_WORKER_OPERATION_FORBIDDEN", "Worker policy forbids the requested operation.");
  }
}

function renderPrompt(template: string, input: Record<string, unknown>, outputSchema: Record<string, unknown>): string {
  const boundary = [
    "You are executing inside TiMELiNES Factory Runtime only.",
    "Generate Factory-owned Production Memory candidates only.",
    "Do not approve, certify, admit to Historical Library, publish, mutate projections, or mutate Platform read models.",
    "Every candidate must include evidence and source attribution.",
    "Return JSON that conforms to the provided output schema."
  ].join("\n");
  return `${boundary}

Output schema:
${JSON.stringify(outputSchema)}

Prompt:
${template.replaceAll("{{input}}", JSON.stringify(input))}`;
}

function authorityGroundedResearchPrompt(template: string): string {
  return `${template}

Authority-grounded execution requirement:
- Use only the provided ResearchReasoningContext.
- Emit compact research only: summary, confidence, boundary, claims, candidates.
- claims must contain claim and supporting evidenceRecordIds only.
- candidates must contain title, objectType, payload, and supporting evidenceRecordIds only.
- Do not emit authority metadata, citation metadata, lineage metadata, or retrieval metadata.
- Factory will hydrate all authority and citation details from stored Source Authority and evidence records.`;
}

function stringArrayField(input: Record<string, unknown>, field: string): string[] {
  const value = input[field];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function sourceUrls(record: SourceAuthorityRegistryRecord, snapshot?: SourceAuthoritySnapshot): string[] {
  return [record.canonicalUrl, record.origin.providerUrl, snapshot?.retrievalUrl]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function evidenceRefFromValidation(record: EvidenceRecord, validation: EvidenceValidationRecord): EvidenceRef {
  return {
    evidenceId: validation.validationRecordId,
    evidenceType: "validated_evidence",
    evidenceRecordId: record.evidenceRecordId,
    validationRecordId: validation.validationRecordId,
    uri: `evidence://${record.evidenceRecordId}#validation=${validation.validationRecordId}`,
    authoritySafe: true
  };
}

async function buildValidatedEvidenceContext(input: StartFactoryPipelineInput): Promise<ValidatedEvidenceContext> {
  const subject = typeof input.input.subject === "string" && input.input.subject.trim()
    ? input.input.subject.trim()
    : typeof input.input.query === "string" && input.input.query.trim()
      ? input.input.query.trim()
      : "";
  if (!subject) {
    throw new ApiError(400, "FACTORY_RESEARCH_SUBJECT_REQUIRED", "Authority-grounded research requires a subject or query.");
  }

  const discovery = await sourceDiscoveryService.discover({
    query: subject,
    providers: Array.isArray(input.input.providers) ? input.input.providers as never : undefined,
    limit: typeof input.input.sourceLimit === "number" ? input.input.sourceLimit : 3,
    actor: input.actor
  });
  if (discovery.records.length === 0) {
    throw new ApiError(409, "SOURCE_AUTHORITY_RECORDS_REQUIRED", "Historical research requires at least one discovered Source Authority record.");
  }

  const sourceRecords: SourceAuthorityRegistryRecord[] = [];
  const snapshots: SourceAuthoritySnapshot[] = [];
  const corpusDocuments: CorpusDocument[] = [];
  const evidenceRecords: EvidenceRecord[] = [];
  const validationRecords: EvidenceValidationRecord[] = [];
  let firstRetrievalFailure: unknown = null;

  for (const sourceRecord of discovery.records) {
    let retrieval: Awaited<ReturnType<typeof sourceRetrievalService.retrieve>>;
    try {
      retrieval = await sourceRetrievalService.retrieve({ sourceRecordId: sourceRecord.sourceRecordId, actor: input.actor });
    } catch (error) {
      firstRetrievalFailure ||= error;
      console.warn(JSON.stringify({
        level: "warn",
        component: "factory_research",
        event: "source_retrieval_skipped",
        sourceRecordId: sourceRecord.sourceRecordId,
        provider: sourceRecord.provider,
        message: error instanceof Error ? error.message : "Source retrieval failed."
      }));
      continue;
    }
    const corpusDocument = await corpusGenerationService.generateFromSourceSnapshot({
      sourceSnapshotId: retrieval.snapshot.snapshotId,
      actor: input.actor
    });
    const extracted = await evidenceExtractionService.extractFromCorpusDocument({
      corpusDocumentId: corpusDocument.corpusDocumentId,
      actor: input.actor,
      maxEvidenceRecords: typeof input.input.maxEvidenceRecordsPerSource === "number" ? input.input.maxEvidenceRecordsPerSource : 5
    });
    const validations = await Promise.all(
      extracted.map((record) => evidenceValidationService.validateEvidence({
        evidenceRecordId: record.evidenceRecordId,
        actor: input.actor,
        topic: subject
      }))
    );

    sourceRecords.push(retrieval.sourceRecord);
    snapshots.push(retrieval.snapshot);
    corpusDocuments.push(corpusDocument);
    evidenceRecords.push(...extracted);
    validationRecords.push(...validations.filter((validation) => validation.status === "passed"));
  }

  if (sourceRecords.length === 0 && firstRetrievalFailure) {
    throw firstRetrievalFailure;
  }

  const passedEvidence = evidenceRecords.filter((record) =>
    validationRecords.some((validation) => validation.evidenceRecordId === record.evidenceRecordId)
  );
  if (passedEvidence.length === 0) {
    throw new ApiError(409, "PASSED_EVIDENCE_REQUIRED", "Historical research requires at least one passed evidence validation record.");
  }

  const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.snapshotId, snapshot]));
  const sourceById = new Map(sourceRecords.map((record) => [record.sourceRecordId, record]));
  const validationByEvidence = new Map(validationRecords.map((validation) => [validation.evidenceRecordId, validation]));
  const allowedSourceIds = new Set<string>();
  const allowedUrls = new Set<string>();
  const allowedEvidenceRecordIds = new Set<string>();
  for (const record of passedEvidence) {
    const source = sourceById.get(record.sourceRecordId)!;
    const snapshot = snapshotById.get(record.sourceSnapshotId);
    allowedSourceIds.add(record.sourceRecordId);
    allowedEvidenceRecordIds.add(record.evidenceRecordId);
    for (const url of sourceUrls(source, snapshot)) {
      allowedUrls.add(url);
    }
  }

  return {
    sourceRecords,
    snapshots,
    corpusDocuments,
    evidenceRecords: passedEvidence,
    validationRecords,
    validatedEvidenceRefs: passedEvidence.map((record) => evidenceRefFromValidation(record, validationByEvidence.get(record.evidenceRecordId)!)),
    allowedSourceIds,
    allowedEvidenceRecordIds,
    allowedUrls,
    editorialEvidenceSet: null
  };
}

function editorialEvidenceSubjects(context: ValidatedEvidenceContext): EditorialEvidenceSubject[] {
  const validations = new Map(context.validationRecords.map((record) => [record.evidenceRecordId, record]));
  const sources = new Map(context.sourceRecords.map((record) => [record.sourceRecordId, record]));
  return context.evidenceRecords.map((evidence) => {
    const validation = validations.get(evidence.evidenceRecordId);
    const source = sources.get(evidence.sourceRecordId);
    if (!validation || validation.status !== "passed" || !source) {
      throw new ApiError(409, "EDITORIAL_EVIDENCE_LINEAGE_INCOMPLETE", "Editorial preparation requires passed validation and Source Authority lineage.");
    }
    const relevance = source.provenance.relevanceAssessment;
    const sourceAuthorityScore = relevance && typeof relevance === "object" &&
      "authorityRelevance" in relevance && typeof relevance.authorityRelevance === "number"
      ? relevance.authorityRelevance
      : 0;
    return {
      evidence,
      validationRecordId: validation.validationRecordId,
      validation: validation.provenance,
      sourceTitle: source.title,
      sourceAuthorityScore
    };
  });
}

function boundedReasoningExcerpt(record: EvidenceRecord): string | undefined {
  const quote = record.quoteText.trim();
  const claim = record.normalizedClaim.trim();
  if (!quote || quote === claim) return undefined;
  return quote.length > 400 ? quote.slice(0, 400) : quote;
}

function buildResearchReasoningContext(input: StartFactoryPipelineInput, context: ValidatedEvidenceContext): ResearchReasoningContext {
  const subject = typeof input.input.subject === "string" && input.input.subject.trim()
    ? input.input.subject.trim()
    : typeof input.input.query === "string" && input.input.query.trim()
      ? input.input.query.trim()
      : "";

  const editorialRanks = new Map(
    context.editorialEvidenceSet?.rankedEvidence.map((item) => [item.evidenceRecordId, item.rank]) || []
  );
  return {
    subject,
    evidence: [...context.evidenceRecords].sort((left, right) => {
      return (editorialRanks.get(left.evidenceRecordId) ?? Number.MAX_SAFE_INTEGER) -
        (editorialRanks.get(right.evidenceRecordId) ?? Number.MAX_SAFE_INTEGER);
    }).map((record) => {
      const item: ResearchReasoningContext["evidence"][number] = {
        evidenceRecordId: record.evidenceRecordId,
        normalizedHistoricalClaim: record.normalizedClaim
      };
      const excerpt = boundedReasoningExcerpt(record);
      if (excerpt) {
        item.excerpt = excerpt;
      }
      return item;
    })
  };
}

function assertAuthorityGroundedOutput(output: ReturnType<typeof validateFactoryWorkerOutput>, context: ValidatedEvidenceContext): void {
  const citations = [
    ...output.sources,
    ...output.evidence.flatMap((evidence) => evidence.citations),
    ...output.candidates.flatMap((candidate) => [
      ...candidate.sources,
      ...candidate.evidence.flatMap((evidence) => evidence.citations)
    ])
  ];

  for (const citation of citations) {
    if (!citation.sourceId || !context.allowedSourceIds.has(citation.sourceId)) {
      throw new ApiError(409, "FACTORY_RESEARCH_CITATION_NOT_AUTHORIZED", "Factory research output contains a citation that does not map to validated evidence.");
    }
    if (!citation.evidenceRecordId || !context.allowedEvidenceRecordIds.has(citation.evidenceRecordId)) {
      throw new ApiError(409, "FACTORY_RESEARCH_EVIDENCE_CITATION_NOT_AUTHORIZED", "Factory research output contains a citation that does not map to a passed evidence record.");
    }
    if (citation.url && !context.allowedUrls.has(citation.url)) {
      throw new ApiError(409, "FACTORY_RESEARCH_URL_NOT_AUTHORIZED", "Factory research output contains a URL that is not present in Source Authority.");
    }
  }
}

function sourcePublisher(source: SourceAuthorityRegistryRecord): string {
  if (source.provider === "wikidata") return "Wikidata";
  if (source.provider === "dbpedia") return "DBpedia";
  if (source.provider === "library_of_congress") return "Library of Congress";
  if (source.provider === "nara") return "National Archives";
  return source.title || "Unknown publisher";
}

function stripAuthorityMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  const forbidden = new Set([
    "sources",
    "source",
    "citations",
    "citation",
    "url",
    "urls",
    "publisher",
    "quote",
    "quoteText",
    "provenance",
    "sourceId",
    "sourceAuthorityRecordId",
    "sourceSnapshotId",
    "validationRecordId"
  ]);
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !forbidden.has(key)));
}

function hydrateCitationFromEvidence(
  evidenceRecordId: string,
  context: ValidatedEvidenceContext,
  evidenceById: Map<string, EvidenceRecord>,
  sourceById: Map<string, SourceAuthorityRegistryRecord>,
  snapshotById: Map<string, SourceAuthoritySnapshot>
): ValidatedFactoryWorkerOutput["sources"][number] {
  const evidence = evidenceById.get(evidenceRecordId);
  if (!evidence) {
    throw new ApiError(409, "FACTORY_RESEARCH_EVIDENCE_NOT_AUTHORIZED", "Factory research output references an unknown evidenceRecordId.");
  }
  const source = sourceById.get(evidence.sourceRecordId);
  if (!source) {
    throw new ApiError(409, "FACTORY_RESEARCH_SOURCE_LINEAGE_MISSING", "Factory research evidence is missing Source Authority lineage.");
  }
  const snapshot = snapshotById.get(evidence.sourceSnapshotId);
  const urls = sourceUrls(source, snapshot);
  const citation: ValidatedFactoryWorkerOutput["sources"][number] = {
    sourceId: source.sourceRecordId,
    evidenceRecordId: evidence.evidenceRecordId,
    title: source.title,
    url: urls[0],
    quote: evidence.quoteText
  };
  if (!citation.url) {
    delete citation.url;
  }
  if (!citation.quote) {
    delete citation.quote;
  }
  if (!context.allowedSourceIds.has(source.sourceRecordId) || !context.allowedEvidenceRecordIds.has(evidence.evidenceRecordId)) {
    throw new ApiError(409, "FACTORY_RESEARCH_EVIDENCE_NOT_AUTHORIZED", "Factory research output references evidence outside the validated authority context.");
  }
  return citation;
}

function hydrateResearchWorkerOutput(output: CompactResearchWorkerOutput, context: ValidatedEvidenceContext): ValidatedFactoryWorkerOutput {
  const evidenceById = new Map(context.evidenceRecords.map((record) => [record.evidenceRecordId, record]));
  const sourceById = new Map(context.sourceRecords.map((record) => [record.sourceRecordId, record]));
  const snapshotById = new Map(context.snapshots.map((snapshot) => [snapshot.snapshotId, snapshot]));
  const citationByEvidenceId = new Map<string, ValidatedFactoryWorkerOutput["sources"][number]>();

  const hydrateCitation = (evidenceRecordId: string) => {
    const existing = citationByEvidenceId.get(evidenceRecordId);
    if (existing) return existing;
    const citation = hydrateCitationFromEvidence(evidenceRecordId, context, evidenceById, sourceById, snapshotById);
    citationByEvidenceId.set(evidenceRecordId, citation);
    return citation;
  };

  const hydratedEvidence = output.claims.map((claim) => ({
    claim: claim.claim,
    citations: claim.evidenceRecordIds.map(hydrateCitation)
  }));

  const candidates = output.candidates.map((candidate) => {
    const citations = candidate.evidenceRecordIds.map(hydrateCitation);
    const primaryEvidence = evidenceById.get(candidate.evidenceRecordIds[0]!);
    const primarySource = primaryEvidence ? sourceById.get(primaryEvidence.sourceRecordId) : null;
    const safePayload = stripAuthorityMetadata(candidate.payload);
    const payload = candidate.objectType === "candidate_source" && primarySource
      ? {
        ...safePayload,
        sourceId: primarySource.sourceRecordId,
        title: primarySource.title,
        url: sourceUrls(primarySource, primaryEvidence ? snapshotById.get(primaryEvidence.sourceSnapshotId) : undefined)[0],
        publisher: sourcePublisher(primarySource),
        credibility: "authority-grounded",
        citationNote: "Hydrated from passed Source Authority evidence by Factory.",
        evidenceSourceRefs: candidate.evidenceRecordIds
      }
      : {
        ...safePayload,
        sourceRefs: candidate.evidenceRecordIds
      };
    return {
      title: candidate.title,
      objectType: candidate.objectType,
      payload,
      evidence: [{
        claim: candidate.title,
        citations
      }],
      sources: citations
    };
  });

  return {
    summary: output.summary,
    confidence: output.confidence,
    boundary: {
      factoryOwned: true,
      publicationAllowed: false,
      governanceSubmissionAllowed: false
    },
    evidence: hydratedEvidence,
    sources: Array.from(citationByEvidenceId.values()),
    candidates
  };
}

function evidenceRefsFromPipelineInput(input: Record<string, unknown>): EvidenceRef[] {
  const refs = input.validatedEvidenceRefs;
  if (!Array.isArray(refs)) return [];
  return refs.filter((ref): ref is EvidenceRef =>
    Boolean(
      ref &&
      typeof ref === "object" &&
      (ref as EvidenceRef).evidenceType === "validated_evidence" &&
      (ref as EvidenceRef).authoritySafe === true &&
      typeof (ref as EvidenceRef).evidenceRecordId === "string" &&
      typeof (ref as EvidenceRef).validationRecordId === "string"
    )
  );
}

function evidenceRefsFromArtifactPayload(payload: Record<string, unknown>): EvidenceRef[] {
  const refs = payload.validatedEvidenceRefs;
  if (!Array.isArray(refs)) return [];
  return refs.filter((ref): ref is EvidenceRef =>
    Boolean(
      ref &&
      typeof ref === "object" &&
      (ref as EvidenceRef).evidenceType === "validated_evidence" &&
      (ref as EvidenceRef).authoritySafe === true &&
      typeof (ref as EvidenceRef).evidenceRecordId === "string" &&
      typeof (ref as EvidenceRef).validationRecordId === "string"
    )
  );
}

async function assertExtractionEvidenceGate(input: StartFactoryPipelineInput): Promise<void> {
  if (input.pipelineId !== "historical_extraction_pipeline") return;
  const refs = evidenceRefsFromPipelineInput(input.input);
  if (refs.length === 0) {
    throw new ApiError(409, "VALIDATED_EVIDENCE_REQUIRED", "Historical extraction requires passed validated evidence from authority-grounded research.");
  }
  await pipelineEvidenceVerifier(refs, "Historical extraction pipeline");
}

const EXTRACTION_WORKERS = new Set([
  "object_extraction_worker",
  "milestone_extraction_worker",
  "participation_extraction_worker",
  "relationship_extraction_worker",
  "context_enrichment_worker"
]);

type ExtractionEvidenceContext = {
  evidenceRecordId: string;
  normalizedClaim: string;
  excerpt?: string;
};

async function buildExtractionEvidenceContext(
  refs: EvidenceRef[],
  options: { boundForObjectCompiler?: boolean } = {}
): Promise<ExtractionEvidenceContext[]> {
  return Promise.all(refs.map(async (ref) => {
    const subject = await evidenceValidationRepository.requireEvidenceSubject(ref.evidenceRecordId!);
    const context: ExtractionEvidenceContext = {
      evidenceRecordId: subject.evidenceRecordId,
      normalizedClaim: options.boundForObjectCompiler
        ? subject.normalizedClaim.slice(0, 500)
        : subject.normalizedClaim
    };
    const excerpt = boundedReasoningExcerpt(subject);
    if (excerpt) context.excerpt = excerpt;
    return context;
  }));
}

async function hydrateExtractionWorkerOutput(
  output: CompactExtractionWorkerOutput,
  refs: EvidenceRef[]
): Promise<ValidatedFactoryWorkerOutput> {
  const allowedIds = new Set(refs.map((ref) => ref.evidenceRecordId).filter((id): id is string => Boolean(id)));
  const requestedIds = [...new Set(output.candidates.flatMap((candidate) => candidate.evidenceRecordIds))];
  const unknownId = requestedIds.find((id) => !allowedIds.has(id));
  if (unknownId) {
    throw new ApiError(409, "EXTRACTION_EVIDENCE_NOT_AUTHORIZED", "Extraction output references evidence outside the supplied Historical Authority context.", {
      evidenceRecordId: unknownId
    });
  }

  const subjects = await Promise.all(requestedIds.map((id) => evidenceValidationRepository.requireEvidenceSubject(id)));
  const evidenceById = new Map(subjects.map((subject) => [subject.evidenceRecordId, subject]));
  const sourceRecordIds = [...new Set(subjects.map((subject) => subject.sourceRecordId))];
  const sourceRecords = await Promise.all(sourceRecordIds.map((id) => sourceAuthorityRepository.requireSourceRecord(id)));
  const sourceById = new Map(sourceRecords.map((source) => [source.sourceRecordId, source]));

  const citationFor = (evidenceRecordId: string) => {
    const subject = evidenceById.get(evidenceRecordId)!;
    const source = sourceById.get(subject.sourceRecordId)!;
    return {
      sourceId: source.sourceRecordId,
      evidenceRecordId,
      title: source.title,
      url: source.canonicalUrl
    };
  };
  const evidenceFor = (evidenceRecordId: string) => {
    const subject = evidenceById.get(evidenceRecordId)!;
    return {
      claim: subject.normalizedClaim,
      citations: [citationFor(evidenceRecordId)]
    };
  };

  return {
    summary: output.summary,
    confidence: output.confidence,
    boundary: {
      factoryOwned: true,
      publicationAllowed: false,
      governanceSubmissionAllowed: false
    },
    sources: sourceRecords.map((source) => ({
      sourceId: source.sourceRecordId,
      title: source.title,
      url: source.canonicalUrl
    })),
    evidence: requestedIds.map(evidenceFor),
    candidates: output.candidates.map((candidate) => ({
      title: candidate.title,
      objectType: candidate.objectType,
      payload: {
        ...candidate.payload,
        sourceRefs: candidate.evidenceRecordIds.map((evidenceRecordId) => {
          const subject = evidenceById.get(evidenceRecordId)!;
          const source = sourceById.get(subject.sourceRecordId)!;
          return {
            evidenceSourceRefs: [evidenceRecordId],
            sourceRecordId: source.sourceRecordId,
            title: source.title,
            canonicalUrl: source.canonicalUrl,
            provider: source.provider,
            provenance: source.provenance
          };
        })
      },
      evidence: candidate.evidenceRecordIds.map(evidenceFor),
      sources: candidate.evidenceRecordIds.map(citationFor)
    }))
  };
}

function groundingTerms(value: string): string[] {
  const stopWords = new Set(["a", "an", "and", "of", "the", "to", "in", "on", "for", "is", "was", "were", "with"]);
  return [...new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(
    (term) => term.length > 2 && !stopWords.has(term)
  ))];
}

function claimGroundingScore(claim: string, quotes: string[]): number {
  const claimTerms = groundingTerms(claim);
  if (claimTerms.length === 0) return 0;
  const evidenceTerms = new Set(groundingTerms(quotes.join(" ")));
  return claimTerms.filter((term) => evidenceTerms.has(term)).length / claimTerms.length;
}

export function milestonePayloadGroundingFailures(input: {
  title: string;
  payload: Record<string, unknown>;
  evidenceTexts: string[];
}): Array<{ unsupportedField: string; chronologyGap?: string; claimGap?: string; groundingScore: number }> {
  const failures: Array<{ unsupportedField: string; chronologyGap?: string; claimGap?: string; groundingScore: number }> = [];
  const date = typeof input.payload.date === "string" ? input.payload.date.trim() : "";
  if (!date || !input.evidenceTexts.some((text) => text.includes(date))) {
    failures.push({ unsupportedField: "date", chronologyGap: date || "missing date", groundingScore: 0 });
  }
  const groundedFields: Array<[string, unknown, number]> = [
    ["title", input.title, 0],
    ["summary", input.payload.summary, 300],
    ["location", input.payload.location, 200],
    ["chronologyPosition", input.payload.chronologyPosition, 200]
  ];
  for (const [field, rawValue, maxLength] of groundedFields) {
    if (rawValue === null || rawValue === undefined || rawValue === "") continue;
    if (typeof rawValue !== "string") {
      failures.push({ unsupportedField: field, claimGap: `${field} must be textual when supplied.`, groundingScore: 0 });
      continue;
    }
    const value = rawValue.trim();
    const score = claimGroundingScore(value, input.evidenceTexts);
    if ((maxLength > 0 && value.length > maxLength) || score < 0.5) {
      failures.push({ unsupportedField: field, claimGap: value, groundingScore: score });
    }
  }
  return failures;
}

function payloadContainsPlaceholder(value: unknown): boolean {
  if (typeof value === "string") {
    return /\b(?:placeholder|unknown entity|missing evidence|insufficient evidence|no specific details available)\b/i.test(value);
  }
  if (Array.isArray(value)) return value.some(payloadContainsPlaceholder);
  if (value && typeof value === "object") return Object.values(value).some(payloadContainsPlaceholder);
  return false;
}

async function assertGroundedExtractionOutput(
  workerKey: string,
  output: ValidatedFactoryWorkerOutput,
  refs: EvidenceRef[]
): Promise<void> {
  if (!EXTRACTION_WORKERS.has(workerKey)) return;
  const allowedIds = new Set(refs.map((ref) => ref.evidenceRecordId).filter((id): id is string => Boolean(id)));
  const subjects = await Promise.all([...allowedIds].map((id) => evidenceValidationRepository.requireEvidenceSubject(id)));
  const evidenceById = new Map(subjects.map((subject) => [subject.evidenceRecordId, subject]));
  const failures: Array<Record<string, unknown>> = [];

  for (const candidate of output.candidates) {
    if (payloadContainsPlaceholder(candidate.payload) || payloadContainsPlaceholder(candidate.title)) {
      failures.push({ artifact: candidate.title, unsupportedField: "payload", evidenceGap: "Placeholder authority is forbidden." });
    }
    const evidence = candidate.evidence.flatMap((item) => item.citations.map((citation) => ({ claim: item.claim, citation })));
    for (const { claim, citation } of evidence) {
      const id = citation.evidenceRecordId;
      const subject = id ? evidenceById.get(id) : null;
      if (!id || !subject) {
        failures.push({ artifact: candidate.title, unsupportedField: "citation", citationGap: "Citation does not resolve to grounded evidence." });
        continue;
      }
      const score = claimGroundingScore(claim, [subject.quoteText, subject.normalizedClaim]);
      if (score < 0.5) {
        failures.push({ artifact: candidate.title, unsupportedField: "claim", claimGap: claim, evidenceRecordId: id, groundingScore: score });
      }
    }
    const sourceRefs = candidate.payload.sourceRefs;
    const referencedIds = Array.isArray(sourceRefs)
      ? sourceRefs.flatMap((ref) =>
        typeof ref === "string"
          ? [ref]
          : ref && typeof ref === "object" && Array.isArray((ref as Record<string, unknown>).evidenceSourceRefs)
            ? ((ref as Record<string, unknown>).evidenceSourceRefs as unknown[]).filter((id): id is string => typeof id === "string")
            : []
      )
      : [];
    if (referencedIds.length === 0 || referencedIds.some((id) => !allowedIds.has(id))) {
      failures.push({ artifact: candidate.title, unsupportedField: "sourceRefs", evidenceGap: "Authority payload does not resolve exclusively to grounded evidence." });
    }
    if (candidate.objectType === "candidate_milestone") {
      const evidenceTexts = evidence.flatMap(({ citation }) => {
        const subject = citation.evidenceRecordId ? evidenceById.get(citation.evidenceRecordId) : null;
        return subject ? [subject.quoteText, subject.normalizedClaim] : [];
      });
      for (const failure of milestonePayloadGroundingFailures({
        title: candidate.title,
        payload: candidate.payload,
        evidenceTexts
      })) {
        failures.push({ artifact: candidate.title, ...failure });
      }
    }
    for (const forbidden of ["publisher", "url", "citation", "citations"]) {
      if (forbidden in candidate.payload) {
        failures.push({ artifact: candidate.title, unsupportedField: forbidden, citationGap: "Extraction payload contains generated authority metadata." });
      }
    }
  }

  if (failures.length > 0) {
    const chronologyFailures = failures.filter((failure) => "chronologyGap" in failure);
    const citationFailures = failures.filter((failure) => "citationGap" in failure);
    const claimFailures = failures.filter((failure) => "claimGap" in failure);
    const totalChecks = Math.max(1, failures.length + output.candidates.length);
    throw new ApiError(409, "EXTRACTION_GROUNDING_FAILED", `${workerKey} emitted authority that is not fully grounded.`, {
      worker: workerKey,
      groundingScore: 0,
      chronologyScore: Math.max(0, 1 - chronologyFailures.length / totalChecks),
      citationScore: Math.max(0, 1 - citationFailures.length / totalChecks),
      claimCoverage: Math.max(0, 1 - claimFailures.length / totalChecks),
      unsupportedFields: failures.map((failure) => failure.unsupportedField).filter(Boolean),
      unsupportedDates: chronologyFailures.map((failure) => failure.chronologyGap),
      unsupportedChronology: chronologyFailures,
      unsupportedClaims: claimFailures.map((failure) => failure.claimGap),
      rejectionReason: "Unsupported extraction output cannot enter Production Memory.",
      failures
    });
  }
}

const clientLineageFields = [
  "artifactRefs",
  "factoryObjectRefs",
  "validatedEvidenceRefs",
  "priorResearchPipelineRunId",
  "priorExtractionPipelineRunId"
] as const;

type PublicationLineage = {
  artifactRefs: string[];
  factoryObjectRefs: string[];
  validatedEvidenceRefs: EvidenceRef[];
  predecessorRunIds: {
    researchPipelineRunId: string;
    extractionPipelineRunId: string;
  };
  editorialEvidenceSetId: string;
  compilerCandidate: EditorialTimelineCandidate;
  persistedCandidate: Awaited<ReturnType<typeof editorialTimelineCandidateRepository.getByFingerprint>>;
  compilerArtifactId: string | null;
  persistedComposition: Awaited<ReturnType<typeof editorialCompositionRepository.getByFingerprint>>;
  compositionArtifactId: string | null;
};

export function pipelineStepsComplete(
  expectedWorkerKeys: string[],
  steps: Array<{ workerKey: string; status: string }>
): boolean {
  if (expectedWorkerKeys.length === 0 || steps.length !== expectedWorkerKeys.length) return false;
  const stepByWorker = new Map(steps.map((step) => [step.workerKey, step.status]));
  return expectedWorkerKeys.every((workerKey) => stepByWorker.get(workerKey) === "completed");
}

function editorialEvidenceSetIdFromArtifacts(artifacts: FactoryArtifact[]): string {
  const ids = artifacts.flatMap((artifact) => {
    const generated = artifact.payload.generated;
    if (!generated || typeof generated !== "object") return [];
    const set = (generated as Record<string, unknown>).editorialEvidenceSet;
    if (!set || typeof set !== "object") return [];
    const id = (set as Record<string, unknown>).editorialEvidenceSetId;
    return typeof id === "string" ? [id] : [];
  });
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== 1) {
    throw new ApiError(409, "PUBLICATION_EDITORIAL_EVIDENCE_LINEAGE_REQUIRED", "Publication requires exactly one Editorial Evidence Set from the pinned research run.");
  }
  return uniqueIds[0]!;
}

function pinnedPublicationLineage(run: FactoryPipelineRun): {
  researchPipelineRunId: string;
  extractionPipelineRunId: string;
  editorialEvidenceSetId: string;
  compilerInputFingerprint: string;
} {
  const value = run.input.factoryResolvedLineage;
  if (!value || typeof value !== "object") {
    throw new ApiError(409, "PUBLICATION_PINNED_LINEAGE_REQUIRED", "Resumed publication requires persisted predecessor lineage.");
  }
  const lineage = value as Record<string, unknown>;
  for (const field of ["researchPipelineRunId", "extractionPipelineRunId", "editorialEvidenceSetId", "compilerInputFingerprint"] as const) {
    if (typeof lineage[field] !== "string" || !lineage[field]) {
      throw new ApiError(409, "PUBLICATION_PINNED_LINEAGE_INCOMPLETE", `Resumed publication lineage is missing ${field}.`);
    }
  }
  return lineage as ReturnType<typeof pinnedPublicationLineage>;
}

async function resolvePublicationLineage(
  input: StartFactoryPipelineInput,
  existingRun: FactoryPipelineRun | null
): Promise<PublicationLineage | null> {
  if (input.pipelineId !== "publication_candidate_pipeline") return null;
  for (const field of clientLineageFields) {
    if (field in input.input) {
      throw new ApiError(400, "FACTORY_LINEAGE_INPUT_FORBIDDEN", `Publication lineage field ${field} is Factory-owned.`);
    }
  }
  const subject = typeof input.input.subject === "string" ? input.input.subject.trim() : "";
  if (subject.length < 2 || subject.length > 300) {
    throw new ApiError(400, "PUBLICATION_INTENT_SUBJECT_REQUIRED", "Publication candidate intent requires a valid subject.");
  }
  const pinned = existingRun ? pinnedPublicationLineage(existingRun) : null;
  const workflowId = typeof input.input.workflowId === "string" ? input.input.workflowId.trim() : "";
  if (existingRun && (
    typeof existingRun.input.subject !== "string" ||
    existingRun.input.subject.trim().toLowerCase() !== subject.toLowerCase() ||
    typeof existingRun.input.workflowId !== "string" ||
    existingRun.input.workflowId !== workflowId
  )) {
    throw new ApiError(409, "PUBLICATION_RESUME_INTENT_MISMATCH", "Resumed publication intent must match its persisted subject and workflow identity.");
  }
  if (!existingRun && !workflowId) {
    throw new ApiError(400, "PUBLICATION_WORKFLOW_ID_REQUIRED", "New publication candidates require an exact Factory workflow identity.");
  }
  const [researchRun, extractionRun] = pinned
    ? await Promise.all([
      factoryRepository.getPipelineRun(pinned.researchPipelineRunId),
      factoryRepository.getPipelineRun(pinned.extractionPipelineRunId)
    ])
    : await Promise.all([
      factoryRepository.getCompletedPipelineRunForWorkflow("historical_research_pipeline", workflowId, subject),
      factoryRepository.getCompletedPipelineRunForWorkflow("historical_extraction_pipeline", workflowId, subject)
    ]);
  if (!researchRun) {
    throw new ApiError(409, "PUBLICATION_RESEARCH_PREDECESSOR_REQUIRED", "Publication requires a completed research pipeline run for the requested subject.");
  }
  if (!extractionRun) {
    throw new ApiError(409, "PUBLICATION_EXTRACTION_PREDECESSOR_REQUIRED", "Publication requires a completed extraction pipeline run for the requested subject.");
  }
  if (researchRun.pipelineId !== "historical_research_pipeline" || researchRun.status !== "completed" ||
      extractionRun.pipelineId !== "historical_extraction_pipeline" || extractionRun.status !== "completed") {
    throw new ApiError(409, "PUBLICATION_PINNED_PREDECESSOR_INVALID", "Pinned publication predecessors must be completed research and extraction runs.");
  }
  if (researchRun.input.workflowId !== workflowId || extractionRun.input.workflowId !== workflowId ||
      String(researchRun.input.subject || "").toLowerCase() !== subject.toLowerCase() ||
      String(extractionRun.input.subject || "").toLowerCase() !== subject.toLowerCase()) {
    throw new ApiError(409, "PUBLICATION_PREDECESSOR_WORKFLOW_MISMATCH", "Publication predecessors must belong to the exact subject workflow.");
  }
  const artifactRefs = Array.from(new Set([...researchRun.artifactRefs, ...extractionRun.artifactRefs]));
  const artifacts = await factoryRepository.getArtifactsByIds(artifactRefs);
  if (artifacts.length !== artifactRefs.length) {
    throw new ApiError(409, "PUBLICATION_ARTIFACT_LINEAGE_INCOMPLETE", "Publication predecessor artifact lineage could not be fully reconstructed.");
  }
  const evidenceByLineage = new Map<string, EvidenceRef>();
  for (const artifact of artifacts) {
    for (const ref of evidenceRefsFromArtifactPayload(artifact.payload)) {
      evidenceByLineage.set(`${ref.evidenceRecordId}:${ref.validationRecordId}`, ref);
    }
  }
  const validatedEvidenceRefs = Array.from(evidenceByLineage.values());
  if (validatedEvidenceRefs.length === 0) {
    throw new ApiError(409, "PUBLICATION_VALIDATED_EVIDENCE_REQUIRED", "Publication predecessor lineage contains no validated evidence.");
  }
  if (extractionRun.factoryObjectRefs.length === 0) {
    throw new ApiError(409, "PUBLICATION_FACTORY_OBJECTS_REQUIRED", "Publication predecessor lineage contains no Factory objects.");
  }
  const researchArtifacts = artifacts.filter((artifact) => researchRun.artifactRefs.includes(artifact.artifactId));
  const editorialEvidenceSetId = editorialEvidenceSetIdFromArtifacts(researchArtifacts);
  if (pinned && pinned.editorialEvidenceSetId !== editorialEvidenceSetId) {
    throw new ApiError(409, "PUBLICATION_EDITORIAL_EVIDENCE_LINEAGE_STALE", "Pinned Editorial Evidence Set no longer matches the research checkpoint.");
  }
  const editorialEvidenceSet = await editorialEvidenceRepository.getById(editorialEvidenceSetId);
  if (!editorialEvidenceSet) {
    throw new ApiError(409, "PUBLICATION_EDITORIAL_EVIDENCE_SET_NOT_FOUND", "Pinned Editorial Evidence Set could not be loaded.");
  }
  const extractionObjects = await factoryRepository.getObjectsByIds(extractionRun.factoryObjectRefs, undefined, 200);
  if (extractionObjects.length !== extractionRun.factoryObjectRefs.length) {
    throw new ApiError(409, "PUBLICATION_EXTRACTION_OBJECT_LINEAGE_INCOMPLETE", "Pinned extraction Factory object lineage is incomplete or exceeds compiler bounds.");
  }
  const milestoneObjects = extractionObjects.filter((object) => object.objectType === "candidate_milestone");
  const compilerCandidate = compileEditorialTimeline(adaptFactoryMilestonesToCompilerInput({
    editorialEvidenceSet,
    milestones: milestoneObjects
  }));
  if (pinned && pinned.compilerInputFingerprint !== compilerCandidate.compilerInputFingerprint) {
    throw new ApiError(409, "PUBLICATION_COMPILER_FINGERPRINT_STALE", "Resumed publication compiler fingerprint does not match pinned inputs.");
  }
  const selectedMilestoneIds = new Set(compilerCandidate.selectedMilestones.map((milestone) => milestone.milestoneId));
  const selectedFactoryObjectRefs = extractionObjects
    .filter((object) => object.objectType !== "candidate_milestone" || selectedMilestoneIds.has(object.objectId))
    .map((object) => object.objectId);
  const existingRunArtifacts = existingRun
    ? await factoryRepository.getArtifactsByIds(existingRun.artifactRefs)
    : [];
  const matchingCompilerArtifacts = existingRun
    ? existingRunArtifacts.filter((artifact) =>
      artifact.factoryObjectId !== null &&
      artifact.payload.compilerInputFingerprint === compilerCandidate.compilerInputFingerprint &&
      artifact.payload.editorialTimelineCandidateId
    )
    : [];
  if (matchingCompilerArtifacts.length > 1) {
    throw new ApiError(409, "PUBLICATION_COMPILER_ARTIFACT_AMBIGUOUS", "Resumed publication contains multiple compiler artifacts for the pinned fingerprint.");
  }
  const existingCompilerArtifact = matchingCompilerArtifacts[0] || null;
  const persistedCandidate = existingCompilerArtifact
    ? await editorialTimelineCandidateRepository.getByFingerprint(editorialEvidenceSetId, compilerCandidate.compilerInputFingerprint)
    : null;
  if (existingCompilerArtifact && !persistedCandidate) {
    throw new ApiError(409, "PUBLICATION_COMPILER_CHECKPOINT_INCOMPLETE", "Compiler artifact cannot resolve its persisted EditorialTimelineCandidate.");
  }
  if (existingCompilerArtifact && persistedCandidate && (
    existingCompilerArtifact.factoryObjectId !== persistedCandidate.factoryObjectId ||
    existingCompilerArtifact.payload.editorialTimelineCandidateId !== persistedCandidate.candidateId
  )) {
    throw new ApiError(409, "PUBLICATION_COMPILER_ARTIFACT_UNRELATED", "Compiler artifact does not belong to the persisted EditorialTimelineCandidate.");
  }
  const matchingCompositionArtifacts = existingRun && persistedCandidate
    ? existingRunArtifacts.filter((artifact) =>
      artifact.factoryObjectId !== null &&
      artifact.payload.editorialTimelineCandidateId === persistedCandidate.candidateId &&
      artifact.payload.editorialCompositionId &&
      artifact.payload.plannerInputFingerprint
    )
    : [];
  if (matchingCompositionArtifacts.length > 1) {
    throw new ApiError(409, "PUBLICATION_COMPOSITION_ARTIFACT_AMBIGUOUS", "Resumed publication contains multiple composition artifacts for the pinned candidate.");
  }
  const existingCompositionArtifact = matchingCompositionArtifacts[0] || null;
  const persistedComposition = existingCompositionArtifact && persistedCandidate
    ? await editorialCompositionRepository.getByFingerprint(
      persistedCandidate.candidateId,
      String(existingCompositionArtifact.payload.plannerInputFingerprint)
    )
    : null;
  if (existingCompositionArtifact && !persistedComposition) {
    throw new ApiError(409, "PUBLICATION_COMPOSITION_CHECKPOINT_INCOMPLETE", "Composition artifact cannot resolve its persisted EditorialComposition.");
  }
  if (existingCompositionArtifact && persistedComposition && (
    existingCompositionArtifact.factoryObjectId !== persistedComposition.factoryObjectId ||
    existingCompositionArtifact.payload.editorialCompositionId !== persistedComposition.compositionId ||
    persistedComposition.editorialEvidenceSetId !== editorialEvidenceSetId ||
    persistedComposition.editorialTimelineCandidateFingerprint !== compilerCandidate.compilerInputFingerprint
  )) {
    throw new ApiError(409, "PUBLICATION_COMPOSITION_ARTIFACT_UNRELATED", "Composition artifact does not belong to the pinned candidate and evidence lineage.");
  }
  if (existingCompositionArtifact && persistedComposition && persistedCandidate) {
    const expectedComposition = buildEditorialCompositionFromExactLineage({
      persistedCandidate,
      editorialEvidenceSet,
      expectedTimelineCandidate: compilerCandidate
    });
    if (persistedComposition.plannerInputFingerprint !== expectedComposition.plannerInputFingerprint ||
        persistedComposition.plannerVersion !== expectedComposition.plannerVersion ||
        persistedComposition.structureAlgorithmVersion !== expectedComposition.structureAlgorithmVersion) {
      throw new ApiError(409, "PUBLICATION_COMPOSITION_FINGERPRINT_STALE", "Resumed composition fingerprint or planner versions do not match pinned inputs.");
    }
  }
  await pipelineEvidenceVerifier(validatedEvidenceRefs, "Publication candidate pipeline");
  return {
    artifactRefs,
    factoryObjectRefs: Array.from(new Set([...researchRun.factoryObjectRefs, ...selectedFactoryObjectRefs])),
    validatedEvidenceRefs,
    predecessorRunIds: {
      researchPipelineRunId: researchRun.pipelineRunId,
      extractionPipelineRunId: extractionRun.pipelineRunId
    },
    editorialEvidenceSetId,
    compilerCandidate,
    persistedCandidate,
    compilerArtifactId: existingCompilerArtifact?.artifactId || null,
    persistedComposition,
    compositionArtifactId: existingCompositionArtifact?.artifactId || null
  };
}

function assertEditorialCompilerCheckpoint(input: {
  publicationLineage: PublicationLineage | null;
  persistedCandidate: NonNullable<PublicationLineage["persistedCandidate"]> | null;
  compilerArtifactId: string | null;
  artifactRefs: string[];
  factoryObjectRefs: string[];
}): void {
  const expected = input.publicationLineage?.compilerCandidate;
  const persisted = input.persistedCandidate;
  if (!expected || !persisted || !input.compilerArtifactId || !input.artifactRefs.includes(input.compilerArtifactId)) {
    throw new ApiError(409, "PUBLICATION_COMPILER_CHECKPOINT_REQUIRED", "Package validation and assembly require a completed EditorialTimelineCandidate compiler checkpoint.");
  }
  if (persisted.editorialEvidenceSetId !== expected.editorialEvidenceSetId ||
      persisted.compilerInputFingerprint !== expected.compilerInputFingerprint) {
    throw new ApiError(409, "PUBLICATION_COMPILER_CHECKPOINT_STALE", "Persisted compiler output does not match pinned publication inputs.");
  }
  const selectedIds = expected.selectedMilestones.map((milestone) => milestone.milestoneId);
  const persistedIds = persisted.selectedMilestones.map((milestone) => milestone.milestoneId);
  if (selectedIds.length !== persistedIds.length ||
      selectedIds.some((id, index) => id !== persistedIds[index]) ||
      selectedIds.some((id) => !input.factoryObjectRefs.includes(id))) {
    throw new ApiError(409, "PUBLICATION_COMPILER_MILESTONE_LINEAGE_INCOMPLETE", "Package lineage does not contain the exact selected compiler milestones.");
  }
  if (input.factoryObjectRefs.includes(persisted.factoryObjectId)) {
    throw new ApiError(409, "PUBLICATION_COMPILER_AUTHORITY_BOUNDARY_VIOLATION", "EditorialTimelineCandidate must remain outside Governance canonical authority inputs.");
  }
}

function assertEditorialCompositionCheckpoint(input: {
  publicationLineage: PublicationLineage | null;
  persistedCandidate: NonNullable<PublicationLineage["persistedCandidate"]> | null;
  persistedComposition: NonNullable<PublicationLineage["persistedComposition"]> | null;
  compilerArtifactId: string | null;
  compositionArtifactId: string | null;
  artifactRefs: string[];
  factoryObjectRefs: string[];
}): void {
  assertEditorialCompilerCheckpoint(input);
  const composition = input.persistedComposition;
  if (!composition || !input.compositionArtifactId || !input.artifactRefs.includes(input.compositionArtifactId)) {
    throw new ApiError(409, "PUBLICATION_COMPOSITION_CHECKPOINT_REQUIRED", "Validation and package assembly require a completed EditorialComposition checkpoint.");
  }
  if (composition.editorialTimelineCandidateId !== input.persistedCandidate!.candidateId ||
      composition.editorialEvidenceSetId !== input.persistedCandidate!.editorialEvidenceSetId ||
      composition.editorialTimelineCandidateFingerprint !== input.persistedCandidate!.compilerInputFingerprint) {
    throw new ApiError(409, "PUBLICATION_COMPOSITION_CHECKPOINT_STALE", "Persisted composition does not match the pinned compiler lineage.");
  }
  const candidateIds = input.persistedCandidate!.selectedMilestones.map((item) => item.milestoneId);
  const compositionIds = composition.phases.flatMap((phase) => phase.milestoneIds);
  if (candidateIds.length !== compositionIds.length ||
      candidateIds.some((id, index) => id !== compositionIds[index]) ||
      compositionIds.some((id) => !input.factoryObjectRefs.includes(id))) {
    throw new ApiError(409, "PUBLICATION_COMPOSITION_MILESTONE_LINEAGE_INCOMPLETE", "Package milestone references must equal EditorialComposition membership.");
  }
  if (input.factoryObjectRefs.includes(composition.factoryObjectId)) {
    throw new ApiError(409, "PUBLICATION_COMPOSITION_AUTHORITY_BOUNDARY_VIOLATION", "EditorialComposition must remain outside Governance canonical authority inputs.");
  }
}

const deterministicResearchSteps = new Set([
  "source_authority_discovery",
  "source_authority_retrieval",
  "research_corpus_generation",
  "evidence_extraction",
  "evidence_validation",
  "editorial_intelligence_foundation"
]);
const deterministicPublicationSteps = new Set(["editorial_timeline_compiler", "editorial_composition_planner"]);

function deterministicStepOutput(workerKey: string, context: ValidatedEvidenceContext): Record<string, unknown> {
  const base = {
    boundary: { factoryOwned: true, publicationAllowed: false, governanceSubmissionAllowed: false },
    validatedEvidenceRefs: context.validatedEvidenceRefs
  };
  if (workerKey === "source_authority_discovery") {
    return { ...base, sourceAuthorityRecords: context.sourceRecords };
  }
  if (workerKey === "source_authority_retrieval") {
    return { ...base, sourceAuthoritySnapshots: context.snapshots };
  }
  if (workerKey === "research_corpus_generation") {
    return {
      ...base,
      corpusDocuments: context.corpusDocuments
    };
  }
  if (workerKey === "evidence_extraction") {
    return { ...base, evidenceRecords: context.evidenceRecords };
  }
  if (workerKey === "evidence_validation") {
    return { ...base, evidenceValidationRecords: context.validationRecords };
  }
  return { ...base, editorialEvidenceSet: context.editorialEvidenceSet };
}

function classifyRuntimeFailure(error: unknown): Record<string, unknown> {
  const message = error instanceof Error ? error.message : "Unexpected Factory runtime provider failure.";
  const diagnostics = error && typeof error === "object" && "diagnostics" in error && typeof error.diagnostics === "object" && error.diagnostics
    ? (error.diagnostics as Record<string, unknown>)
    : {};
  const abortName = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  const diagnosticFailureClass = typeof diagnostics.failureClass === "string" ? diagnostics.failureClass : null;
  const failureClass = diagnosticFailureClass === "provider_timeout_failed" || abortName === "AbortError" || message.includes("timed out") || message.includes("aborted")
    ? "provider_timeout_failed"
    : diagnosticFailureClass === "output_validation_failed"
    ? "output_validation_failed"
    : message.includes("validation") || message.includes("required") || message.includes("Invalid")
      || message.includes("missing") || message.includes("forbidden candidate") || message.includes("unknown sourceId")
    ? "output_validation_failed"
    : diagnosticFailureClass
      ? diagnosticFailureClass
    : message.includes("Ollama") || message.includes("Qwen14")
      ? "provider_execution_failed"
      : "runtime_execution_failed";
  return { ...diagnostics, failureClass, message };
}

function errorDiagnostics(error: unknown): Record<string, unknown> {
  return error && typeof error === "object" && "diagnostics" in error && typeof error.diagnostics === "object" && error.diagnostics
    ? { ...(error.diagnostics as Record<string, unknown>) }
    : {};
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorStack(error: unknown): string | null {
  return error instanceof Error ? error.stack || null : null;
}

function errorCode(error: unknown): string | null {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : null;
}

function errorStatus(error: unknown): number | null {
  return error instanceof ApiError ? error.status : null;
}

function freezeFailure(failure: FactoryPipelineFailure): FactoryPipelineFailure {
  Object.freeze(failure.retryHistory);
  Object.freeze(failure.cleanupDiagnostics);
  Object.freeze(failure.diagnostics);
  return Object.freeze(failure);
}

function createPipelineFailure(input: {
  error: unknown;
  pipelineRunId: string;
  pipelineStepId?: string | null;
  workerKey?: string | null;
  stepIndex?: number | null;
  stage: string;
  retryHistory?: Array<Record<string, unknown>>;
}): FactoryPipelineFailure {
  const diagnostics = errorDiagnostics(input.error);
  const classified = classifyRuntimeFailure(input.error);
  return freezeFailure({
    failureId: randomUUID(),
    pipelineRunId: input.pipelineRunId,
    pipelineStepId: input.pipelineStepId || null,
    workerKey: input.workerKey || null,
    stepIndex: typeof input.stepIndex === "number" ? input.stepIndex : null,
    stage: input.stage,
    failureClass: String(classified.failureClass || "runtime_execution_failed"),
    originalName: errorName(input.error),
    originalMessage: errorMessage(input.error),
    originalStack: errorStack(input.error),
    originalCode: errorCode(input.error),
    originalStatus: errorStatus(input.error),
    retryHistory: input.retryHistory || [],
    diagnostics,
    cleanupDiagnostics: [],
    failedAt: new Date().toISOString()
  });
}

function appendCleanupDiagnostic(failure: FactoryPipelineFailure, diagnostic: Record<string, unknown>): FactoryPipelineFailure {
  return freezeFailure({
    ...failure,
    cleanupDiagnostics: [
      ...failure.cleanupDiagnostics,
      {
        ...diagnostic,
        failedAt: new Date().toISOString()
      }
    ]
  });
}

function factoryPipelineFailureError(failure: FactoryPipelineFailure): ApiError {
  return new ApiError(
    failure.originalStatus || 502,
    "FACTORY_PIPELINE_FAILED",
    `Factory pipeline failed: ${failure.originalMessage}`,
    { failure }
  );
}

async function finalizePipelineFailure(input: {
  failure: FactoryPipelineFailure;
  actor: string;
  reason: string;
  artifactRefs: string[];
  factoryObjectRefs: string[];
  packageDraftId: string | null;
}): Promise<never> {
  let failure = input.failure;
  let failedStep: unknown = null;

  if (failure.pipelineStepId) {
    try {
      failedStep = await factoryRepository.transitionPipelineStep({
        pipelineStepId: failure.pipelineStepId,
        status: "failed",
        output: failure as unknown as Record<string, unknown>
      });
    } catch (cleanupError) {
      failure = appendCleanupDiagnostic(failure, {
        operation: "transitionPipelineStep",
        message: errorMessage(cleanupError),
        stack: errorStack(cleanupError)
      });
    }
  }

  try {
    await factoryRepository.transitionPipelineRun({
      pipelineRunId: failure.pipelineRunId,
      status: "failed",
      actor: input.actor,
      artifactRefs: input.artifactRefs,
      factoryObjectRefs: input.factoryObjectRefs,
      packageDraftId: input.packageDraftId
    });
  } catch (cleanupError) {
    failure = appendCleanupDiagnostic(failure, {
      operation: "transitionPipelineRun",
      message: errorMessage(cleanupError),
      stack: errorStack(cleanupError)
    });
  }

  try {
    await factoryRepository.createRuntimeAuditRecord({
      targetRef: { authorityType: "factory_runtime_execution", authorityId: failure.pipelineStepId || failure.pipelineRunId },
      action: "fail_pipeline_step",
      actor: input.actor,
      reason: input.reason,
      afterState: {
        failure,
        failedStep
      }
    });
  } catch (cleanupError) {
    failure = appendCleanupDiagnostic(failure, {
      operation: "createRuntimeAuditRecord",
      message: errorMessage(cleanupError),
      stack: errorStack(cleanupError)
    });
    console.error(JSON.stringify({
      level: "error",
      component: "factory_pipeline",
      message: "Factory pipeline failure audit persistence failed.",
      failure
    }));
  }

  throw factoryPipelineFailureError(failure);
}

function withAttemptDiagnostics(error: unknown, diagnostics: Record<string, unknown>): unknown {
  if (error && typeof error === "object") {
    const current = "diagnostics" in error && typeof error.diagnostics === "object" && error.diagnostics
      ? (error.diagnostics as Record<string, unknown>)
      : {};
    const details = error instanceof ApiError && error.details && typeof error.details === "object"
      ? (error.details as Record<string, unknown>)
      : {};
    Object.assign(error, {
      diagnostics: {
        ...diagnostics,
        ...details,
        ...current
      }
    });
  }
  return error;
}

function candidateObjectTypeForWorker(workerKey: string): FactoryObjectType | null {
  const contract = getCanonicalFactoryWorker(workerKey);
  return contract?.allowed_object_types[0] || null;
}

function artifactTypeForWorker(workerKey: string): FactoryArtifactType {
  return workerKey === "validation_worker" || workerKey === "source_validation_worker" ? "validation" : "generation";
}

function pipelineStepOutput(input: {
  pipelineId: string;
  pipelineRunId: string;
  workerKey: string;
  stepIndex: number;
  previousArtifactRefs: string[];
  previousFactoryObjectRefs: string[];
}): Record<string, unknown> {
  return {
    pipelineId: input.pipelineId,
    pipelineRunId: input.pipelineRunId,
    workerKey: input.workerKey,
    stepIndex: input.stepIndex,
    candidateGenerated: true,
    publicationAllowed: false,
    governanceSubmissionAllowed: false,
    previousArtifactRefs: input.previousArtifactRefs,
    previousFactoryObjectRefs: input.previousFactoryObjectRefs
  };
}

export function assertFactoryCannotCertifyReadiness(): never {
  throw new ApiError(403, "FACTORY_CERTIFICATION_FORBIDDEN", "Factory cannot certify publication readiness.");
}

export function assertFactoryCannotApprovePackage(): never {
  throw new ApiError(403, "FACTORY_APPROVAL_FORBIDDEN", "Factory cannot approve Publication Packages.");
}

export function assertFactoryCannotRejectPackage(): never {
  throw new ApiError(403, "FACTORY_REJECTION_FORBIDDEN", "Factory cannot reject Publication Packages.");
}

export function assertFactoryCannotAdmitToHistoricalLibrary(): never {
  throw new ApiError(403, "FACTORY_LIBRARY_ADMISSION_FORBIDDEN", "Factory cannot admit records into Historical Library.");
}

export function assertFactoryCannotPublish(): never {
  throw new ApiError(403, "FACTORY_PUBLICATION_FORBIDDEN", "Factory cannot publish records or mutate public read models.");
}

export const factoryService = {
  discoverExternalSources: sourceDiscoveryService.discover,
  retrieveExternalSource: sourceRetrievalService.retrieve,
  generateCorpusDocument: corpusGenerationService.generateFromSourceSnapshot,
  extractEvidenceRecords: evidenceExtractionService.extractFromCorpusDocument,
  toFactoryEvidenceReferences: evidenceExtractionService.toFactoryEvidenceReferences,
  validateEvidenceRecord: evidenceValidationService.validateEvidence,

  listPipelineDefinitions() {
    return canonicalFactoryPipelines;
  },

  async getPipelineValidatedEvidence(pipelineRunId: string): Promise<EvidenceRef[]> {
    const run = await factoryRepository.getPipelineRun(pipelineRunId);
    if (!run || run.status !== "completed") {
      throw new ApiError(409, "FACTORY_PIPELINE_NOT_COMPLETED", "Validated evidence is available only from a completed Factory pipeline.");
    }
    const artifacts = await factoryRepository.getArtifactsByIds(run.artifactRefs);
    const refs = artifacts.flatMap((artifact) => evidenceRefsFromArtifactPayload(artifact.payload));
    const unique = Array.from(new Map(refs.map((ref) => [`${ref.evidenceRecordId}:${ref.validationRecordId}`, ref])).values());
    await pipelineEvidenceVerifier(unique, "Factory operations extraction handoff");
    return unique;
  },

  async assertEditorialBoundaryCompleted(factoryPackageDraftId: string): Promise<void> {
    const review = await factoryRepository.getLatestEditorialReviewForPackage(factoryPackageDraftId);
    if (!review || review.lifecycle !== "governance_ready") {
      throw new ApiError(409, "FOUNDER_REVIEW_INCOMPLETE", "The certified Factory editorial workflow has not reached governance readiness.");
    }
  },

  async applyEditorialReviewPolicy(input: {
    factoryPackageDraftId: string;
    researchPipelineRunId: string;
    extractionPipelineRunId: string;
    actor: string;
  }): Promise<{ outcome: "routine" | "exceptional"; reasons: string[]; reviewId?: string }> {
    const [draft, researchRun, extractionRun] = await Promise.all([
      factoryRepository.getPackageDraft(input.factoryPackageDraftId),
      factoryRepository.getPipelineRun(input.researchPipelineRunId),
      factoryRepository.getPipelineRun(input.extractionPipelineRunId)
    ]);
    const evidence = researchRun?.status === "completed"
      ? await factoryService.getPipelineValidatedEvidence(input.researchPipelineRunId)
      : [];
    const reasons: string[] = [];
    if (!draft) reasons.push("package_draft_missing");
    if (researchRun?.status !== "completed") reasons.push("research_incomplete");
    if (extractionRun?.status !== "completed") reasons.push("extraction_incomplete");
    if (evidence.length < 2) reasons.push("insufficient_evidence");
    if (!draft?.artifactRefs.length) reasons.push("validation_artifacts_missing");
    if (!draft?.factoryObjectRefs.length) reasons.push("candidate_authority_missing");
    const quality = draft?.riskSummary.qualityMetrics;
    if (!quality) reasons.push("publication_quality_metrics_missing");
    if (quality && quality.groundingQuality < 1) reasons.push("grounded_extraction_incomplete");
    if (quality && quality.authorityCompleteness < 1) reasons.push("unresolved_authority");
    if (quality && quality.chronologyCompleteness < 1) reasons.push("unsupported_chronology");
    if (quality && quality.citationCompleteness < 1) reasons.push("unsupported_citations");
    if (quality && quality.sourceDiversity < 1) reasons.push("source_diversity_insufficient");
    if (quality && quality.confidence < 0.75) reasons.push("publication_confidence_insufficient");
    if (draft?.riskSummary.publicationBlockers.length) reasons.push(...draft.riskSummary.publicationBlockers);
    if (draft?.riskSummary.unresolvedAuthorityRisks.length) reasons.push("unresolved_authority_risks");
    if (reasons.length > 0 || !draft) return { outcome: "exceptional", reasons };

    const policyReason = "Deterministic routine editorial policy: certified pipelines, validated evidence, candidate authority, and validation artifacts are complete.";
    const reviewedEvidence = evidence.map((item) => ({ evidenceRecordId: item.evidenceRecordId, validationRecordId: item.validationRecordId }));
    const reviewedSources = evidence.map((item) => ({ evidenceRecordId: item.evidenceRecordId, uri: item.uri }));
    const review = await factoryService.validateCandidatePackage({
      factoryPackageDraftId: draft.packageDraftId,
      reviewer: "editorial-policy",
      evidenceReviewed: reviewedEvidence,
      sourcesReviewed: reviewedSources,
      validationSummary: {
        minimumSourceCount: 2, minimumEvidenceCount: 2, sourceDiversity: true,
        dateConsistency: quality!.chronologyCompleteness === 1,
        chronologyConsistency: quality!.chronologyCompleteness === 1,
        relationshipConsistency: quality!.unsupportedRelationships.length === 0,
        objectIdentityConsistency: quality!.authorityCompleteness === 1
      },
      actor: input.actor, reason: policyReason
    });
    await factoryService.reviewCandidatePackage({ editorialReviewId: review.reviewId, reviewer: "editorial-policy", actor: input.actor, reason: policyReason });
    const countScore = Math.min(1, evidence.length / 5);
    await factoryService.approveEditorialReview({
      editorialReviewId: review.reviewId, actor: input.actor, reason: policyReason,
      confidence: {
        confidenceLevel: "verified", confidenceScore: quality!.confidence,
        factors: { sourceQuality: quality!.evidenceQuality, sourceCount: countScore, evidenceCount: countScore, crossSourceAgreement: quality!.groundingQuality, chronologicalConsistency: quality!.chronologyCompleteness }
      }
    });
    const authorityRefs = Object.fromEntries(draft.factoryObjectRefs.map((id, index) => [`candidate_${index}`, id]));
    const evidenceTraceability = Object.fromEntries(evidence.map((item, index) => [`evidence_${index}`, item]));
    await factoryService.prepareAuthorityRecords({
      editorialReviewId: review.reviewId,
      canonicalIdentityMapping: authorityRefs,
      authorityReferences: authorityRefs,
      sourceTraceability: Object.fromEntries(reviewedSources.map((item, index) => [`source_${index}`, item])),
      evidenceTraceability,
      revisionTraceability: { packageDraftId: draft.packageDraftId, researchPipelineRunId: input.researchPipelineRunId, extractionPipelineRunId: input.extractionPipelineRunId },
      actor: input.actor, reason: policyReason
    });
    await factoryService.assessGovernanceReadiness({ editorialReviewId: review.reviewId, actor: input.actor, reason: policyReason });
    return { outcome: "routine", reasons: [], reviewId: review.reviewId };
  },

  async continueEditorialPackageToGovernanceReady(factoryPackageDraftId: string): Promise<void> {
    const draft = await factoryRepository.getPackageDraft(factoryPackageDraftId);
    if (!draft) throw new ApiError(404, "FACTORY_PACKAGE_DRAFT_NOT_FOUND", "Factory package draft not found.");
    if (draft.lifecycle === "ready_for_governance" || draft.lifecycle === "submitted_to_governance") return;
    if (draft.lifecycle === "draft") {
      await factoryService.transitionPackageDraft({ packageDraftId: factoryPackageDraftId, lifecycle: "validating", actor: "factory-operations", reason: "PE-002 certified editorial continuation" });
    } else if (draft.lifecycle !== "validating") {
      throw new ApiError(409, "FACTORY_PACKAGE_CONTINUATION_BLOCKED", `Package lifecycle ${draft.lifecycle} cannot continue to Governance.`);
    }
    await factoryService.transitionPackageDraft({ packageDraftId: factoryPackageDraftId, lifecycle: "ready_for_governance", actor: "factory-operations", reason: "PE-002 certified editorial continuation" });
  },

  async getGovernancePublicationPackage(packageId: string) {
    return governanceRepository.getPublicationPackage(packageId);
  },

  async getGovernanceHandoffByDraft(factoryPackageDraftId: string) {
    return factoryRepository.getGovernanceHandoffByDraft(factoryPackageDraftId);
  },

  async listPipelineRuns(status?: FactoryPipelineRunStatus, limit = 100) {
    return factoryRepository.listPipelineRuns(status, limit);
  },

  async startPipeline(input: StartFactoryPipelineInput) {
    const pipeline = getCanonicalFactoryPipeline(input.pipelineId);
    if (!pipeline) {
      throw new ApiError(404, "FACTORY_PIPELINE_NOT_FOUND", "Factory pipeline definition not found.");
    }
    await assertExtractionEvidenceGate(input);
    const existingRun = input.pipelineRunId
      ? await factoryRepository.getPipelineRun(input.pipelineRunId)
      : null;
    if (input.pipelineRunId && (!existingRun || existingRun.pipelineId !== pipeline.pipelineId)) {
      throw new ApiError(409, "FACTORY_PIPELINE_RESUME_MISMATCH", "Pipeline resume requires the matching persisted run.");
    }
    if (existingRun?.status === "completed") {
      return existingRun;
    }
    if (existingRun && existingRun.status !== "running") {
      throw new ApiError(409, "FACTORY_PIPELINE_NOT_RESUMABLE", `Pipeline run in ${existingRun.status} state cannot resume.`);
    }
    const publicationLineage = await resolvePublicationLineage(input, existingRun);
    const missingWorker = pipeline.steps.find((workerKey) =>
      !deterministicResearchSteps.has(workerKey) &&
      !deterministicPublicationSteps.has(workerKey) &&
      !getCanonicalFactoryWorker(workerKey)
    );
    if (missingWorker) {
      throw new ApiError(409, "FACTORY_PIPELINE_WORKER_MISSING", `Pipeline worker ${missingWorker} is not registered in the canonical worker registry.`);
    }
    const run = existingRun || await factoryRepository.createPipelineRun({
      pipelineId: pipeline.pipelineId,
      input: publicationLineage
        ? {
          ...input.input,
          factoryResolvedLineage: {
            ...publicationLineage.predecessorRunIds,
            editorialEvidenceSetId: publicationLineage.editorialEvidenceSetId,
            compilerInputFingerprint: publicationLineage.compilerCandidate.compilerInputFingerprint
          }
        }
        : input.input,
      actor: input.actor
    });
    const completedSteps = existingRun ? await factoryRepository.listPipelineSteps(run.pipelineRunId) : [];
    const artifactRefs: string[] = existingRun ? [...run.artifactRefs] : [...(publicationLineage?.artifactRefs || [])];
    const factoryObjectRefs: string[] = existingRun ? [...run.factoryObjectRefs] : [...(publicationLineage?.factoryObjectRefs || [])];
    let packageDraftId: string | null = run.packageDraftId;
    let validatedEvidenceContext: ValidatedEvidenceContext | null = null;
    let persistedTimelineCandidate = publicationLineage?.persistedCandidate || null;
    let compilerArtifactId = publicationLineage?.compilerArtifactId || null;
    let persistedEditorialComposition = publicationLineage?.persistedComposition || null;
    let compositionArtifactId = publicationLineage?.compositionArtifactId || null;

    if (existingRun && pipelineStepsComplete(pipeline.steps, completedSteps)) {
      const completedRun = await factoryRepository.transitionPipelineRun({
        pipelineRunId: run.pipelineRunId,
        status: "completed",
        actor: input.actor,
        artifactRefs,
        factoryObjectRefs,
        packageDraftId
      });
      await factoryRepository.createRuntimeAuditRecord({
        targetRef: { authorityType: "factory_runtime_execution", authorityId: completedRun.pipelineRunId },
        action: "complete_pipeline_run",
        actor: input.actor,
        reason: input.reason,
        afterState: completedRun as unknown as Record<string, unknown>
      });
      return completedRun;
    }

    try {
    if (!existingRun) await factoryRepository.createRuntimeAuditRecord({
      targetRef: { authorityType: "factory_runtime_execution", authorityId: run.pipelineRunId },
      action: "create_pipeline_run",
      actor: input.actor,
      reason: input.reason,
      afterState: run as unknown as Record<string, unknown>
    });
    if (!existingRun) await factoryRepository.transitionPipelineRun({ pipelineRunId: run.pipelineRunId, status: "running", actor: input.actor });

    const nextStepIndex = completedSteps.filter((step) => step.status === "completed").length;
    const workerLimit = Math.max(1, input.maxWorkers ?? pipeline.steps.length);
    for (const [stepIndex, workerKey] of pipeline.steps.entries()) {
      if (stepIndex < nextStepIndex) continue;
      if (stepIndex >= nextStepIndex + workerLimit) break;
      const executionKey = `${run.pipelineRunId}:${stepIndex}:${workerKey}`;
      const step = await factoryRepository.createPipelineStep({
        pipelineRunId: run.pipelineRunId,
        stepIndex,
        workerKey,
        input: {
          pipelineInput: input.input,
          artifactRefs,
          factoryObjectRefs,
          executionKey
        }
      });
      await factoryRepository.transitionPipelineStep({ pipelineStepId: step.pipelineStepId, status: "running" });

      if (deterministicPublicationSteps.has(workerKey)) {
        if (!publicationLineage) {
          throw new ApiError(409, "PUBLICATION_COMPILER_LINEAGE_REQUIRED", "Editorial timeline compilation requires pinned publication lineage.");
        }
        if (workerKey === "editorial_composition_planner") {
          assertEditorialCompilerCheckpoint({
            publicationLineage,
            persistedCandidate: persistedTimelineCandidate,
            compilerArtifactId,
            artifactRefs,
            factoryObjectRefs
          });
          try {
            let committedArtifactId: string | null = null;
            await withWriteTransaction("committing EditorialComposition planner checkpoint", async () => {
              persistedEditorialComposition = await prepareAndPersistEditorialComposition({
                editorialTimelineCandidateId: persistedTimelineCandidate!.candidateId,
                editorialEvidenceSetId: publicationLineage.editorialEvidenceSetId,
                expectedTimelineCandidate: publicationLineage.compilerCandidate,
                actor: input.actor
              });
              const stepOutput = {
                ...pipelineStepOutput({
                  pipelineId: pipeline.pipelineId,
                  pipelineRunId: run.pipelineRunId,
                  workerKey,
                  stepIndex,
                  previousArtifactRefs: artifactRefs,
                  previousFactoryObjectRefs: factoryObjectRefs
                }),
                executionKey,
                editorialCompositionId: persistedEditorialComposition.compositionId,
                editorialCompositionFactoryObjectId: persistedEditorialComposition.factoryObjectId,
                editorialTimelineCandidateId: persistedEditorialComposition.editorialTimelineCandidateId,
                editorialEvidenceSetId: persistedEditorialComposition.editorialEvidenceSetId,
                plannerInputFingerprint: persistedEditorialComposition.plannerInputFingerprint,
                plannerVersion: persistedEditorialComposition.plannerVersion,
                structureAlgorithmVersion: persistedEditorialComposition.structureAlgorithmVersion,
                selectedMilestoneRefs: persistedEditorialComposition.phases.flatMap((phase) => phase.milestoneIds),
                predecessorRunIds: publicationLineage.predecessorRunIds,
                boundary: {
                  factoryOwned: true,
                  authorityDecision: false,
                  publicationReadinessDecision: false
                }
              };
              const artifact = await factoryRepository.createArtifact({
                factoryObjectId: persistedEditorialComposition.factoryObjectId,
                artifactType: "generation",
                title: "EditorialComposition planner output",
                payload: stepOutput,
                authoritySafe: false,
                actor: input.actor
              });
              const checkpointArtifactRefs = [...artifactRefs, artifact.artifactId];
              const completedStep = await factoryRepository.transitionPipelineStep({
                pipelineStepId: step.pipelineStepId,
                status: "completed",
                output: stepOutput,
                artifactRefs: checkpointArtifactRefs,
                factoryObjectRefs: [...factoryObjectRefs]
              });
              await factoryRepository.createRuntimeAuditRecord({
                targetRef: { authorityType: "factory_runtime_execution", authorityId: completedStep.pipelineStepId },
                action: "complete_editorial_composition_planner",
                actor: input.actor,
                reason: input.reason,
                afterState: completedStep as unknown as Record<string, unknown>
              });
              await factoryRepository.transitionPipelineRun({
                pipelineRunId: run.pipelineRunId,
                status: stepIndex === pipeline.steps.length - 1 ? "completed" : "running",
                actor: input.actor,
                artifactRefs: checkpointArtifactRefs,
                factoryObjectRefs,
                packageDraftId
              });
              committedArtifactId = artifact.artifactId;
            });
            compositionArtifactId = committedArtifactId;
            artifactRefs.push(committedArtifactId!);
          } catch (error) {
            await finalizePipelineFailure({
              failure: createPipelineFailure({
                error,
                pipelineRunId: run.pipelineRunId,
                pipelineStepId: step.pipelineStepId,
                workerKey,
                stepIndex,
                stage: "editorial_composition_planning"
              }),
              actor: input.actor,
              reason: input.reason,
              artifactRefs,
              factoryObjectRefs,
              packageDraftId
            });
          }
          continue;
        }
        try {
          let committedArtifactId: string | null = null;
          await withWriteTransaction("committing EditorialTimelineCandidate compiler checkpoint", async () => {
            persistedTimelineCandidate = await editorialTimelineCandidateRepository.create({
              candidate: publicationLineage.compilerCandidate,
              actor: input.actor
            });
            const stepOutput = {
              ...pipelineStepOutput({
                pipelineId: pipeline.pipelineId,
                pipelineRunId: run.pipelineRunId,
                workerKey,
                stepIndex,
                previousArtifactRefs: artifactRefs,
                previousFactoryObjectRefs: factoryObjectRefs
              }),
              executionKey,
              editorialTimelineCandidateId: persistedTimelineCandidate.candidateId,
              editorialTimelineFactoryObjectId: persistedTimelineCandidate.factoryObjectId,
              editorialEvidenceSetId: persistedTimelineCandidate.editorialEvidenceSetId,
              compilerInputFingerprint: persistedTimelineCandidate.compilerInputFingerprint,
              selectedMilestoneRefs: persistedTimelineCandidate.selectedMilestones.map((milestone) => milestone.milestoneId),
              predecessorRunIds: publicationLineage.predecessorRunIds,
              boundary: {
                factoryOwned: true,
                authorityDecision: false,
                publicationReadinessDecision: false
              }
            };
            const artifact = await factoryRepository.createArtifact({
              factoryObjectId: persistedTimelineCandidate.factoryObjectId,
              artifactType: "generation",
              title: "EditorialTimelineCandidate compiler output",
              payload: stepOutput,
              authoritySafe: false,
              actor: input.actor
            });
            const checkpointArtifactRefs = [...artifactRefs, artifact.artifactId];
            const completedStep = await factoryRepository.transitionPipelineStep({
              pipelineStepId: step.pipelineStepId,
              status: "completed",
              output: stepOutput,
              artifactRefs: checkpointArtifactRefs,
              factoryObjectRefs: [...factoryObjectRefs]
            });
            await factoryRepository.createRuntimeAuditRecord({
              targetRef: { authorityType: "factory_runtime_execution", authorityId: completedStep.pipelineStepId },
              action: "complete_editorial_timeline_compiler",
              actor: input.actor,
              reason: input.reason,
              afterState: completedStep as unknown as Record<string, unknown>
            });
            await factoryRepository.transitionPipelineRun({
              pipelineRunId: run.pipelineRunId,
              status: stepIndex === pipeline.steps.length - 1 ? "completed" : "running",
              actor: input.actor,
              artifactRefs: checkpointArtifactRefs,
              factoryObjectRefs,
              packageDraftId
            });
            committedArtifactId = artifact.artifactId;
          });
          compilerArtifactId = committedArtifactId;
          artifactRefs.push(committedArtifactId!);
        } catch (error) {
          await finalizePipelineFailure({
            failure: createPipelineFailure({
              error,
              pipelineRunId: run.pipelineRunId,
              pipelineStepId: step.pipelineStepId,
              workerKey,
              stepIndex,
              stage: "editorial_timeline_compilation"
            }),
            actor: input.actor,
            reason: input.reason,
            artifactRefs,
            factoryObjectRefs,
            packageDraftId
          });
        }
        continue;
      }

      if (deterministicResearchSteps.has(workerKey)) {
        try {
          validatedEvidenceContext ||= await buildValidatedEvidenceContext(input);
          if (workerKey === "editorial_intelligence_foundation") {
            const subject = typeof input.input.subject === "string" && input.input.subject.trim()
              ? input.input.subject.trim()
              : String(input.input.query || "").trim();
            validatedEvidenceContext.editorialEvidenceSet = await editorialFoundationService.prepareFromValidatedEvidence({
              topic: subject,
              actor: input.actor,
              evidence: editorialEvidenceSubjects(validatedEvidenceContext)
            });
          }
          const stepOutput = {
            ...pipelineStepOutput({
              pipelineId: pipeline.pipelineId,
              pipelineRunId: run.pipelineRunId,
              workerKey,
              stepIndex,
              previousArtifactRefs: artifactRefs,
              previousFactoryObjectRefs: factoryObjectRefs
            }),
            executionKey,
            generated: deterministicStepOutput(workerKey, validatedEvidenceContext)
          };
          await withWriteTransaction("committing deterministic Factory worker checkpoint", async () => {
            const artifact = await factoryRepository.createArtifact({
              artifactType: "evidence",
              title: `${workerKey} output`,
              payload: stepOutput,
              authoritySafe: false,
              actor: input.actor
            });
            artifactRefs.push(artifact.artifactId);
            const completedStep = await factoryRepository.transitionPipelineStep({
              pipelineStepId: step.pipelineStepId,
              status: "completed",
              output: stepOutput,
              artifactRefs: [...artifactRefs],
              factoryObjectRefs: [...factoryObjectRefs]
            });
            await factoryRepository.createRuntimeAuditRecord({
              targetRef: { authorityType: "factory_runtime_execution", authorityId: completedStep.pipelineStepId },
              action: "complete_pipeline_step",
              actor: input.actor,
              reason: input.reason,
              afterState: completedStep as unknown as Record<string, unknown>
            });
            await factoryRepository.transitionPipelineRun({
              pipelineRunId: run.pipelineRunId,
              status: stepIndex === pipeline.steps.length - 1 ? "completed" : "running",
              actor: input.actor,
              artifactRefs,
              factoryObjectRefs,
              packageDraftId
            });
          });
        } catch (error) {
          await finalizePipelineFailure({
            failure: createPipelineFailure({
              error,
              pipelineRunId: run.pipelineRunId,
              pipelineStepId: step.pipelineStepId,
              workerKey,
              stepIndex,
              stage: "authority_orchestration"
            }),
            actor: input.actor,
            reason: input.reason,
            artifactRefs,
            factoryObjectRefs,
            packageDraftId
          });
        }
        continue;
      }

      if (pipeline.pipelineId === "publication_candidate_pipeline") {
        assertEditorialCompositionCheckpoint({
          publicationLineage,
          persistedCandidate: persistedTimelineCandidate,
          persistedComposition: persistedEditorialComposition,
          compilerArtifactId,
          compositionArtifactId,
          artifactRefs,
          factoryObjectRefs
        });
      }
      const contract = getCanonicalFactoryWorker(workerKey)!;
      const provider = getFactoryRuntimeProvider("qwen14");
      let result: Awaited<ReturnType<typeof provider.execute>> | null = null;
      let validated = null;
      let lastFailure: unknown = null;
      const retryHistory: Array<Record<string, unknown>> = [];
      const compactAuthorityResearch = Boolean(validatedEvidenceContext && pipeline.pipelineId === "historical_research_pipeline" && workerKey === "research_worker");
      const compactExtraction = pipeline.pipelineId === "historical_extraction_pipeline" && EXTRACTION_WORKERS.has(workerKey);
      const extractionEvidenceRefs = compactExtraction ? evidenceRefsFromPipelineInput(input.input) : [];
      const canonicalOutputSchema = compactAuthorityResearch
        ? compactResearchWorkerOutputContractSchema()
        : compactExtraction
          ? compactExtractionWorkerOutputContractSchema(workerKey)
          : contract.output_schema;
      const outputSchema = compactExtraction
        ? specializeExtractionSchemaForEvidence(
          canonicalOutputSchema,
          extractionEvidenceRefs.map((ref) => ref.evidenceRecordId!)
        )
        : canonicalOutputSchema;
      const workerInput = compactAuthorityResearch
        ? { researchReasoningContext: buildResearchReasoningContext(input, validatedEvidenceContext!) }
        : compactExtraction
          ? {
            extractionEvidenceContext: await buildExtractionEvidenceContext(extractionEvidenceRefs, {
              boundForObjectCompiler: workerKey === "object_extraction_worker"
            })
          }
        : {
          pipelineInput: input.input,
          artifactRefs,
          factoryObjectRefs,
          validatedEvidenceRefs: publicationLineage?.validatedEvidenceRefs || evidenceRefsFromPipelineInput(input.input)
        };
      const objectExtractionCompiler = workerKey === "object_extraction_worker" && compactExtraction;
      try {
        const maxAttempts = Math.max(1, contract.retry_policy.maxAttempts);
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            const attemptResult = await provider.execute({
              prompt: objectExtractionCompiler
                ? renderObjectExtractionCompilerPrompt(outputSchema, workerInput)
                : renderPrompt(
                `${pipeline.pipelineId === "historical_research_pipeline" && workerKey === "research_worker"
                  ? authorityGroundedResearchPrompt(getFactoryWorkerPromptTemplate(workerKey))
                  : getFactoryWorkerPromptTemplate(workerKey)}

Execute ${contract.worker_name} for the Factory pipeline. Use prior Factory artifact and object references as context only.`,
                workerInput,
                outputSchema
              ),
              input: workerInput,
              outputSchema,
              configuration: {
                maxOutputTokens: contract.max_output_tokens,
                pipelineId: pipeline.pipelineId,
                stepIndex,
                attempt,
                ...(objectExtractionCompiler ? { compilerPrompt: "object_extraction", temperature: 0 } : {})
              },
              timeoutMs: contract.execution_timeout * 1000
            });
            const attemptValidated = compactAuthorityResearch
              ? validateFactoryWorkerOutput({
                workerKey,
                allowedObjectTypes: contract.allowed_object_types,
                output: hydrateResearchWorkerOutput(validateCompactResearchWorkerOutput(attemptResult.output), validatedEvidenceContext!)
              })
              : compactExtraction
                ? await hydrateExtractionWorkerOutput(validateCompactExtractionWorkerOutput({
                  workerKey,
                  allowedObjectTypes: contract.allowed_object_types,
                  output: attemptResult.output
                }), extractionEvidenceRefs)
                : validateFactoryWorkerOutput({
                  workerKey,
                  allowedObjectTypes: contract.allowed_object_types,
                  output: attemptResult.output
                });
            if (compactAuthorityResearch) {
              assertAuthorityGroundedOutput(attemptValidated, validatedEvidenceContext!);
            }
            if (pipeline.pipelineId === "historical_extraction_pipeline") {
              try {
                await assertGroundedExtractionOutput(
                  workerKey,
                  attemptValidated,
                  evidenceRefsFromPipelineInput(input.input)
                );
              } catch (error) {
                if (workerKey !== "milestone_extraction_worker" ||
                    !(error instanceof ApiError) || error.code !== "EXTRACTION_GROUNDING_FAILED") {
                  throw error;
                }
                const rejectionDiagnostics = error.details && typeof error.details === "object"
                  ? error.details as Record<string, unknown>
                  : {};
                attemptValidated.candidates = [];
                attemptValidated.summary = `${attemptValidated.summary} No milestone authority emitted: supplied evidence did not fully ground the candidate.`;
                attemptResult.diagnostics = {
                  ...attemptResult.diagnostics,
                  milestoneRejection: rejectionDiagnostics
                };
              }
            }
            result = attemptResult;
            validated = attemptValidated;
            break;
          } catch (error) {
            lastFailure = withAttemptDiagnostics(error, {
              attempt,
              providerKey: provider.providerKey,
              modelName: provider.modelName,
              workerTimeoutMs: contract.execution_timeout * 1000,
              workerKey,
              rawResponsePreview: result?.diagnostics.rawResponsePreview
            });
            retryHistory.push({
              attempt,
              workerKey,
              providerKey: provider.providerKey,
              modelName: provider.modelName,
              message: errorMessage(error),
              stack: errorStack(error),
              diagnostics: errorDiagnostics(lastFailure)
            });
            if (attempt < maxAttempts && contract.retry_policy.backoffMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, contract.retry_policy.backoffMs));
            }
          }
        }
        if (!result || !validated) {
          throw lastFailure instanceof Error ? lastFailure : new Error("Qwen14 pipeline worker failed validation.");
        }
      } catch (error) {
        await finalizePipelineFailure({
          failure: createPipelineFailure({
            error,
            pipelineRunId: run.pipelineRunId,
            pipelineStepId: step.pipelineStepId,
            workerKey,
            stepIndex,
            stage: "worker_execution",
            retryHistory
          }),
          actor: input.actor,
          reason: input.reason,
          artifactRefs,
          factoryObjectRefs,
          packageDraftId
        });
      }
      if (!result || !validated) {
        throw new Error("Factory pipeline failure finalization did not terminate execution.");
      }
      const output = {
        ...pipelineStepOutput({
          pipelineId: pipeline.pipelineId,
          pipelineRunId: run.pipelineRunId,
          workerKey,
          stepIndex,
          previousArtifactRefs: artifactRefs,
          previousFactoryObjectRefs: factoryObjectRefs
        }),
        executionKey,
        generated: validated,
        diagnostics: {
          ...result.diagnostics,
          ...(EXTRACTION_WORKERS.has(workerKey) ? extractionQualityDiagnostics(workerKey, validated) : {})
        },
        validatedEvidenceRefs: validatedEvidenceContext?.validatedEvidenceRefs || publicationLineage?.validatedEvidenceRefs || evidenceRefsFromPipelineInput(input.input)
      };
      const objectType = candidateObjectTypeForWorker(workerKey);

      await withWriteTransaction("committing Factory worker checkpoint", async () => {
      for (const candidate of validated.candidates) {
        const candidateType = candidate.objectType || objectType;
        if (!candidateType) continue;
        const object = await factoryRepository.createObject({
          objectType: candidateType,
          title: candidate.title,
          payload: {
            ...candidate.payload,
            evidence: candidate.evidence,
            sources: candidate.sources,
            generationTarget: candidateType
          },
          provenance: {
            pipelineId: pipeline.pipelineId,
            pipelineRunId: run.pipelineRunId,
            workerKey,
            executionKey,
            provider: result.providerKey,
            modelName: result.modelName,
            sources: candidate.sources,
            validatedEvidenceRefs: validatedEvidenceContext?.validatedEvidenceRefs || publicationLineage?.validatedEvidenceRefs || evidenceRefsFromPipelineInput(input.input)
          },
          actor: input.actor
        });
        factoryObjectRefs.push(object.objectId);
      }

      const artifact = await factoryRepository.createArtifact({
        artifactType: artifactTypeForWorker(workerKey),
        title: `${contract.worker_name} output`,
        payload: output,
        authoritySafe: false,
        modelProvider: result.providerKey,
        modelName: result.modelName,
        actor: input.actor
      });
      artifactRefs.push(artifact.artifactId);

      if (workerKey === "package_assembly_worker") {
        const evidenceRefs = validatedEvidenceContext?.validatedEvidenceRefs || publicationLineage?.validatedEvidenceRefs || evidenceRefsFromPipelineInput(input.input);
        const evidenceCount = evidenceRefs.length;
        const sourceKeys = new Set(evidenceRefs.map((ref) => ref.uri).filter(Boolean));
        const confidence = evidenceCount >= 2 ? 1 : evidenceCount / 2;
        const qualityMetrics: FactoryPublicationQualityMetrics = {
          publicationQualityScore: confidence,
          researchQuality: confidence,
          evidenceQuality: confidence,
          groundingQuality: factoryObjectRefs.length > 0 && evidenceCount > 0 ? 1 : 0,
          authorityCompleteness: factoryObjectRefs.length > 0 ? 1 : 0,
          chronologyCompleteness: 1,
          citationCompleteness: evidenceCount > 0 ? 1 : 0,
          sourceDiversity: Math.min(1, sourceKeys.size / 2),
          confidence,
          unsupportedFields: [],
          unsupportedClaims: [],
          unsupportedChronology: [],
          unsupportedRelationships: [],
          unsupportedCitations: []
        };
        const publicationBlockers = [
          ...(qualityMetrics.groundingQuality < 1 ? ["grounded_extraction_incomplete"] : []),
          ...(qualityMetrics.citationCompleteness < 1 ? ["citation_completeness_insufficient"] : []),
          ...(qualityMetrics.confidence < 0.75 ? ["publication_confidence_insufficient"] : [])
        ];
        const draft = await factoryRepository.createPackageDraft({
          title: `Pipeline package candidate ${run.pipelineRunId}`,
          description: "Candidate package draft assembled by Factory pipeline. Not submitted to Governance.",
          packageType: "mixed_authority_publication",
          factoryObjectRefs,
          artifactRefs,
          validatedEvidenceRefs: evidenceRefs,
          riskSummary: {
            unresolvedAuthorityRisks: [],
            validationWarnings: qualityMetrics.sourceDiversity < 1 ? ["source_diversity_below_routine_threshold"] : [],
            publicationBlockers,
            qualityMetrics
          },
          actor: input.actor
        });
        packageDraftId = draft.packageDraftId;
      }

      const completedStep = await factoryRepository.transitionPipelineStep({
        pipelineStepId: step.pipelineStepId,
        status: "completed",
        output,
        artifactRefs: [...artifactRefs],
        factoryObjectRefs: [...factoryObjectRefs]
      });
      await factoryRepository.createRuntimeAuditRecord({
        targetRef: { authorityType: "factory_runtime_execution", authorityId: completedStep.pipelineStepId },
        action: "complete_pipeline_step",
        actor: input.actor,
        reason: input.reason,
        afterState: completedStep as unknown as Record<string, unknown>
      });
      await factoryRepository.transitionPipelineRun({
        pipelineRunId: run.pipelineRunId,
        status: stepIndex === pipeline.steps.length - 1 ? "completed" : "running",
        actor: input.actor,
        artifactRefs,
        factoryObjectRefs,
        packageDraftId
      });
      });
    }

    if (nextStepIndex + workerLimit < pipeline.steps.length) {
      return (await factoryRepository.getPipelineRun(run.pipelineRunId))!;
    }
    const completedRun = await factoryRepository.transitionPipelineRun({
      pipelineRunId: run.pipelineRunId,
      status: "completed",
      actor: input.actor,
      artifactRefs,
      factoryObjectRefs,
      packageDraftId
    });
    await factoryRepository.createRuntimeAuditRecord({
      targetRef: { authorityType: "factory_runtime_execution", authorityId: completedRun.pipelineRunId },
      action: "complete_pipeline_run",
      actor: input.actor,
      reason: input.reason,
      afterState: completedRun as unknown as Record<string, unknown>
    });
    return completedRun;
    } catch (error) {
      if (error instanceof ApiError && error.code === "FACTORY_PIPELINE_FAILED") {
        throw error;
      }
      await finalizePipelineFailure({
        failure: createPipelineFailure({
          error,
          pipelineRunId: run.pipelineRunId,
          stage: "pipeline_execution"
        }),
        actor: input.actor,
        reason: input.reason,
        artifactRefs,
        factoryObjectRefs,
        packageDraftId
      });
    }
  },

  async cancelPipeline(input: CancelFactoryPipelineInput) {
    const current = await factoryRepository.getPipelineRun(input.pipelineRunId);
    if (!current) {
      throw new ApiError(404, "FACTORY_PIPELINE_RUN_NOT_FOUND", "Factory pipeline run not found.");
    }
    if (current.status === "completed" || current.status === "failed" || current.status === "cancelled") {
      throw new ApiError(409, "FACTORY_PIPELINE_TERMINAL", "Terminal Factory pipeline runs cannot be cancelled.");
    }
    const cancelled = await factoryRepository.transitionPipelineRun({
      pipelineRunId: input.pipelineRunId,
      status: "cancelled",
      actor: input.actor
    });
    await factoryRepository.createRuntimeAuditRecord({
      targetRef: { authorityType: "factory_runtime_execution", authorityId: input.pipelineRunId },
      action: "cancel_pipeline_run",
      actor: input.actor,
      reason: input.reason,
      beforeState: current as unknown as Record<string, unknown>,
      afterState: cancelled as unknown as Record<string, unknown>
    });
    return cancelled;
  },

  async prepareGovernanceHandoff(input: PrepareFactoryGovernanceHandoffInput) {
    const draft = await factoryRepository.getPackageDraft(input.factoryPackageDraftId);
    if (!draft) {
      throw new ApiError(404, "FACTORY_PACKAGE_DRAFT_NOT_FOUND", "Factory package draft not found.");
    }
    if (draft.lifecycle !== "ready_for_governance") {
      throw new ApiError(409, "FACTORY_PACKAGE_DRAFT_NOT_READY", "Factory handoff requires a ready_for_governance package draft.");
    }
    assertNoPublicationBlockers(draft);
    const pipelineRun = input.pipelineRunId ? await factoryRepository.getPipelineRun(input.pipelineRunId) : null;
    if (input.pipelineRunId && !pipelineRun) {
      throw new ApiError(404, "FACTORY_PIPELINE_RUN_NOT_FOUND", "Factory pipeline run not found.");
    }
    if (pipelineRun && pipelineRun.status !== "completed") {
      throw new ApiError(409, "FACTORY_PIPELINE_NOT_COMPLETE", "Factory handoff requires a completed pipeline run.");
    }
    const lineage = {
      pipelineRunId: pipelineRun?.pipelineRunId || null,
      workerOutputs: pipelineRun?.artifactRefs || draft.artifactRefs,
      factoryObjectRefs: draft.factoryObjectRefs,
      packageDraftId: draft.packageDraftId,
      packageVersionId: null,
      governancePublicationPackageId: null,
      governanceDecisions: []
    };
    const handoff = await factoryRepository.createGovernanceHandoff({
      pipelineRunId: pipelineRun?.pipelineRunId || null,
      factoryPackageDraftId: draft.packageDraftId,
      lineage,
      validationArtifactRefs: draft.artifactRefs,
      submissionReason: input.reason,
      actor: input.actor
    });
    await factoryRepository.createSubmissionAuditRecord({
      handoffId: handoff.handoffId,
      action: "prepare_governance_handoff",
      actor: input.actor,
      reason: input.reason,
      packageLineage: lineage,
      pipelineLineage: pipelineRun ? (pipelineRun as unknown as Record<string, unknown>) : {},
      validationArtifacts: draft.artifactRefs
    });
    await factoryRepository.createSubmissionLineage({
      handoffId: handoff.handoffId,
      pipelineRunId: pipelineRun?.pipelineRunId || null,
      factoryPackageDraftId: draft.packageDraftId,
      workerOutputs: pipelineRun?.artifactRefs || [],
      validationArtifacts: draft.artifactRefs
    });
    return handoff;
  },

  async submitToGovernance(input: SubmitFactoryGovernanceHandoffInput) {
    const handoff = await factoryRepository.getGovernanceHandoff(input.handoffId);
    if (!handoff) {
      throw new ApiError(404, "FACTORY_HANDOFF_NOT_FOUND", "Factory Governance handoff not found.");
    }
    if (
      handoff.status === "submitted_to_governance" &&
      handoff.factoryPackageVersionId &&
      handoff.governancePublicationPackageId
    ) {
      const [factoryPackageVersion, governancePackage, submission] = await Promise.all([
        factoryRepository.getPackageVersion(handoff.factoryPackageVersionId),
        governanceRepository.getPublicationPackage(handoff.governancePublicationPackageId),
        factoryRepository.getGovernanceSubmissionByVersion(handoff.factoryPackageVersionId)
      ]);
      if (!factoryPackageVersion || !governancePackage || !submission) {
        throw new ApiError(409, "FACTORY_HANDOFF_LINEAGE_INCOMPLETE", "Submitted Factory handoff has incomplete persisted Governance lineage.");
      }
      return { handoff, submission, governancePackage, factoryPackageVersion };
    }
    if (handoff.status !== "prepared") {
      throw new ApiError(409, "FACTORY_HANDOFF_NOT_PREPARED", "Only prepared handoffs can be submitted to Governance.");
    }
    const version = await factoryService.createPackageVersion({
      packageDraftId: handoff.factoryPackageDraftId,
      actor: input.actor.actorId,
      reason: input.reason
    });
    const result = await factoryService.markPackageVersionSubmitted({
      packageVersionId: version.packageVersionId,
      actor: input.actor,
      reason: input.reason
    });
    if (!result.governancePackage) {
      throw new ApiError(409, "GOVERNANCE_PACKAGE_LINK_REQUIRED", "Factory handoff submission requires a linked Governance Publication Package.");
    }
    const submittedVersion = result.factoryPackageVersion || version;
    const submitted = await factoryRepository.markGovernanceHandoffSubmitted({
      handoffId: handoff.handoffId,
      factoryPackageVersionId: submittedVersion.packageVersionId,
      governancePublicationPackageId: result.governancePackage.packageId,
      actor: input.actor.actorId
    });
    const packageLineage = {
      ...handoff.lineage,
      packageVersionId: submittedVersion.packageVersionId,
      governancePublicationPackageId: result.governancePackage.packageId
    };
    await factoryRepository.createSubmissionAuditRecord({
      handoffId: handoff.handoffId,
      action: "submit_to_governance",
      actor: input.actor.actorId,
      reason: input.reason,
      packageLineage,
      pipelineLineage: handoff.pipelineRunId ? { pipelineRunId: handoff.pipelineRunId } : {},
      validationArtifacts: handoff.validationArtifactRefs,
      governancePublicationPackageId: result.governancePackage.packageId
    });
    await factoryRepository.createSubmissionLineage({
      handoffId: handoff.handoffId,
      pipelineRunId: handoff.pipelineRunId,
      factoryPackageDraftId: handoff.factoryPackageDraftId,
      factoryPackageVersionId: submittedVersion.packageVersionId,
      governancePublicationPackageId: result.governancePackage.packageId,
      workerOutputs: Array.isArray(handoff.lineage.workerOutputs) ? (handoff.lineage.workerOutputs as string[]) : [],
      validationArtifacts: handoff.validationArtifactRefs,
      governanceDecisions: []
    });
    return {
      handoff: submitted,
      submission: result.submission,
      governancePackage: result.governancePackage,
      factoryPackageVersion: submittedVersion
    };
  },

  async getHandoffStatus(handoffId: string) {
    return factoryRepository.getGovernanceHandoff(handoffId);
  },

  async listGovernanceSubmissions(status?: FactoryGovernanceHandoffStatus, limit = 100) {
    return factoryRepository.listGovernanceHandoffs(status, limit);
  },

  async validateCandidatePackage(input: ValidateCandidatePackageInput) {
    const draft = await factoryRepository.getPackageDraft(input.factoryPackageDraftId);
    if (!draft) {
      throw new ApiError(404, "FACTORY_PACKAGE_DRAFT_NOT_FOUND", "Factory package draft not found.");
    }
    assertEditorialValidationPassed(input);
    const review = await factoryRepository.createEditorialReview({
      factoryPackageDraftId: draft.packageDraftId,
      lifecycle: "validated",
      validationSummary: input.validationSummary,
      evidenceReviewed: input.evidenceReviewed,
      sourcesReviewed: input.sourcesReviewed,
      reviewer: input.reviewer,
      reason: input.reason,
      actor: input.actor
    });
    await factoryRepository.createEditorialDecision({
      editorialReviewId: review.reviewId,
      decision: "validate",
      reason: input.reason,
      evidenceReviewed: input.evidenceReviewed,
      sourcesReviewed: input.sourcesReviewed,
      confidenceAssessment: {},
      authorityMapping: {},
      decidedBy: input.reviewer
    });
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_editorial_review", authorityId: review.reviewId },
      action: "validate_candidate_package",
      actor: input.actor,
      reason: input.reason,
      afterState: review as unknown as Record<string, unknown>
    });
    return review;
  },

  async reviewCandidatePackage(input: ReviewCandidatePackageInput) {
    const current = await factoryRepository.getEditorialReview(input.editorialReviewId);
    if (!current) {
      throw new ApiError(404, "FACTORY_EDITORIAL_REVIEW_NOT_FOUND", "Factory editorial review not found.");
    }
    assertTransitionAllowed("FactoryEditorialReview", editorialReviewTransitions, current.lifecycle, "under_editorial_review");
    const review = await factoryRepository.transitionEditorialReview(input.editorialReviewId, "under_editorial_review", input.actor);
    await factoryRepository.createEditorialDecision({
      editorialReviewId: review.reviewId,
      decision: "start_review",
      reason: input.reason,
      evidenceReviewed: review.evidenceReviewed,
      sourcesReviewed: review.sourcesReviewed,
      confidenceAssessment: {},
      authorityMapping: {},
      decidedBy: input.reviewer
    });
    return review;
  },

  async approveEditorialReview(input: ApproveEditorialReviewInput) {
    const current = await factoryRepository.getEditorialReview(input.editorialReviewId);
    if (!current) {
      throw new ApiError(404, "FACTORY_EDITORIAL_REVIEW_NOT_FOUND", "Factory editorial review not found.");
    }
    assertConfidenceSufficient(input.confidence);
    assertTransitionAllowed("FactoryEditorialReview", editorialReviewTransitions, current.lifecycle, "editorially_approved");
    const confidence = await factoryRepository.createConfidenceAssessment({
      editorialReviewId: current.reviewId,
      confidenceLevel: input.confidence.confidenceLevel,
      confidenceScore: input.confidence.confidenceScore,
      factors: input.confidence.factors,
      actor: input.actor
    });
    const review = await factoryRepository.transitionEditorialReview(input.editorialReviewId, "editorially_approved", input.actor);
    await factoryRepository.createEditorialDecision({
      editorialReviewId: review.reviewId,
      decision: "approve",
      reason: input.reason,
      evidenceReviewed: review.evidenceReviewed,
      sourcesReviewed: review.sourcesReviewed,
      confidenceAssessment: confidence as unknown as Record<string, unknown>,
      authorityMapping: {},
      decidedBy: input.actor
    });
    return { review, confidence };
  },

  async requireRevision(input: RequireRevisionInput) {
    const current = await factoryRepository.getEditorialReview(input.editorialReviewId);
    if (!current) {
      throw new ApiError(404, "FACTORY_EDITORIAL_REVIEW_NOT_FOUND", "Factory editorial review not found.");
    }
    assertTransitionAllowed("FactoryEditorialReview", editorialReviewTransitions, current.lifecycle, "revision_required");
    const review = await factoryRepository.transitionEditorialReview(input.editorialReviewId, "revision_required", input.actor);
    await factoryRepository.createEditorialDecision({
      editorialReviewId: review.reviewId,
      decision: "require_revision",
      reason: input.reason,
      evidenceReviewed: input.evidenceReviewed || review.evidenceReviewed,
      sourcesReviewed: input.sourcesReviewed || review.sourcesReviewed,
      confidenceAssessment: {},
      authorityMapping: {},
      decidedBy: input.actor
    });
    return review;
  },

  async prepareAuthorityRecords(input: PrepareAuthorityRecordsInput) {
    const current = await factoryRepository.getEditorialReview(input.editorialReviewId);
    if (!current) {
      throw new ApiError(404, "FACTORY_EDITORIAL_REVIEW_NOT_FOUND", "Factory editorial review not found.");
    }
    assertTraceabilityComplete(input);
    assertTransitionAllowed("FactoryEditorialReview", editorialReviewTransitions, current.lifecycle, "authority_prepared");
    const preparation = await factoryRepository.createAuthorityPreparation({
      editorialReviewId: current.reviewId,
      factoryPackageDraftId: current.factoryPackageDraftId,
      canonicalIdentityMapping: input.canonicalIdentityMapping,
      authorityReferences: input.authorityReferences,
      sourceTraceability: input.sourceTraceability,
      evidenceTraceability: input.evidenceTraceability,
      revisionTraceability: input.revisionTraceability,
      preparedBy: input.actor
    });
    const review = await factoryRepository.transitionEditorialReview(input.editorialReviewId, "authority_prepared", input.actor);
    await factoryRepository.createEditorialDecision({
      editorialReviewId: review.reviewId,
      decision: "prepare_authority",
      reason: input.reason,
      evidenceReviewed: review.evidenceReviewed,
      sourcesReviewed: review.sourcesReviewed,
      confidenceAssessment: {},
      authorityMapping: preparation as unknown as Record<string, unknown>,
      decidedBy: input.actor
    });
    return { review, preparation };
  },

  async assessGovernanceReadiness(input: AssessGovernanceReadinessInput) {
    const current = await factoryRepository.getEditorialReview(input.editorialReviewId);
    if (!current) {
      throw new ApiError(404, "FACTORY_EDITORIAL_REVIEW_NOT_FOUND", "Factory editorial review not found.");
    }
    assertTransitionAllowed("FactoryEditorialReview", editorialReviewTransitions, current.lifecycle, "governance_ready");
    const preparation = await factoryRepository.getLatestAuthorityPreparationForReview(current.reviewId);
    if (!preparation) {
      throw new ApiError(409, "FACTORY_AUTHORITY_PREPARATION_REQUIRED", "Governance readiness requires authority preparation.");
    }
    const review = await factoryRepository.transitionEditorialReview(input.editorialReviewId, "governance_ready", input.actor);
    await factoryRepository.createEditorialDecision({
      editorialReviewId: review.reviewId,
      decision: "assess_governance_ready",
      reason: input.reason,
      evidenceReviewed: review.evidenceReviewed,
      sourcesReviewed: review.sourcesReviewed,
      confidenceAssessment: {},
      authorityMapping: preparation as unknown as Record<string, unknown>,
      decidedBy: input.actor
    });
    return { review, preparation };
  },

  async listEditorialReviews(limit = 100) {
    return factoryRepository.listEditorialReviews(limit);
  },

  async getEditorialReview(reviewId: string) {
    return factoryRepository.getEditorialReview(reviewId);
  },

  async syncCanonicalWorkerRegistry(input: ActorInput) {
    const records = [];
    for (const contract of canonicalFactoryWorkers) {
      const permissions = allowedOperationsForWorker(contract);
      const record = await factoryRepository.upsertWorkerRegistryContract({
        contract,
        permissions,
        actor: input.actor
      });
      await factoryRepository.createRuntimeAuditRecord({
        targetRef: { authorityType: "factory_runtime_worker", authorityId: record.workerRegistryId },
        action: "sync_worker_contract",
        actor: input.actor,
        reason: input.reason,
        afterState: record as unknown as Record<string, unknown>
      });
      records.push(record);
    }
    return records;
  },

  async listWorkerRegistry(limit = 100) {
    return factoryRepository.listWorkerRegistry(limit);
  },

  async registerRuntimeWorker(input: RegisterFactoryRuntimeWorkerInput) {
    const provider = getFactoryRuntimeProvider(input.defaultProviderKey || "qwen14");
    const worker = await factoryRepository.registerRuntimeWorker({
      workerKey: input.workerKey,
      displayName: input.displayName,
      description: input.description,
      capabilities: input.capabilities,
      defaultProviderKey: provider.providerKey,
      actor: input.actor
    });
    await factoryRepository.createRuntimeAuditRecord({
      targetRef: { authorityType: "factory_runtime_worker", authorityId: worker.workerId },
      action: "register_worker",
      actor: input.actor,
      reason: input.reason,
      afterState: worker as unknown as Record<string, unknown>
    });
    return worker;
  },

  async listRuntimeWorkers(limit = 100) {
    return factoryRepository.listRuntimeWorkers(limit);
  },

  async registerRuntimePrompt(input: RegisterFactoryRuntimePromptInput) {
    const prompt = await factoryRepository.registerRuntimePrompt(input);
    await factoryRepository.createRuntimeAuditRecord({
      targetRef: { authorityType: "factory_runtime_prompt", authorityId: prompt.promptId },
      action: "register_prompt_version",
      actor: input.actor,
      reason: input.reason,
      afterState: prompt as unknown as Record<string, unknown>
    });
    return prompt;
  },

  async listRuntimePrompts(limit = 100) {
    return factoryRepository.listRuntimePrompts(limit);
  },

  async queueRuntimeJob(input: QueueFactoryRuntimeJobInput) {
    const [worker, prompt] = await Promise.all([
      factoryRepository.getRuntimeWorker(input.workerId),
      factoryRepository.getRuntimePrompt(input.promptId)
    ]);
    if (!worker || worker.status !== "registered") {
      throw new ApiError(404, "FACTORY_RUNTIME_WORKER_NOT_AVAILABLE", "Factory runtime worker is not registered.");
    }
    if (!prompt || prompt.status !== "active") {
      throw new ApiError(404, "FACTORY_RUNTIME_PROMPT_NOT_AVAILABLE", "Factory runtime prompt is not active.");
    }
    const provider = getFactoryRuntimeProvider(input.providerKey || worker.defaultProviderKey);
    assertWorkerExecutionPolicy({
      workerKey: worker.workerKey,
      providerKey: provider.providerKey,
      configuration: input.configuration || {}
    });
    const job = await factoryRepository.queueRuntimeJob({
      workerId: worker.workerId,
      promptId: prompt.promptId,
      providerKey: provider.providerKey,
      modelName: provider.modelName,
      priority: input.priority ?? 0,
      input: input.input,
      configuration: input.configuration || {},
      actor: input.actor
    });
    await factoryRepository.createRuntimeAuditRecord({
      targetRef: { authorityType: "factory_runtime_job", authorityId: job.jobId },
      action: "queue_job",
      actor: input.actor,
      reason: input.reason,
      afterState: job as unknown as Record<string, unknown>
    });
    return job;
  },

  async listRuntimeJobs(status?: FactoryRuntimeJobStatus, limit = 100) {
    return factoryRepository.listRuntimeJobs(status, limit);
  },

  async transitionRuntimeJob(input: TransitionFactoryRuntimeJobInput) {
    const current = await factoryRepository.getRuntimeJob(input.jobId);
    if (!current) {
      throw new ApiError(404, "FACTORY_RUNTIME_JOB_NOT_FOUND", "Factory runtime job not found.");
    }
    assertTransitionAllowed("FactoryRuntimeJob", runtimeJobTransitions, current.status, input.status);
    const updated = await factoryRepository.transitionRuntimeJob(input.jobId, input.status, input.actor);
    await factoryRepository.createRuntimeAuditRecord({
      targetRef: { authorityType: "factory_runtime_job", authorityId: input.jobId },
      action: "transition_job",
      actor: input.actor,
      reason: input.reason,
      beforeState: current as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>
    });
    return updated;
  },

  async executeRuntimeJob(input: ExecuteFactoryRuntimeJobInput) {
    const current = await factoryRepository.getRuntimeJob(input.jobId);
    if (!current) {
      throw new ApiError(404, "FACTORY_RUNTIME_JOB_NOT_FOUND", "Factory runtime job not found.");
    }
    const [worker, prompt] = await Promise.all([
      factoryRepository.getRuntimeWorker(current.workerId),
      factoryRepository.getRuntimePrompt(current.promptId)
    ]);
    if (!worker || worker.status !== "registered") {
      throw new ApiError(404, "FACTORY_RUNTIME_WORKER_NOT_AVAILABLE", "Factory runtime worker is not registered.");
    }
    if (!prompt || prompt.status !== "active") {
      throw new ApiError(404, "FACTORY_RUNTIME_PROMPT_NOT_AVAILABLE", "Factory runtime prompt is not active.");
    }
    const contract = getCanonicalFactoryWorker(worker.workerKey);
    if (!contract) {
      throw new ApiError(409, "FACTORY_WORKER_CONTRACT_REQUIRED", "Factory runtime jobs require a canonical worker contract.");
    }
    assertTransitionAllowed("FactoryRuntimeJob", runtimeJobTransitions, current.status, "running");
    const execution = await factoryRepository.createRuntimeExecution(current, input.actor);
    await factoryRepository.createRuntimeAuditRecord({
      targetRef: { authorityType: "factory_runtime_execution", authorityId: execution.executionId },
      action: "create_execution",
      actor: input.actor,
      reason: input.reason,
      afterState: execution as unknown as Record<string, unknown>
    });

    const runningJob = await factoryRepository.transitionRuntimeJob(current.jobId, "running", input.actor);
    const startedExecution = await factoryRepository.transitionRuntimeExecution({
      executionId: execution.executionId,
      status: "started",
      actor: input.actor
    });
    await factoryRepository.createRuntimeAuditRecord({
      targetRef: { authorityType: "factory_runtime_execution", authorityId: execution.executionId },
      action: "start_execution",
      actor: input.actor,
      reason: input.reason,
      beforeState: execution as unknown as Record<string, unknown>,
      afterState: startedExecution as unknown as Record<string, unknown>
    });

    const provider = getFactoryRuntimeProvider(current.providerKey);
    const providerStartedAt = Date.now();
    try {
      let result = null;
      let validated = null;
      let lastFailure: unknown = null;
      let attemptsUsed = 0;
      const maxAttempts = Math.max(1, contract.retry_policy.maxAttempts);
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        attemptsUsed = attempt;
        try {
          result = await provider.execute({
            prompt: renderPrompt(`${getFactoryWorkerPromptTemplate(worker.workerKey)}

${prompt.template}`, current.input, prompt.outputSchema || contract.output_schema),
            input: current.input,
            outputSchema: prompt.outputSchema || contract.output_schema,
            configuration: {
              ...current.configuration,
              maxOutputTokens: contract.max_output_tokens,
              attempt
            },
            timeoutMs: contract.execution_timeout * 1000
          });
          validated = validateFactoryWorkerOutput({
            workerKey: worker.workerKey,
            allowedObjectTypes: contract.allowed_object_types,
            output: result.output
          });
          break;
        } catch (error) {
          lastFailure = withAttemptDiagnostics(error, {
            attempt,
            providerKey: provider.providerKey,
            modelName: provider.modelName,
            workerTimeoutMs: contract.execution_timeout * 1000,
            workerKey: worker.workerKey,
            rawResponsePreview: result?.diagnostics.rawResponsePreview
          });
          if (attempt < maxAttempts && contract.retry_policy.backoffMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, contract.retry_policy.backoffMs));
          }
        }
      }
      if (!result) {
        throw lastFailure instanceof Error ? lastFailure : new Error("Qwen14 execution failed without a provider result.");
      }
      if (!validated) {
        throw new Error(`Output validation failed: ${lastFailure instanceof Error ? lastFailure.message : "invalid generated JSON"}`);
      }

      const artifact = await factoryRepository.createArtifact({
        artifactType: artifactTypeForWorker(worker.workerKey),
        title: `${contract.worker_name} Qwen14 output`,
        payload: {
          ...validated,
          executionId: execution.executionId,
          jobId: current.jobId,
          workerKey: worker.workerKey
        },
        authoritySafe: false,
        modelProvider: result.providerKey,
        modelName: result.modelName,
        actor: input.actor
      });
      const factoryObjectRefs: string[] = [];
      for (const candidate of validated.candidates) {
        const objectType = candidate.objectType || candidateObjectTypeForWorker(worker.workerKey);
        if (!objectType) continue;
        const object = await factoryRepository.createObject({
          objectType,
          title: candidate.title,
          payload: {
            ...candidate.payload,
            evidence: candidate.evidence,
            sources: candidate.sources,
            executionId: execution.executionId,
            artifactId: artifact.artifactId
          },
          provenance: {
            factoryRuntimeJobId: current.jobId,
            factoryRuntimeExecutionId: execution.executionId,
            artifactId: artifact.artifactId,
            workerKey: worker.workerKey,
            providerKey: result.providerKey,
            modelName: result.modelName,
            sources: candidate.sources
          },
          actor: input.actor
        });
        factoryObjectRefs.push(object.objectId);
      }
      assertTransitionAllowed("FactoryRuntimeExecution", runtimeExecutionTransitions, startedExecution.status, "completed");
      const completedExecution = await factoryRepository.transitionRuntimeExecution({
        executionId: execution.executionId,
        status: "completed",
        output: {
          providerKey: result.providerKey,
          modelName: result.modelName,
          output: result.output,
          diagnostics: {
            ...result.diagnostics,
            attemptsUsed,
            retryCount: Math.max(0, attemptsUsed - 1),
            artifactId: artifact.artifactId,
            factoryObjectRefs
          }
        },
        actor: input.actor
      });
      const completedJob = await factoryRepository.transitionRuntimeJob(current.jobId, "completed", input.actor);
      const inputTokens = Number(result.diagnostics.promptTokens || result.diagnostics.estimatedPromptTokens || 0);
      const outputTokens = Number(result.diagnostics.completionTokens || 0);
      const inputRate = Number(process.env.QWEN14_INPUT_COST_PER_MILLION_USD || 0);
      const outputRate = Number(process.env.QWEN14_OUTPUT_COST_PER_MILLION_USD || 0);
      try {
        await factoryRepository.recordProviderExecutionMetric({
          providerKey: result.providerKey, modelName: result.modelName, status: "completed",
          latencyMs: Date.now() - providerStartedAt, estimatedInputTokens: inputTokens,
          maxOutputTokens: contract.max_output_tokens,
          estimatedCostUsd: (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000
        });
      } catch (metricError) {
        console.error(JSON.stringify({ level: "error", component: "provider_metrics", event: "metric_persistence_failed", message: metricError instanceof Error ? metricError.message : "Unknown metric persistence failure" }));
      }
      await factoryRepository.createRuntimeAuditRecord({
        targetRef: { authorityType: "factory_runtime_execution", authorityId: execution.executionId },
        action: "complete_execution",
        actor: input.actor,
        reason: input.reason,
        beforeState: runningJob as unknown as Record<string, unknown>,
        afterState: completedExecution as unknown as Record<string, unknown>
      });
      return { job: completedJob, execution: completedExecution };
    } catch (error) {
      const failure = classifyRuntimeFailure(error);
      try {
        await factoryRepository.recordProviderExecutionMetric({
          providerKey: provider.providerKey, modelName: provider.modelName,
          status: error instanceof Error && error.message.includes("PROVIDER_THROTTLED") ? "throttled" : "failed",
          latencyMs: Date.now() - providerStartedAt, estimatedInputTokens: 0,
          maxOutputTokens: contract.max_output_tokens, estimatedCostUsd: 0
        });
      } catch (metricError) {
        console.error(JSON.stringify({ level: "error", component: "provider_metrics", event: "metric_persistence_failed", message: metricError instanceof Error ? metricError.message : "Unknown metric persistence failure" }));
      }
      assertTransitionAllowed("FactoryRuntimeExecution", runtimeExecutionTransitions, startedExecution.status, "failed");
      const failedExecution = await factoryRepository.transitionRuntimeExecution({
        executionId: execution.executionId,
        status: "failed",
        error: failure,
        actor: input.actor
      });
      const failedJob = await factoryRepository.transitionRuntimeJob(current.jobId, "failed", input.actor);
      await factoryRepository.createRuntimeAuditRecord({
        targetRef: { authorityType: "factory_runtime_execution", authorityId: execution.executionId },
        action: "fail_execution",
        actor: input.actor,
        reason: input.reason,
        beforeState: startedExecution as unknown as Record<string, unknown>,
        afterState: failedExecution as unknown as Record<string, unknown>
      });
      return { job: failedJob, execution: failedExecution };
    }
  },

  async listRuntimeExecutions(jobId?: string, limit = 100) {
    return factoryRepository.listRuntimeExecutions(jobId, limit);
  },

  async getRuntimeMetrics() {
    return factoryRepository.getRuntimeMetrics();
  },

  async getRuntimeHealth() {
    const providers = await Promise.all(listFactoryRuntimeProviders().map((provider) => provider.health()));
    return {
      status: providers.every((provider) => provider.ok) ? "healthy" : "degraded",
      providers,
      workerRegistry: {
        canonicalWorkerCount: canonicalFactoryWorkers.length,
        sourceGroundedGenerationEnabled: true
      }
    };
  },

  async createObject(input: CreateFactoryObjectInput) {
    const created = await factoryRepository.createObject(input);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_object", authorityId: created.objectId },
      action: "create_object",
      actor: input.actor,
      reason: input.reason,
      afterState: created as unknown as Record<string, unknown>
    });
    return created;
  },

  async transitionObject(input: ActorInput & { objectId: string; lifecycle: FactoryObjectLifecycle }) {
    const current = await factoryRepository.getObject(input.objectId);
    if (!current) {
      throw new ApiError(404, "FACTORY_OBJECT_NOT_FOUND", "Factory object not found.");
    }
    assertTransitionAllowed("FactoryObject", objectTransitions, current.lifecycle, input.lifecycle);
    const updated = await factoryRepository.transitionObject(input.objectId, input.lifecycle, input.actor);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_object", authorityId: input.objectId },
      action: "transition_object",
      actor: input.actor,
      reason: input.reason,
      beforeState: current as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>
    });
    return updated;
  },

  async createArtifact(input: CreateFactoryArtifactInput) {
    if (input.factoryObjectId) {
      const object = await factoryRepository.getObject(input.factoryObjectId);
      if (!object) {
        throw new ApiError(404, "FACTORY_OBJECT_NOT_FOUND", "Factory object not found for artifact ownership.");
      }
    }
    const created = await factoryRepository.createArtifact(input);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_artifact", authorityId: created.artifactId },
      action: "create_artifact",
      actor: input.actor,
      reason: input.reason,
      afterState: created as unknown as Record<string, unknown>
    });
    return created;
  },

  async createPackageDraft(input: CreateFactoryPackageDraftInput) {
    if (input.factoryObjectRefs.length === 0) {
      throw new ApiError(409, "FACTORY_PACKAGE_OBJECTS_REQUIRED", "Factory package drafts require at least one Factory object reference.");
    }
    const created = await factoryRepository.createPackageDraft(input);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_package_draft", authorityId: created.packageDraftId },
      action: "create_package_draft",
      actor: input.actor,
      reason: input.reason,
      afterState: created as unknown as Record<string, unknown>
    });
    return created;
  },

  async transitionPackageDraft(input: ActorInput & { packageDraftId: string; lifecycle: FactoryPackageDraftLifecycle }) {
    const current = await factoryRepository.getPackageDraft(input.packageDraftId);
    if (!current) {
      throw new ApiError(404, "FACTORY_PACKAGE_DRAFT_NOT_FOUND", "Factory package draft not found.");
    }
    assertTransitionAllowed("FactoryPackageDraft", packageDraftTransitions, current.lifecycle, input.lifecycle);
    if (input.lifecycle === "ready_for_governance") {
      assertNoPublicationBlockers(current);
      const review = await factoryRepository.getLatestEditorialReviewForPackage(current.packageDraftId);
      if (!review || review.lifecycle !== "governance_ready") {
        throw new ApiError(409, "FACTORY_EDITORIAL_REVIEW_REQUIRED", "Factory package drafts require governance-ready editorial review before Governance readiness.");
      }
      const preparation = await factoryRepository.getLatestAuthorityPreparationForReview(review.reviewId);
      if (!preparation) {
        throw new ApiError(409, "FACTORY_AUTHORITY_PREPARATION_REQUIRED", "Factory package drafts require authority preparation before Governance readiness.");
      }
    }
    const updated = await factoryRepository.transitionPackageDraft(input.packageDraftId, input.lifecycle, input.actor);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_package_draft", authorityId: input.packageDraftId },
      action: "transition_package_draft",
      actor: input.actor,
      reason: input.reason,
      beforeState: current as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>
    });
    return updated;
  },

  async createPackageVersion(input: ActorInput & { packageDraftId: string }) {
    const draft = await factoryRepository.getPackageDraft(input.packageDraftId);
    if (!draft) {
      throw new ApiError(404, "FACTORY_PACKAGE_DRAFT_NOT_FOUND", "Factory package draft not found.");
    }
    if (draft.lifecycle !== "ready_for_governance") {
      throw new ApiError(409, "FACTORY_PACKAGE_NOT_READY", "Factory package versions require a ready_for_governance draft.");
    }
    assertNoPublicationBlockers(draft);
    const version = await factoryRepository.createPackageVersion({
      draft,
      actor: input.actor,
      packageSnapshot: {
        packageDraftId: draft.packageDraftId,
        title: draft.title,
        description: draft.description,
        packageType: draft.packageType,
        factoryObjectRefs: draft.factoryObjectRefs,
        artifactRefs: draft.artifactRefs,
        validatedEvidenceRefs: draft.validatedEvidenceRefs,
        riskSummary: draft.riskSummary,
        lineageRootId: draft.lineageRootId || draft.packageDraftId,
        supersedesPackageId: draft.supersedesPackageId
      }
    });
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_package_version", authorityId: version.packageVersionId },
      action: "create_package_version",
      actor: input.actor,
      reason: input.reason,
      afterState: version as unknown as Record<string, unknown>
    });
    return version;
  },

  async markPackageVersionSubmitted(input: SubmitFactoryPackageVersionInput) {
    const existingSubmission = await factoryRepository.getGovernanceSubmissionByVersion(input.packageVersionId);
    if (existingSubmission) {
      const governancePackage = await governanceRepository.getPublicationPackage(existingSubmission.governancePublicationPackageId);
      return {
        submission: existingSubmission,
        governancePackage
      };
    }

    const packageVersion = await factoryRepository.getPackageVersion(input.packageVersionId);
    if (!packageVersion) {
      throw new ApiError(404, "FACTORY_PACKAGE_VERSION_NOT_FOUND", "Factory package version not found.");
    }
    if (packageVersion.lifecycle !== "draft") {
      throw new ApiError(409, "FACTORY_PACKAGE_VERSION_NOT_ELIGIBLE", "Only draft Factory package versions can be submitted to Governance.");
    }
    if (packageVersion.governancePublicationPackageId) {
      throw new ApiError(409, "FACTORY_PACKAGE_VERSION_ALREADY_LINKED", "Factory package version is already linked to a Governance PublicationPackage.");
    }

    const draft = await factoryRepository.getPackageDraft(packageVersion.draftId);
    if (!draft) {
      throw new ApiError(404, "FACTORY_PACKAGE_DRAFT_NOT_FOUND", "Factory package draft not found.");
    }
    if (draft.lifecycle !== "ready_for_governance") {
      throw new ApiError(409, "FACTORY_PACKAGE_DRAFT_NOT_READY", "Factory package draft must remain ready_for_governance before submission.");
    }
    assertNoPublicationBlockers(draft);

    const auditRecordId = await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_package_version", authorityId: input.packageVersionId },
      action: "submit_package_version_to_governance",
      actor: input.actor.actorId,
      reason: input.reason,
      beforeState: packageVersion as unknown as Record<string, unknown>,
      afterState: {
        factoryPackageVersionId: packageVersion.packageVersionId,
        factoryPackageDraftId: packageVersion.draftId,
        factoryLineageRootId: packageVersion.lineageRootId,
        submittedBy: input.actor
      }
    });

    const factoryObjects = await Promise.all(draft.factoryObjectRefs.map((objectId) => factoryRepository.getObject(objectId)));
    if (factoryObjects.some((object) => !object)) {
      throw new ApiError(409, "FACTORY_PUBLICATION_AUTHORITY_MISSING", "Every packaged Factory object must exist before Governance submission.");
    }
    const governancePackageInput = buildGovernancePublicationPackage(
      packageVersion,
      draft,
      input.actor,
      auditRecordId,
      factoryObjects as FactoryObject[]
    );
    const governancePackage = await governanceService.createPublicationPackage(governancePackageInput);
    const submittedVersion = await factoryRepository.markPackageVersionSubmitted(
      input.packageVersionId,
      governancePackage.packageId
    );
    const submittedDraft = await factoryRepository.transitionPackageDraft(draft.packageDraftId, "submitted_to_governance", input.actor.actorId);
    const submission = await factoryRepository.createGovernanceSubmission({
      factoryPackageVersionId: submittedVersion.packageVersionId,
      factoryPackageDraftId: submittedVersion.draftId,
      factoryLineageRootId: submittedVersion.lineageRootId,
      governancePublicationPackageId: governancePackage.packageId,
      submissionActor: input.actor,
      submissionReason: input.reason,
      submissionAuditRecordId: auditRecordId
    });

    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_package_draft", authorityId: submittedDraft.packageDraftId },
      action: "transition_package_draft",
      actor: input.actor.actorId,
      reason: "Factory package draft submitted to Governance.",
      beforeState: draft as unknown as Record<string, unknown>,
      afterState: submittedDraft as unknown as Record<string, unknown>
    });

    return {
      submission,
      governancePackage,
      factoryPackageVersion: submittedVersion
    };
  },

  async intakeFeedbackPackage(input: IntakeFactoryFeedbackInput) {
    const existing = await factoryRepository.getFeedbackConsumptionByFeedbackPackage(input.feedbackPackageId);
    if (existing) {
      return existing;
    }

    const feedbackPackage = await governanceRepository.getFeedbackPackage(input.feedbackPackageId);
    if (!feedbackPackage) {
      throw new ApiError(404, "FEEDBACK_PACKAGE_NOT_FOUND", "FeedbackPackage not found.");
    }
    const governancePublicationPackageId = feedbackPackage.origin.sourcePackageId;
    if (!governancePublicationPackageId) {
      throw new ApiError(409, "FEEDBACK_SOURCE_PACKAGE_REQUIRED", "Factory feedback intake requires source Governance PublicationPackage linkage.");
    }
    const submission = await factoryRepository.getGovernanceSubmissionByGovernancePackage(governancePublicationPackageId);
    if (!submission) {
      throw new ApiError(409, "FACTORY_SUBMISSION_LINK_REQUIRED", "Feedback source package is not linked to Factory Production Memory.");
    }
    const auditRecordId = await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "feedback_package", authorityId: input.feedbackPackageId },
      action: "intake_feedback_package",
      actor: input.actor,
      reason: input.reason,
      afterState: {
        feedbackPackageId: input.feedbackPackageId,
        governancePublicationPackageId,
        factoryPackageVersionId: submission.factoryPackageVersionId,
        affectedFactoryObjectIds: input.affectedFactoryObjectIds
      }
    });
    return factoryRepository.createFeedbackConsumption({
      feedbackPackageId: input.feedbackPackageId,
      governancePublicationPackageId,
      factoryPackageVersionId: submission.factoryPackageVersionId,
      factoryPackageDraftId: submission.factoryPackageDraftId,
      factoryLineageRootId: submission.factoryLineageRootId,
      affectedFactoryObjectIds: input.affectedFactoryObjectIds,
      classification: feedbackPackage.correctionClass,
      requiredResponse: feedbackPackage.requiredResponse,
      auditRecordId,
      actor: input.actor
    });
  },

  async transitionFeedbackConsumption(input: TransitionFactoryFeedbackInput) {
    const current = await factoryRepository.getFeedbackConsumption(input.feedbackConsumptionId);
    if (!current) {
      throw new ApiError(404, "FACTORY_FEEDBACK_CONSUMPTION_NOT_FOUND", "Factory feedback consumption not found.");
    }
    assertTransitionAllowed("FactoryFeedbackConsumption", feedbackTransitions, current.lifecycle, input.lifecycle);
    const updated = await factoryRepository.transitionFeedbackConsumption(input.feedbackConsumptionId, input.lifecycle, input.actor);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_feedback_consumption", authorityId: input.feedbackConsumptionId },
      action: "transition_feedback_consumption",
      actor: input.actor,
      reason: input.reason,
      beforeState: current as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>
    });
    return updated;
  },

  async createRevisionPlan(input: CreateFactoryRevisionPlanInput) {
    const consumption = await factoryRepository.getFeedbackConsumption(input.feedbackConsumptionId);
    if (!consumption) {
      throw new ApiError(404, "FACTORY_FEEDBACK_CONSUMPTION_NOT_FOUND", "Factory feedback consumption not found.");
    }
    if (consumption.lifecycle !== "revision_required" && consumption.lifecycle !== "triaged") {
      throw new ApiError(409, "FACTORY_FEEDBACK_REVISION_NOT_ALLOWED", "Revision plans require triaged or revision_required feedback.");
    }
    if (input.plannedActions.length === 0) {
      throw new ApiError(409, "REVISION_ACTIONS_REQUIRED", "Revision plan requires at least one planned action.");
    }
    const auditRecordId = await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_feedback_consumption", authorityId: input.feedbackConsumptionId },
      action: "create_revision_plan",
      actor: input.actor,
      reason: input.reason,
      beforeState: consumption as unknown as Record<string, unknown>,
      afterState: {
        planSummary: input.planSummary,
        plannedActions: input.plannedActions
      }
    });
    const plan = await factoryRepository.createRevisionPlan({
      feedbackConsumption: consumption,
      planSummary: input.planSummary,
      plannedActions: input.plannedActions,
      auditRecordId,
      actor: input.actor
    });
    await factoryRepository.transitionFeedbackConsumption(input.feedbackConsumptionId, "revision_in_progress", input.actor, plan.revisionPlanId);
    return plan;
  },

  async prepareResubmission(input: PrepareFactoryResubmissionInput) {
    const plan = await factoryRepository.getRevisionPlan(input.revisionPlanId);
    if (!plan) {
      throw new ApiError(404, "FACTORY_REVISION_PLAN_NOT_FOUND", "Factory revision plan not found.");
    }
    if (plan.lifecycle !== "draft" && plan.lifecycle !== "approved" && plan.lifecycle !== "in_progress") {
      throw new ApiError(409, "REVISION_PLAN_RESUBMISSION_NOT_ALLOWED", "Revision plan cannot prepare resubmission from current lifecycle.");
    }
    assertTransitionAllowed("FactoryRevisionPlan", revisionPlanTransitions, plan.lifecycle, "resubmission_prepared");
    if (!plan.factoryPackageDraftId || plan.affectedFactoryObjectIds.length === 0) {
      throw new ApiError(409, "RESUBMISSION_LINEAGE_REQUIRED", "Resubmission requires source package draft and affected Factory objects.");
    }
    const sourceDraft = await factoryRepository.getPackageDraft(plan.factoryPackageDraftId);
    if (!sourceDraft) {
      throw new ApiError(404, "FACTORY_PACKAGE_DRAFT_NOT_FOUND", "Source Factory package draft not found.");
    }
    const resubmissionDraft = await factoryRepository.createPackageDraft({
      title: input.title,
      description: input.description,
      packageType: sourceDraft.packageType,
      factoryObjectRefs: Array.from(new Set([...sourceDraft.factoryObjectRefs, ...plan.affectedFactoryObjectIds])),
      artifactRefs: sourceDraft.artifactRefs,
      validatedEvidenceRefs: sourceDraft.validatedEvidenceRefs,
      riskSummary: {
        unresolvedAuthorityRisks: [],
        validationWarnings: [`Prepared from revision plan ${plan.revisionPlanId}.`],
        publicationBlockers: []
      },
      supersedesPackageId: sourceDraft.packageDraftId,
      actor: input.actor
    });
    const updatedPlan = await factoryRepository.transitionRevisionPlan(
      input.revisionPlanId,
      "resubmission_prepared",
      input.actor,
      resubmissionDraft.packageDraftId
    );
    await factoryRepository.transitionFeedbackConsumption(plan.feedbackConsumptionId, "resubmission_prepared", input.actor, plan.revisionPlanId);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_revision_plan", authorityId: input.revisionPlanId },
      action: "prepare_resubmission",
      actor: input.actor,
      reason: input.reason,
      beforeState: plan as unknown as Record<string, unknown>,
      afterState: {
        revisionPlan: updatedPlan,
        resubmissionPackageDraft: resubmissionDraft
      }
    });
    return {
      revisionPlan: updatedPlan,
      resubmissionPackageDraft: resubmissionDraft
    };
  },

  async completeResubmission(input: CompleteFactoryResubmissionInput) {
    const plan = await factoryRepository.getRevisionPlan(input.revisionPlanId);
    if (!plan) {
      throw new ApiError(404, "FACTORY_REVISION_PLAN_NOT_FOUND", "Factory revision plan not found.");
    }
    if (plan.newPackageVersionId) {
      const factoryPackageVersion = await factoryRepository.getPackageVersion(plan.newPackageVersionId);
      const submission = factoryPackageVersion
        ? await factoryRepository.getGovernanceSubmissionByVersion(factoryPackageVersion.packageVersionId)
        : null;
      const governancePackage = submission
        ? await governanceRepository.getPublicationPackage(submission.governancePublicationPackageId)
        : null;
      return {
        revisionPlan: plan,
        factoryPackageVersion,
        submission,
        governancePackage
      };
    }
    if (plan.lifecycle !== "resubmission_prepared") {
      throw new ApiError(409, "REVISION_PLAN_NOT_PREPARED", "Revision plan must be resubmission_prepared before completion.");
    }
    assertTransitionAllowed("FactoryRevisionPlan", revisionPlanTransitions, plan.lifecycle, "resolved");
    if (!plan.resubmissionPackageDraftId || !plan.factoryPackageVersionId || !plan.factoryPackageDraftId || !plan.factoryLineageRootId) {
      throw new ApiError(409, "RESUBMISSION_LINKAGE_INCOMPLETE", "Revision plan is missing required resubmission lineage links.");
    }

    const [resubmissionDraft, supersededVersion] = await Promise.all([
      factoryRepository.getPackageDraft(plan.resubmissionPackageDraftId),
      factoryRepository.getPackageVersion(plan.factoryPackageVersionId)
    ]);
    if (!resubmissionDraft) {
      throw new ApiError(404, "RESUBMISSION_DRAFT_NOT_FOUND", "Prepared resubmission package draft not found.");
    }
    if (!supersededVersion) {
      throw new ApiError(404, "SUPERSEDED_PACKAGE_VERSION_NOT_FOUND", "Superseded Factory package version not found.");
    }
    if (resubmissionDraft.lifecycle !== "ready_for_governance") {
      throw new ApiError(409, "RESUBMISSION_DRAFT_NOT_READY", "Prepared resubmission draft must be ready_for_governance before completion.");
    }
    if (resubmissionDraft.lineageRootId !== plan.factoryLineageRootId || supersededVersion.lineageRootId !== plan.factoryLineageRootId) {
      throw new ApiError(409, "RESUBMISSION_LINEAGE_MISMATCH", "Resubmission lineage root does not match the originating Factory lineage.");
    }
    if (resubmissionDraft.supersedesPackageId !== plan.factoryPackageDraftId) {
      throw new ApiError(409, "RESUBMISSION_DRAFT_SUPERSESSION_MISMATCH", "Resubmission draft must supersede the source Factory package draft.");
    }
    if (supersededVersion.lifecycle !== "submitted_to_governance") {
      throw new ApiError(409, "SUPERSEDED_VERSION_NOT_SUBMITTED", "Only submitted Factory package versions can be superseded by resubmission.");
    }
    assertNoPublicationBlockers(resubmissionDraft);

    const resubmissionAuditRecordId = await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_revision_plan", authorityId: input.revisionPlanId },
      action: "create_resubmission_package_version",
      actor: input.actor.actorId,
      reason: input.reason,
      beforeState: {
        revisionPlan: plan,
        supersededPackageVersion: supersededVersion
      } as unknown as Record<string, unknown>,
      afterState: {
        resubmissionPackageDraftId: resubmissionDraft.packageDraftId,
        supersededPackageVersionId: supersededVersion.packageVersionId,
        feedbackPackageId: plan.feedbackPackageId
      }
    });

    const packageVersion = await factoryRepository.createPackageVersion({
      draft: resubmissionDraft,
      actor: input.actor.actorId,
      supersedesVersionId: supersededVersion.packageVersionId,
      feedbackPackageRefs: [plan.feedbackPackageId],
      revisionPlanId: plan.revisionPlanId,
      sourceFeedbackPackageId: plan.feedbackPackageId,
      resubmissionAuditRecordId,
      packageSnapshot: {
        packageDraftId: resubmissionDraft.packageDraftId,
        title: resubmissionDraft.title,
        description: resubmissionDraft.description,
        packageType: resubmissionDraft.packageType,
        factoryObjectRefs: resubmissionDraft.factoryObjectRefs,
        artifactRefs: resubmissionDraft.artifactRefs,
        validatedEvidenceRefs: resubmissionDraft.validatedEvidenceRefs,
        riskSummary: resubmissionDraft.riskSummary,
        lineageRootId: resubmissionDraft.lineageRootId,
        supersedesPackageId: resubmissionDraft.supersedesPackageId,
        supersededPackageVersionId: supersededVersion.packageVersionId,
        revisionPlanId: plan.revisionPlanId,
        feedbackPackageId: plan.feedbackPackageId
      }
    });

    const submissionResult = await factoryService.markPackageVersionSubmitted({
      packageVersionId: packageVersion.packageVersionId,
      actor: input.actor,
      reason: input.reason
    });
    const submittedVersion = submissionResult.factoryPackageVersion || packageVersion;
    const revisionCompletionRecordId = await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_revision_plan", authorityId: input.revisionPlanId },
      action: "complete_resubmission",
      actor: input.actor.actorId,
      reason: input.reason,
      beforeState: plan as unknown as Record<string, unknown>,
      afterState: {
        supersededPackageVersionId: supersededVersion.packageVersionId,
        newPackageVersionId: submittedVersion.packageVersionId,
        feedbackPackageId: plan.feedbackPackageId,
        governancePublicationPackageId: submissionResult.governancePackage?.packageId || null
      }
    });
    const completedPlan = await factoryRepository.completeRevisionPlan({
      revisionPlanId: input.revisionPlanId,
      supersededPackageVersionId: supersededVersion.packageVersionId,
      newPackageVersionId: submittedVersion.packageVersionId,
      governancePublicationPackageId: submissionResult.governancePackage?.packageId || submissionResult.submission.governancePublicationPackageId,
      submissionAuditRecordId: submissionResult.submission.submissionAuditRecordId,
      revisionCompletionRecordId,
      actor: input.actor.actorId
    });
    await factoryRepository.transitionFeedbackConsumption(
      plan.feedbackConsumptionId,
      "resolved",
      input.actor.actorId,
      plan.revisionPlanId,
      revisionCompletionRecordId
    );

    return {
      revisionPlan: completedPlan,
      factoryPackageVersion: submittedVersion,
      submission: submissionResult.submission,
      governancePackage: submissionResult.governancePackage
    };
  },

  certifyReadiness: assertFactoryCannotCertifyReadiness,
  approvePackage: assertFactoryCannotApprovePackage,
  rejectPackage: assertFactoryCannotRejectPackage,
  admitToHistoricalLibrary: assertFactoryCannotAdmitToHistoricalLibrary,
  publish: assertFactoryCannotPublish
};

export function buildGovernancePublicationPackage(
  packageVersion: FactoryPackageVersion,
  draft: FactoryPackageDraft,
  actor: GovernanceActorRef,
  auditRecordId: string,
  factoryObjects: FactoryObject[] = []
): PublicationPackage {
  const factoryValidationRefs: EvidenceRef[] = draft.artifactRefs.map((artifactId) => ({
    evidenceId: artifactId,
    evidenceType: "factory_validation" as const,
    authoritySafe: true
  }));
  const validatedEvidenceRefs = packageVersion.validatedEvidenceRefs.length > 0
    ? packageVersion.validatedEvidenceRefs
    : draft.validatedEvidenceRefs;

  const authorityTypeByFactoryType: Record<Exclude<FactoryObjectType, "editorial_timeline_candidate" | "editorial_composition">, AuthorityRef["authorityType"]> = {
    candidate_historical_object: "historical_object",
    candidate_milestone: "milestone",
    candidate_participation: "participation",
    candidate_relationship: "relationship",
    candidate_context_record: "context_record",
    candidate_source: "source"
  };
  const canonicalAuthority = factoryObjects.map((object) => {
    if (object.objectType === "editorial_timeline_candidate") {
      throw new ApiError(409, "EDITORIAL_TIMELINE_CANDIDATE_NOT_PACKAGEABLE", "EditorialTimelineCandidate persistence is not yet certified for package integration.");
    }
    if (object.objectType === "editorial_composition") {
      throw new ApiError(409, "EDITORIAL_COMPOSITION_NOT_PACKAGEABLE", "EditorialComposition is Factory Production Memory and cannot become Governance canonical authority.");
    }
    return {
      authorityRef: {
        authorityType: authorityTypeByFactoryType[object.objectType],
        authorityId: object.objectId
      },
      title: object.title,
      payload: object.payload,
      provenance: object.provenance,
      factoryObjectId: object.objectId
    };
  });

  return {
    packageId: randomUUID(),
    scope: {
      packageType: draft.packageType,
      description: draft.description
    },
    includedAuthority: canonicalAuthority.map((authority) => authority.authorityRef),
    canonicalAuthority,
    validationArtifacts: [...validatedEvidenceRefs, ...factoryValidationRefs],
    decisionRefs: [],
    riskSummary: {
      unresolvedAuthorityRisks: draft.riskSummary.unresolvedAuthorityRisks,
      disputeRefs: [],
      validationWarnings: draft.riskSummary.validationWarnings,
      publicationBlockers: draft.riskSummary.publicationBlockers
    },
    factorySubmission: {
      factoryPackageVersionId: packageVersion.packageVersionId,
      factoryPackageDraftId: packageVersion.draftId,
      factoryLineageRootId: packageVersion.lineageRootId,
      submittedBy: actor,
      submissionAuditRecordId: auditRecordId
    },
    lifecycle: "factory_ready"
  };
}
