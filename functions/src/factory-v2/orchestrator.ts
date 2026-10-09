import { randomUUID } from "node:crypto";
import { V2_PIPELINE_VERSION, V2_POLICY_VERSION, auditRecordSchema, canonicalEntityRecordSchema, canonicalEntityVersionSchema, canonicalEventRecordSchema, deadlineTerminalRecordSchema, entityAliasSchema, eventClaimEdgeSchema, eventEntityEdgeSchema, modelExecutionSchema, publisherAuthorityRecordSchema, reconnaissanceRecordSchema, sourceDocumentSchema, topicOperationSchema, v2FailureRecordSchema, type AcquisitionConfidenceVector, type AtomicClaimVersion, type CanonicalEntityVersion, type CanonicalEventVersion, type ClaimAuthorityVerdict, type ClaimEvidenceEdge, type ControlledResearchOperation, type EvidenceSegment, type HistoricalDate, type PublisherAuthorityVersion, type ResearchMap, type ScopeContract, type SourceDocument, type SourceSnapshot, type TopicAuthorityProposal, type TopicAuthoritySet } from "./contracts";
import { assertV2AShadowEnabled, authorityFirstRunDeadlineAt, type FactoryV2Config } from "./config";
import { bootstrapPublisherRegistry, detectClaimConflicts, evaluateClaimAuthority, independenceGroup } from "./authority";
import { buildAtomicClaimVersion, buildCanonicalEntityVersion, buildCanonicalEventVersion, buildClaimEvidenceEdge, executionArtifactId, immutableEnvelope, normalizedIdentityText, parseSealedArtifact, semanticArtifactId, semanticEnvelope, type ArtifactContext } from "./contracts/builders";
import { canReuseSnapshot, retrieveSource, type RetrievalDependencies } from "./acquisition/retrieval";
import { canonicalizeUrl } from "./acquisition/url";
import { contentAddressedId, payloadHash, sha256 } from "./hashing";
import { performBoundedReconnaissance } from "./reconnaissance";
import { eventWithinLockedScope, resolveEntityCandidate, resolveEventCandidate } from "./resolution";
import { V2FirestoreRepository } from "./repositories/firestore";
import { extractAtomicClaims, generateResearchMap, generateTopicAuthorityProposals, proposeScope, runGroundedAcquisition, selectRoutingObligationBatch, StructuredStageError, type V2ModelProvider } from "./vertex";
import { claimPropositionKey, isDiscoveryRelevant, rankCoverageSourcesByQuestion, selectEvidencePacket, selectIndependentCoverageCandidates, selectUsableCoverageCandidates, type DiscoveredSourceCandidate } from "./reliability";
import { auditPerspective, authorizeEscalation, buildAuthorityResearchPlan, buildConfidenceVector, buildTopicAuthoritySet, completeProtectedAvailabilityProposals, ProtectedRepresentationAvailabilityError, registeredGroundingExpansionPublishers, sealControlledResearchLedger } from "./authority-first";
import { executeInstitutionalDiscovery, type InstitutionalDiscoveryTransport } from "./institutional-discovery";
import { AuthorityFirstExecutionSupervisor, WholeRunDeadlineExceededError } from "./execution-supervisor";

export type ShadowFixtureDescriptor = { title: string; language: string; ongoingAsOf: string };

export type V2ACertificationMetrics = {
  totalExecutionMs: number;
  scopeContractModelCalls: number;
  researchMapModelCalls: number;
  queryPlanModelCalls: number;
  authorityRoutingModelCalls: number;
  groundingCalls: number;
  providerReportedSearchQueries: number;
  candidateQueriesProposed: number;
  candidateQueriesAuthorized: number;
  candidateQueriesRejected: number;
  explicitQueriesExecuted: number;
  explicitSearchRequests: number;
  explicitSearchResults: number;
  explicitSearchLatencyMs: number;
  queryLedgerId: string | null;
  topicAuthoritySetId: string | null;
  authorityResearchPlanId: string | null;
  controlledResearchLedgerId: string | null;
  perspectiveAuditId: string | null;
  confidenceVectorId: string | null;
  controlledResearchOperations: number;
  directRetrievalAttempts: number;
  retrievalSuccesses: number;
  retrievalFailures: number;
  sourceDocumentsDiscovered: number;
  sourceDocumentsSnapshotted: number;
  cacheHits: number;
  cacheRevalidated: number;
  cacheRefetched: number;
  cacheNotApplicable: number;
  retrievalsSuppressedByHostCircuit: number;
  retrievalRejectionReasons: Record<string, number>;
  retrievalFailureDetails: Array<{ urlHash: string; reason: string; latencyMs: number }>;
  sourceRanking: Array<{ rank: number; urlHash: string; domain: string; admittedQuestionCount: number }>;
  evidencePackets: number;
  evidencePacketSegments: number;
  individualClaimsRejected: number;
  claimRejectionReasons: Record<string, number>;
  researchQuestionsNoEvidence: number;
  researchQuestionsPartial: number;
  researchQuestionsSufficient: number;
  researchQuestionsBlocked: number;
  sourceClasses: string[];
  publisherIdentities: number;
  claimsExtracted: number;
  claimsSupported: number;
  claimsRejected: number;
  claimsRequiringReview: number;
  authorityVerdictDistribution: Record<string, number>;
  conflictsDetected: number;
  conflictsResolved: number;
  conflictsUnresolved: number;
  entityCandidates: number;
  resolvedEntities: number;
  eventCandidates: number;
  resolvedCanonicalEventCandidates: number;
  nonEventKnowledgeItems: number;
  eventDispositionDistribution: Record<string, number>;
  eventResolutionDiagnostics: Record<string, number>;
  reusedExistingKnowledge: number;
  newKnowledge: number;
  modelRepairAttempts: number;
  infrastructureRetries: number;
  providerCalls: number;
  stageLatencyMs: Record<string, number>;
  providerQueries: string[];
  inputTokens: number | null;
  outputTokens: number | null;
  monetaryCost: number | null;
  monetaryCostMeasurement: "MEASURED" | "NOT_MEASURABLE";
  firestoreWrites: number;
  cloudStorageWrites: number;
  finalV2AVerdict: "PASS" | "FAIL";
};

/** Keeps a bounded continuation's escalation capacity aligned with the sealed completion plan. */
export function prioritizeContinuationQuestionIds(questionIds: readonly string[], continuationQuestionIds: readonly string[] | undefined): string[] {
  if (!continuationQuestionIds) return [...questionIds];
  const priority = new Map(continuationQuestionIds.map((questionId, index) => [questionId, index]));
  return [...questionIds].sort((left, right) => (priority.get(left) ?? Number.MAX_SAFE_INTEGER) - (priority.get(right) ?? Number.MAX_SAFE_INTEGER));
}

/**
 * A specialist collection landing endpoint is only an entry point, not proof
 * that it yielded an admissible question-relevant source. Its sealed
 * same-authority fallback must therefore still run.
 */
export function shouldContinueSameAuthorityDiscovery(operation: Pick<ControlledResearchOperation, "status" | "returnedUrls" | "specialistCollectionProfileId">): boolean {
  return operation.status !== "SUCCEEDED" || operation.returnedUrls.length === 0 || operation.specialistCollectionProfileId !== null;
}

/** Builds an escalation query from the sealed authority set without broadening source eligibility. */
export function buildRegisteredAuthorityGroundingQuery(input: { title: string; question: string; verifiedDomains: readonly string[] }): string {
  const domains = [...new Set(input.verifiedDomains.map((domain) => domain.toLocaleLowerCase("en-US").trim()).filter(Boolean))].sort().slice(0, 12);
  // Google Grounding may rewrite search-operator syntax before searching. A
  // natural-language constraint retains the sealed authority boundary without
  // relying on provider-specific query grammar.
  const domainConstraint = domains.length > 0 ? ` Return citations only from these registered authority domains: ${domains.join(", ")}.` : "";
  return `${input.title} ${input.question}.${domainConstraint}`.slice(0, 500);
}

/** Records an unattributable Grounding response as a bounded failed operation, never as evidence. */
export function failedGroundingEscalationOperation(input: { escalationDecisionId: string; researchQuestionId: string; purpose: string; error: unknown }): ControlledResearchOperation {
  const failureReason = input.error instanceof Error ? input.error.message.slice(0, 1_000) : "GROUNDING_UNATTRIBUTABLE_SUPPORT";
  const identity = {
    researchQuestionIds: [input.researchQuestionId], authorityBindingId: null,
    layer: "GAP_CONTEST_ESCALATION" as const, mechanism: "GOOGLE_GROUNDING_ESCALATION" as const,
    endpoint: "https://google.com/", specialistCollectionProfileId: null, attemptOrder: 0, purpose: input.purpose
  };
  return {
    ...identity,
    operationId: contentAddressedId("controlled-research-operation", { escalationDecisionId: input.escalationDecisionId, ...identity }),
    status: "FAILED", returnedUrls: [], providerInternalQueries: [], latencyMs: null, failureReason
  };
}

export type V2AShadowResult = {
  context: ArtifactContext;
  scopeContractId: string;
  researchMapId: string;
  queryPlanId: string | null;
  topicAuthoritySetId: string;
  routingObligationSetId: string | null;
  authorityResearchPlanId: string;
  controlledResearchLedgerId: string;
  perspectiveAuditId: string;
  confidenceVectorId: string;
  sourceSnapshotIds: string[];
  claimVersionIds: string[];
  authorityVerdictIds: string[];
  conflictSetIds: string[];
  eventVersionIds: string[];
  metrics: V2ACertificationMetrics;
  blockingReasons: string[];
};

export class V2ARunError extends Error {
  constructor(message: string, readonly metrics: V2ACertificationMetrics, options?: ErrorOptions) {
    super(message, options);
    this.name = "V2ARunError";
  }
}

export function minimumKnowledgeBlockingReasons(input: { continuation: boolean; durableSources: number; claims: number; supportedClaims: number; eventCandidates: number; unresolvedMaterialConflicts: number }): string[] {
  const reasons: string[] = [];
  if (input.durableSources === 0) reasons.push("NO_DURABLE_SOURCE_SNAPSHOTS");
  if (input.claims === 0) reasons.push("NO_ATOMIC_CLAIMS");
  if (input.supportedClaims === 0) reasons.push("NO_SUPPORTED_CLAIMS");
  // A completion run augments the initial event inventory. Requiring it to
  // independently recreate an event would reject useful gap evidence before
  // the authoritative merged coverage audit can evaluate it.
  if (!input.continuation && input.eventCandidates === 0) reasons.push("NO_RESOLVED_EVENT_CANDIDATES");
  if (input.unresolvedMaterialConflicts > 0) reasons.push("CLAIM_CONFLICT_UNRESOLVED");
  return reasons;
}

export function requiredPerspectiveTags(map: ResearchMap, requiredQuestionIds?: readonly string[]): string[] {
  return requiredPerspectiveRequirements(map, requiredQuestionIds).filter((requirement) => requirement.kind !== "INDEPENDENT_SCHOLARSHIP").map((requirement) => requirement.label);
}

export function requiredPerspectiveRequirements(map: ResearchMap, requiredQuestionIds?: readonly string[]): NonNullable<ResearchMap["questions"][number]["historicalPerspectiveRequirements"]> {
  const required = requiredQuestionIds ? new Set(requiredQuestionIds) : null;
  return [...new Set(map.questions
    .filter((question) => !required || required.has(question.questionId))
    .flatMap((question) => question.historicalPerspectiveRequirements || [])
    .map((requirement) => JSON.stringify(requirement)))].sort().map((requirement) => JSON.parse(requirement) as NonNullable<ResearchMap["questions"][number]["historicalPerspectiveRequirements"]>[number]);
}

export function conflictConfidenceStatus(conflicts: readonly { state: string; material: boolean }[]): "PASS" | "QUALIFIED" | "FAIL" {
  if (conflicts.some((conflict) => conflict.material && conflict.state === "UNRESOLVED")) return "FAIL";
  if (conflicts.some((conflict) => conflict.state === "UNRESOLVED" || conflict.state === "QUALIFIED")) return "QUALIFIED";
  return "PASS";
}

export function independentCorroborationStatus(
  claims: readonly { independenceGroupCount: number; risk: AtomicClaimVersion["risk"] }[]
): "PASS" | "QUALIFIED" | "FAIL" {
  const requiresIndependentCorroboration = new Set<AtomicClaimVersion["risk"]>(["MATERIAL", "INTERPRETIVE", "CONTESTED", "SENSITIVE"]);
  if (claims.some((claim) => requiresIndependentCorroboration.has(claim.risk) && claim.independenceGroupCount < 2)) return "FAIL";
  if (claims.some((claim) => claim.independenceGroupCount < 1)) return "QUALIFIED";
  return "PASS";
}

export function temporalPrecisionStatus(
  events: readonly { temporal: { start: HistoricalDate; uncertainty: string | null } }[],
  continuation: boolean
): "PASS" | "QUALIFIED" | "FAIL" {
  if (events.length === 0) return continuation ? "QUALIFIED" : "FAIL";
  return events.some((event) => event.temporal.start.precision === "APPROXIMATE" || event.temporal.uncertainty !== null) ? "QUALIFIED" : "PASS";
}

export function confidenceRequiresAdditionalBlock(
  confidence: Pick<AcquisitionConfidenceVector, "verdict" | "authorityApplicability" | "evidenceDirectness" | "independentCorroboration" | "perspectiveAdequacy" | "conflictStatus" | "provenanceIntegrity">,
  existingBlockingReasons: readonly string[]
): boolean {
  // .16 defers perspective sufficiency to the evidence-derived coverage audit.
  // A planning-time perspective review alone is not an acquisition failure.
  if (confidence.verdict === "REVIEW_REQUIRED") return confidence.conflictStatus === "REVIEW_REQUIRED";
  if (confidence.verdict !== "FAIL") return false;
  const missingEventOnly = existingBlockingReasons.length === 1 && existingBlockingReasons[0] === "NO_RESOLVED_EVENT_CANDIDATES";
  const independentFailure = confidence.authorityApplicability === "FAIL"
    || confidence.evidenceDirectness === "FAIL"
    || confidence.independentCorroboration === "FAIL"
    || confidence.perspectiveAdequacy !== "PASS"
    || confidence.conflictStatus === "FAIL"
    || confidence.conflictStatus === "REVIEW_REQUIRED"
    || confidence.provenanceIntegrity === "FAIL";
  return !missingEventOnly || independentFailure;
}

