import { randomUUID } from "node:crypto";
import { acquisitionDiscoverySchema, acquisitionRunSchema, canonicalEntityRecordSchema, canonicalEventRecordSchema, entityAliasSchema, eventClaimEdgeSchema, eventEntityEdgeSchema, modelExecutionSchema, publisherAuthorityRecordSchema, publisherAuthorityVersionSchema, reconnaissanceRecordSchema, sourceDocumentSchema, topicOperationSchema, v2FailureRecordSchema, type AtomicClaimVersion, type CanonicalEntityVersion, type CanonicalEventVersion, type ClaimAuthorityVerdict, type ClaimEvidenceEdge, type PublisherAuthorityVersion, type SourceDocument } from "./contracts";
import { assertV2AShadowEnabled, type FactoryV2Config } from "./config";
import { bootstrapPublisherRegistry, detectClaimConflicts, evaluateClaimAuthority, independenceGroup } from "./authority";
import { buildAtomicClaimVersion, buildCanonicalEntityVersion, buildCanonicalEventVersion, buildClaimEvidenceEdge, immutableEnvelope, normalizedIdentityText, parseSealedArtifact, type ArtifactContext } from "./contracts/builders";
import { retrieveSource, type RetrievalDependencies } from "./acquisition/retrieval";
import { canonicalizeUrl } from "./acquisition/url";
import { contentAddressedId, deterministicUuid, payloadHash, sha256 } from "./hashing";
import { performBoundedReconnaissance } from "./reconnaissance";
import { eventWithinLockedScope, resolveEntityCandidate, resolveEventCandidate } from "./resolution";
import { V2FirestoreRepository } from "./repositories/firestore";
import { extractAtomicClaims, generateQueryPlan, generateResearchMap, proposeScope, runGroundedAcquisition, StructuredStageError, type GroundingAcquisition, type V2ModelProvider } from "./vertex";

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
  eventVersionIds: string[];
  metrics: V2ACertificationMetrics;
  blockingReasons: string[];
};

export type OrchestratorDependencies = {
  repository?: V2FirestoreRepository;
  provider?: V2ModelProvider;
  retrieval?: RetrievalDependencies;
};

function publisherForUrl(url: string, publishers: PublisherAuthorityVersion[]): PublisherAuthorityVersion | undefined {
  const hostname = new URL(url).hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "");
  return publishers.find((publisher) => publisher.knownDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)));
}

