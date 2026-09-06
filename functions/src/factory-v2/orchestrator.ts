import { randomUUID } from "node:crypto";
import { V2_PIPELINE_VERSION, V2_POLICY_VERSION, acquisitionDiscoverySchema, acquisitionRunSchema, auditRecordSchema, canonicalEntityRecordSchema, canonicalEventRecordSchema, entityAliasSchema, eventClaimEdgeSchema, eventEntityEdgeSchema, modelExecutionSchema, publisherAuthorityRecordSchema, reconnaissanceRecordSchema, sourceDocumentSchema, topicOperationSchema, v2FailureRecordSchema, type AtomicClaimVersion, type CanonicalEntityVersion, type CanonicalEventVersion, type ClaimAuthorityVerdict, type ClaimEvidenceEdge, type EvidenceSegment, type PublisherAuthorityVersion, type QueryPlan, type ResearchMap, type ScopeContract, type SourceDocument, type SourceSnapshot } from "./contracts";
import { assertV2AShadowEnabled, type FactoryV2Config } from "./config";
import { bootstrapPublisherRegistry, buildPublisherAuthorityVersion, detectClaimConflicts, evaluateClaimAuthority, independenceGroup } from "./authority";
import { buildAtomicClaimVersion, buildCanonicalEntityVersion, buildCanonicalEventVersion, buildClaimEvidenceEdge, executionArtifactId, immutableEnvelope, normalizedIdentityText, parseSealedArtifact, semanticArtifactId, semanticEnvelope, type ArtifactContext } from "./contracts/builders";
import { canReuseSnapshot, retrieveSource, type RetrievalDependencies } from "./acquisition/retrieval";
import { canonicalizeUrl } from "./acquisition/url";
import { contentAddressedId, deterministicUuid, payloadHash, sha256 } from "./hashing";
import { performBoundedReconnaissance } from "./reconnaissance";
import { eventWithinLockedScope, resolveEntityCandidate, resolveEventCandidate } from "./resolution";
import { V2FirestoreRepository } from "./repositories/firestore";
import { extractAtomicClaims, generateQueryPlan, generateResearchMap, proposeScope, runGroundedAcquisition, StructuredStageError, type GroundingAcquisition, type V2ModelProvider } from "./vertex";
import { admitSourcesByQuestion, claimPropositionKey, rankCoverageSourcesByQuestion, selectEvidencePacket, selectUsableCoverageCandidates, type DiscoveredSourceCandidate } from "./reliability";

export type ShadowFixtureDescriptor = { title: string; language: string; ongoingAsOf: string };

export type V2ACertificationMetrics = {
  totalExecutionMs: number;
  scopeContractModelCalls: number;
  researchMapModelCalls: number;
  queryPlanModelCalls: number;
  groundingCalls: number;
  providerReportedSearchQueries: number;
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
  evidencePackets: number;
  evidencePacketSegments: number;
  individualClaimsRejected: number;
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
  conflictsDetected: number;
  conflictsResolved: number;
  conflictsUnresolved: number;
  entityCandidates: number;
  resolvedEntities: number;
  eventCandidates: number;
  resolvedCanonicalEventCandidates: number;
  nonEventKnowledgeItems: number;
  reusedExistingKnowledge: number;
  newKnowledge: number;
  modelRepairAttempts: number;
  infrastructureRetries: number;
  inputTokens: number | null;
  outputTokens: number | null;
  monetaryCost: null;
  monetaryCostMeasurement: "NOT_MEASURABLE";
  firestoreWrites: number;
  cloudStorageWrites: number;
  finalV2AVerdict: "PASS" | "FAIL";
};

export type V2AShadowResult = {
  context: ArtifactContext;
  scopeContractId: string;
  researchMapId: string;
  queryPlanId: string;
  sourceSnapshotIds: string[];
  claimVersionIds: string[];
  authorityVerdictIds: string[];
  conflictSetIds: string[];
  eventVersionIds: string[];
  metrics: V2ACertificationMetrics;
  blockingReasons: string[];
};