export function selectMostPreciseHistoricalDate<T>(values: readonly { value: T; date: HistoricalDate; stableId: string }[]): T | undefined {
  const rank: Record<HistoricalDate["precision"], number> = { DAY: 4, MONTH: 3, YEAR: 2, APPROXIMATE: 1 };
  return [...values].sort((left, right) => rank[right.date.precision] - rank[left.date.precision] || left.stableId.localeCompare(right.stableId))[0]?.value;
}

export function resolutionEntityContext(scopeEntities: ScopeContract["centralEntities"], current: readonly CanonicalEntityVersion[], reusable: readonly CanonicalEntityVersion[]): CanonicalEntityVersion[] {
  const locked = new Set(scopeEntities.map((entity) => `${entity.type}:${normalizedIdentityText(entity.name)}`));
  const byEntityId = new Map<string, CanonicalEntityVersion>();
  for (const entity of reusable) if (entity.resolutionState === "RESOLVED" && locked.has(`${entity.entityType}:${normalizedIdentityText(entity.canonicalName)}`)) byEntityId.set(entity.entityId, entity);
  for (const entity of current) if (entity.resolutionState === "RESOLVED" && locked.has(`${entity.entityType}:${normalizedIdentityText(entity.canonicalName)}`)) byEntityId.set(entity.entityId, entity);
  return [...byEntityId.values()].sort((left, right) => left.entityVersionId.localeCompare(right.entityVersionId));
}

/** Legacy telemetry normalization retained only to reconstruct historical
 * Google-grounded acquisition evidence. Authority-First does not use this as
 * an execution budget or canonical acquisition ledger. */
export function uniqueProviderQueries(acquisitions: readonly { webSearchQueries: string[] }[]): string[] {
  return [...new Set(acquisitions.flatMap((acquisition) => acquisition.webSearchQueries).map((query) => query.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US")))].sort();
}

export function reconnaissanceArtifactId(context: ArtifactContext, reconnaissance: Record<string, unknown>): string {
  return executionArtifactId("recon-record", context, reconnaissance);
}

export type OrchestratorDependencies = {
  repository?: V2FirestoreRepository;
  provider?: V2ModelProvider;
  retrieval?: RetrievalDependencies;
  institutionalDiscoveryTransport?: InstitutionalDiscoveryTransport;
  /** Injection point for deterministic deadline tests. Production creates one owner per run. */
  supervisor?: AuthorityFirstExecutionSupervisor;
  onRunStarted?: (context: ArtifactContext) => void;
  /** A3 continuation mode reuses the locked scope and a versioned Research Map,
   * then executes the same certified acquisition/claim/authority/resolution path. */
  continuation?: {
    context: ArtifactContext;
    originalKnowledgeRunId: string;
    scope: ScopeContract;
    researchMap: ResearchMap;
    gapIdsByQuestionId?: ReadonlyMap<string, readonly string[]>;
    priorTopicAuthoritySet: TopicAuthoritySet;
  };
};

function publisherForUrl(url: string, publishers: PublisherAuthorityVersion[]): PublisherAuthorityVersion | undefined {
  const hostname = new URL(url).hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "");
  return publishers.find((publisher) => publisher.knownDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)));
}