export function provisionalPublisher(context: ArtifactContext, url: string, language: string): PublisherAuthorityVersion {
  const hostname = new URL(url).hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "");
  const registryContext: ArtifactContext = { ...context, topicId: "publisher-registry", runId: "provisional-v2-a", generation: 1, createdAt: "2026-09-06T00:00:00.000Z" };
  const publisherId = deterministicUuid("timelines.publisher.provisional", hostname);
  const publisherVersionId = contentAddressedId("publisher-version", { publisherId, hostname, language: "multilingual", state: "PROVISIONAL", policy: "v2-a.1" });
  return parseSealedArtifact(publisherAuthorityVersionSchema, {
    ...immutableEnvelope(registryContext, publisherVersionId), publisherVersionId, publisherId, version: 1, canonicalName: hostname, aliases: [], parentPublisherId: null,
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
  if (["ARCHIVE", "GOVERNMENT", "MUSEUM", "STANDARDS_BODY"].includes(publisher.institutionType)) return "PRIMARY_INSTITUTIONAL";
  if (publisher.institutionType === "NEWSROOM") return "ESTABLISHED_JOURNALISM";
  if (publisher.institutionType === "EDITED_REFERENCE") return "EDITED_REFERENCE";
  if (publisher.institutionType === "UNIVERSITY" || publisher.institutionType === "SCHOLARLY_PUBLISHER") return "SCHOLARLY_SECONDARY";
  return "OTHER";
}

function operationProjection(input: { context: ArtifactContext; state: "RUNNING" | "FAILED" | "COMPLETED"; stage: "A1_SCHEMAS" | "A2_SCOPE_ACQUISITION" | "A3_CLAIMS" | "A4_AUTHORITY_CONFLICTS" | "A5_RESOLUTION_REUSE" | "COMPLETE"; startedAt: number; blockingReason: string | null; counts: Record<string, number>; finalVerdict: "PENDING" | "PASS" | "FAIL" }) {
  return topicOperationSchema.parse({ operationId: input.context.runId, corpusId: input.context.corpusId, topicId: input.context.topicId, runId: input.context.runId, generation: input.context.generation, pipelineVersion: "factory-v2-a.1", executionMode: "SHADOW", state: input.state, stage: input.stage, scopeState: input.stage === "A1_SCHEMAS" ? "PENDING" : "LOCKED", researchMapState: ["A1_SCHEMAS", "A2_SCOPE_ACQUISITION"].includes(input.stage) ? "PENDING" : "VALID", currentBlockingReason: input.blockingReason, counts: input.counts, budgetsConsumed: {}, elapsedMs: Date.now() - input.startedAt, finalVerdict: input.finalVerdict, updatedAt: new Date().toISOString() });
}

export async function runV2AShadowFixture(descriptor: ShadowFixtureDescriptor, config: FactoryV2Config, dependencies: OrchestratorDependencies = {}): Promise<V2AShadowResult> {
  assertV2AShadowEnabled(config);
  const repository = dependencies.repository || new V2FirestoreRepository();
  const startedAt = Date.now();
  const topicId = sha256(`${descriptor.language}\n${normalizedIdentityText(descriptor.title)}`);
  const context: ArtifactContext = { corpusId: repository.activeCorpusId(), topicId, runId: randomUUID(), generation: 1, createdAt: new Date().toISOString() };
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
  try {
    await repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: {}, finalVerdict: "PENDING" }));
    firestoreWrites += 1;

  const publishers = bootstrapPublisherRegistry(context);
  for (const publisher of publishers) {
    await persist("v2PublisherAuthorityVersions", publisher);
    const head = publisherAuthorityRecordSchema.parse({ publisherId: publisher.publisherId, corpusId: context.corpusId, canonicalNameKey: normalizedIdentityText(publisher.canonicalName), currentVersionId: publisher.publisherVersionId, currentVersion: publisher.version, state: publisher.state, updatedAt: context.createdAt });
    const result = await repository.advanceHead({ collection: "v2PublisherAuthorityRecords", headId: publisher.publisherId, expectedCurrentVersionId: null, nextVersionId: publisher.publisherVersionId, data: head });
    if (result === "CREATED") firestoreWrites += 1;
  }

  const scopeResult = await proposeScope({ context, title: descriptor.title, language: descriptor.language, ongoingAsOf: descriptor.ongoingAsOf, reconnaissance: { classification: "NO_LEGACY_CONTENT_REUSE", existingKnowledgeWillBeInspectedAfterScopeLock: true }, provider: dependencies.provider });
  modelExecutions.push(...scopeResult.executions.map((execution) => modelExecutionSchema.parse(execution)));
  for (const execution of scopeResult.executions) await persist("v2ModelExecutions", execution);
  await persist("v2ScopeContracts", scopeResult.scope);

  const reconnaissance = await performBoundedReconnaissance({ repository, topicId, scopeContractId: scopeResult.scope.scopeContractId, entityNameKeys: scopeResult.scope.centralEntities.map((entity) => normalizedIdentityText(entity.name)), limitPerKind: 25 });
  const reconnaissanceId = contentAddressedId("recon-record", reconnaissance);
  const reconnaissanceArtifact = parseSealedArtifact(reconnaissanceRecordSchema, { ...immutableEnvelope(context, reconnaissanceId), reconnaissanceId, scopeContractId: scopeResult.scope.scopeContractId, knownEntityIds: reconnaissance.knownEntities.map((item) => String(item.entityId || item.id)), admittedEventVersionIds: reconnaissance.admittedEvents.map((item) => String(item.eventVersionId || item.id)), strongClaimVersionIds: reconnaissance.strongClaims.map((item) => String(item.claimVersionId || item.id)), reusableSnapshotIds: reconnaissance.reusableSnapshots.map((item) => String(item.sourceSnapshotId || item.id)), conflictSetIds: reconnaissance.conflicts.map((item) => String(item.conflictSetId || item.id)), gaps: reconnaissance.gaps, legacyInputsExcluded: true });
  await persist("v2ReconnaissanceRecords", reconnaissanceArtifact);

  const mapResult = await generateResearchMap({ context, scope: scopeResult.scope, reconnaissance, provider: dependencies.provider });
  modelExecutions.push(...mapResult.executions.map((execution) => modelExecutionSchema.parse(execution)));
  for (const execution of mapResult.executions) await persist("v2ModelExecutions", execution);
  await persist("v2ResearchMaps", mapResult.map);
  const planResult = await generateQueryPlan({ context, scope: scopeResult.scope, map: mapResult.map, provider: dependencies.provider });
  modelExecutions.push(...planResult.executions.map((execution) => modelExecutionSchema.parse(execution)));
  for (const execution of planResult.executions) await persist("v2ModelExecutions", execution);
  await persist("v2QueryPlans", planResult.plan);

  currentStage = "A2_SCOPE_ACQUISITION";
  await repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: {}, finalVerdict: "PENDING" }));
  const groundedQueries = planResult.plan.queries.filter((query) => query.role !== "SOURCE_RETRIEVAL").slice(0, 5);
  const acquisitions = await mapLimit(groundedQueries, config.budgetBundle.maximumConcurrency, async (query) => runGroundedAcquisition({ context, query, provider: dependencies.provider }));
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

  const discovered = new Map<string, { url: string; title: string; acquisition: GroundingAcquisition }>();
  for (const acquisition of acquisitions) for (const chunk of acquisition.chunks) {
    let key: string;
    try { key = canonicalizeUrl(chunk.url); } catch { continue; }
    if (!discovered.has(key)) discovered.set(key, { url: chunk.url, title: chunk.title, acquisition });
  }
  const sourceCandidates = [...discovered.values()].slice(0, config.budgetBundle.maximumSourceDocuments);
  let retrievalFailures = 0;
  const retrieved = (await mapLimit(sourceCandidates, Math.min(6, config.budgetBundle.maximumConcurrency * 2), async (candidate) => {
    try {
      const initialPublisher = publisherForUrl(candidate.url, publishers);
      const result = await retrieveSource({ context, url: candidate.url, titleHint: candidate.title, publisherId: initialPublisher?.publisherId || null, sourceClass: provisionalSourceClass(initialPublisher), primarySecondaryRole: initialPublisher?.primarySecondaryTendency || "UNKNOWN", languageHint: descriptor.language }, dependencies.retrieval);
      cloudStorageWrites += result.archiveWrites;
      return result;
    } catch (error) {
      retrievalFailures += 1;
      console.error(JSON.stringify({ severity: "WARNING", component: "factory-v2-source-retrieval", topicId, urlHash: sha256(candidate.url), message: error instanceof Error ? error.message.slice(0, 300) : "Unknown retrieval failure" }));
      return null;
    }
  })).filter((value): value is NonNullable<typeof value> => value !== null);

  const publisherVersions = [...publishers];
  const publisherBySource = new Map<string, PublisherAuthorityVersion>();
  for (const result of retrieved) {
    let publisher = publisherForUrl(result.source.canonicalUrl, publisherVersions);
    if (!publisher) {
      publisher = provisionalPublisher(context, result.source.canonicalUrl, result.source.language);
      publisherVersions.push(publisher);
      await persist("v2PublisherAuthorityVersions", publisher);
      const head = publisherAuthorityRecordSchema.parse({ publisherId: publisher.publisherId, corpusId: context.corpusId, canonicalNameKey: normalizedIdentityText(publisher.canonicalName), currentVersionId: publisher.publisherVersionId, currentVersion: publisher.version, state: publisher.state, updatedAt: context.createdAt });
      const state = await repository.advanceHead({ collection: "v2PublisherAuthorityRecords", headId: publisher.publisherId, expectedCurrentVersionId: null, nextVersionId: publisher.publisherVersionId, data: head });
      if (state === "CREATED") firestoreWrites += 1;
    }
    const source = sourceDocumentSchema.parse({ ...result.source, publisherId: publisher.publisherId, sourceClass: provisionalSourceClass(publisher), primarySecondaryRole: publisher.primarySecondaryTendency, authorityDomains: publisher.authorityDomains });
    const sourceWrite = await repository.upsertSourceDocument(source);
    if (sourceWrite !== "IDEMPOTENT") firestoreWrites += 1;
    await persist("v2SourceSnapshots", result.snapshot);
    if (result.evidenceSegments.length > 0) {
      const segmentWrites = await repository.createImmutableBatch("v2EvidenceSegments", result.evidenceSegments);
      firestoreWrites += segmentWrites.created;
    }
    publisherBySource.set(source.sourceId, publisher);
    result.source = source;
  }

  currentStage = "A3_CLAIMS";
  await repository.setOperation(context.runId, operationProjection({ context, state: "RUNNING", stage: currentStage, startedAt, blockingReason: null, counts: { sources: retrieved.length }, finalVerdict: "PENDING" }));
  const claimCandidates = retrieved.filter((result) => result.evidenceSegments.length > 0).sort((left, right) => {
    const score = (result: typeof left) => {
      const publisher = publisherBySource.get(result.source.sourceId);
      return (publisher?.state === "VERIFIED" ? 100 : 0)
        + (result.source.sourceClass === "PRIMARY_INSTITUTIONAL" ? 30 : result.source.sourceClass === "SCHOLARLY_SECONDARY" ? 20 : result.source.sourceClass === "ESTABLISHED_JOURNALISM" ? 10 : 0)
        + (result.snapshot.accessLimitations.length === 0 ? 5 : 0);
    };
    return score(right) - score(left) || left.source.sourceId.localeCompare(right.source.sourceId);
  });
  const claimInputs: typeof claimCandidates = [];
  const selectedPublishers = new Set<string>();
  for (const result of claimCandidates) {
    const publisherKey = result.source.publisherId || result.source.sourceId;
    if (selectedPublishers.has(publisherKey)) continue;
    selectedPublishers.add(publisherKey);
    claimInputs.push(result);
    if (claimInputs.length === 6) break;
  }
  for (const result of claimCandidates) {
    if (claimInputs.length === 6) break;
    if (!claimInputs.includes(result)) claimInputs.push(result);
  }
  let claimExtractionFailures = 0;
  const extractedAttempts = await mapLimit(claimInputs, 3, async (result) => {
    try {
      return await extractAtomicClaims({ context, scope: scopeResult.scope, sourceSnapshotId: result.snapshot.sourceSnapshotId, segments: result.evidenceSegments.slice(0, 30), provider: dependencies.provider });
    } catch (error) {
      claimExtractionFailures += 1;
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 1900);
      const failedExecutions = error instanceof StructuredStageError ? error.executions : [];
      for (const execution of failedExecutions) {
        modelExecutions.push(execution);
        try { await persist("v2ModelExecutions", execution); } catch { /* The per-source failure record still captures the fault. */ }
      }
      const failureRecordId = contentAddressedId("failure", { runId: context.runId, sourceSnapshotId: result.snapshot.sourceSnapshotId, stage: "CLAIM_EXTRACTION", message });
      const failure = parseSealedArtifact(v2FailureRecordSchema, {
        ...immutableEnvelope(context, failureRecordId), failureRecordId, stage: "CLAIM_EXTRACTION", failureClass: "CLAIM_UNSUPPORTED", severity: "WARNING", retryable: false,
        message, blockingArtifactIds: [result.snapshot.sourceSnapshotId], attemptsConsumed: failedExecutions.length, budgetConsumed: {},
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
  for (const claim of extractedClaims) claimContributors.set(claim.claimId, [...(claimContributors.get(claim.claimId) || []), claim]);
  const claims = [...claimContributors.values()].map((contributors) => contributors[0]!);
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
    const currentVersion = typeof existingHead?.currentVersion === "number" ? existingHead.currentVersion : 0;
    const headState = await repository.advanceHead({ collection: "v2AtomicClaims", headId: claim.claimId, expectedCurrentVersionId: priorVersionId, nextVersionId: claim.claimVersionId, data: { claimId: claim.claimId, subjectKey: normalizedIdentityText(claim.subject.label), predicate: claim.predicate, currentVersion: currentVersion + 1, state: "CANDIDATE", updatedAt: context.createdAt } });
    if (headState === "CREATED") firestoreWrites += 1;
  }
  const snapshotsById = new Map(retrieved.map((item) => [item.snapshot.sourceSnapshotId, item]));
  const segmentsById = new Map(retrieved.flatMap((item) => item.evidenceSegments).map((segment) => [segment.evidenceSegmentId, segment]));
  const evidenceEdges: ClaimEvidenceEdge[] = [];
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
  const identityEvidence = [...new Set(claims.flatMap((claim) => claim.extractedFromSegmentIds).filter((id) => segmentsById.has(id)))];
  const entities: CanonicalEntityVersion[] = [];
  for (const entityRef of scopeResult.scope.centralEntities) {
    if (identityEvidence.length === 0) break;
    const candidate = buildCanonicalEntityVersion(context, { version: 1, entityType: entityRef.type, canonicalName: entityRef.name, language: entityRef.language, externalIdentifiers: [], activeTemporal: null, geographyKeys: scopeResult.scope.spatialScope.included, state: "FACTORY_CANDIDATE", resolutionState: "PROPOSED", identityEvidenceSegmentIds: identityEvidence.slice(0, 20), supersedesEntityVersionId: null });
    const existingHeads = (await repository.boundedQuery("v2CanonicalEntities", [{ field: "canonicalNameKey", op: "==", value: normalizedIdentityText(candidate.canonicalName) }], 20)).filter((head) => head.entityType === candidate.entityType);
    const existing = (await Promise.all(existingHeads.map((head) => repository.getById("v2CanonicalEntityVersions", String(head.currentVersionId))))).filter((item): item is CanonicalEntityVersion => item !== null) as CanonicalEntityVersion[];
    const resolution = resolveEntityCandidate({ candidate, existing, aliases: [] });
    const resolved = buildCanonicalEntityVersion(context, {
      entityId: resolution.state === "REUSED" ? resolution.entityId : candidate.entityId,
      version: resolution.state === "REUSED" ? (existing.find((item) => item.entityVersionId === resolution.entityVersionId)?.version || 0) + 1 : 1,
      entityType: candidate.entityType,
      canonicalName: candidate.canonicalName,
      language: candidate.language,
      externalIdentifiers: candidate.externalIdentifiers,
      activeTemporal: candidate.activeTemporal,
      geographyKeys: candidate.geographyKeys,
      state: candidate.state,
      resolutionState: resolution.state === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : "RESOLVED",
      identityEvidenceSegmentIds: candidate.identityEvidenceSegmentIds,
      supersedesEntityVersionId: resolution.state === "REUSED" ? resolution.entityVersionId : null
    });
    entities.push(resolved);
    await persist("v2CanonicalEntityVersions", resolved);
    const head = canonicalEntityRecordSchema.parse({ entityId: resolved.entityId, corpusId: context.corpusId, entityType: resolved.entityType, canonicalNameKey: normalizedIdentityText(resolved.canonicalName), currentVersionId: resolved.entityVersionId, currentVersion: resolved.version, state: resolved.state, updatedAt: context.createdAt });
    const state = await repository.advanceHead({ collection: "v2CanonicalEntities", headId: resolved.entityId, expectedCurrentVersionId: resolution.state === "REUSED" ? resolution.entityVersionId : null, nextVersionId: resolved.entityVersionId, data: head });
    if (state === "CREATED") firestoreWrites += 1;
    const aliasId = contentAddressedId("entity-alias", { entityVersionId: resolved.entityVersionId, alias: resolved.canonicalName, language: resolved.language });
    const alias = parseSealedArtifact(entityAliasSchema, { ...immutableEnvelope(context, aliasId), entityAliasId: aliasId, entityId: resolved.entityId, entityVersionId: resolved.entityVersionId, entityType: resolved.entityType, alias: resolved.canonicalName, aliasKey: normalizedIdentityText(resolved.canonicalName), language: resolved.language, script: null, aliasType: "CANONICAL" });
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
    const semanticClass = semanticClassByClaim.get(cluster[0]!.claimVersionId) || "CONTEXT";
    const temporalClaim = cluster.find((claim) => claim.temporal) || cluster.find((claim) => claim.claimType === "DATE" && typeof claim.object.value === "object");
    const start = temporalClaim?.temporal?.start || (temporalClaim?.claimType === "DATE" && typeof temporalClaim.object.value === "object" ? temporalClaim.object.value : null);
    if (!start) continue;
    const action = core.find((claim) => claim.claimType === "OCCURRENCE" || claim.claimType === "INSTITUTIONAL_ACTION") || core[0]!;
    let event = buildCanonicalEventVersion(context, { version: 1, scopeContractId: scopeResult.scope.scopeContractId, canonicalTitle: action.subject.label, semanticClass, eventSubtype: semanticClass === "EVENT" ? "OCCURRENCE" : null, temporal: { start, end: temporalClaim?.temporal?.end || null, uncertainty: start.precision === "APPROXIMATE" ? "Approximate date preserved from evidence." : null }, actionKey: action.normalizedAssertion.slice(0, 300), primaryEntityKeys: entities.map((entity) => entity.entityId).slice(0, 20), locationKeys: core.flatMap((claim) => claim.locationEntityIds).slice(0, 20), coreClaimVersionIds: core.map((claim) => claim.claimVersionId).slice(0, 20), supportingClaimVersionIds: cluster.filter((claim) => !core.includes(claim)).map((claim) => claim.claimVersionId).slice(0, 40), authorityState: "FACTORY_CANDIDATE", canonicalizationState: semanticClass === "EVENT" ? "RESOLVED" : "INELIGIBLE", parentEventId: null, supersedesEventVersionId: null });
    if (event.semanticClass === "EVENT" && !eventWithinLockedScope(scopeResult.scope, event)) {
      event = buildCanonicalEventVersion(context, { version: 1, scopeContractId: event.scopeContractId, canonicalTitle: event.canonicalTitle, semanticClass: "CONTEXT", eventSubtype: null, temporal: event.temporal, actionKey: event.actionKey, primaryEntityKeys: event.primaryEntityKeys, locationKeys: event.locationKeys, coreClaimVersionIds: event.coreClaimVersionIds, supportingClaimVersionIds: event.supportingClaimVersionIds, authorityState: event.authorityState, canonicalizationState: "INELIGIBLE", parentEventId: null, supersedesEventVersionId: null });
    }
    const existingHeads = await repository.boundedQuery("v2CanonicalEvents", [{ field: "eventIdentityKey", op: "==", value: event.eventIdentityKey }], 50);
    const existing = (await Promise.all(existingHeads.map((head) => repository.getById("v2CanonicalEventVersions", String(head.currentVersionId))))).filter((item): item is CanonicalEventVersion => item !== null) as CanonicalEventVersion[];
    const resolution = resolveEventCandidate(event, existing);
    const resolved = resolution.state === "REUSED" ? buildCanonicalEventVersion(context, {
      canonicalEventId: resolution.canonicalEventId,
      candidateEventId: event.candidateEventId,
      version: (existing.find((item) => item.eventVersionId === resolution.eventVersionId)?.version || event.version) + 1,
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
      supersedesEventVersionId: resolution.eventVersionId
    }) : event;
    events.push(resolved);
    await persist("v2CanonicalEventVersions", resolved);
    if (resolved.semanticClass === "EVENT" && resolved.canonicalEventId) {
      const head = canonicalEventRecordSchema.parse({ canonicalEventId: resolved.canonicalEventId, corpusId: context.corpusId, eventIdentityKey: resolved.eventIdentityKey, currentVersionId: resolved.eventVersionId, currentVersion: resolved.version, state: resolved.authorityState, updatedAt: context.createdAt });
      const state = await repository.advanceHead({ collection: "v2CanonicalEvents", headId: resolved.canonicalEventId, expectedCurrentVersionId: resolution.state === "REUSED" ? resolution.eventVersionId : null, nextVersionId: resolved.eventVersionId, data: head });
      if (state === "CREATED") firestoreWrites += 1;
    }
    for (const claimId of [...resolved.coreClaimVersionIds, ...resolved.supportingClaimVersionIds]) {
      const edgeId = contentAddressedId("event-claim", { eventVersionId: resolved.eventVersionId, claimVersionId: claimId, role: resolved.coreClaimVersionIds.includes(claimId) ? "CORE" : "SUPPORTING" });
      const edge = parseSealedArtifact(eventClaimEdgeSchema, { ...immutableEnvelope(context, edgeId), eventClaimId: edgeId, eventVersionId: resolved.eventVersionId, claimVersionId: claimId, role: resolved.coreClaimVersionIds.includes(claimId) ? "CORE" : "SUPPORTING" });
      await repository.createEdgeWithReferences({ collection: "v2EventClaims", edge, references: [{ collection: "v2CanonicalEventVersions", id: resolved.eventVersionId }, { collection: "v2AtomicClaimVersions", id: claimId }] });
      firestoreWrites += 1;
    }
    for (const entity of entities) {
      const edgeId = contentAddressedId("event-entity", { eventVersionId: resolved.eventVersionId, entityVersionId: entity.entityVersionId, role: "CENTRAL_SUBJECT" });
      const edge = parseSealedArtifact(eventEntityEdgeSchema, { ...immutableEnvelope(context, edgeId), eventEntityId: edgeId, eventVersionId: resolved.eventVersionId, entityVersionId: entity.entityVersionId, role: "CENTRAL_SUBJECT", meaning: "The entity is the central subject participating in this candidate event.", temporal: null });
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
  const tokenMetrics = modelTokens(modelExecutions);
  const metrics: V2ACertificationMetrics = {
    totalExecutionMs: Date.now() - startedAt, scopeContractModelCalls: scopeResult.executions.length, researchMapModelCalls: mapResult.executions.length, queryPlanModelCalls: planResult.executions.length,
    groundingCalls: acquisitions.length, providerReportedSearchQueries: actualQueryCount, directRetrievalAttempts: sourceCandidates.length, retrievalSuccesses: retrieved.length, retrievalFailures,
    sourceDocumentsDiscovered: discovered.size, sourceDocumentsSnapshotted: retrieved.length, cacheHits: retrieved.filter((item) => item.snapshot.retrievalDisposition === "CACHE_REUSED").length,
    sourceClasses: [...new Set(retrieved.map((item) => item.source.sourceClass))].sort(), publisherIdentities: new Set(retrieved.map((item) => item.source.publisherId).filter(Boolean)).size,
    claimsExtracted: claims.length, claimsSupported: verdicts.filter((verdict) => verdict.verdict === "SUPPORTED" || verdict.verdict === "QUALIFIED").length,
    claimsRejected: verdicts.filter((verdict) => verdict.verdict === "INSUFFICIENT" || verdict.verdict === "REJECTED").length + claimExtractionFailures, claimsRequiringReview: verdicts.filter((verdict) => verdict.verdict === "REVIEW_REQUIRED").length,
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
  return { context, scopeContractId: scopeResult.scope.scopeContractId, researchMapId: mapResult.map.researchMapId, queryPlanId: planResult.plan.queryPlanId, eventVersionIds: events.map((event) => event.eventVersionId), metrics, blockingReasons };
  } catch (error) {
    if (error instanceof StructuredStageError) {
      for (const execution of error.executions) {
        if (modelExecutions.some((current) => current.executionId === execution.executionId)) continue;
        modelExecutions.push(execution);
        try { await persist("v2ModelExecutions", execution); } catch { /* Preserve the originating failure. */ }
      }
    }
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 1900);
    const failureClass = message.includes("ACQUISITION_BUDGET_EXHAUSTED") ? "ACQUISITION_BUDGET_EXHAUSTED"
      : /SOURCE_RETRIEVAL|PRIVATE_ADDRESS|ROBOTS/iu.test(message) ? "SECURITY_RETRIEVAL_REJECTED"
      : /VERTEX|PROVIDER|MODEL|GOOGLE/iu.test(message) ? "PROVIDER_FAILURE"
      : "FAILED_UNCLASSIFIED";
    const failureRecordId = contentAddressedId("failure", { runId: context.runId, stage: currentStage, message });
    const failure = parseSealedArtifact(v2FailureRecordSchema, {
      ...immutableEnvelope(context, failureRecordId),
      failureRecordId,
      stage: currentStage,
      failureClass,
      severity: failureClass === "FAILED_UNCLASSIFIED" ? "CRITICAL" : "HIGH",
      retryable: failureClass === "PROVIDER_FAILURE",
      message,
      blockingArtifactIds: [],
      attemptsConsumed: modelExecutions.length,
      budgetConsumed: { firestoreWrites, cloudStorageWrites },
    });
    try { await persist("v2FailureRecords", failure); } catch { /* Preserve the originating failure. */ }
    try {
      await repository.setOperation(context.runId, operationProjection({ context, state: "FAILED", stage: currentStage, startedAt, blockingReason: message.slice(0, 1000), counts: {}, finalVerdict: "FAIL" }));
    } catch { /* Preserve the originating failure. */ }
    throw new Error(`V2_A_RUN_FAILED:${context.runId}:${message}`, { cause: error });
  }
}