export type OrchestratorDependencies = {
  repository?: V2FirestoreRepository;
  provider?: V2ModelProvider;
  retrieval?: RetrievalDependencies;
  /** A3 continuation mode reuses the locked scope and a versioned Research Map,
   * then executes the same certified acquisition/claim/authority/resolution path. */
  continuation?: {
    context: ArtifactContext;
    originalKnowledgeRunId: string;
    scope: ScopeContract;
    researchMap: ResearchMap;
    queryPlan: QueryPlan;
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

export function provisionalPublisher(context: ArtifactContext, url: string, language: string): PublisherAuthorityVersion {
  void language;
  const hostname = new URL(url).hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "");
  const registryContext: ArtifactContext = { ...context, topicId: "publisher-registry", runId: "provisional-v2-a", generation: 1, createdAt: "2026-09-06T00:00:00.000Z", policyVersion: V2_POLICY_VERSION };
  const publisherId = deterministicUuid("timelines.publisher.provisional", hostname);
  return buildPublisherAuthorityVersion(registryContext, {
    publisherId, version: 2, effectiveAt: "2026-09-06T00:00:00.000Z", canonicalName: hostname, aliases: [], parentPublisherId: null,
    institutionType: "OTHER", authorityDomains: ["Unclassified"], geographicScope: ["Unclassified"], languages: ["multilingual"], primarySecondaryTendency: "MIXED",
    knownDomains: [hostname], externalIdentifiers: [], independenceGroupId: contentAddressedId("publisher-group", hostname), accessLimitations: [], state: "PROVISIONAL", classificationEvidenceSegmentIds: [], admittedBy: "POLICY"
  });
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
  // V2-A is only one portion of the future sub-12-minute workflow. Ten minutes
  // is the authoritative shadow deadline even when the broader worker safety
  // ceiling remains 20 minutes.
  const deadlineAt = startedAt + Math.min(config.budgetBundle.maximumWorkerSeconds * 1000, 600_000);
  const assertDeadline = () => {
    if (Date.now() >= deadlineAt) throw new Error("WHOLE_RUN_DEADLINE_EXCEEDED");
  };
  const expectedTopicId = sha256(`${descriptor.language}\n${normalizedIdentityText(descriptor.title)}`);
  const continuation = dependencies.continuation;
  const context: ArtifactContext = continuation
    ? continuation.context
    : { corpusId: repository.activeCorpusId(), topicId: expectedTopicId, runId: randomUUID(), generation: 1, createdAt: new Date().toISOString() };
  const topicId = context.topicId;
  if (continuation) {
    if (continuation.scope.topicId !== expectedTopicId || continuation.scope.title !== descriptor.title) throw new Error("A3 continuation Scope Contract does not match the requested topic.");
    if (continuation.scope.corpusId !== context.corpusId || continuation.researchMap.corpusId !== context.corpusId || continuation.queryPlan.corpusId !== context.corpusId) throw new Error("A3 continuation artifacts cross the active corpus boundary.");
    if (continuation.researchMap.scopeContractId !== continuation.scope.scopeContractId || continuation.queryPlan.scopeContractId !== continuation.scope.scopeContractId || continuation.queryPlan.researchMapId !== continuation.researchMap.researchMapId) throw new Error("A3 continuation lineage is invalid.");
    if (continuation.researchMap.parentArtifactId === null) throw new Error("A3 continuation requires a versioned Research Map linked to its immutable parent.");
  }
  const modelExecutions: Array<ReturnType<typeof modelExecutionSchema.parse>> = [];
  const blockingReasons: string[] = [];
  let firestoreWrites = 0;
  let cloudStorageWrites = 0;
  let currentStage: Parameters<typeof operationProjection>[0]["stage"] = "A1_SCHEMAS";
  const persist = async (collection: Parameters<V2FirestoreRepository["createImmutable"]>[0], artifact: Record<string, unknown>) => {
    try {
      const result = await repository.createImmutable(collection, artifact);
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
    await repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: {}, finalVerdict: "PENDING" }));
    firestoreWrites += 1;

  const publishers = bootstrapPublisherRegistry(context);
  for (const publisher of publishers) {
    await persist("v2PublisherAuthorityVersions", publisher);
    const current = await repository.getById("v2PublisherAuthorityRecords", publisher.publisherId);
    const head = publisherAuthorityRecordSchema.parse({ publisherId: publisher.publisherId, corpusId: context.corpusId, canonicalNameKey: normalizedIdentityText(publisher.canonicalName), currentVersionId: publisher.publisherVersionId, currentVersion: publisher.version, state: publisher.state, updatedAt: context.createdAt });
    const result = await repository.advanceHead({ collection: "v2PublisherAuthorityRecords", headId: publisher.publisherId, expectedCurrentVersionId: typeof current?.currentVersionId === "string" ? current.currentVersionId : null, nextVersionId: publisher.publisherVersionId, data: head });
    if (result !== "IDEMPOTENT") firestoreWrites += 1;
  }

  const scopeResult = continuation
    ? { scope: continuation.scope, executions: [] }
    : await proposeScope({ context, title: descriptor.title, language: descriptor.language, ongoingAsOf: descriptor.ongoingAsOf, reconnaissance: { classification: "NO_LEGACY_CONTENT_REUSE", existingKnowledgeWillBeInspectedAfterScopeLock: true }, provider: dependencies.provider, deadlineAt });
  modelExecutions.push(...scopeResult.executions.map((execution) => modelExecutionSchema.parse(execution)));
  for (const execution of scopeResult.executions) await persist("v2ModelExecutions", execution);
  if (!continuation) {
    await persist("v2ScopeContracts", scopeResult.scope);
    await persistSemanticDerivation("v2ScopeContracts", scopeResult.scope, scopeResult.executions.at(-1));
  }

  const reconnaissance = await performBoundedReconnaissance({ repository, topicId, scopeContractId: scopeResult.scope.scopeContractId, entityNameKeys: scopeResult.scope.centralEntities.map((entity) => normalizedIdentityText(entity.name)), limitPerKind: 25 });
  const reconnaissanceId = contentAddressedId("recon-record", reconnaissance);
  const reconnaissanceArtifact = parseSealedArtifact(reconnaissanceRecordSchema, { ...immutableEnvelope(context, reconnaissanceId), reconnaissanceId, scopeContractId: scopeResult.scope.scopeContractId, knownEntityIds: reconnaissance.knownEntities.map((item) => String(item.entityId || item.id)), admittedEventVersionIds: reconnaissance.admittedEvents.map((item) => String(item.eventVersionId || item.id)), strongClaimVersionIds: reconnaissance.strongClaims.map((item) => String(item.claimVersionId || item.id)), reusableSnapshotIds: reconnaissance.reusableSnapshots.map((item) => String(item.sourceSnapshotId || item.id)), conflictSetIds: reconnaissance.conflicts.map((item) => String(item.conflictSetId || item.id)), gaps: reconnaissance.gaps, legacyInputsExcluded: true });
  await persist("v2ReconnaissanceRecords", reconnaissanceArtifact);

  assertDeadline();
  const mapResult = continuation
    ? { map: continuation.researchMap, executions: [] }
    : await generateResearchMap({ context, scope: scopeResult.scope, reconnaissance, provider: dependencies.provider, deadlineAt });
  modelExecutions.push(...mapResult.executions.map((execution) => modelExecutionSchema.parse(execution)));
  for (const execution of mapResult.executions) await persist("v2ModelExecutions", execution);
  await persist("v2ResearchMaps", mapResult.map);
  await persistSemanticDerivation("v2ResearchMaps", mapResult.map, mapResult.executions.at(-1));
  assertDeadline();
  const planResult = continuation
    ? { plan: continuation.queryPlan, executions: [] }
    : await generateQueryPlan({ context, scope: scopeResult.scope, map: mapResult.map, provider: dependencies.provider, deadlineAt });
  modelExecutions.push(...planResult.executions.map((execution) => modelExecutionSchema.parse(execution)));
  for (const execution of planResult.executions) await persist("v2ModelExecutions", execution);
  await persist("v2QueryPlans", planResult.plan);
  await persistSemanticDerivation("v2QueryPlans", planResult.plan, planResult.executions.at(-1));

  currentStage = "A2_SCOPE_ACQUISITION";
  await repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: {}, finalVerdict: "PENDING" }));
  const groundedQueries = planResult.plan.queries.filter((query) => query.role !== "SOURCE_RETRIEVAL").slice(0, 5);
  const acquisitions = await mapLimit(groundedQueries, config.budgetBundle.maximumConcurrency, async (query) => {
    assertDeadline();
    return runGroundedAcquisition({ context, query, provider: dependencies.provider, deadlineAt });
  });
  const actualQueryCount = acquisitions.reduce((total, acquisition) => total + acquisition.webSearchQueries.length, 0);
  if (actualQueryCount > config.budgetBundle.maximumProviderQueries) throw new Error("ACQUISITION_BUDGET_EXHAUSTED: provider-reported query cap exceeded.");
  if (acquisitions.length > config.budgetBundle.maximumGroundingCalls) throw new Error("ACQUISITION_BUDGET_EXHAUSTED: grounding call cap exceeded.");
  for (const [index, acquisition] of acquisitions.entries()) {
    modelExecutions.push(modelExecutionSchema.parse(acquisition.execution));
    await persist("v2ModelExecutions", acquisition.execution);
    const query = groundedQueries[index]!;
    const discoveryId = contentAddressedId("discovery", { queryId: query.queryId, executionId: acquisition.execution.executionId });
    const discovery = parseSealedArtifact(acquisitionDiscoverySchema, { ...immutableEnvelope(context, discoveryId), discoveryId, acquisitionRunId: `acquisition-${acquisition.execution.executionId}`, queryId: query.queryId, providerQuery: query.providerQuery, providerReportedQueries: acquisition.webSearchQueries, responseBodyHash: sha256(acquisition.body), chunks: acquisition.chunks, supports: acquisition.supports, searchEntryPointPresent: acquisition.searchEntryPointPresent });
    await persist("v2AcquisitionDiscoveries", discovery);
    const acquisitionId = contentAddressedId("acquisition", { queryId: query.queryId, executionId: acquisition.execution.executionId });
    const run = parseSealedArtifact(acquisitionRunSchema, { ...immutableEnvelope(context, acquisitionId), acquisitionRunId: acquisitionId, queryPlanId: planResult.plan.queryPlanId, queryId: query.queryId, role: query.role, providerReportedQueries: acquisition.webSearchQueries, groundingChunkCount: acquisition.chunks.length, groundingSupportCount: acquisition.supports.length, discoveredSourceIds: [], resultState: "ATTRIBUTABLE", budgetConsumed: { maximumGroundingCalls: 1, maximumProviderQueries: acquisition.webSearchQueries.length }, modelExecutionId: acquisition.execution.executionId });
    await persist("v2AcquisitionRuns", run);
  }

  const discovered = new Map<string, DiscoveredSourceCandidate>();
  let discoveryOrder = 0;
  for (const [acquisitionIndex, acquisition] of acquisitions.entries()) for (const chunk of acquisition.chunks) {
    const query = groundedQueries[acquisitionIndex]!;
    let key: string;
    try { key = canonicalizeUrl(chunk.url); } catch { continue; }
    const domain = (chunk.domain || new URL(key).hostname).toLocaleLowerCase("en-US").replace(/^www\./u, "");
    const discoveryText = acquisition.supports.filter((support) => support.chunkIndices.includes(chunk.chunkIndex)).map((support) => support.attributedText).join(" ").slice(0, 12_000);
    const existing = discovered.get(key);
    if (existing) {
      existing.researchQuestionIds = [...new Set([...existing.researchQuestionIds, ...query.researchQuestionIds])];
      existing.discoveryText = [...new Set([existing.discoveryText, discoveryText].filter(Boolean))].join(" ").slice(0, 12_000);
    } else discovered.set(key, { canonicalUrl: key, originalUrl: chunk.url, title: chunk.title, domain, queryId: query.queryId, researchQuestionIds: [...query.researchQuestionIds], role: query.role, intendedSourceClass: query.intendedSourceClass, discoveryOrder: discoveryOrder++, discoveryText });
  }
  const coverageAdmission = continuation ? rankCoverageSourcesByQuestion({ candidates: [...discovered.values()], map: mapResult.map, publishers, maximumSources: config.budgetBundle.maximumSourceDocuments }) : null;
  const sourceCandidates = coverageAdmission?.retrievalCandidates || admitSourcesByQuestion({ candidates: [...discovered.values()], map: mapResult.map, publishers, maximumSources: config.budgetBundle.maximumSourceDocuments }).map((candidate) => ({ ...candidate, admissionScores: {} as Record<string, number> }));
  if (coverageAdmission) for (const decision of coverageAdmission.decisions) {
    const decisionPayload = { questionId: decision.questionId, urlHash: sha256(decision.canonicalUrl), rank: decision.rank, disposition: decision.disposition, exclusionReason: decision.exclusionReason, authorityEligibility: decision.authorityEligibility, admissionScore: decision.admissionScore, components: JSON.stringify(decision.components), temporalSignals: decision.matchedTemporalSignals.join(",").slice(0, 1000), eventSignals: decision.matchedEventSignals.join(",").slice(0, 1000), publisherDomain: decision.domain };
    const auditRecordId = contentAddressedId("audit", { runId: context.runId, action: "COVERAGE_SOURCE_ADMISSION", ...decisionPayload });
    const audit = parseSealedArtifact(auditRecordSchema, { ...immutableEnvelope(context, auditRecordId), auditRecordId, action: "COVERAGE_SOURCE_ADMISSION", actorType: "POLICY", actorId: "gap-aware-source-admission-v1", artifactRefs: [{ collection: "v2ResearchMaps", id: mapResult.map.researchMapId, payloadHash: mapResult.map.payloadHash }], details: decisionPayload });
    await persist("v2AuditRecords", audit);
  }
  let retrievalFailures = 0;
  let retrievalsSuppressedByHostCircuit = 0;
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
    try {
      assertDeadline();
      const existing = await repository.getReusableSource(candidate.canonicalUrl);
      const freshness = scopeResult.scope.topicClass === "ONGOING_SUBJECT" ? "ONGOING" : "IMMUTABLE_HISTORICAL";
      if (existing && canReuseSnapshot(existing.snapshot as SourceSnapshot, freshness, scopeResult.scope.ongoingAsOf)) {
        return { source: existing.source as SourceDocument, snapshot: existing.snapshot as SourceSnapshot, evidenceSegments: existing.evidenceSegments as EvidenceSegment[], archiveWrites: 0, cacheDisposition: "CACHE_HIT", admittedQuestionIds: candidate.admittedQuestionIds, admissionScores: candidate.admissionScores };
      }
      const initialPublisher = publisherForDomain(candidate.domain, publishers) || publisherForUrl(candidate.canonicalUrl, publishers);
      const result = await retrieveSource({ context, url: candidate.originalUrl, titleHint: candidate.title, publisherId: initialPublisher?.publisherId || null, sourceClass: provisionalSourceClass(initialPublisher), primarySecondaryRole: initialPublisher?.primarySecondaryTendency || "UNKNOWN", languageHint: descriptor.language }, {
        ...dependencies.retrieval,
        cachedSource: async (resolvedUrl) => {
          const cached = await repository.getReusableSource(resolvedUrl);
          if (!cached) return null;
          return { source: cached.source as SourceDocument, snapshot: cached.snapshot as SourceSnapshot, evidenceSegments: cached.evidenceSegments as EvidenceSegment[], reusable: canReuseSnapshot(cached.snapshot as SourceSnapshot, freshness, scopeResult.scope.ongoingAsOf) };
        }
      });
      cloudStorageWrites += result.archiveWrites;
      return { ...result, admittedQuestionIds: candidate.admittedQuestionIds, admissionScores: candidate.admissionScores };
    } catch (error) {
      retrievalFailures += 1;
      hostFailures.set(candidate.domain, (hostFailures.get(candidate.domain) || 0) + 1);
      const message = error instanceof Error ? error.message.slice(0, 300) : "Unknown retrieval failure";
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

  const publisherVersions = [...publishers];
  const publisherBySource = new Map<string, PublisherAuthorityVersion>();
  for (const result of retrieved) {
    assertDeadline();
    let publisher = publisherForUrl(result.source.canonicalUrl, publisherVersions);
    if (!publisher) {
      publisher = provisionalPublisher(context, result.source.canonicalUrl, result.source.language);
      publisherVersions.push(publisher);
      await persist("v2PublisherAuthorityVersions", publisher);
      const current = await repository.getById("v2PublisherAuthorityRecords", publisher.publisherId);
      const head = publisherAuthorityRecordSchema.parse({ publisherId: publisher.publisherId, corpusId: context.corpusId, canonicalNameKey: normalizedIdentityText(publisher.canonicalName), currentVersionId: publisher.publisherVersionId, currentVersion: publisher.version, state: publisher.state, updatedAt: context.createdAt });
      const state = await repository.advanceHead({ collection: "v2PublisherAuthorityRecords", headId: publisher.publisherId, expectedCurrentVersionId: typeof current?.currentVersionId === "string" ? current.currentVersionId : null, nextVersionId: publisher.publisherVersionId, data: head });
      if (state !== "IDEMPOTENT") firestoreWrites += 1;
    }
    const { id: _repositoryId, ...sourcePayload } = result.source as SourceDocument & { id?: string };
    const source = sourceDocumentSchema.parse({ ...sourcePayload, publisherId: publisher.publisherId, sourceClass: provisionalSourceClass(publisher), primarySecondaryRole: publisher.primarySecondaryTendency, authorityDomains: publisher.authorityDomains });
    if (result.cacheDisposition === "CACHE_NOT_APPLICABLE" || result.cacheDisposition === "REFETCHED") {
      const sourceWrite = await repository.upsertSourceDocument(source);
      if (sourceWrite !== "IDEMPOTENT") firestoreWrites += 1;
      await persist("v2SourceSnapshots", result.snapshot);
      if (result.evidenceSegments.length > 0) {
        const segmentWrites = await repository.createImmutableBatch("v2EvidenceSegments", result.evidenceSegments);
        firestoreWrites += segmentWrites.created;
      }
    }
    publisherBySource.set(source.sourceId, publisher);
    result.source = source;
    const auditRecordId = contentAddressedId("audit", { runId: context.runId, action: "SOURCE_CACHE_DECISION", sourceId: source.sourceId, snapshotId: result.snapshot.sourceSnapshotId, status: result.cacheDisposition });
    const cacheAudit = parseSealedArtifact(auditRecordSchema, { ...immutableEnvelope(context, auditRecordId), auditRecordId, action: "SOURCE_CACHE_DECISION", actorType: "POLICY", actorId: "factory-v2-a-cache-policy.4", artifactRefs: [{ collection: "v2SourceSnapshots", id: result.snapshot.sourceSnapshotId, payloadHash: result.snapshot.payloadHash }], details: { cacheStatus: result.cacheDisposition, sourceId: source.sourceId, snapshotId: result.snapshot.sourceSnapshotId } });
    await persist("v2AuditRecords", cacheAudit);
  }

  currentStage = "A3_CLAIMS";
  await repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: { sources: retrieved.length }, finalVerdict: "PENDING" }));
  const questionsForExtraction = mapResult.map.questions.filter((question) => question.priority !== "SUPPORTING");
  const candidatesByQuestion = new Map(questionsForExtraction.map((question) => {
    const packetCandidates = retrieved.flatMap((result) => {
    if (!result.admittedQuestionIds.includes(question.questionId) || result.evidenceSegments.length === 0) return [];
    const packet = selectEvidencePacket({ question, segments: result.evidenceSegments, entityNames: scopeResult.scope.centralEntities.map((entity) => entity.name) });
    return packet.segments.length === 0 ? [] : [{ result, question, packet }];
    });
    if (coverageAdmission) return [question.questionId, selectUsableCoverageCandidates(packetCandidates.map((item) => ({ ...item, canonicalKey: item.result.source.canonicalUrl, admissionScore: item.result.admissionScores[question.questionId] || 0, usable: item.result.snapshot.retrievalDisposition !== "UNAVAILABLE" && item.packet.segments.length > 0 })), 2)] as const;
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
  // Eight packets bound both model work and graph fan-out. Interleaving the
  // first-ranked source for each question before second-source corroboration
  // preserves research breadth under the ceiling.
  const claimInputs = [0, 1].flatMap((rank) => questionsForExtraction.flatMap((question) => {
    const candidate = candidatesByQuestion.get(question.questionId)?.[rank];
    return candidate ? [candidate] : [];
  })).slice(0, 8);
  let claimExtractionFailures = 0;
  const extractedAttempts = await mapLimit(claimInputs, config.budgetBundle.maximumConcurrency, async ({ result, question, packet }) => {
    try {
      assertDeadline();
      return await extractAtomicClaims({ context, scope: scopeResult.scope, sourceSnapshotId: result.snapshot.sourceSnapshotId, segments: packet.segments, question, provider: dependencies.provider, deadlineAt });
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
  const claimExecution = new Map(extractedGroups.flatMap((group) => group.claims.map((claim) => [claim.claimId, group.executions.at(-1)] as const)));
  const semanticClassByClaim = new Map(extractedGroups.flatMap((group) => [...group.semanticClasses.entries()]));
  for (let index = 0; index < claims.length; index += 1) {
    const extracted = claims[index]!;
    const existingHead = await repository.getById("v2AtomicClaims", extracted.claimId);
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
    const headState = await repository.advanceHead({ collection: "v2AtomicClaims", headId: claim.claimId, expectedCurrentVersionId: priorVersionId, nextVersionId: claim.claimVersionId, data: { claimId: claim.claimId, subjectKey: normalizedIdentityText(claim.subject.label), predicate: claim.predicate, currentVersion: currentVersion + 1, state: "CANDIDATE", updatedAt: context.createdAt } });
    if (headState === "CREATED") firestoreWrites += 1;
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
        const edgeState = await repository.createEdgeWithReferences({ collection: "v2ClaimEvidence", edge, references: [{ collection: "v2AtomicClaimVersions", id: claim.claimVersionId }, { collection: "v2EvidenceSegments", id: segmentId }] });
        if (edgeState === "CREATED") firestoreWrites += 1;
      }
    }
  }

  currentStage = "A4_AUTHORITY_CONFLICTS";
  await repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: { claims: claims.length, evidenceEdges: evidenceEdges.length }, finalVerdict: "PENDING" }));
  const conflictSets = detectClaimConflicts({ context, claims, evidenceEdges });
  for (const conflict of conflictSets) await persist("v2ClaimConflictSets", conflict);
  const publishersByVersion = new Map(publisherVersions.map((publisher) => [publisher.publisherVersionId, publisher]));
  const verdicts: ClaimAuthorityVerdict[] = [];
  for (const claim of claims) {
    const conflict = conflictSets.find((set) => set.claimVersionIds.includes(claim.claimVersionId));
    const verdict = evaluateClaimAuthority({ context, claim, evidenceEdges: evidenceEdges.filter((edge) => edge.claimVersionId === claim.claimVersionId), publishersByVersionId: publishersByVersion, conflictSet: conflict });
    verdicts.push(verdict);
    await persist("v2ClaimAuthorityVerdicts", verdict);
  }

  currentStage = "A5_RESOLUTION_REUSE";
  await repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: { claims: claims.length, conflicts: conflictSets.length }, finalVerdict: "PENDING" }));
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
    const existingHeads = (await repository.boundedQuery("v2CanonicalEntities", [{ field: "canonicalNameKey", op: "==", value: normalizedIdentityText(candidate.canonicalName) }], 20)).filter((head) => head.entityType === candidate.entityType);
    const existing = (await Promise.all(existingHeads.map((head) => repository.getById("v2CanonicalEntityVersions", String(head.currentVersionId))))).filter((item): item is CanonicalEntityVersion => item !== null) as CanonicalEntityVersion[];
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
      const state = await repository.advanceHead({ collection: "v2CanonicalEntities", headId: resolved.entityId, expectedCurrentVersionId: priorEntity?.entityVersionId || null, nextVersionId: resolved.entityVersionId, data: head });
      if (state === "CREATED") firestoreWrites += 1;
    }
    const aliasPayload = { entityId: resolved.entityId, entityVersionId: resolved.entityVersionId, entityType: resolved.entityType, alias: resolved.canonicalName, aliasKey: normalizedIdentityText(resolved.canonicalName), language: resolved.language, script: null, aliasType: "CANONICAL" as const };
    const semanticContext = { ...context, policyVersion: V2_POLICY_VERSION };
    const aliasId = semanticArtifactId("entity-alias", semanticContext, aliasPayload);
    const alias = parseSealedArtifact(entityAliasSchema, { ...semanticEnvelope(semanticContext, aliasId, resolved.entityVersionId), entityAliasId: aliasId, ...aliasPayload });
    await persist("v2EntityAliases", alias);
  }

  const claimsByCluster = new Map<string, AtomicClaimVersion[]>();
  for (const claim of claims) {
    const key = claim.candidateEventClusterId || `claim-${claim.claimId}`;
    claimsByCluster.set(key, [...(claimsByCluster.get(key) || []), claim]);
  }
  const events: CanonicalEventVersion[] = [];
  for (const cluster of claimsByCluster.values()) {
    const core = cluster.filter((claim) => passingClaimIds.has(claim.claimVersionId));
    if (core.length === 0 || entities.length === 0) continue;
    const clusterEvidenceText = core.flatMap((claim) => claim.extractedFromSegmentIds).flatMap((segmentId) => {
      const segment = segmentsById.get(segmentId);
      return segment ? [segment.exactText] : [];
    });
    const clusterText = normalizedIdentityText([...cluster.map((claim) => `${claim.subject.label} ${typeof claim.object.value === "string" || typeof claim.object.value === "number" ? claim.object.value : claim.object.value.label} ${claim.normalizedAssertion}`), ...clusterEvidenceText].join(" "));
    const relatedEntities = entities.filter((entity) => clusterText.includes(normalizedIdentityText(entity.canonicalName)));
    if (relatedEntities.length === 0) continue;
    const semanticClass = semanticClassByClaim.get(cluster[0]!.claimVersionId) || "CONTEXT";
    const temporalClaim = core.find((claim) => claim.temporal) || core.find((claim) => claim.claimType === "DATE" && typeof claim.object.value === "object");
    const start = temporalClaim?.temporal?.start || (temporalClaim?.claimType === "DATE" && typeof temporalClaim.object.value === "object" ? temporalClaim.object.value : null);
    if (!start) continue;
    const action = core.find((claim) => claim.claimType === "OCCURRENCE" || claim.claimType === "INSTITUTIONAL_ACTION");
    if (!action) continue;
    let event = buildCanonicalEventVersion(context, { version: 1, scopeContractId: scopeResult.scope.scopeContractId, canonicalTitle: action.subject.label, semanticClass, eventSubtype: semanticClass === "EVENT" ? "OCCURRENCE" : null, temporal: { start, end: temporalClaim?.temporal?.end || null, uncertainty: start.precision === "APPROXIMATE" ? "Approximate date preserved from evidence." : null }, actionKey: action.normalizedAssertion.slice(0, 300), primaryEntityKeys: relatedEntities.map((entity) => entity.entityId).slice(0, 20), locationKeys: core.flatMap((claim) => claim.locationEntityIds).slice(0, 20), coreClaimVersionIds: core.map((claim) => claim.claimVersionId).slice(0, 20), supportingClaimVersionIds: cluster.filter((claim) => !core.includes(claim)).map((claim) => claim.claimVersionId).slice(0, 40), authorityState: "FACTORY_CANDIDATE", canonicalizationState: semanticClass === "EVENT" ? "RESOLVED" : "INELIGIBLE", parentEventId: null, supersedesEventVersionId: null });
    if (event.semanticClass === "EVENT" && !eventWithinLockedScope(scopeResult.scope, event)) {
      event = buildCanonicalEventVersion(context, { version: 1, scopeContractId: event.scopeContractId, canonicalTitle: event.canonicalTitle, semanticClass: "CONTEXT", eventSubtype: null, temporal: event.temporal, actionKey: event.actionKey, primaryEntityKeys: event.primaryEntityKeys, locationKeys: event.locationKeys, coreClaimVersionIds: event.coreClaimVersionIds, supportingClaimVersionIds: event.supportingClaimVersionIds, authorityState: event.authorityState, canonicalizationState: "INELIGIBLE", parentEventId: null, supersedesEventVersionId: null });
    }
    const existingHeads = await repository.boundedQuery("v2CanonicalEvents", [{ field: "eventIdentityKey", op: "==", value: event.eventIdentityKey }], 50);
    const existing = (await Promise.all(existingHeads.map((head) => repository.getById("v2CanonicalEventVersions", String(head.currentVersionId))))).filter((item): item is CanonicalEventVersion => item !== null) as CanonicalEventVersion[];
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
      const head = canonicalEventRecordSchema.parse({ canonicalEventId: resolved.canonicalEventId, corpusId: context.corpusId, eventIdentityKey: resolved.eventIdentityKey, currentVersionId: resolved.eventVersionId, currentVersion: resolved.version, state: resolved.authorityState, updatedAt: context.createdAt });
      const state = await repository.advanceHead({ collection: "v2CanonicalEvents", headId: resolved.canonicalEventId, expectedCurrentVersionId: priorEvent?.eventVersionId || null, nextVersionId: resolved.eventVersionId, data: head });
      if (state === "CREATED") firestoreWrites += 1;
    }
    for (const claimId of [...resolved.coreClaimVersionIds, ...resolved.supportingClaimVersionIds]) {
      const edgePayload = { eventVersionId: resolved.eventVersionId, claimVersionId: claimId, role: resolved.coreClaimVersionIds.includes(claimId) ? "CORE" as const : "SUPPORTING" as const };
      const semanticContext = { ...context, policyVersion: V2_POLICY_VERSION };
      const edgeId = semanticArtifactId("event-claim", semanticContext, edgePayload);
      const edge = parseSealedArtifact(eventClaimEdgeSchema, { ...semanticEnvelope(semanticContext, edgeId, resolved.eventVersionId), eventClaimId: edgeId, ...edgePayload });
      await repository.createEdgeWithReferences({ collection: "v2EventClaims", edge, references: [{ collection: "v2CanonicalEventVersions", id: resolved.eventVersionId }, { collection: "v2AtomicClaimVersions", id: claimId }] });
      firestoreWrites += 1;
    }
    for (const entity of relatedEntities) {
      const edgePayload = { eventVersionId: resolved.eventVersionId, entityVersionId: entity.entityVersionId, role: "CENTRAL_SUBJECT", meaning: "The entity is the central subject participating in this candidate event.", temporal: null };
      const semanticContext = { ...context, policyVersion: V2_POLICY_VERSION };
      const edgeId = semanticArtifactId("event-entity", semanticContext, edgePayload);
      const edge = parseSealedArtifact(eventEntityEdgeSchema, { ...semanticEnvelope(semanticContext, edgeId, resolved.eventVersionId), eventEntityId: edgeId, ...edgePayload });
      await repository.createEdgeWithReferences({ collection: "v2EventEntities", edge, references: [{ collection: "v2CanonicalEventVersions", id: resolved.eventVersionId }, { collection: "v2CanonicalEntityVersions", id: entity.entityVersionId }] });
      firestoreWrites += 1;
    }
  }

  const unresolvedMaterialConflicts = conflictSets.filter((conflict) => conflict.blocksPass).length;
  if (retrieved.length === 0) blockingReasons.push("NO_DURABLE_SOURCE_SNAPSHOTS");
  if (claims.length === 0) blockingReasons.push("NO_ATOMIC_CLAIMS");
  if (passingClaimIds.size === 0) blockingReasons.push("NO_SUPPORTED_CLAIMS");
  if (events.filter((event) => event.semanticClass === "EVENT").length === 0) blockingReasons.push("NO_RESOLVED_EVENT_CANDIDATES");
  if (unresolvedMaterialConflicts > 0) blockingReasons.push("CLAIM_CONFLICT_UNRESOLVED");
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
  assertDeadline();
  const tokenMetrics = modelTokens(modelExecutions);
  const individualClaimsRejected = extractedGroups.reduce((total, group) => total + group.rejectedClaims.length, 0);
  const metrics: V2ACertificationMetrics = {
    totalExecutionMs: Date.now() - startedAt, scopeContractModelCalls: scopeResult.executions.length, researchMapModelCalls: mapResult.executions.length, queryPlanModelCalls: planResult.executions.length,
    groundingCalls: acquisitions.length, providerReportedSearchQueries: actualQueryCount, directRetrievalAttempts: sourceCandidates.length - retrievalsSuppressedByHostCircuit, retrievalSuccesses: retrievedWithDuplicates.length, retrievalFailures,
    sourceDocumentsDiscovered: discovered.size, sourceDocumentsSnapshotted: retrieved.length, cacheHits: retrieved.filter((item) => item.cacheDisposition === "CACHE_HIT").length,
    cacheRevalidated: retrieved.filter((item) => item.cacheDisposition === "REVALIDATED").length, cacheRefetched: retrieved.filter((item) => item.cacheDisposition === "REFETCHED").length, cacheNotApplicable: retrieved.filter((item) => item.cacheDisposition === "CACHE_NOT_APPLICABLE").length,
    retrievalsSuppressedByHostCircuit,
    evidencePackets: claimInputs.length, evidencePacketSegments: claimInputs.reduce((total, input) => total + input.packet.segments.length, 0), individualClaimsRejected,
    researchQuestionsNoEvidence: questionCoverage.filter((item) => item.status === "NO_EVIDENCE").length, researchQuestionsPartial: questionCoverage.filter((item) => item.status === "PARTIAL").length,
    researchQuestionsSufficient: questionCoverage.filter((item) => item.status === "SUFFICIENT").length, researchQuestionsBlocked: questionCoverage.filter((item) => item.status === "BLOCKED").length,
    sourceClasses: [...new Set(retrieved.map((item) => item.source.sourceClass))].sort(), publisherIdentities: new Set(retrieved.map((item) => item.source.publisherId).filter(Boolean)).size,
    claimsExtracted: claims.length, claimsSupported: verdicts.filter((verdict) => verdict.verdict === "SUPPORTED" || verdict.verdict === "QUALIFIED").length,
    claimsRejected: verdicts.filter((verdict) => verdict.verdict === "INSUFFICIENT" || verdict.verdict === "REJECTED").length + claimExtractionFailures + individualClaimsRejected, claimsRequiringReview: verdicts.filter((verdict) => verdict.verdict === "REVIEW_REQUIRED").length,
    conflictsDetected: conflictSets.length, conflictsResolved: conflictSets.filter((conflict) => ["RESOLVED", "QUALIFIED"].includes(conflict.state)).length, conflictsUnresolved: conflictSets.filter((conflict) => conflict.state === "UNRESOLVED").length,
    entityCandidates: entities.length, resolvedEntities: entities.filter((entity) => entity.resolutionState === "RESOLVED").length, eventCandidates: events.length,
    resolvedCanonicalEventCandidates: events.filter((event) => event.semanticClass === "EVENT" && event.canonicalizationState === "RESOLVED").length,
    nonEventKnowledgeItems: events.filter((event) => event.semanticClass !== "EVENT").length, reusedExistingKnowledge: reconnaissance.reuseClassifications.filter((item) => item.classification === "REUSE_DIRECTLY").length,
    newKnowledge: claims.length + entities.length + events.length, modelRepairAttempts: tokenMetrics.repairs, infrastructureRetries: tokenMetrics.retries,
    inputTokens: tokenMetrics.input, outputTokens: tokenMetrics.output, monetaryCost: null, monetaryCostMeasurement: "NOT_MEASURABLE", firestoreWrites, cloudStorageWrites,
    finalV2AVerdict: blockingReasons.length === 0 ? "PASS" : "FAIL"
  };
  currentStage = metrics.finalV2AVerdict === "PASS" ? "COMPLETE" : "A5_RESOLUTION_REUSE";
  await repository.setOperation(context.runId, operationProjection({ context, state: metrics.finalV2AVerdict === "PASS" ? "COMPLETED" : "FAILED", stage: currentStage, startedAt, blockingReason: blockingReasons.join(", ") || null, counts: { sources: metrics.sourceDocumentsSnapshotted, claims: metrics.claimsExtracted, supportedClaims: metrics.claimsSupported, conflicts: metrics.conflictsDetected, entities: metrics.entityCandidates, events: metrics.eventCandidates }, finalVerdict: metrics.finalV2AVerdict }));
  return {
    context,
    scopeContractId: scopeResult.scope.scopeContractId,
    researchMapId: mapResult.map.researchMapId,
    queryPlanId: planResult.plan.queryPlanId,
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
    const failureClass = message.includes("WHOLE_RUN_DEADLINE_EXCEEDED") ? "WHOLE_RUN_DEADLINE_EXCEEDED"
      : message.includes("ACQUISITION_BUDGET_EXHAUSTED") ? "ACQUISITION_BUDGET_EXHAUSTED"
      : /SOURCE_RETRIEVAL|PRIVATE_ADDRESS|ROBOTS/iu.test(message) ? "SECURITY_RETRIEVAL_REJECTED"
      : /VERTEX|PROVIDER|MODEL|GOOGLE/iu.test(message) ? "PROVIDER_FAILURE"
      : "FAILED_UNCLASSIFIED";
    const failurePayload = {
      stage: currentStage,
      failureClass,
      severity: failureClass === "FAILED_UNCLASSIFIED" ? "CRITICAL" as const : "HIGH" as const,
      retryable: failureClass === "PROVIDER_FAILURE",
      message,
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
    try { await persist("v2FailureRecords", failure); } catch { /* Preserve the originating failure. */ }
    try {
      await repository.setOperation(context.runId, operationProjection({ context, state: "FAILED", stage: currentStage, startedAt, blockingReason: message.slice(0, 1000), counts: {}, finalVerdict: "FAIL" }));
    } catch { /* Preserve the originating failure. */ }
    throw new Error(`V2_A_RUN_FAILED:${context.runId}:${message}`, { cause: error });
  }
}