function publisherForDomain(domain: string, publishers: PublisherAuthorityVersion[]): PublisherAuthorityVersion | undefined {
  const hostname = domain.toLocaleLowerCase("en-US").replace(/^https?:\/\//u, "").replace(/^www\./u, "").split("/", 1)[0]!;
  return publishers.find((publisher) => publisher.knownDomains.some((known) => hostname === known || hostname.endsWith(`.${known}`)));
}

async function mapLimit<T, R>(items: readonly T[], concurrency: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Merges bounded authority proposals without granting semantic authority to
 * any planned historical perspective. */
function mergeAuthorityProposals(proposals: readonly TopicAuthorityProposal[]): TopicAuthorityProposal[] {
  const merged = new Map<string, TopicAuthorityProposal>();
  for (const proposal of proposals) {
    const existing = merged.get(proposal.publisherVersionId);
    if (!existing) {
      merged.set(proposal.publisherVersionId, { ...proposal, researchQuestionIds: [...proposal.researchQuestionIds].sort(), roles: [...proposal.roles].sort(), claimTypes: [...proposal.claimTypes].sort(), perspectiveTags: [...proposal.perspectiveTags].sort(), historicalJurisdictionCapacityIds: [...(proposal.historicalJurisdictionCapacityIds || [])].sort(), routingObligationIds: [] });
      continue;
    }
    merged.set(proposal.publisherVersionId, {
      ...existing,
      researchQuestionIds: [...new Set([...existing.researchQuestionIds, ...proposal.researchQuestionIds])].sort(),
      roles: [...new Set([...existing.roles, ...proposal.roles])].sort(),
      claimTypes: [...new Set([...existing.claimTypes, ...proposal.claimTypes])].sort(),
      perspectiveTags: [...new Set([...existing.perspectiveTags, ...proposal.perspectiveTags])].sort(),
      historicalJurisdictionCapacityIds: [...new Set([...(existing.historicalJurisdictionCapacityIds || []), ...(proposal.historicalJurisdictionCapacityIds || [])])].sort(),
      routingObligationIds: [],
      rationale: existing.rationale
    });
  }
  return [...merged.values()].sort((left, right) => left.publisherVersionId.localeCompare(right.publisherVersionId));
}

function modelTokens(executions: Array<{ usage: { inputTokens: number | null; outputTokens: number | null }; transportAttempts: number; repairAttempt: number }>): { input: number | null; output: number | null; retries: number; repairs: number } {
  const inputs = executions.map((execution) => execution.usage.inputTokens);
  const outputs = executions.map((execution) => execution.usage.outputTokens);
  return {
    input: inputs.every((value) => value === null) ? null : inputs.reduce<number>((total, value) => total + (value || 0), 0),
    output: outputs.every((value) => value === null) ? null : outputs.reduce<number>((total, value) => total + (value || 0), 0),
    retries: executions.reduce((total, execution) => total + Math.max(0, execution.transportAttempts - 1), 0),
    repairs: executions.filter((execution) => execution.repairAttempt > 0).length
  };
}

function provisionalSourceClass(publisher: PublisherAuthorityVersion | undefined): SourceDocument["sourceClass"] {
  if (!publisher) return "OTHER";
  if (publisher.knownDomains.some((domain) => domain.includes("wikipedia.org"))) return "WIKIPEDIA";
  if (publisher.state === "VERIFIED" && publisher.primarySecondaryTendency === "PRIMARY") return "PRIMARY_INSTITUTIONAL";
  if (["ARCHIVE", "GOVERNMENT", "MUSEUM", "STANDARDS_BODY"].includes(publisher.institutionType)) return "PRIMARY_INSTITUTIONAL";
  if (publisher.institutionType === "NEWSROOM") return "ESTABLISHED_JOURNALISM";
  if (publisher.institutionType === "EDITED_REFERENCE") return "EDITED_REFERENCE";
  if (publisher.institutionType === "UNIVERSITY" || publisher.institutionType === "SCHOLARLY_PUBLISHER") return "SCHOLARLY_SECONDARY";
  return "OTHER";
}

function operationProjection(input: { context: ArtifactContext; state: "RUNNING" | "FAILED" | "COMPLETED"; stage: "A1_SCHEMAS" | "A2_SCOPE_ACQUISITION" | "A3_CLAIMS" | "A4_AUTHORITY_CONFLICTS" | "A5_RESOLUTION_REUSE" | "COMPLETE"; startedAt: number; blockingReason: string | null; counts: Record<string, number>; finalVerdict: "PENDING" | "PASS" | "FAIL" }) {
  return topicOperationSchema.parse({ operationId: input.context.runId, corpusId: input.context.corpusId, topicId: input.context.topicId, runId: input.context.runId, generation: input.context.generation, pipelineVersion: V2_PIPELINE_VERSION, executionMode: "SHADOW", state: input.state, stage: input.stage, scopeState: input.stage === "A1_SCHEMAS" ? "PENDING" : "LOCKED", researchMapState: ["A1_SCHEMAS", "A2_SCOPE_ACQUISITION"].includes(input.stage) ? "PENDING" : "VALID", currentBlockingReason: input.blockingReason, counts: input.counts, budgetsConsumed: {}, elapsedMs: Date.now() - input.startedAt, finalVerdict: input.finalVerdict, updatedAt: new Date().toISOString() });
}

export async function runV2AShadowFixture(descriptor: ShadowFixtureDescriptor, config: FactoryV2Config, dependencies: OrchestratorDependencies = {}): Promise<V2AShadowResult> {
  assertV2AShadowEnabled(config);
  const repository = dependencies.repository || new V2FirestoreRepository();
  const startedAt = Date.now();
  // Authority-First acquisition owns the complete knowledge-construction run.
  // Its versioned Controlled Research Operation budget is authoritative; do
  // not silently clamp it to the superseded V2-A ten-minute shadow target.
  const configuredDeadlineAt = authorityFirstRunDeadlineAt(startedAt, config.budgetBundle.maximumWorkerSeconds);
  const supervisor = dependencies.supervisor || new AuthorityFirstExecutionSupervisor(startedAt, configuredDeadlineAt);
  // Tests may inject only a shorter deadline.  Production has exactly one
  // owner: the supervisor constructed from the immutable budget bundle.
  if (supervisor.deadlineAt > configuredDeadlineAt) throw new Error("AUTHORITY_FIRST_SUPERVISOR_EXTENDS_CONFIGURED_DEADLINE");
  const deadlineAt = supervisor.deadlineAt;
  const assertDeadline = () => {
    if (Date.now() >= deadlineAt) throw new Error("WHOLE_RUN_DEADLINE_EXCEEDED");
  };
  const expectedTopicId = sha256(`${descriptor.language}\n${normalizedIdentityText(descriptor.title)}`);
  const continuation = dependencies.continuation;
  const context: ArtifactContext = continuation
    ? continuation.context
    : { corpusId: repository.activeCorpusId(), topicId: expectedTopicId, runId: randomUUID(), generation: 1, createdAt: new Date().toISOString() };
  dependencies.onRunStarted?.(context);
  const topicId = context.topicId;
  if (continuation) {
    if (continuation.scope.topicId !== expectedTopicId || continuation.scope.title !== descriptor.title) throw new Error("A3 continuation Scope Contract does not match the requested topic.");
    if (continuation.scope.corpusId !== context.corpusId || continuation.researchMap.corpusId !== context.corpusId) throw new Error("A3 continuation artifacts cross the active corpus boundary.");
    if (continuation.researchMap.scopeContractId !== continuation.scope.scopeContractId) throw new Error("A3 continuation lineage is invalid.");
    if (continuation.researchMap.parentArtifactId === null) throw new Error("A3 continuation requires a versioned Research Map linked to its immutable parent.");
  }
  const modelExecutions: Array<ReturnType<typeof modelExecutionSchema.parse>> = [];
  const blockingReasons: string[] = [];
  let firestoreWrites = 0;
  let cloudStorageWrites = 0;
  let lastCompletedOperation: string | null = "RUN_INITIALIZED";
  const durableSnapshotIds: string[] = [];
  const durableClaimVersionIds: string[] = [];
  const durableEventVersionIds: string[] = [];
  const bounded = async <T>(name: string, maximumMs: number, work: () => Promise<T>): Promise<T> => {
    const value = await supervisor.runChild({ name, maximumMs: Math.min(maximumMs, Math.max(1, deadlineAt - Date.now())), run: () => work() });
    lastCompletedOperation = name;
    return value;
  };
  const terminalWrite = async <T>(work: () => Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([work(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("DEADLINE_TERMINAL_SEAL_TIMEOUT")), 2_000); })]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  };
  const progress = {
    sourceDocumentsDiscovered: 0, directRetrievalAttempts: 0, retrievalSuccesses: 0, retrievalFailures: 0,
    retrievalsSuppressedByHostCircuit: 0, retrievalRejectionReasons: {} as Record<string, number>, sourceDocumentsSnapshotted: 0,
    retrievalFailureDetails: [] as V2ACertificationMetrics["retrievalFailureDetails"],
    evidencePackets: 0, evidencePacketSegments: 0, claimsExtracted: 0, claimsSupported: 0, claimsRejected: 0,
    conflictsDetected: 0, conflictsResolved: 0, conflictsUnresolved: 0, entityCandidates: 0, resolvedEntities: 0,
    eventCandidates: 0, resolvedCanonicalEventCandidates: 0, nonEventKnowledgeItems: 0,
    sourceRanking: [] as V2ACertificationMetrics["sourceRanking"], providerQueries: [] as string[],
    candidateQueriesProposed: 0, candidateQueriesAuthorized: 0, candidateQueriesRejected: 0, explicitQueriesExecuted: 0,
    explicitSearchRequests: 0, explicitSearchResults: 0, explicitSearchLatencyMs: 0, explicitSearchCostUsd: 0, explicitSearchCostMeasured: true, queryLedgerId: null as string | null,
    topicAuthoritySetId: null as string | null, authorityResearchPlanId: null as string | null, controlledResearchLedgerId: null as string | null, perspectiveAuditId: null as string | null, confidenceVectorId: null as string | null, controlledResearchOperations: 0
  };
  let currentStage: Parameters<typeof operationProjection>[0]["stage"] = "A1_SCHEMAS";
  const persist = async (collection: Parameters<V2FirestoreRepository["createImmutable"]>[0], artifact: Record<string, unknown>) => {
    try {
      const result = await bounded(`firestore:create:${collection}`, 30_000, () => repository.createImmutable(collection, artifact));
      if (result === "CREATED") firestoreWrites += 1;
    } catch (error) {
      throw new Error(`${collection}/${String(artifact.artifactId || "missing-id")}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const persistSemanticDerivation = async (collection: string, artifact: Record<string, unknown>, execution: ReturnType<typeof modelExecutionSchema.parse> | undefined) => {
    if (!execution) return;
    const artifactId = String(artifact.artifactId);
    const artifactHash = String(artifact.payloadHash);
    const auditRecordId = executionArtifactId("audit", context, { action: "SEMANTIC_ARTIFACT_DERIVATION", collection, artifactId, artifactHash, executionId: execution.executionId });
    const audit = parseSealedArtifact(auditRecordSchema, {
      ...immutableEnvelope(context, auditRecordId),
      auditRecordId,
      action: "SEMANTIC_ARTIFACT_DERIVATION",
      actorType: "MODEL",
      actorId: execution.model,
      artifactRefs: [
        { collection, id: artifactId, payloadHash: artifactHash },
        { collection: "v2ModelExecutions", id: execution.executionId, payloadHash: execution.payloadHash }
      ],
      details: { executionId: execution.executionId, semanticArtifactId: artifactId }
    });
    await persist("v2AuditRecords", audit);
  };
  try {
    await bounded("firestore:set-operation:A1", 30_000, () => repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: {}, finalVerdict: "PENDING" })));
    firestoreWrites += 1;

  const publishers = bootstrapPublisherRegistry(context);
  for (const publisher of publishers) {
    await persist("v2PublisherAuthorityVersions", publisher);
    const current = await bounded("firestore:get-publisher-head", 30_000, () => repository.getById("v2PublisherAuthorityRecords", publisher.publisherId));
    const head = publisherAuthorityRecordSchema.parse({ publisherId: publisher.publisherId, corpusId: context.corpusId, canonicalNameKey: normalizedIdentityText(publisher.canonicalName), currentVersionId: publisher.publisherVersionId, currentVersion: publisher.version, state: publisher.state, updatedAt: context.createdAt });
    const result = await bounded("firestore:advance-publisher-head", 30_000, () => repository.advanceHead({ collection: "v2PublisherAuthorityRecords", headId: publisher.publisherId, expectedCurrentVersionId: typeof current?.currentVersionId === "string" ? current.currentVersionId : null, nextVersionId: publisher.publisherVersionId, data: head }));
    if (result !== "IDEMPOTENT") firestoreWrites += 1;
  }

  const scopeResult = continuation
    ? { scope: continuation.scope, executions: [] }
    : await proposeScope({ context, title: descriptor.title, language: descriptor.language, ongoingAsOf: descriptor.ongoingAsOf, reconnaissance: { classification: "NO_LEGACY_CONTENT_REUSE", existingKnowledgeWillBeInspectedAfterScopeLock: true }, provider: dependencies.provider, deadlineAt, supervisor });
  modelExecutions.push(...scopeResult.executions.map((execution) => modelExecutionSchema.parse(execution)));
  for (const execution of scopeResult.executions) await persist("v2ModelExecutions", execution);
  if (!continuation) {
    await persist("v2ScopeContracts", scopeResult.scope);
    await persistSemanticDerivation("v2ScopeContracts", scopeResult.scope, scopeResult.executions.at(-1));
  }

  const reconnaissance = await performBoundedReconnaissance({ repository, topicId, scopeContractId: scopeResult.scope.scopeContractId, entityNameKeys: scopeResult.scope.centralEntities.map((entity) => normalizedIdentityText(entity.name)), limitPerKind: 25, supervisor });
  const reconnaissanceId = reconnaissanceArtifactId(context, reconnaissance);
  const reconnaissanceArtifact = parseSealedArtifact(reconnaissanceRecordSchema, { ...immutableEnvelope(context, reconnaissanceId), reconnaissanceId, scopeContractId: scopeResult.scope.scopeContractId, knownEntityIds: reconnaissance.knownEntities.map((item) => String(item.entityId || item.id)), admittedEventVersionIds: reconnaissance.admittedEvents.map((item) => String(item.eventVersionId || item.id)), strongClaimVersionIds: reconnaissance.strongClaims.map((item) => String(item.claimVersionId || item.id)), reusableSnapshotIds: reconnaissance.reusableSnapshots.map((item) => String(item.sourceSnapshotId || item.id)), conflictSetIds: reconnaissance.conflicts.map((item) => String(item.conflictSetId || item.id)), gaps: reconnaissance.gaps, legacyInputsExcluded: true });
  await persist("v2ReconnaissanceRecords", reconnaissanceArtifact);

  assertDeadline();
  const mapResult = continuation
    ? { map: continuation.researchMap, executions: [] }
    : await generateResearchMap({ context, scope: scopeResult.scope, reconnaissance, provider: dependencies.provider, deadlineAt, supervisor });
  modelExecutions.push(...mapResult.executions.map((execution) => modelExecutionSchema.parse(execution)));
  for (const execution of mapResult.executions) await persist("v2ModelExecutions", execution);
  await persist("v2ResearchMaps", mapResult.map);
  await persistSemanticDerivation("v2ResearchMaps", mapResult.map, mapResult.executions.at(-1));
  assertDeadline();
  const requiredAuthorityQuestionIds = continuation?.gapIdsByQuestionId ? [...continuation.gapIdsByQuestionId.keys()] : undefined;
  // .16 deliberately has no pre-acquisition route-selection, batching, or
  // repair phase. The bounded authority set is an acquisition universe, not
  // evidence of perspective sufficiency.
  const authorityProposalResult = await generateTopicAuthorityProposals({ context, scope: scopeResult.scope, map: mapResult.map, publishers, requiredQuestionIds: requiredAuthorityQuestionIds, routingObligations: [], provider: dependencies.provider, deadlineAt, supervisor });
  modelExecutions.push(...authorityProposalResult.executions.map((execution) => modelExecutionSchema.parse(execution)));
  for (const execution of authorityProposalResult.executions) await persist("v2ModelExecutions", execution);
  const protectedAvailability = completeProtectedAvailabilityProposals({
    scope: scopeResult.scope,
    researchMap: mapResult.map,
    publishers,
    proposals: authorityProposalResult.proposals,
    requiredQuestionIds: requiredAuthorityQuestionIds
  });
  // This is not universal predictive routing. It ranks only protected
  // requirements that remain ambiguous after Registry-only completion.
  const protectedSelection = protectedAvailability.unresolved.length === 0 ? null : await selectRoutingObligationBatch({
    context,
    scope: scopeResult.scope,
    map: mapResult.map,
    publishers,
    obligations: protectedAvailability.unresolved.map((items) => items[0]!).map((candidate) => ({ routingObligationId: candidate.requirementId, researchQuestionId: candidate.researchQuestionId, requirementKind: candidate.requirementKind, label: candidate.requirementLabel, rationale: "Locked protected availability requires selection from the already eligible Registry candidate set." })),
    candidates: protectedAvailability.unresolved.flat().map((candidate) => ({ routingObligationId: candidate.requirementId, researchQuestionId: candidate.researchQuestionId, publisherVersionId: candidate.publisherVersionId, eligibleRoles: candidate.eligibleRoles, subjectRelationship: candidate.subjectRelationship, authorityFamily: candidate.authorityFamily, independenceGroupId: publishers.find((publisher) => publisher.publisherVersionId === candidate.publisherVersionId)!.independenceGroupId, specialistCollectionProfileIds: [] })),
    provider: dependencies.provider,
    deadlineAt,
    supervisor
  });
  if (protectedSelection) {
    modelExecutions.push(...protectedSelection.executions.map((execution) => modelExecutionSchema.parse(execution)));
    for (const execution of protectedSelection.executions) await persist("v2ModelExecutions", execution);
    for (const decision of protectedAvailability.decisions) {
      const selected = protectedSelection.proposals.find((proposal) => proposal.routingObligationIds.includes(decision.requirementId));
      if (!selected) continue;
      decision.selectedPublisherVersionId = selected.publisherVersionId;
      decision.selectedHistoricalJurisdictionCapacityIds = selected.historicalJurisdictionCapacityIds || [];
      decision.selectionMethod = "BOUNDED_AI_SELECTION";
    }
  }
  const allAuthorityProposals = mergeAuthorityProposals([...protectedAvailability.proposals, ...(protectedSelection?.proposals || [])]);
  let topicAuthoritySet = buildTopicAuthoritySet({ context, scope: scopeResult.scope, researchMap: mapResult.map, publishers, proposals: allAuthorityProposals, protectedAvailabilityDecisions: protectedAvailability.decisions, requiredQuestionIds: requiredAuthorityQuestionIds, parentTopicAuthoritySetId: continuation?.priorTopicAuthoritySet.topicAuthoritySetId });
  await persist("v2TopicAuthoritySets", topicAuthoritySet);
  await persistSemanticDerivation("v2TopicAuthoritySets", topicAuthoritySet, authorityProposalResult.executions.at(-1));
  const authorityResearchPlan = buildAuthorityResearchPlan({ context, set: topicAuthoritySet, researchMap: mapResult.map });
  await persist("v2AuthorityResearchPlans", authorityResearchPlan);
  let perspectiveAudit = auditPerspective({ context, set: topicAuthoritySet, requiredPerspectiveTags: requiredPerspectiveTags(mapResult.map, requiredAuthorityQuestionIds), requiredPerspectiveRequirements: requiredPerspectiveRequirements(mapResult.map, requiredAuthorityQuestionIds), sensitive: false });
  await persist("v2PerspectiveAudits", perspectiveAudit);
  progress.topicAuthoritySetId = topicAuthoritySet.topicAuthoritySetId;
  progress.authorityResearchPlanId = authorityResearchPlan.authorityResearchPlanId;
  progress.perspectiveAuditId = perspectiveAudit.perspectiveAuditId;

  currentStage = "A2_SCOPE_ACQUISITION";
  await bounded("firestore:set-operation:A2", 30_000, () => repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: {}, finalVerdict: "PENDING" })));
  assertDeadline();
  const bindingById = new Map(topicAuthoritySet.bindings.map((binding) => [binding.bindingId, binding]));
  const groundingAttributionByUrl = new Map<string, { publisherDomain: string; title: string; discoveryText: string }>();
  const operationsByBinding = new Map<string, typeof authorityResearchPlan.operations>();
  for (const planned of authorityResearchPlan.operations) {
    const grouped = operationsByBinding.get(planned.authorityBindingId) || [];
    grouped.push(planned);
    operationsByBinding.set(planned.authorityBindingId, grouped);
  }
  const controlledOperations = (await mapLimit([...operationsByBinding.values()], authorityResearchPlan.budget.maximumConcurrency, async (plannedOperations): Promise<ControlledResearchOperation[]> => {
    const attempts: ControlledResearchOperation[] = [];
    for (const planned of [...plannedOperations].sort((left, right) => left.attemptOrder - right.attemptOrder || left.plannedOperationId.localeCompare(right.plannedOperationId))) {
      const binding = bindingById.get(planned.authorityBindingId);
      if (!binding) throw new Error(`AUTHORITY_RESEARCH_PLAN_BINDING_MISSING:${planned.authorityBindingId}`);
      const operation = await bounded(`institutional-discovery:${planned.plannedOperationId}`, 90_000, () => executeInstitutionalDiscovery({ binding, researchQuestionIds: planned.researchQuestionIds, layer: planned.layer, mechanism: planned.mechanism, endpoint: planned.endpoint, specialistCollectionProfileId: planned.specialistCollectionProfileId, attemptOrder: planned.attemptOrder, purpose: planned.purpose, transport: dependencies.institutionalDiscoveryTransport, signal: AbortSignal.any([supervisor.signal, AbortSignal.timeout(Math.max(1, deadlineAt - Date.now()))]) }));
      attempts.push(operation);
      if (!shouldContinueSameAuthorityDiscovery(operation)) break;
    }
    return attempts;
  })).flat();
  const questionById = new Map(mapResult.map.questions.map((question) => [question.questionId, question]));
  const initiallyCoveredQuestionIds = new Set(controlledOperations.filter((operation) => operation.status === "SUCCEEDED" && operation.returnedUrls.length > 0).flatMap((operation) => operation.researchQuestionIds.filter((questionId) => {
    const question = questionById.get(questionId);
    if (!question) return false;
    return operation.returnedUrls.some((url) => {
      try {
        const canonicalUrl = canonicalizeUrl(url);
        const parsed = new URL(canonicalUrl);
        return isDiscoveryRelevant({ canonicalUrl, originalUrl: url, title: parsed.pathname.split("/").filter(Boolean).at(-1) || parsed.hostname, domain: parsed.hostname.replace(/^www\./u, ""), queryId: operation.operationId, researchQuestionIds: [questionId], role: "AUTHORITY_TARGETED", intendedSourceClass: "PRIMARY_INSTITUTIONAL", discoveryOrder: 0 }, question, mapResult.map);
      } catch { return false; }
    });
  })));
  const escalationQuestionIds = prioritizeContinuationQuestionIds(
    mapResult.map.questions
    .filter((question) => question.priority === "CRITICAL" && (!requiredAuthorityQuestionIds || requiredAuthorityQuestionIds.includes(question.questionId)) && !initiallyCoveredQuestionIds.has(question.questionId))
    .map((question) => question.questionId),
    continuation?.gapIdsByQuestionId ? [...continuation.gapIdsByQuestionId.keys()] : undefined
  );
  const escalationQuestions = escalationQuestionIds.map((questionId) => questionById.get(questionId)!)
    .slice(0, Math.min(authorityResearchPlan.budget.maximumGroundingEscalationCalls, authorityResearchPlan.budget.maximumControlledDiscoveryOperations - controlledOperations.length));
  for (const question of escalationQuestions) {
    const mappedAttempts = controlledOperations.filter((operation) => operation.researchQuestionIds.includes(question.questionId)).length;
    const gapIds = continuation?.gapIdsByQuestionId?.get(question.questionId) || [`authority-gap-${question.questionId}`];
    const decision = authorizeEscalation({ context, set: topicAuthoritySet, researchQuestionIds: [question.questionId], gapIds: [...gapIds], reason: controlledOperations.some((operation) => operation.researchQuestionIds.includes(question.questionId) && operation.status === "FAILED") ? "AUTHORITY_INACCESSIBLE" : "MATERIAL_COVERAGE_GAP", mappedAuthorityOperationsAttempted: mappedAttempts, gapOperationsConsumed: controlledOperations.filter((operation) => operation.layer === "GAP_CONTEST_ESCALATION").length, allowedPurpose: `Locate directly retrievable registered-authority pages for the unmet Research Map question: ${question.text}` });
    await persist("v2EscalationDecisions", decision);
    const registeredDomains = topicAuthoritySet.bindings.filter((binding) => binding.researchQuestionIds.includes(question.questionId)).flatMap((binding) => binding.verifiedDomains);
    const queryId = contentAddressedId("authority-escalation-query", { escalationDecisionId: decision.escalationDecisionId, questionId: question.questionId });
    let acquisition: Awaited<ReturnType<typeof runGroundedAcquisition>>;
    try {
      acquisition = await runGroundedAcquisition({ context, provider: dependencies.provider, deadlineAt, supervisor, query: {
        queryId, researchQuestionIds: [question.questionId], role: "AUTHORITY_TARGETED", intendedSourceClass: "PRIMARY_INSTITUTIONAL", aliasesAndTerms: [scopeResult.scope.title], language: descriptor.language,
        geography: question.geography.length > 0 ? question.geography.slice(0, 8) : ["International"], providerQuery: buildRegisteredAuthorityGroundingQuery({ title: scopeResult.scope.title, question: question.text, verifiedDomains: registeredDomains }), providerReportedQueries: [], budgetUnits: 1, resultArtifactIds: []
      } });
    } catch (error) {
      controlledOperations.push(failedGroundingEscalationOperation({ escalationDecisionId: decision.escalationDecisionId, researchQuestionId: question.questionId, purpose: decision.allowedPurpose, error }));
      continue;
    }
    modelExecutions.push(modelExecutionSchema.parse(acquisition.execution));
    await persist("v2ModelExecutions", acquisition.execution);
    const expansionPublishers = registeredGroundingExpansionPublishers({ set: topicAuthoritySet, publishers, researchQuestionId: question.questionId, references: acquisition.chunks });
    if (expansionPublishers.length > 0) {
      try {
        const expansionResult = await generateTopicAuthorityProposals({ context, scope: scopeResult.scope, map: mapResult.map, publishers: expansionPublishers, requiredQuestionIds: [question.questionId], routingObligations: [], maximumRepairs: 0, provider: dependencies.provider, deadlineAt, supervisor });
        modelExecutions.push(...expansionResult.executions.map((execution) => modelExecutionSchema.parse(execution)));
        for (const execution of expansionResult.executions) await persist("v2ModelExecutions", execution);
        const parentTopicAuthoritySetId = topicAuthoritySet.topicAuthoritySetId;
        allAuthorityProposals.push(...expansionResult.proposals);
        topicAuthoritySet = buildTopicAuthoritySet({ context, scope: scopeResult.scope, researchMap: mapResult.map, publishers, proposals: allAuthorityProposals, requiredQuestionIds: requiredAuthorityQuestionIds, parentTopicAuthoritySetId });
        await persist("v2TopicAuthoritySets", topicAuthoritySet);
        await persistSemanticDerivation("v2TopicAuthoritySets", topicAuthoritySet, expansionResult.executions.at(-1));
        for (const binding of topicAuthoritySet.bindings) bindingById.set(binding.bindingId, binding);
        perspectiveAudit = auditPerspective({ context, set: topicAuthoritySet, requiredPerspectiveTags: requiredPerspectiveTags(mapResult.map, requiredAuthorityQuestionIds), requiredPerspectiveRequirements: requiredPerspectiveRequirements(mapResult.map, requiredAuthorityQuestionIds), sensitive: false });
        await persist("v2PerspectiveAudits", perspectiveAudit);
        progress.topicAuthoritySetId = topicAuthoritySet.topicAuthoritySetId;
        progress.perspectiveAuditId = perspectiveAudit.perspectiveAuditId;
      } catch (error) {
        if (!(error instanceof StructuredStageError)) throw error;
        for (const execution of error.executions) {
          modelExecutions.push(modelExecutionSchema.parse(execution));
          await persist("v2ModelExecutions", execution);
        }
        const failurePayload = { stage: "GROUNDING_AUTHORITY_EXPANSION", failureClass: "SOURCE_AUTHORITY_INSUFFICIENT" as const, severity: "WARNING" as const, retryable: false, message: error.message.slice(0, 1900), blockingArtifactIds: [topicAuthoritySet.topicAuthoritySetId, question.questionId], attemptsConsumed: error.executions.length, budgetConsumed: {} };
        const failureRecordId = executionArtifactId("failure", context, failurePayload);
        await persist("v2FailureRecords", parseSealedArtifact(v2FailureRecordSchema, { ...immutableEnvelope(context, failureRecordId), failureRecordId, ...failurePayload }));
      }
    }
    const returnedUrls = acquisition.chunks.flatMap((chunk) => {
      try {
        const publisher = publisherForUrl(chunk.url, publishers) || (chunk.domain ? publisherForDomain(chunk.domain, publishers) : undefined);
        if (!publisher) return [];
        const binding = topicAuthoritySet.bindings.find((candidate) => candidate.publisherVersionId === publisher.publisherVersionId && candidate.researchQuestionIds.includes(question.questionId));
        if (!binding) return [];
        const canonicalUrl = canonicalizeUrl(chunk.url);
        const discoveryText = acquisition.supports.filter((support) => support.chunkIndices.includes(chunk.chunkIndex)).map((support) => support.attributedText).join(" ").slice(0, 12_000);
        groundingAttributionByUrl.set(canonicalUrl, { publisherDomain: publisher.knownDomains[0]!, title: chunk.title, discoveryText });
        return [canonicalUrl];
      } catch { return []; }
    });
    const authorizedUrls = [...new Set(returnedUrls)].slice(0, 60);
    const operationIdentity = {
      researchQuestionIds: [question.questionId], authorityBindingId: null,
      layer: "GAP_CONTEST_ESCALATION" as const, mechanism: "GOOGLE_GROUNDING_ESCALATION" as const,
      endpoint: "https://google.com/", specialistCollectionProfileId: null, attemptOrder: 0, purpose: decision.allowedPurpose
    };
    controlledOperations.push({ ...operationIdentity, operationId: contentAddressedId("controlled-research-operation", { escalationDecisionId: decision.escalationDecisionId, ...operationIdentity }), status: authorizedUrls.length > 0 ? "SUCCEEDED" : "FAILED", returnedUrls: authorizedUrls, providerInternalQueries: acquisition.webSearchQueries, latencyMs: acquisition.execution.latencyMs, failureReason: authorizedUrls.length > 0 ? null : "GROUNDING_NO_REGISTERED_AUTHORITY_URL" });
  }
  progress.controlledResearchOperations = controlledOperations.length;
  const discovered = new Map<string, DiscoveredSourceCandidate>();
  let discoveryOrder = 0;
  for (const operation of controlledOperations) for (const returnedUrl of operation.returnedUrls) {
    let key: string;
    try { key = canonicalizeUrl(returnedUrl); } catch { continue; }
    const groundingAttribution = groundingAttributionByUrl.get(key);
    const returnedPublisher = publisherForUrl(key, publishers) || (groundingAttribution ? publisherForDomain(groundingAttribution.publisherDomain, publishers) : undefined);
    const binding = operation.authorityBindingId
      ? bindingById.get(operation.authorityBindingId)
      : topicAuthoritySet.bindings.find((candidate) => candidate.publisherVersionId === returnedPublisher?.publisherVersionId && candidate.researchQuestionIds.some((id) => operation.researchQuestionIds.includes(id)));
    if (!binding) continue;
    const domain = groundingAttribution?.publisherDomain || new URL(key).hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "");
    const publisher = publishers.find((candidate) => candidate.publisherVersionId === binding.publisherVersionId);
    const existing = discovered.get(key);
    if (existing) {
      existing.researchQuestionIds = [...new Set([...existing.researchQuestionIds, ...operation.researchQuestionIds])];
      existing.specialistCollectionProfileId ||= operation.specialistCollectionProfileId;
      existing.discoveryText = [...new Set([existing.discoveryText, groundingAttribution?.discoveryText].filter((value): value is string => Boolean(value)))].join(" ").slice(0, 12_000);
    } else discovered.set(key, { canonicalUrl: key, originalUrl: returnedUrl, title: groundingAttribution?.title || new URL(key).pathname.split("/").filter(Boolean).at(-1) || publisher?.canonicalName || domain, domain, queryId: operation.operationId, researchQuestionIds: [...operation.researchQuestionIds], role: operation.layer === "ORIENTATION" ? "ORIENTATION" : "AUTHORITY_TARGETED", intendedSourceClass: provisionalSourceClass(publisher), discoveryOrder: discoveryOrder++, specialistCollectionProfileId: operation.specialistCollectionProfileId, discoveryText: groundingAttribution?.discoveryText || groundingAttribution?.title || "" });
  }
  const coverageAdmission = rankCoverageSourcesByQuestion({
    candidates: [...discovered.values()],
    map: mapResult.map,
    publishers,
    maximumSources: Math.min(40, config.budgetBundle.maximumSourceDocuments),
    // Controlled operations are already Registry-bound to their exact
    // questions. Metadata relevance is a ranking signal, not an additional
    // authority gate; retain one bounded retrieval path when it is empty.
    allowBoundAuthorityFallback: true
  });
  const sourceCandidates = coverageAdmission.retrievalCandidates;
  progress.sourceDocumentsDiscovered = discovered.size;
  progress.directRetrievalAttempts = 0;
  progress.sourceRanking = sourceCandidates.map((candidate, index) => ({ rank: index + 1, urlHash: sha256(candidate.canonicalUrl), domain: candidate.domain, admittedQuestionCount: candidate.admittedQuestionIds.length }));
  if (coverageAdmission) for (const decision of coverageAdmission.decisions) {
    const decisionPayload = { questionId: decision.questionId, urlHash: sha256(decision.canonicalUrl), rank: decision.rank, disposition: decision.disposition, exclusionReason: decision.exclusionReason, authorityEligibility: decision.authorityEligibility, admissionScore: decision.admissionScore, components: JSON.stringify(decision.components), temporalSignals: decision.matchedTemporalSignals.join(",").slice(0, 1000), eventSignals: decision.matchedEventSignals.join(",").slice(0, 1000), publisherDomain: decision.domain };
    const auditRecordId = contentAddressedId("audit", { runId: context.runId, action: "COVERAGE_SOURCE_ADMISSION", ...decisionPayload });
    const audit = parseSealedArtifact(auditRecordSchema, { ...immutableEnvelope(context, auditRecordId), auditRecordId, action: "COVERAGE_SOURCE_ADMISSION", actorType: "POLICY", actorId: "gap-aware-source-admission-v1", artifactRefs: [{ collection: "v2ResearchMaps", id: mapResult.map.researchMapId, payloadHash: mapResult.map.payloadHash }], details: decisionPayload });
    await persist("v2AuditRecords", audit);
  }
  let retrievalFailures = 0;
  let retrievalsSuppressedByHostCircuit = 0;
  const retrievalRejectionReasons = new Map<string, number>();
  const hostFailures = new Map<string, number>();
  const hostTails = new Map<string, Promise<void>>();
  async function serializedForHost<T>(host: string, task: () => Promise<T>): Promise<T> {
    const previous = hostTails.get(host) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    hostTails.set(host, previous.then(() => current));
    await previous;
    try { return await task(); } finally { release(); }
  }
  type RetrievedSource = Awaited<ReturnType<typeof retrieveSource>> & { admittedQuestionIds: string[]; admissionScores: Record<string, number> };
  const retrievedWithDuplicates = (await mapLimit(sourceCandidates, config.budgetBundle.maximumConcurrency, async (candidate): Promise<RetrievedSource | null> => serializedForHost(candidate.domain, async () => {
    if ((hostFailures.get(candidate.domain) || 0) >= 2) {
      retrievalsSuppressedByHostCircuit += 1;
      if (coverageAdmission) {
        const details = { urlHash: sha256(candidate.canonicalUrl), questionIds: candidate.admittedQuestionIds.join(",").slice(0, 1000), disposition: "RETRIEVAL_SUPPRESSED_HOST_CIRCUIT", publisherDomain: candidate.domain };
        const auditRecordId = contentAddressedId("audit", { runId: context.runId, action: "COVERAGE_SOURCE_RETRIEVAL", ...details });
        await persist("v2AuditRecords", parseSealedArtifact(auditRecordSchema, { ...immutableEnvelope(context, auditRecordId), auditRecordId, action: "COVERAGE_SOURCE_RETRIEVAL", actorType: "POLICY", actorId: "gap-aware-source-admission-v1", artifactRefs: [], details }));
      }
      return null;
    }
    const retrievalStartedAt = Date.now();
    progress.directRetrievalAttempts += 1;
    try {
      assertDeadline();
      const existing = await bounded(`firestore:reusable-source:${sha256(candidate.canonicalUrl).slice(0, 12)}`, 30_000, () => repository.getReusableSource(candidate.canonicalUrl));
      const freshness = scopeResult.scope.topicClass === "ONGOING_SUBJECT" ? "ONGOING" : "IMMUTABLE_HISTORICAL";
      if (existing && canReuseSnapshot(existing.snapshot as SourceSnapshot, freshness, scopeResult.scope.ongoingAsOf)) {
        progress.retrievalSuccesses += 1;
        return { source: existing.source as SourceDocument, snapshot: existing.snapshot as SourceSnapshot, evidenceSegments: existing.evidenceSegments as EvidenceSegment[], archiveWrites: 0, cacheDisposition: "CACHE_HIT", admittedQuestionIds: candidate.admittedQuestionIds, admissionScores: candidate.admissionScores };
      }
      const initialPublisher = publisherForDomain(candidate.domain, publishers) || publisherForUrl(candidate.canonicalUrl, publishers);
      if (!initialPublisher || !topicAuthoritySet.bindings.some((binding) => binding.publisherVersionId === initialPublisher.publisherVersionId)) throw new Error(`SOURCE_OUTSIDE_TOPIC_AUTHORITY_SET:${candidate.canonicalUrl}`);
      const result = await bounded(`source-retrieval:${sha256(candidate.canonicalUrl).slice(0, 12)}`, 90_000, () => retrieveSource({ context, url: candidate.originalUrl, titleHint: candidate.title, publisherId: initialPublisher?.publisherId || null, sourceClass: provisionalSourceClass(initialPublisher), primarySecondaryRole: initialPublisher?.primarySecondaryTendency || "UNKNOWN", languageHint: descriptor.language, specialistCollectionProfileId: candidate.specialistCollectionProfileId || null }, {
        ...dependencies.retrieval,
        signal: AbortSignal.any([supervisor.signal, AbortSignal.timeout(Math.max(1, deadlineAt - Date.now()))]),
        cachedSource: async (resolvedUrl) => {
          const cached = await bounded(`firestore:cached-source:${sha256(resolvedUrl).slice(0, 12)}`, 30_000, () => repository.getReusableSource(resolvedUrl));
          if (!cached) return null;
          return { source: cached.source as SourceDocument, snapshot: cached.snapshot as SourceSnapshot, evidenceSegments: cached.evidenceSegments as EvidenceSegment[], reusable: canReuseSnapshot(cached.snapshot as SourceSnapshot, freshness, scopeResult.scope.ongoingAsOf) };
        }
      }));
      cloudStorageWrites += result.archiveWrites;
      progress.retrievalSuccesses += 1;
      return { ...result, admittedQuestionIds: candidate.admittedQuestionIds, admissionScores: candidate.admissionScores };
    } catch (error) {
      retrievalFailures += 1;
      progress.retrievalFailures = retrievalFailures;
      hostFailures.set(candidate.domain, (hostFailures.get(candidate.domain) || 0) + 1);
      const message = error instanceof Error ? error.message.slice(0, 300) : "Unknown retrieval failure";
      const rejectionCode = message.split(":", 1)[0]!.trim() || "UNKNOWN_RETRIEVAL_FAILURE";
      retrievalRejectionReasons.set(rejectionCode, (retrievalRejectionReasons.get(rejectionCode) || 0) + 1);
      progress.retrievalRejectionReasons = Object.fromEntries([...retrievalRejectionReasons.entries()].sort());
      progress.retrievalFailureDetails.push({ urlHash: sha256(candidate.canonicalUrl), reason: rejectionCode, latencyMs: Date.now() - retrievalStartedAt });
      console.error(JSON.stringify({ severity: "WARNING", component: "factory-v2-source-retrieval", topicId, urlHash: sha256(candidate.canonicalUrl), message }));
      if (coverageAdmission) {
        const details = { urlHash: sha256(candidate.canonicalUrl), questionIds: candidate.admittedQuestionIds.join(",").slice(0, 1000), disposition: "RETRIEVAL_FAILED_REPLACED", publisherDomain: candidate.domain, message };
        const auditRecordId = contentAddressedId("audit", { runId: context.runId, action: "COVERAGE_SOURCE_RETRIEVAL", ...details });
        await persist("v2AuditRecords", parseSealedArtifact(auditRecordSchema, { ...immutableEnvelope(context, auditRecordId), auditRecordId, action: "COVERAGE_SOURCE_RETRIEVAL", actorType: "POLICY", actorId: "gap-aware-source-admission-v1", artifactRefs: [], details }));
      }
      return null;
    }
  }))).filter((value): value is NonNullable<typeof value> => value !== null);
  const retrievedByContent = new Map<string, RetrievedSource>();
  for (const result of retrievedWithDuplicates) {
    const key = result.snapshot.contentHash;
    const existing = retrievedByContent.get(key);
    if (existing) {
      existing.admittedQuestionIds = [...new Set([...existing.admittedQuestionIds, ...result.admittedQuestionIds])];
      existing.admissionScores = { ...existing.admissionScores, ...result.admissionScores };
    }
    else retrievedByContent.set(key, result);
  }
  const retrieved = [...retrievedByContent.values()];
  progress.retrievalSuccesses = retrievedWithDuplicates.length;
  progress.sourceDocumentsSnapshotted = retrieved.length;
  progress.retrievalsSuppressedByHostCircuit = retrievalsSuppressedByHostCircuit;
  const controlledResearchLedger = sealControlledResearchLedger({ context, set: topicAuthoritySet, operations: controlledOperations, directRetrievalCount: progress.directRetrievalAttempts });
  await persist("v2ControlledResearchLedgers", controlledResearchLedger);
  progress.controlledResearchLedgerId = controlledResearchLedger.controlledResearchLedgerId;

  const publisherVersions = [...publishers];
  const publisherBySource = new Map<string, PublisherAuthorityVersion>();
  for (const result of retrieved) {
    assertDeadline();
    const publisher = publisherForUrl(result.source.canonicalUrl, publisherVersions);
    if (!publisher || !topicAuthoritySet.bindings.some((binding) => binding.publisherVersionId === publisher.publisherVersionId)) throw new Error(`RETRIEVED_SOURCE_OUTSIDE_TOPIC_AUTHORITY_SET:${result.source.canonicalUrl}`);
    const { id: _repositoryId, ...sourcePayload } = result.source as SourceDocument & { id?: string };
    const source = sourceDocumentSchema.parse({ ...sourcePayload, publisherId: publisher.publisherId, sourceClass: provisionalSourceClass(publisher), primarySecondaryRole: publisher.primarySecondaryTendency, authorityDomains: publisher.authorityDomains });
    if (result.cacheDisposition === "CACHE_NOT_APPLICABLE" || result.cacheDisposition === "REFETCHED") {
      const sourceWrite = await bounded(`firestore:upsert-source:${source.sourceId}`, 30_000, () => repository.upsertSourceDocument(source));
      if (sourceWrite !== "IDEMPOTENT") firestoreWrites += 1;
      await persist("v2SourceSnapshots", result.snapshot);
      if (result.evidenceSegments.length > 0) {
        const segmentWrites = await bounded(`firestore:create-segments:${result.snapshot.sourceSnapshotId}`, 30_000, () => repository.createImmutableBatch("v2EvidenceSegments", result.evidenceSegments));
        firestoreWrites += segmentWrites.created;
      }
    }
    publisherBySource.set(source.sourceId, publisher);
    result.source = source;
    durableSnapshotIds.push(result.snapshot.sourceSnapshotId);
    const auditRecordId = contentAddressedId("audit", { runId: context.runId, action: "SOURCE_CACHE_DECISION", sourceId: source.sourceId, snapshotId: result.snapshot.sourceSnapshotId, status: result.cacheDisposition });
    const cacheAudit = parseSealedArtifact(auditRecordSchema, { ...immutableEnvelope(context, auditRecordId), auditRecordId, action: "SOURCE_CACHE_DECISION", actorType: "POLICY", actorId: "factory-v2-a-cache-policy.4", artifactRefs: [{ collection: "v2SourceSnapshots", id: result.snapshot.sourceSnapshotId, payloadHash: result.snapshot.payloadHash }], details: { cacheStatus: result.cacheDisposition, sourceId: source.sourceId, snapshotId: result.snapshot.sourceSnapshotId } });
    await persist("v2AuditRecords", cacheAudit);
  }

  currentStage = "A3_CLAIMS";
  await bounded("firestore:set-operation:A3", 30_000, () => repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: { sources: retrieved.length }, finalVerdict: "PENDING" })));
  const priorityRank = { CRITICAL: 0, IMPORTANT: 1, SUPPORTING: 2 } as const;
  const requiresIndependentExtraction = (question: ResearchMap["questions"][number]) => question.contested || question.claimTypesExpected.some((claimType) => ["INTERPRETATION", "CAUSATION", "CONSEQUENCE", "ATTRIBUTION"].includes(claimType));
  const questionsForExtraction = mapResult.map.questions.filter((question) => question.priority !== "SUPPORTING" && (!continuation?.gapIdsByQuestionId || continuation.gapIdsByQuestionId.has(question.questionId)))
    .sort((left, right) => {
      const leftTargeted = continuation?.gapIdsByQuestionId?.has(left.questionId) ? 0 : 1;
      const rightTargeted = continuation?.gapIdsByQuestionId?.has(right.questionId) ? 0 : 1;
      return leftTargeted - rightTargeted || priorityRank[left.priority] - priorityRank[right.priority] || left.questionId.localeCompare(right.questionId);
    });
  const candidatesByQuestion = new Map(questionsForExtraction.map((question) => {
    const packetCandidates = retrieved.flatMap((result) => {
    if (!result.admittedQuestionIds.includes(question.questionId) || result.evidenceSegments.length === 0) return [];
    const packet = selectEvidencePacket({ question, segments: result.evidenceSegments, entityNames: scopeResult.scope.centralEntities.map((entity) => entity.name) });
    return packet.segments.length === 0 ? [] : [{ result, question, packet }];
    });
    if (coverageAdmission) {
      const ranked = packetCandidates.map((item) => ({ ...item, canonicalKey: item.result.source.canonicalUrl, admissionScore: item.result.admissionScores[question.questionId] || 0, usable: item.result.snapshot.retrievalDisposition !== "UNAVAILABLE" && item.packet.segments.length > 0, independenceGroupId: publisherBySource.get(item.result.source.sourceId)?.independenceGroupId || item.result.source.sourceId }));
      const requiresIndependentSelection = requiresIndependentExtraction(question);
      return [question.questionId, requiresIndependentSelection ? selectIndependentCoverageCandidates(ranked, 2) : selectUsableCoverageCandidates(ranked, 2)] as const;
    }
    return [question.questionId, packetCandidates.sort((left, right) => {
    const authority = (item: typeof left) => publisherBySource.get(item.result.source.sourceId)?.state === "VERIFIED" ? 100 : 0;
    return authority(right) - authority(left) || right.packet.score - left.packet.score || left.result.source.sourceId.localeCompare(right.result.source.sourceId);
    }).slice(0, 2)] as const;
  }));
  if (coverageAdmission) for (const question of questionsForExtraction) {
    const selectedIds = new Set((candidatesByQuestion.get(question.questionId) || []).map((item) => item.result.source.sourceId));
    const questionResults = retrieved.filter((result) => result.admittedQuestionIds.includes(question.questionId));
    for (const result of questionResults) {
      const usable = result.evidenceSegments.length > 0 && result.snapshot.retrievalDisposition !== "UNAVAILABLE";
      const disposition = selectedIds.has(result.source.sourceId) ? "EXTRACTION_SELECTED" : usable ? "NOT_SELECTED_AFTER_RETRIEVAL" : "RETRIEVAL_UNUSABLE_REPLACED";
      const details = { questionId: question.questionId, sourceId: result.source.sourceId, snapshotId: result.snapshot.sourceSnapshotId, admissionScore: result.admissionScores[question.questionId] || 0, disposition, usable, cacheDisposition: result.cacheDisposition };
      const auditRecordId = contentAddressedId("audit", { runId: context.runId, action: "COVERAGE_SOURCE_POST_RETRIEVAL", ...details });
      const audit = parseSealedArtifact(auditRecordSchema, { ...immutableEnvelope(context, auditRecordId), auditRecordId, action: "COVERAGE_SOURCE_POST_RETRIEVAL", actorType: "POLICY", actorId: "gap-aware-source-admission-v1", artifactRefs: [{ collection: "v2SourceSnapshots", id: result.snapshot.sourceSnapshotId, payloadHash: result.snapshot.payloadHash }], details });
      await persist("v2AuditRecords", audit);
    }
  }
  // Ten packets bound model work and graph fan-out while reserving the second
  // source for critical claims that require independent corroboration before
  // lower-priority breadth consumes the extraction ceiling.
  const criticalQuestions = questionsForExtraction.filter((question) => question.priority === "CRITICAL");
  const importantQuestions = questionsForExtraction.filter((question) => question.priority === "IMPORTANT");
  const candidateAt = (question: ResearchMap["questions"][number], rank: number) => {
    const candidate = candidatesByQuestion.get(question.questionId)?.[rank];
    return candidate ? [candidate] : [];
  };
  const claimInputs = [
    ...criticalQuestions.flatMap((question) => candidateAt(question, 0)),
    ...criticalQuestions.filter(requiresIndependentExtraction).flatMap((question) => candidateAt(question, 1)),
    ...importantQuestions.flatMap((question) => candidateAt(question, 0)),
    ...criticalQuestions.filter((question) => !requiresIndependentExtraction(question)).flatMap((question) => candidateAt(question, 1)),
    ...importantQuestions.flatMap((question) => candidateAt(question, 1))
  ].slice(0, 10);
  progress.evidencePackets = claimInputs.length;
  progress.evidencePacketSegments = claimInputs.reduce((total, input) => total + input.packet.segments.length, 0);
  let claimExtractionFailures = 0;
  const extractedAttempts = await mapLimit(claimInputs, config.budgetBundle.maximumConcurrency, async ({ result, question, packet }) => {
    try {
      assertDeadline();
      return await extractAtomicClaims({ context, scope: scopeResult.scope, sourceSnapshotId: result.snapshot.sourceSnapshotId, segments: packet.segments, question, provider: dependencies.provider, deadlineAt, supervisor });
    } catch (error) {
      claimExtractionFailures += 1;
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 1900);
      const failedExecutions = error instanceof StructuredStageError ? error.executions : [];
      for (const execution of failedExecutions) {
        modelExecutions.push(execution);
        try { await persist("v2ModelExecutions", execution); } catch { /* The per-source failure record still captures the fault. */ }
      }
      const failurePayload = { stage: "CLAIM_EXTRACTION" as const, failureClass: "CLAIM_UNSUPPORTED" as const, severity: "WARNING" as const, retryable: false, message, blockingArtifactIds: [result.snapshot.sourceSnapshotId], attemptsConsumed: failedExecutions.length, budgetConsumed: {} };
      const failureRecordId = executionArtifactId("failure", context, failurePayload);
      const failure = parseSealedArtifact(v2FailureRecordSchema, {
        ...immutableEnvelope(context, failureRecordId), failureRecordId, ...failurePayload,
      });
      try { await persist("v2FailureRecords", failure); } catch { /* Continue with other independently acquired sources. */ }
      return null;
    }
  });
  const extractedGroups = extractedAttempts.filter((group): group is NonNullable<typeof group> => group !== null);
  for (const group of extractedGroups) {
    modelExecutions.push(...group.executions.map((execution) => modelExecutionSchema.parse(execution)));
    for (const execution of group.executions) await persist("v2ModelExecutions", execution);
  }
  const extractedClaims = extractedGroups.flatMap((group) => group.claims).slice(0, config.budgetBundle.maximumAtomicClaims);
  const claimContributors = new Map<string, AtomicClaimVersion[]>();
  const claimIdByProposition = new Map<string, string>();
  for (const extracted of extractedClaims) {
    const proposition = claimPropositionKey(extracted);
    const claimId = claimIdByProposition.get(proposition) || extracted.claimId;
    claimIdByProposition.set(proposition, claimId);
    if (claimId !== extracted.claimId) throw new Error("PROPOSITION_IDENTITY_NONDETERMINISTIC");
    claimContributors.set(claimId, [...(claimContributors.get(claimId) || []), extracted]);
  }
  const claims = [...claimContributors.values()].map((contributors) => contributors[0]!);
  progress.claimsExtracted = claims.length;
  const claimExecution = new Map(extractedGroups.flatMap((group) => group.claims.map((claim) => [claim.claimId, group.executions.at(-1)] as const)));
  const semanticClassByClaim = new Map(extractedGroups.flatMap((group) => [...group.semanticClasses.entries()]));
  for (let index = 0; index < claims.length; index += 1) {
    const extracted = claims[index]!;
    const existingHead = await bounded(`firestore:get-claim-head:${extracted.claimId}`, 30_000, () => repository.getById("v2AtomicClaims", extracted.claimId));
    const priorVersionId = typeof existingHead?.currentVersionId === "string" ? existingHead.currentVersionId : null;
    const claim = priorVersionId && priorVersionId !== extracted.claimVersionId ? buildAtomicClaimVersion(context, {
      claimId: extracted.claimId, scopeContractId: extracted.scopeContractId, subject: extracted.subject, predicate: extracted.predicate, object: extracted.object,
      normalizedAssertion: extracted.normalizedAssertion, claimType: extracted.claimType, risk: extracted.risk, temporal: extracted.temporal,
      candidateEventClusterId: extracted.candidateEventClusterId, locationEntityIds: extracted.locationEntityIds, qualifiers: extracted.qualifiers,
      extractedFromSnapshotId: extracted.extractedFromSnapshotId, extractedFromSegmentIds: extracted.extractedFromSegmentIds, conflictState: extracted.conflictState,
      validationState: extracted.validationState, evidenceVerdictId: extracted.evidenceVerdictId, supersedesClaimVersionId: priorVersionId,
    }, extracted.modelExecutionRef) : extracted;
    if (claim.claimVersionId !== extracted.claimVersionId) {
      const semanticClass = semanticClassByClaim.get(extracted.claimVersionId);
      semanticClassByClaim.delete(extracted.claimVersionId);
      if (semanticClass) semanticClassByClaim.set(claim.claimVersionId, semanticClass);
      claims[index] = claim;
    }
    await persist("v2AtomicClaimVersions", claim);
    await persistSemanticDerivation("v2AtomicClaimVersions", claim, claimExecution.get(claim.claimId));
    const currentVersion = typeof existingHead?.currentVersion === "number" ? existingHead.currentVersion : 0;
    const headState = await bounded(`firestore:advance-claim-head:${claim.claimId}`, 30_000, () => repository.advanceHead({ collection: "v2AtomicClaims", headId: claim.claimId, expectedCurrentVersionId: priorVersionId, nextVersionId: claim.claimVersionId, data: { claimId: claim.claimId, subjectKey: normalizedIdentityText(claim.subject.label), predicate: claim.predicate, currentVersion: currentVersion + 1, state: "CANDIDATE", updatedAt: context.createdAt } }));
    if (headState === "CREATED") firestoreWrites += 1;
    durableClaimVersionIds.push(claim.claimVersionId);
  }
  const snapshotsById = new Map(retrieved.map((item) => [item.snapshot.sourceSnapshotId, item]));
  const segmentsById = new Map(retrieved.flatMap((item) => item.evidenceSegments).map((segment) => [segment.evidenceSegmentId, segment]));
  const evidenceEdges: ClaimEvidenceEdge[] = [];
  const evidenceEdgeIds = new Set<string>();
  for (const claim of claims) {
    for (const contributor of claimContributors.get(claim.claimId) || [claim]) {
      const sourceResult = snapshotsById.get(contributor.extractedFromSnapshotId);
      if (!sourceResult) continue;
      const publisher = publisherBySource.get(sourceResult.source.sourceId);
      const independence = independenceGroup({ publisher, contentHash: sourceResult.snapshot.contentHash });
      for (const segmentId of contributor.extractedFromSegmentIds) {
        if (!segmentsById.has(segmentId)) continue;
        const wikipedia = publisher?.knownDomains.some((domain) => domain.includes("wikipedia.org"));
        const authorityFinding: ClaimEvidenceEdge["authorityFinding"] = wikipedia ? "PROHIBITED" : sourceResult.snapshot.partial || sourceResult.snapshot.accessLimitations.length > 0 ? "MODERATE" : publisher?.state === "VERIFIED" ? "STRONG" : "UNCLASSIFIED";
        const edge = buildClaimEvidenceEdge(context, { claimVersionId: claim.claimVersionId, evidenceSegmentId: segmentId, relationship: "SUPPORTS", relevance: "DIRECT", authorityFinding, publisherVersionId: publisher?.publisherVersionId || null, independenceGroupId: independence.independenceGroupId, dependenceBasis: independence.dependenceBasis, evaluator: "DETERMINISTIC" });
        if (evidenceEdgeIds.has(edge.claimEvidenceId)) continue;
        evidenceEdgeIds.add(edge.claimEvidenceId);
        evidenceEdges.push(edge);
        const edgeState = await bounded(`firestore:create-claim-edge:${edge.claimEvidenceId}`, 30_000, () => repository.createEdgeWithReferences({ collection: "v2ClaimEvidence", edge, references: [{ collection: "v2AtomicClaimVersions", id: claim.claimVersionId }, { collection: "v2EvidenceSegments", id: segmentId }] }));
        if (edgeState === "CREATED") firestoreWrites += 1;
      }
    }
  }
  currentStage = "A4_AUTHORITY_CONFLICTS";
  await bounded("firestore:set-operation:A4", 30_000, () => repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: { claims: claims.length, evidenceEdges: evidenceEdges.length }, finalVerdict: "PENDING" })));
  const conflictSets = detectClaimConflicts({ context, claims, evidenceEdges });
  for (const conflict of conflictSets) await persist("v2ClaimConflictSets", conflict);
  const publishersByVersion = new Map(publisherVersions.map((publisher) => [publisher.publisherVersionId, publisher]));
  const authorityBindingsByPublisherVersionId = new Map(topicAuthoritySet.bindings.map((binding) => [binding.publisherVersionId, binding]));
  const verdicts: ClaimAuthorityVerdict[] = [];
  for (const claim of claims) {
    const conflict = conflictSets.find((set) => set.claimVersionIds.includes(claim.claimVersionId));
    const verdict = evaluateClaimAuthority({ context, claim, evidenceEdges: evidenceEdges.filter((edge) => edge.claimVersionId === claim.claimVersionId), publishersByVersionId: publishersByVersion, authorityBindingsByPublisherVersionId, conflictSet: conflict });
    verdicts.push(verdict);
    await persist("v2ClaimAuthorityVerdicts", verdict);
  }
  progress.claimsSupported = verdicts.filter((verdict) => verdict.verdict === "SUPPORTED" || verdict.verdict === "QUALIFIED").length;
  progress.claimsRejected = verdicts.filter((verdict) => verdict.verdict === "INSUFFICIENT" || verdict.verdict === "REJECTED").length;
  progress.conflictsDetected = conflictSets.length;
  progress.conflictsResolved = conflictSets.filter((conflict) => ["RESOLVED", "QUALIFIED"].includes(conflict.state)).length;
  progress.conflictsUnresolved = conflictSets.filter((conflict) => conflict.state === "UNRESOLVED").length;

  currentStage = "A5_RESOLUTION_REUSE";
  await bounded("firestore:set-operation:A5", 30_000, () => repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: { claims: claims.length, conflicts: conflictSets.length }, finalVerdict: "PENDING" })));
  const passingClaimIds = new Set(verdicts.filter((verdict) => verdict.verdict === "SUPPORTED" || verdict.verdict === "QUALIFIED").map((verdict) => verdict.claimVersionId));
  const identityEvidence = [...new Set(claims.filter((claim) => passingClaimIds.has(claim.claimVersionId)).flatMap((claim) => claim.extractedFromSegmentIds).filter((id) => segmentsById.has(id)))];
  const entities: CanonicalEntityVersion[] = [];
  for (const entityRef of scopeResult.scope.centralEntities) {
    if (identityEvidence.length === 0) break;
    const entityNameKey = normalizedIdentityText(entityRef.name);
    const entityEvidence = identityEvidence.filter((segmentId) => {
      const segment = segmentsById.get(segmentId);
      return segment ? normalizedIdentityText(segment.exactText).includes(entityNameKey) : false;
    });
    if (entityEvidence.length === 0) continue;
    const candidate = buildCanonicalEntityVersion(context, { version: 1, entityType: entityRef.type, canonicalName: entityRef.name, language: entityRef.language, externalIdentifiers: entityRef.entityId ? [{ scheme: "scope", value: entityRef.entityId }] : [], activeTemporal: null, geographyKeys: scopeResult.scope.spatialScope.included, state: "FACTORY_CANDIDATE", resolutionState: "PROPOSED", identityEvidenceSegmentIds: entityEvidence.slice(0, 20), supersedesEntityVersionId: null });
    const existingHeads = (await bounded(`firestore:find-entity:${entityNameKey}`, 30_000, () => repository.boundedQuery("v2CanonicalEntities", [{ field: "canonicalNameKey", op: "==", value: normalizedIdentityText(candidate.canonicalName) }], 20))).filter((head) => head.entityType === candidate.entityType);
    const existing = (await Promise.all(existingHeads.map((head) => bounded(`firestore:get-entity-version:${String(head.currentVersionId)}`, 30_000, () => repository.getById("v2CanonicalEntityVersions", String(head.currentVersionId)))))).filter((item): item is CanonicalEntityVersion => item !== null) as CanonicalEntityVersion[];
    const resolution = resolveEntityCandidate({ candidate, existing, aliases: [] });
    const priorEntity = resolution.state === "REUSED" ? existing.find((item) => item.entityVersionId === resolution.entityVersionId) : undefined;
    const buildResolvedEntity = (version: number, supersedesEntityVersionId: string | null) => buildCanonicalEntityVersion(context, {
      entityId: resolution.state === "REUSED" ? resolution.entityId : candidate.entityId,
      version,
      entityType: candidate.entityType,
      canonicalName: candidate.canonicalName,
      language: candidate.language,
      externalIdentifiers: candidate.externalIdentifiers,
      activeTemporal: candidate.activeTemporal,
      geographyKeys: candidate.geographyKeys,
      state: candidate.state,
      resolutionState: resolution.state === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : "RESOLVED",
      identityEvidenceSegmentIds: candidate.identityEvidenceSegmentIds,
      supersedesEntityVersionId
    });
    const replayEntity = priorEntity ? buildResolvedEntity(priorEntity.version, priorEntity.supersedesEntityVersionId) : null;
    const resolved = priorEntity && replayEntity?.entityVersionId === priorEntity.entityVersionId
      ? replayEntity
      : buildResolvedEntity((priorEntity?.version || 0) + 1, priorEntity?.entityVersionId || null);
    entities.push(resolved);
    await persist("v2CanonicalEntityVersions", resolved);
    if (!priorEntity || resolved.entityVersionId !== priorEntity.entityVersionId) {
      const head = canonicalEntityRecordSchema.parse({ entityId: resolved.entityId, corpusId: context.corpusId, entityType: resolved.entityType, canonicalNameKey: normalizedIdentityText(resolved.canonicalName), currentVersionId: resolved.entityVersionId, currentVersion: resolved.version, state: resolved.state, updatedAt: context.createdAt });
      const state = await bounded(`firestore:advance-entity-head:${resolved.entityId}`, 30_000, () => repository.advanceHead({ collection: "v2CanonicalEntities", headId: resolved.entityId, expectedCurrentVersionId: priorEntity?.entityVersionId || null, nextVersionId: resolved.entityVersionId, data: head }));
      if (state === "CREATED") firestoreWrites += 1;
    }
    const aliasPayload = { entityId: resolved.entityId, entityVersionId: resolved.entityVersionId, entityType: resolved.entityType, alias: resolved.canonicalName, aliasKey: normalizedIdentityText(resolved.canonicalName), language: resolved.language, script: null, aliasType: "CANONICAL" as const };
    const semanticContext = { ...context, policyVersion: V2_POLICY_VERSION };
    const aliasId = semanticArtifactId("entity-alias", semanticContext, aliasPayload);
    const alias = parseSealedArtifact(entityAliasSchema, { ...semanticEnvelope(semanticContext, aliasId, resolved.entityVersionId), entityAliasId: aliasId, ...aliasPayload });
    await persist("v2EntityAliases", alias);
  }

  const reusableEntities = (await Promise.all(reconnaissance.knownEntities.slice(0, 25).map(async (head) => {
    const currentVersionId = typeof head.currentVersionId === "string" ? head.currentVersionId : null;
    if (!currentVersionId) return null;
    const value = await bounded(`firestore:get-reusable-entity:${currentVersionId}`, 30_000, () => repository.getById("v2CanonicalEntityVersions", currentVersionId));
    if (!value) return null;
    const { id: _repositoryDocumentId, ...artifact } = value;
    const parsed = canonicalEntityVersionSchema.safeParse(artifact);
    return parsed.success ? parsed.data : null;
  }))).filter((entity): entity is CanonicalEntityVersion => entity !== null);
  const resolutionEntities = resolutionEntityContext(scopeResult.scope.centralEntities, entities, reusableEntities);

  const claimsByCluster = new Map<string, AtomicClaimVersion[]>();
  for (const claim of claims) {
    const key = claim.candidateEventClusterId || `claim-${claim.claimId}`;
    claimsByCluster.set(key, [...(claimsByCluster.get(key) || []), claim]);
  }
  const events: CanonicalEventVersion[] = [];
  const eventResolutionDiagnostics = new Map<string, number>();
  const rejectEventCluster = (reason: string) => eventResolutionDiagnostics.set(reason, (eventResolutionDiagnostics.get(reason) || 0) + 1);
  for (const cluster of claimsByCluster.values()) {
    const core = cluster.filter((claim) => passingClaimIds.has(claim.claimVersionId));
    if (core.length === 0) { rejectEventCluster("NO_SUPPORTED_CORE_CLAIM"); continue; }
    if (resolutionEntities.length === 0) { rejectEventCluster("NO_RESOLVED_ENTITY"); continue; }
    const clusterEvidenceText = core.flatMap((claim) => claim.extractedFromSegmentIds).flatMap((segmentId) => {
      const segment = segmentsById.get(segmentId);
      return segment ? [segment.exactText] : [];
    });
    const clusterText = normalizedIdentityText([...cluster.map((claim) => `${claim.subject.label} ${typeof claim.object.value === "string" || typeof claim.object.value === "number" ? claim.object.value : claim.object.value.label} ${claim.normalizedAssertion}`), ...clusterEvidenceText].join(" "));
    const relatedEntities = resolutionEntities.filter((entity) => clusterText.includes(normalizedIdentityText(entity.canonicalName)));
    if (relatedEntities.length === 0) { rejectEventCluster("NO_RELATED_RESOLVED_ENTITY"); continue; }
    const semanticClass = semanticClassByClaim.get(cluster[0]!.claimVersionId) || "CONTEXT";
    const temporalClaim = selectMostPreciseHistoricalDate(core.flatMap((claim) => {
      const date = claim.temporal?.start || (claim.claimType === "DATE" && typeof claim.object.value === "object" ? claim.object.value : null);
      return date ? [{ value: claim, date, stableId: claim.claimVersionId }] : [];
    }));
    const start = temporalClaim?.temporal?.start || (temporalClaim?.claimType === "DATE" && typeof temporalClaim.object.value === "object" ? temporalClaim.object.value : null);
    if (!start) { rejectEventCluster("NO_EVIDENCED_TEMPORAL_START"); continue; }
    const action = core.find((claim) => claim.claimType === "OCCURRENCE" || claim.claimType === "INSTITUTIONAL_ACTION");
    if (!action) { rejectEventCluster("NO_OCCURRENCE_OR_INSTITUTIONAL_ACTION"); continue; }
    let event = buildCanonicalEventVersion(context, { version: 1, scopeContractId: scopeResult.scope.scopeContractId, canonicalTitle: action.subject.label, semanticClass, eventSubtype: semanticClass === "EVENT" ? "OCCURRENCE" : null, temporal: { start, end: temporalClaim?.temporal?.end || null, uncertainty: start.precision === "APPROXIMATE" ? "Approximate date preserved from evidence." : null }, actionKey: action.normalizedAssertion.slice(0, 300), primaryEntityKeys: relatedEntities.map((entity) => entity.entityId).slice(0, 20), locationKeys: core.flatMap((claim) => claim.locationEntityIds).slice(0, 20), coreClaimVersionIds: core.map((claim) => claim.claimVersionId).slice(0, 20), supportingClaimVersionIds: cluster.filter((claim) => !core.includes(claim)).map((claim) => claim.claimVersionId).slice(0, 40), authorityState: "FACTORY_CANDIDATE", canonicalizationState: semanticClass === "EVENT" ? "RESOLVED" : "INELIGIBLE", parentEventId: null, supersedesEventVersionId: null });
    if (event.semanticClass === "EVENT" && !eventWithinLockedScope(scopeResult.scope, event)) {
      event = buildCanonicalEventVersion(context, { version: 1, scopeContractId: event.scopeContractId, canonicalTitle: event.canonicalTitle, semanticClass: "CONTEXT", eventSubtype: null, temporal: event.temporal, actionKey: event.actionKey, primaryEntityKeys: event.primaryEntityKeys, locationKeys: event.locationKeys, coreClaimVersionIds: event.coreClaimVersionIds, supportingClaimVersionIds: event.supportingClaimVersionIds, authorityState: event.authorityState, canonicalizationState: "INELIGIBLE", parentEventId: null, supersedesEventVersionId: null });
    }
    const existingHeads = await bounded(`firestore:find-event:${event.eventIdentityKey.slice(0, 32)}`, 30_000, () => repository.boundedQuery("v2CanonicalEvents", [{ field: "eventIdentityKey", op: "==", value: event.eventIdentityKey }], 50));
    const existing = (await Promise.all(existingHeads.map((head) => bounded(`firestore:get-event-version:${String(head.currentVersionId)}`, 30_000, () => repository.getById("v2CanonicalEventVersions", String(head.currentVersionId)))))).filter((item): item is CanonicalEventVersion => item !== null) as CanonicalEventVersion[];
    const resolution = resolveEventCandidate(event, existing);
    const priorEvent = resolution.state === "REUSED" ? existing.find((item) => item.eventVersionId === resolution.eventVersionId) : undefined;
    const buildResolvedEvent = (version: number, supersedesEventVersionId: string | null) => buildCanonicalEventVersion(context, {
      canonicalEventId: resolution.canonicalEventId,
      candidateEventId: event.candidateEventId,
      version,
      scopeContractId: event.scopeContractId,
      canonicalTitle: event.canonicalTitle,
      semanticClass: event.semanticClass,
      eventSubtype: event.eventSubtype,
      temporal: event.temporal,
      actionKey: event.actionKey,
      primaryEntityKeys: event.primaryEntityKeys,
      locationKeys: event.locationKeys,
      coreClaimVersionIds: event.coreClaimVersionIds,
      supportingClaimVersionIds: event.supportingClaimVersionIds,
      authorityState: event.authorityState,
      canonicalizationState: event.canonicalizationState,
      parentEventId: event.parentEventId,
      supersedesEventVersionId
    });
    const replayEvent = priorEvent ? buildResolvedEvent(priorEvent.version, priorEvent.supersedesEventVersionId) : null;
    const resolved = resolution.state !== "REUSED" ? event
      : priorEvent && replayEvent?.eventVersionId === priorEvent.eventVersionId ? replayEvent
        : buildResolvedEvent((priorEvent?.version || event.version) + 1, priorEvent?.eventVersionId || resolution.eventVersionId);
    events.push(resolved);
    await persist("v2CanonicalEventVersions", resolved);
    if (resolved.semanticClass === "EVENT" && resolved.canonicalEventId && (!priorEvent || resolved.eventVersionId !== priorEvent.eventVersionId)) {
      const canonicalEventId = resolved.canonicalEventId;
      const head = canonicalEventRecordSchema.parse({ canonicalEventId, corpusId: context.corpusId, eventIdentityKey: resolved.eventIdentityKey, currentVersionId: resolved.eventVersionId, currentVersion: resolved.version, state: resolved.authorityState, updatedAt: context.createdAt });
      const state = await bounded(`firestore:advance-event-head:${canonicalEventId}`, 30_000, () => repository.advanceHead({ collection: "v2CanonicalEvents", headId: canonicalEventId, expectedCurrentVersionId: priorEvent?.eventVersionId || null, nextVersionId: resolved.eventVersionId, data: head }));
      if (state === "CREATED") firestoreWrites += 1;
    }
    for (const claimId of [...resolved.coreClaimVersionIds, ...resolved.supportingClaimVersionIds]) {
      const edgePayload = { eventVersionId: resolved.eventVersionId, claimVersionId: claimId, role: resolved.coreClaimVersionIds.includes(claimId) ? "CORE" as const : "SUPPORTING" as const };
      const semanticContext = { ...context, policyVersion: V2_POLICY_VERSION };
      const edgeId = semanticArtifactId("event-claim", semanticContext, edgePayload);
      const edge = parseSealedArtifact(eventClaimEdgeSchema, { ...semanticEnvelope(semanticContext, edgeId, resolved.eventVersionId), eventClaimId: edgeId, ...edgePayload });
      await bounded(`firestore:create-event-claim:${edge.eventClaimId}`, 30_000, () => repository.createEdgeWithReferences({ collection: "v2EventClaims", edge, references: [{ collection: "v2CanonicalEventVersions", id: resolved.eventVersionId }, { collection: "v2AtomicClaimVersions", id: claimId }] }));
      firestoreWrites += 1;
    }
    for (const entity of relatedEntities) {
      const edgePayload = { eventVersionId: resolved.eventVersionId, entityVersionId: entity.entityVersionId, role: "CENTRAL_SUBJECT", meaning: "The entity is the central subject participating in this candidate event.", temporal: null };
      const semanticContext = { ...context, policyVersion: V2_POLICY_VERSION };
      const edgeId = semanticArtifactId("event-entity", semanticContext, edgePayload);
      const edge = parseSealedArtifact(eventEntityEdgeSchema, { ...semanticEnvelope(semanticContext, edgeId, resolved.eventVersionId), eventEntityId: edgeId, ...edgePayload });
      await bounded(`firestore:create-event-entity:${edge.eventEntityId}`, 30_000, () => repository.createEdgeWithReferences({ collection: "v2EventEntities", edge, references: [{ collection: "v2CanonicalEventVersions", id: resolved.eventVersionId }, { collection: "v2CanonicalEntityVersions", id: entity.entityVersionId }] }));
      firestoreWrites += 1;
    }
    durableEventVersionIds.push(resolved.eventVersionId);
  }

  const unresolvedMaterialConflicts = conflictSets.filter((conflict) => conflict.blocksPass).length;
  progress.entityCandidates = entities.length;
  progress.resolvedEntities = entities.filter((entity) => entity.resolutionState === "RESOLVED").length;
  progress.eventCandidates = events.length;
  progress.resolvedCanonicalEventCandidates = events.filter((event) => event.semanticClass === "EVENT" && event.canonicalizationState === "RESOLVED").length;
  progress.nonEventKnowledgeItems = events.filter((event) => event.semanticClass !== "EVENT").length;
  blockingReasons.push(...minimumKnowledgeBlockingReasons({ continuation: Boolean(continuation), durableSources: retrieved.length, claims: claims.length, supportedClaims: passingClaimIds.size, eventCandidates: events.filter((event) => event.semanticClass === "EVENT").length, unresolvedMaterialConflicts }));
  const supportedClaimIds = new Set(claims.filter((claim) => passingClaimIds.has(claim.claimVersionId)).map((claim) => claim.claimId));
  const questionCoverage = mapResult.map.questions.map((question) => {
    const jobs = claimInputs.filter((input) => input.question.questionId === question.questionId);
    const extracted = extractedClaims.filter((claim) => claim.qualifiers.some((qualifier) => qualifier.key === "researchQuestionId" && qualifier.value === question.questionId));
    const status = jobs.length === 0 ? "BLOCKED" : extracted.length === 0 ? "NO_EVIDENCE" : extracted.some((claim) => supportedClaimIds.has(claim.claimId)) ? "SUFFICIENT" : "PARTIAL";
    return { questionId: question.questionId, status, jobs: jobs.length, extractedClaims: extracted.length };
  });
  for (const coverage of questionCoverage) {
    const auditRecordId = contentAddressedId("audit", { runId: context.runId, action: "RESEARCH_QUESTION_COVERAGE", ...coverage });
    const audit = parseSealedArtifact(auditRecordSchema, { ...immutableEnvelope(context, auditRecordId), auditRecordId, action: "RESEARCH_QUESTION_COVERAGE", actorType: "POLICY", actorId: "factory-v2-a-coverage-policy.10", artifactRefs: [{ collection: "v2ResearchMaps", id: mapResult.map.researchMapId, payloadHash: mapResult.map.payloadHash }], details: { ...coverage, generationSource: coverage.questionId.startsWith("software-chronology-question-") ? "SOFTWARE_GENERATED" : "MODEL_OR_SOFTWARE_COVERAGE_COMPLETION" } });
    await persist("v2AuditRecords", audit);
  }
  const acceptedEdgeIds = new Set(verdicts.flatMap((verdict) => verdict.acceptedEvidenceEdgeIds));
  const acceptedEdges = evidenceEdges.filter((edge) => acceptedEdgeIds.has(edge.claimEvidenceId));
  const passingVerdicts = verdicts.filter((verdict) => verdict.verdict === "SUPPORTED" || verdict.verdict === "QUALIFIED");
  const corroborationInputs = passingVerdicts.flatMap((verdict) => {
    const claim = claims.find((candidate) => candidate.claimVersionId === verdict.claimVersionId);
    return claim ? [{ independenceGroupCount: verdict.independenceGroupCount, risk: claim.risk }] : [];
  });
  const resolvedEvents = events.filter((event) => event.semanticClass === "EVENT" && event.canonicalizationState === "RESOLVED");
  const confidenceVector = buildConfidenceVector({
    context,
    topicAuthoritySetId: topicAuthoritySet.topicAuthoritySetId,
    authorityApplicability: passingVerdicts.length > 0 && passingVerdicts.every((verdict) => !verdict.reasonCodes.includes("CLAIM_RELATIVE_AUTHORITY_MISMATCH")) ? "PASS" : "FAIL",
    evidenceDirectness: acceptedEdges.length === 0 ? "FAIL" : acceptedEdges.every((edge) => edge.relevance === "DIRECT") ? "PASS" : "QUALIFIED",
    independentCorroboration: independentCorroborationStatus(corroborationInputs),
    perspectiveAdequacy: perspectiveAudit.verdict === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : "PASS",
    conflictStatus: conflictConfidenceStatus(conflictSets),
    coverageCompleteness: blockingReasons.length === 0 ? "PASS" : "FAIL",
    temporalPrecision: temporalPrecisionStatus(resolvedEvents, Boolean(continuation)),
    provenanceIntegrity: acceptedEdges.length > 0 && acceptedEdges.every((edge) => edge.publisherVersionId !== null && authorityBindingsByPublisherVersionId.has(edge.publisherVersionId) && segmentsById.has(edge.evidenceSegmentId)) ? "PASS" : "FAIL",
    reasonCodes: blockingReasons.length === 0 ? ["AUTHORITY_FIRST_DIAGNOSTICS_COMPLETE"] : blockingReasons
  });
  await persist("v2AcquisitionConfidenceVectors", confidenceVector);
  progress.confidenceVectorId = confidenceVector.confidenceVectorId;
  if (confidenceRequiresAdditionalBlock(confidenceVector, blockingReasons)) blockingReasons.push(`ACQUISITION_CONFIDENCE_${confidenceVector.verdict}`);
  assertDeadline();
  const tokenMetrics = modelTokens(modelExecutions);
  const individualClaimsRejected = extractedGroups.reduce((total, group) => total + group.rejectedClaims.length, 0);
  const claimRejectionReasons = extractedGroups.flatMap((group) => group.rejectedClaims).flatMap((rejection) => rejection.reasons).reduce<Record<string, number>>((counts, reason) => {
    const code = reason.split(":", 1)[0]!.trim() || "UNKNOWN_CLAIM_REJECTION";
    counts[code] = (counts[code] || 0) + 1;
    return counts;
  }, {});
  if (claimExtractionFailures > 0) claimRejectionReasons.CLAIM_EXTRACTION_STAGE_FAILURE = claimExtractionFailures;
  const distribution = <T extends string>(values: readonly T[]): Record<string, number> => values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
  const stageLatencyMs = modelExecutions.reduce<Record<string, number>>((latencies, execution) => {
    latencies[execution.stage] = (latencies[execution.stage] || 0) + execution.latencyMs;
    return latencies;
  }, {});
  stageLatencyMs.AUTHORITY_DISCOVERY = controlledOperations.reduce((total, operation) => total + (operation.latencyMs || 0), 0);
  const metrics: V2ACertificationMetrics = {
    totalExecutionMs: Date.now() - startedAt, scopeContractModelCalls: scopeResult.executions.length, researchMapModelCalls: mapResult.executions.length, queryPlanModelCalls: 0, authorityRoutingModelCalls: modelExecutions.filter((execution) => execution.stage === "AUTHORITY_ROUTING").length,
    groundingCalls: controlledOperations.filter((operation) => operation.mechanism === "GOOGLE_GROUNDING_ESCALATION").length, providerReportedSearchQueries: controlledOperations.reduce((total, operation) => total + operation.providerInternalQueries.length, 0), candidateQueriesProposed: 0, candidateQueriesAuthorized: 0, candidateQueriesRejected: 0, explicitQueriesExecuted: 0, explicitSearchRequests: 0, explicitSearchResults: 0, explicitSearchLatencyMs: 0, queryLedgerId: null, topicAuthoritySetId: topicAuthoritySet.topicAuthoritySetId, authorityResearchPlanId: authorityResearchPlan.authorityResearchPlanId, controlledResearchLedgerId: controlledResearchLedger.controlledResearchLedgerId, perspectiveAuditId: perspectiveAudit.perspectiveAuditId, confidenceVectorId: confidenceVector.confidenceVectorId, controlledResearchOperations: controlledOperations.length, directRetrievalAttempts: sourceCandidates.length - retrievalsSuppressedByHostCircuit, retrievalSuccesses: retrievedWithDuplicates.length, retrievalFailures,
    sourceDocumentsDiscovered: discovered.size, sourceDocumentsSnapshotted: retrieved.length, cacheHits: retrieved.filter((item) => item.cacheDisposition === "CACHE_HIT").length,
    cacheRevalidated: retrieved.filter((item) => item.cacheDisposition === "REVALIDATED").length, cacheRefetched: retrieved.filter((item) => item.cacheDisposition === "REFETCHED").length, cacheNotApplicable: retrieved.filter((item) => item.cacheDisposition === "CACHE_NOT_APPLICABLE").length,
    retrievalsSuppressedByHostCircuit, retrievalRejectionReasons: Object.fromEntries([...retrievalRejectionReasons.entries()].sort()), retrievalFailureDetails: progress.retrievalFailureDetails,
    sourceRanking: sourceCandidates.map((candidate, index) => ({ rank: index + 1, urlHash: sha256(candidate.canonicalUrl), domain: candidate.domain, admittedQuestionCount: candidate.admittedQuestionIds.length })),
    evidencePackets: claimInputs.length, evidencePacketSegments: claimInputs.reduce((total, input) => total + input.packet.segments.length, 0), individualClaimsRejected, claimRejectionReasons,
    researchQuestionsNoEvidence: questionCoverage.filter((item) => item.status === "NO_EVIDENCE").length, researchQuestionsPartial: questionCoverage.filter((item) => item.status === "PARTIAL").length,
    researchQuestionsSufficient: questionCoverage.filter((item) => item.status === "SUFFICIENT").length, researchQuestionsBlocked: questionCoverage.filter((item) => item.status === "BLOCKED").length,
    sourceClasses: [...new Set(retrieved.map((item) => item.source.sourceClass))].sort(), publisherIdentities: new Set(retrieved.map((item) => item.source.publisherId).filter(Boolean)).size,
    claimsExtracted: claims.length, claimsSupported: verdicts.filter((verdict) => verdict.verdict === "SUPPORTED" || verdict.verdict === "QUALIFIED").length,
    claimsRejected: verdicts.filter((verdict) => verdict.verdict === "INSUFFICIENT" || verdict.verdict === "REJECTED").length + claimExtractionFailures + individualClaimsRejected, claimsRequiringReview: verdicts.filter((verdict) => verdict.verdict === "REVIEW_REQUIRED").length, authorityVerdictDistribution: distribution(verdicts.map((verdict) => verdict.verdict)),
    conflictsDetected: conflictSets.length, conflictsResolved: conflictSets.filter((conflict) => ["RESOLVED", "QUALIFIED"].includes(conflict.state)).length, conflictsUnresolved: conflictSets.filter((conflict) => conflict.state === "UNRESOLVED").length,
    entityCandidates: entities.length, resolvedEntities: entities.filter((entity) => entity.resolutionState === "RESOLVED").length, eventCandidates: events.length,
    resolvedCanonicalEventCandidates: events.filter((event) => event.semanticClass === "EVENT" && event.canonicalizationState === "RESOLVED").length,
    nonEventKnowledgeItems: events.filter((event) => event.semanticClass !== "EVENT").length, eventDispositionDistribution: distribution(events.map((event) => `${event.semanticClass}:${event.canonicalizationState}`)), eventResolutionDiagnostics: Object.fromEntries([...eventResolutionDiagnostics.entries()].sort()), reusedExistingKnowledge: reconnaissance.reuseClassifications.filter((item) => item.classification === "REUSE_DIRECTLY").length,
    newKnowledge: claims.length + entities.length + events.length, modelRepairAttempts: tokenMetrics.repairs, infrastructureRetries: tokenMetrics.retries,
    providerCalls: modelExecutions.reduce((total, execution) => total + execution.transportAttempts, 0), stageLatencyMs, providerQueries: controlledOperations.flatMap((operation) => operation.providerInternalQueries),
    inputTokens: tokenMetrics.input, outputTokens: tokenMetrics.output, monetaryCost: null, monetaryCostMeasurement: "NOT_MEASURABLE", firestoreWrites, cloudStorageWrites,
    finalV2AVerdict: blockingReasons.length === 0 ? "PASS" : "FAIL"
  };
  currentStage = metrics.finalV2AVerdict === "PASS" ? "COMPLETE" : "A5_RESOLUTION_REUSE";
  await bounded("firestore:set-operation:terminal", 30_000, () => repository.setOperation(context.runId, operationProjection({ context, state: metrics.finalV2AVerdict === "PASS" ? "COMPLETED" : "FAILED", stage: currentStage, startedAt, blockingReason: blockingReasons.join(", ") || null, counts: { sources: metrics.sourceDocumentsSnapshotted, claims: metrics.claimsExtracted, supportedClaims: metrics.claimsSupported, conflicts: metrics.conflictsDetected, entities: metrics.entityCandidates, events: metrics.eventCandidates }, finalVerdict: metrics.finalV2AVerdict })));
  supervisor.close();
  return {
    context,
    scopeContractId: scopeResult.scope.scopeContractId,
    researchMapId: mapResult.map.researchMapId,
    queryPlanId: null,
    topicAuthoritySetId: topicAuthoritySet.topicAuthoritySetId,
    routingObligationSetId: null,
    authorityResearchPlanId: authorityResearchPlan.authorityResearchPlanId,
    controlledResearchLedgerId: controlledResearchLedger.controlledResearchLedgerId,
    perspectiveAuditId: perspectiveAudit.perspectiveAuditId,
    confidenceVectorId: confidenceVector.confidenceVectorId,
    sourceSnapshotIds: retrieved.map((item) => item.snapshot.sourceSnapshotId),
    claimVersionIds: claims.map((claim) => claim.claimVersionId),
    authorityVerdictIds: verdicts.map((verdict) => verdict.claimAuthorityVerdictId),
    conflictSetIds: conflictSets.map((conflict) => conflict.conflictSetId),
    eventVersionIds: events.map((event) => event.eventVersionId),
    metrics,
    blockingReasons
  };
  } catch (error) {
    if (error instanceof StructuredStageError) {
      for (const execution of error.executions) {
        if (modelExecutions.some((current) => current.executionId === execution.executionId)) continue;
        modelExecutions.push(execution);
        try { await persist("v2ModelExecutions", execution); } catch { /* Preserve the originating failure. */ }
      }
    }
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 1900);
    const deadlineExceeded = error instanceof WholeRunDeadlineExceededError || message.includes("WHOLE_RUN_DEADLINE_EXCEEDED") || supervisor.status === "CANCELLING";
    const failureClass = deadlineExceeded ? "WHOLE_RUN_DEADLINE_EXCEEDED"
      : message.includes("ACQUISITION_BUDGET_EXHAUSTED") ? "ACQUISITION_BUDGET_EXHAUSTED"
      : /SOURCE_RETRIEVAL|PRIVATE_ADDRESS|ROBOTS/iu.test(message) ? "SECURITY_RETRIEVAL_REJECTED"
      : /VERTEX|PROVIDER|MODEL|GOOGLE|EXPLICIT_SEARCH/iu.test(message) ? "PROVIDER_FAILURE"
      : "FAILED_UNCLASSIFIED";
    const protectedRepresentationDiagnostics = error instanceof ProtectedRepresentationAvailabilityError
      ? { ...error.diagnostic, releaseIdentity: /^[a-f0-9]{64}$/u.test(process.env.TIMELINES_GENERATION_RELEASE_ID || "") ? process.env.TIMELINES_GENERATION_RELEASE_ID! : null }
      : null;
    const failurePayload = {
      stage: currentStage,
      failureClass,
      severity: failureClass === "FAILED_UNCLASSIFIED" ? "CRITICAL" as const : "HIGH" as const,
      retryable: failureClass === "PROVIDER_FAILURE",
      message,
      protectedRepresentationDiagnostics,
      blockingArtifactIds: [],
      attemptsConsumed: modelExecutions.length,
      budgetConsumed: { firestoreWrites, cloudStorageWrites }
    };
    const failureRecordId = executionArtifactId("failure", context, failurePayload);
    const failure = parseSealedArtifact(v2FailureRecordSchema, {
      ...immutableEnvelope(context, failureRecordId),
      failureRecordId,
      ...failurePayload,
    });
    if (deadlineExceeded) {
      await supervisor.awaitShutdownGrace();
      try { await terminalWrite(() => repository.createImmutable("v2FailureRecords", failure)); } catch { /* A process-isolated caller owns the final hard stop if persistence is unavailable. */ }
      const snapshot = supervisor.terminalSnapshot();
      const terminalPayload = {
        failureRecordId,
        terminalStage: currentStage,
        deadlineAt: new Date(deadlineAt).toISOString(),
        elapsedMs: Math.max(0, Date.now() - startedAt),
        lastCompletedOperation,
        activeOperation: snapshot.activeOperation,
        completedOperations: snapshot.completedOperations,
        timedOutOperations: snapshot.timedOutOperations,
        lateCompletionsIgnored: snapshot.lateCompletionsIgnored,
        shutdownGraceMs: snapshot.shutdownGraceMs,
        shutdownGraceOutcome: snapshot.shutdownGraceOutcome,
        controlledOperationCount: progress.controlledResearchOperations,
        directRetrievalAttempts: progress.directRetrievalAttempts,
        retrievalSuccesses: progress.retrievalSuccesses,
        retrievalFailures: progress.retrievalFailures,
        sourceSnapshotIds: [...new Set(durableSnapshotIds)].slice(0, 60),
        claimVersionIds: [...new Set(durableClaimVersionIds)].slice(0, 300),
        eventVersionIds: [...new Set(durableEventVersionIds)].slice(0, 300),
        coverageState: "INCOMPLETE_DEADLINE_TERMINATED",
        perspectiveAuditId: progress.perspectiveAuditId,
        confidenceVectorId: progress.confidenceVectorId,
        protectedStateParity: "PENDING_EXTERNAL_VERIFICATION" as const
      };
      const deadlineTerminalRecordId = executionArtifactId("deadline-terminal", context, terminalPayload);
      // Terminal evidence is an immutable execution artifact.  Parse through
      // the same sealing path as every other immutable record so a deadline
      // cannot erase its required terminal proof through a missing hash.
      const terminal = parseSealedArtifact(deadlineTerminalRecordSchema, { ...immutableEnvelope(context, deadlineTerminalRecordId), deadlineTerminalRecordId, ...terminalPayload });
      try { await terminalWrite(() => repository.createImmutable("v2DeadlineTerminalRecords", terminal)); } catch { /* Failure record remains the canonical fail-closed minimum. */ }
    } else {
      try { await persist("v2FailureRecords", failure); } catch { /* Preserve the originating failure. */ }
    }
    try {
      const write = () => repository.setOperation(context.runId, operationProjection({ context, state: "FAILED", stage: currentStage, startedAt, blockingReason: deadlineExceeded ? "WHOLE_RUN_DEADLINE_EXCEEDED" : message.slice(0, 1000), counts: {}, finalVerdict: "FAIL" }));
      if (deadlineExceeded) await terminalWrite(write);
      else await bounded("firestore:set-operation:failed", 30_000, write);
    } catch { /* Preserve the originating failure. */ }
    const tokenMetrics = modelTokens(modelExecutions);
    const partialMetrics: V2ACertificationMetrics = {
      totalExecutionMs: Date.now() - startedAt, scopeContractModelCalls: modelExecutions.filter((item) => item.stage === "SCOPE").length,
      researchMapModelCalls: modelExecutions.filter((item) => item.stage === "RESEARCH_MAP").length, queryPlanModelCalls: 0, authorityRoutingModelCalls: modelExecutions.filter((item) => item.stage === "AUTHORITY_ROUTING").length,
      groundingCalls: 0, providerReportedSearchQueries: 0, candidateQueriesProposed: 0, candidateQueriesAuthorized: 0, candidateQueriesRejected: 0, explicitQueriesExecuted: 0, explicitSearchRequests: 0, explicitSearchResults: 0, explicitSearchLatencyMs: 0, queryLedgerId: null, topicAuthoritySetId: progress.topicAuthoritySetId, authorityResearchPlanId: progress.authorityResearchPlanId, controlledResearchLedgerId: progress.controlledResearchLedgerId, perspectiveAuditId: progress.perspectiveAuditId, confidenceVectorId: progress.confidenceVectorId, controlledResearchOperations: progress.controlledResearchOperations,
      directRetrievalAttempts: progress.directRetrievalAttempts, retrievalSuccesses: progress.retrievalSuccesses, retrievalFailures: progress.retrievalFailures,
      sourceDocumentsDiscovered: progress.sourceDocumentsDiscovered, sourceDocumentsSnapshotted: progress.sourceDocumentsSnapshotted,
      cacheHits: 0, cacheRevalidated: 0, cacheRefetched: 0, cacheNotApplicable: progress.sourceDocumentsSnapshotted,
      retrievalsSuppressedByHostCircuit: progress.retrievalsSuppressedByHostCircuit, retrievalRejectionReasons: progress.retrievalRejectionReasons, retrievalFailureDetails: progress.retrievalFailureDetails, sourceRanking: progress.sourceRanking,
      evidencePackets: progress.evidencePackets, evidencePacketSegments: progress.evidencePacketSegments, individualClaimsRejected: 0, claimRejectionReasons: {},
      researchQuestionsNoEvidence: 0, researchQuestionsPartial: 0, researchQuestionsSufficient: 0, researchQuestionsBlocked: 0,
      sourceClasses: [], publisherIdentities: 0, claimsExtracted: progress.claimsExtracted, claimsSupported: progress.claimsSupported, claimsRejected: progress.claimsRejected, claimsRequiringReview: 0,
      authorityVerdictDistribution: {}, conflictsDetected: progress.conflictsDetected, conflictsResolved: progress.conflictsResolved, conflictsUnresolved: progress.conflictsUnresolved,
      entityCandidates: progress.entityCandidates, resolvedEntities: progress.resolvedEntities, eventCandidates: progress.eventCandidates,
      resolvedCanonicalEventCandidates: progress.resolvedCanonicalEventCandidates, nonEventKnowledgeItems: progress.nonEventKnowledgeItems,
      eventDispositionDistribution: {}, eventResolutionDiagnostics: {}, reusedExistingKnowledge: 0, newKnowledge: progress.claimsExtracted + progress.entityCandidates + progress.eventCandidates,
      modelRepairAttempts: tokenMetrics.repairs, infrastructureRetries: tokenMetrics.retries, providerCalls: modelExecutions.reduce((total, execution) => total + execution.transportAttempts, 0),
      stageLatencyMs: modelExecutions.reduce<Record<string, number>>((latencies, execution) => { latencies[execution.stage] = (latencies[execution.stage] || 0) + execution.latencyMs; return latencies; }, {}),
      providerQueries: progress.providerQueries, inputTokens: tokenMetrics.input, outputTokens: tokenMetrics.output, monetaryCost: null, monetaryCostMeasurement: "NOT_MEASURABLE",
      firestoreWrites, cloudStorageWrites, finalV2AVerdict: "FAIL"
    };
    supervisor.close();
    throw new V2ARunError(`V2_A_RUN_FAILED:${context.runId}:${deadlineExceeded ? "WHOLE_RUN_DEADLINE_EXCEEDED" : message}`, partialMetrics, { cause: error });
  }
}
