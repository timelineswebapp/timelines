import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { V2FirestoreRepository } from "./firestore";
import { date, scopeFixture, TEST_CONTEXT } from "../test-fixtures";
import { buildEvidenceSegment, buildAtomicClaimVersion, buildCanonicalEventVersion, buildClaimEvidenceEdge, buildResearchMap, immutableEnvelope, parseSealedArtifact, sealArtifact, semanticArtifactId, semanticEnvelope } from "../contracts/builders";
import { bootstrapPublisherRegistry, buildPublisherAuthorityVersion } from "../authority";
import { buildTopicAuthoritySet } from "../authority-first";
import { dispatchSourceSubmissionRetrieval } from "../source-submission-dispatch";
import { inspectSourceSubmissionCandidate } from "../source-submission";
import { claimAuthorityVerdictSchema, deferredReentryRequestSchema, publisherAuthorityRecordSchema, sourceSnapshotSchema, v2FailureRecordSchema } from "../contracts";
import { normalizedIdentityText } from "../contracts/builders";
import { auditKnowledgeCoverage, buildCompletionResearchMap, buildKnowledgeCompletionResult, KNOWLEDGE_COVERAGE_POLICY_VERSION, planGapDirectedCompletion } from "../coverage";
import { reconstructCompletedKnowledgeSetForB1 } from "../completed-knowledge-set";

const AUTHORITY_LINEAGE = [{ topicAuthoritySetId: "topic-authority-set", routingObligationSetId: "routing-obligation-set", authorityResearchPlanId: "authority-research-plan", controlledResearchLedgerId: "controlled-research-ledger", perspectiveAuditId: "perspective-audit", confidenceVectorId: "confidence-vector" }];

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

test("Firestore emulator consumes a deferred re-entry exactly once and rejects occupied next lineage", { skip: !enabled }, async () => {
  const app = getApps()[0] || initializeApp({ projectId: "tiimeliines" });
  const firestore = getFirestore(app);
  const context = { corpusId: "reentry-emulator-corpus", topicId: "topic-reentry-001", runId: "run-original-001", generation: 1, createdAt: "2026-10-16T00:00:00.000Z" };
  const repository = new V2FirestoreRepository({ firestore, corpusId: context.corpusId });
  const outcome = { policyVersion: "autonomous-public-evidence.1", classification: "PUBLIC_EVIDENCE_LIMITATION" as const, disposition: "DEFERRED" as const, reentryState: "REQUIRES_RELEVANT_CHANGE" as const, detailedReason: "FAILED_UNCLASSIFIED", publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED" };
  const failure = parseSealedArtifact(v2FailureRecordSchema, { ...immutableEnvelope(context, "failure-reentry-001"), failureRecordId: "failure-reentry-001", stage: "A2_SCOPE_ACQUISITION", failureClass: "FAILED_UNCLASSIFIED", severity: "HIGH", retryable: false, message: "Governed public evidence capacity is exhausted.", protectedRepresentationDiagnostics: null, blockingArtifactIds: [], attemptsConsumed: 1, budgetConsumed: {}, autonomousOutcome: outcome });
  const operation = { operationId: "operation-reentry-001", corpusId: context.corpusId, topicId: context.topicId, runId: context.runId, generation: 1, pipelineVersion: "factory-v2-a.70", executionMode: "SHADOW", state: "DEFERRED", stage: "A2_SCOPE_ACQUISITION", scopeState: "LOCKED", researchMapState: "VALID", currentBlockingReason: "capacity", counts: {}, budgetsConsumed: {}, elapsedMs: 1, finalVerdict: "FAIL", terminalFailureRecordId: failure.failureRecordId, autonomousOutcome: outcome, updatedAt: context.createdAt };
  const request = parseSealedArtifact(deferredReentryRequestSchema, { ...immutableEnvelope({ ...context, runId: "run-reentry-002", generation: 2 }, "request-reentry-001"), deferredReentryRequestId: "request-reentry-001", originalFailureRecordId: failure.failureRecordId, originalOperationId: operation.operationId, originalRunId: context.runId, originalGeneration: 1, nextRunId: "run-reentry-002", nextGeneration: 2, originalRelease: { pipelineVersion: "factory-v2-a.70", schemaVersion: "factory-v2-a.15", policyVersion: "authority-first-research.43", promptVersion: null }, outcome, trigger: "RELEVANT_EVIDENCE_CHANGE", relevantChangeArtifactId: "governed-change-001", authorizedBy: null, authorizationReason: null, state: "REQUESTED" });
  await repository.createImmutable("v2FailureRecords", failure);
  await repository.setOperation(operation.operationId, operation);
  await repository.createImmutable("v2DeferredReentryRequests", request);
  assert.deepEqual(await Promise.all([repository.consumeDeferredReentryRequest(request.deferredReentryRequestId), repository.consumeDeferredReentryRequest(request.deferredReentryRequestId)]).then((values) => values.sort()), ["CONSUMED", "IDEMPOTENT"]);
  assert.equal((await repository.getById("v2TopicOperations", request.nextRunId))?.state, "QUEUED");
  await assert.rejects(repository.consumeDeferredReentryRequest("missing-request"), /does not exist/);
});

test("Firestore emulator derives and creates a deferred re-entry request exactly once from persisted lineage", { skip: !enabled }, async () => {
  const app = getApps()[0] || initializeApp({ projectId: "tiimeliines" });
  const firestore = getFirestore(app);
  const context = { corpusId: "reentry-request-emulator-corpus", topicId: "topic-reentry-request-001", runId: "run-reentry-request-original", generation: 1, createdAt: "2026-10-16T01:00:00.000Z" };
  const repository = new V2FirestoreRepository({ firestore, corpusId: context.corpusId });
  const outcome = { policyVersion: "autonomous-public-evidence.1", classification: "PUBLIC_EVIDENCE_LIMITATION" as const, disposition: "DEFERRED" as const, reentryState: "REQUIRES_RELEVANT_CHANGE" as const, detailedReason: "FAILED_UNCLASSIFIED", publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED" as const };
  const failure = parseSealedArtifact(v2FailureRecordSchema, { ...immutableEnvelope(context, "failure-reentry-request-001"), failureRecordId: "failure-reentry-request-001", stage: "A2_SCOPE_ACQUISITION", failureClass: "FAILED_UNCLASSIFIED", severity: "HIGH", retryable: false, message: "Governed public evidence capacity is exhausted.", protectedRepresentationDiagnostics: null, blockingArtifactIds: [], attemptsConsumed: 1, budgetConsumed: {}, autonomousOutcome: outcome });
  const operation = { operationId: "operation-reentry-request-001", corpusId: context.corpusId, topicId: context.topicId, runId: context.runId, generation: 1, pipelineVersion: "factory-v2-a.70", executionMode: "SHADOW", state: "DEFERRED", stage: "A2_SCOPE_ACQUISITION", scopeState: "LOCKED", researchMapState: "VALID", currentBlockingReason: "capacity", counts: {}, budgetsConsumed: {}, elapsedMs: 1, finalVerdict: "FAIL", terminalFailureRecordId: failure.failureRecordId, autonomousOutcome: outcome, updatedAt: context.createdAt };
  const source = { sourceId: "source-reentry-request-001", corpusId: context.corpusId, canonicalUrl: "https://example.org/reentry-request", canonicalUrlHash: "d".repeat(64), publisherId: "c1835f1f-e8de-4be3-885b-088896f526c2", title: "Newly accessible source", authors: [], publicationDate: null, sourceClass: "PRIMARY_INSTITUTIONAL", language: "en", primarySecondaryRole: "PRIMARY", authorityDomains: ["history"], access: "OPEN", currentSnapshotId: "snapshot-reentry-request-001", supersedesSourceId: null, identityHash: "e".repeat(64), updatedAt: "2026-10-16T01:02:00.000Z" };
  const snapshot = parseSealedArtifact(sourceSnapshotSchema, { ...immutableEnvelope({ ...context, runId: "source-retrieval-request", createdAt: "2026-10-16T01:02:00.000Z" }, "snapshot-reentry-request-001"), sourceSnapshotId: "snapshot-reentry-request-001", sourceId: source.sourceId, retrievalUrl: source.canonicalUrl, resolvedUrl: source.canonicalUrl, redirectChain: [], retrievedAt: "2026-10-16T01:02:00.000Z", retrievalMethod: "HTTP", retrievalDisposition: "NEWLY_RETRIEVED", mediaType: "text/html", language: "en", publicationDateObserved: null, rawObjectRef: null, extractedTextObjectRef: null, boundedExtractedText: "Newly accessible public source.", contentHash: "f".repeat(64), extractionHash: null, groundingMetadataRef: null, etag: null, lastModified: null, license: null, contentBytes: 32, accessLimitations: [], partial: false, supersedesSnapshotId: null });
  await repository.createImmutable("v2FailureRecords", failure);
  await repository.setOperation(operation.operationId, operation);
  await repository.upsertSourceDocument(source);
  await repository.createImmutable("v2SourceSnapshots", snapshot);
  const input = { operationId: operation.operationId, trigger: "RELEVANT_EVIDENCE_CHANGE" as const, relevantChangeArtifactId: snapshot.sourceSnapshotId, now: "2026-10-16T01:03:00.000Z" };
  const created = await Promise.all([repository.createDeferredReentryRequest(input), repository.createDeferredReentryRequest(input)]);
  assert.deepEqual(created.map((result) => result.state).sort(), ["CREATED", "IDEMPOTENT"]);
  assert.equal(created[0]!.requestId, created[1]!.requestId);
  assert.equal((await repository.getById("v2DeferredReentryRequests", created[0]!.requestId))?.originalOperationId, operation.operationId);
  await assert.rejects(repository.createDeferredReentryRequest({ ...input, relevantChangeArtifactId: "missing-change" }), /does not exist/);
});

test("Firestore emulator resolves submitted-source authority and persists a non-evidentiary retrieval observation", { skip: !enabled }, async () => {
  const app = getApps()[0] || initializeApp({ projectId: "tiimeliines" });
  const firestore = getFirestore(app);
  const context = { corpusId: "source-submission-emulator-corpus", topicId: "topic-source-submission", runId: "run-source-submission", generation: 1, createdAt: "2026-10-16T04:00:00.000Z" };
  const repository = new V2FirestoreRepository({ firestore, corpusId: context.corpusId });
  const scope = scopeFixture({ title: "Submitted source authority fixture" }, context);
  const map = buildResearchMap(context, scope, { version: 1, phases: [{ phaseId: "phase-submission", label: "material chronology", temporalRule: "The material chronology must be evidenced.", required: true, rationale: "The required chronology is materially relevant." }], dimensions: [{ dimensionId: "dimension-submission", label: "historical development", required: true, rationale: "Historical development is materially relevant." }], entities: [], questions: [{ questionId: "question-submission", text: "What registered evidence establishes the submitted-source fixture?", phaseIds: ["phase-submission"], dimensionIds: ["dimension-submission"], claimTypesExpected: ["OCCURRENCE"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["British Library"], languages: ["en"], geography: ["United Kingdom"], contested: false, dateCritical: true, priority: "CRITICAL", state: "UNRESEARCHED" }], terminology: [], knownUncertainty: [] });
  const publisher = bootstrapPublisherRegistry(context).find((item) => item.canonicalName === "British Library")!;
  const authoritySet = buildTopicAuthoritySet({ context, scope, researchMap: map, publishers: [publisher], proposals: [{ publisherVersionId: publisher.publisherVersionId, researchQuestionIds: ["question-submission"], roles: ["PRIMARY_RECORD"], claimTypes: ["OCCURRENCE"], subjectRelationship: "INDEPENDENT", perspectiveTags: [], routingObligationIds: [], rationale: "Registered British Library authority for the bounded fixture." }] });
  const outcome = { policyVersion: "autonomous-public-evidence.1", classification: "PUBLIC_EVIDENCE_LIMITATION" as const, disposition: "DEFERRED" as const, reentryState: "REQUIRES_RELEVANT_CHANGE" as const, detailedReason: "FAILED_UNCLASSIFIED", publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED" as const };
  const failure = parseSealedArtifact(v2FailureRecordSchema, { ...immutableEnvelope(context, "failure-source-submission"), failureRecordId: "failure-source-submission", stage: "A2_SCOPE_ACQUISITION", failureClass: "FAILED_UNCLASSIFIED", severity: "HIGH", retryable: false, message: "Public evidence is unavailable.", protectedRepresentationDiagnostics: null, blockingArtifactIds: [], attemptsConsumed: 1, budgetConsumed: {}, autonomousOutcome: outcome });
  const operation = { operationId: "operation-source-submission", corpusId: context.corpusId, topicId: context.topicId, runId: context.runId, generation: 1, pipelineVersion: "factory-v2-a.70", executionMode: "SHADOW", state: "DEFERRED", stage: "A2_SCOPE_ACQUISITION", scopeState: "LOCKED", researchMapState: "VALID", currentBlockingReason: "capacity", counts: {}, budgetsConsumed: {}, elapsedMs: 1, finalVerdict: "FAIL", terminalFailureRecordId: failure.failureRecordId, topicAuthoritySetId: authoritySet.topicAuthoritySetId, autonomousOutcome: outcome, updatedAt: context.createdAt };
  await repository.createImmutable("v2PublisherAuthorityVersions", publisher); await repository.createImmutable("v2TopicAuthoritySets", authoritySet); await repository.createImmutable("v2FailureRecords", failure); await repository.setOperation(operation.operationId, operation);
  const candidate = await repository.createSourceSubmissionCandidate({ operationId: operation.operationId, submittedUrl: "https://www.bl.uk/submitted-source", rationale: "A registered authority URL may address the unresolved obligation.", submittedBy: "operator-submission", now: "2026-10-16T04:01:00.000Z" });
  let fetchCalls = 0;
  const observation = await dispatchSourceSubmissionRetrieval({ candidateId: candidate.candidateId, dispatchedAt: "2026-10-16T04:02:00.000Z" }, repository, {
    dnsLookup: (async () => [{ address: "93.184.216.34", family: 4 }]) as never,
    fetch: async () => {
      fetchCalls += 1;
      const body = fetchCalls === 1 ? "User-agent: *\nAllow: /" : "Registered British Library source fixture material.";
      return { status: 200, headers: { get: (name: string) => name.toLocaleLowerCase("en-US") === "content-type" ? "text/plain" : null }, body: Readable.from([new TextEncoder().encode(body)]) as unknown as AsyncIterable<Uint8Array> };
    }
  });
  assert.equal(observation.state, "RETRIEVED_UNQUALIFIED");
  assert.equal(observation.qualifyingEvidence, false);
  assert.equal((await repository.getById("v2SourceSubmissionRetrievals", observation.sourceSubmissionRetrievalId))?.reentryAuthorized, false);
  const inspection = await inspectSourceSubmissionCandidate(repository, candidate.candidateId);
  assert.deepEqual(inspection.validation, { state: "AUTHORITY_ELIGIBLE", recordedAt: "2026-10-16T04:02:00.000Z" });
  assert.deepEqual(inspection.retrieval, { state: "RETRIEVED_UNQUALIFIED", recordedAt: "2026-10-16T04:02:00.000Z", retrievalDisposition: "NEWLY_RETRIEVED", rejectionCode: null });
  assert.equal(inspection.qualifyingEvidence, false);
  assert.equal(inspection.reentryAuthorized, false);
  assert.equal("sourceSnapshotId" in inspection, false);
  assert.equal(fetchCalls, 2);
});

test("Firestore emulator enforces corpus paths, immutable idempotency, heads, and edge integrity", { skip: !enabled }, async () => {
  const app = getApps()[0] || initializeApp({ projectId: "tiimeliines" });
  const firestore = getFirestore(app);
  const repository = new V2FirestoreRepository({ firestore, corpusId: TEST_CONTEXT.corpusId });
  const scope = scopeFixture();
  assert.equal(repository.reference("v2ScopeContracts", scope.artifactId).path, `corpora/${TEST_CONTEXT.corpusId}/v2ScopeContracts/${scope.artifactId}`);
  assert.equal(await repository.createImmutable("v2ScopeContracts", scope), "CREATED");
  assert.equal(await repository.createImmutable("v2ScopeContracts", scope), "IDEMPOTENT");
  const collision = sealArtifact({ ...scope, title: "Collision payload" });
  await assert.rejects(repository.createImmutable("v2ScopeContracts", collision), /collision/);
  await assert.rejects(new V2FirestoreRepository({ firestore, corpusId: "other-clean-corpus" }).createImmutable("v2ScopeContracts", scope), /Cross-corpus/);

  const segment = buildEvidenceSegment(TEST_CONTEXT, { sourceSnapshotId: "snapshot-existing", exactText: "Apollo 11 launched from Kennedy Space Center on July 16, 1969.", segmentType: "TEXT", startOffset: 0, endOffset: 65, page: null, section: null, selector: null, extractionMethod: "TEST", sourceCompleteness: "FULL_SNAPSHOT" });
  const snapshot = sealArtifact({ ...immutableEnvelope(TEST_CONTEXT, "snapshot-existing"), sourceSnapshotId: "snapshot-existing", contentHash: "0".repeat(64) });
  await repository.createImmutable("v2SourceSnapshots", snapshot);
  await repository.createImmutable("v2EvidenceSegments", segment);
  const batchedSegments = [1, 2].map((index) => buildEvidenceSegment(TEST_CONTEXT, { sourceSnapshotId: "snapshot-existing", exactText: `Bounded batch evidence segment ${index}.`, segmentType: "TEXT", startOffset: index * 40, endOffset: index * 40 + 33, page: null, section: null, selector: null, extractionMethod: "TEST", sourceCompleteness: "FULL_SNAPSHOT" }));
  assert.deepEqual(await repository.createImmutableBatch("v2EvidenceSegments", batchedSegments), { created: 2, idempotent: 0 });
  assert.deepEqual(await repository.createImmutableBatch("v2EvidenceSegments", batchedSegments), { created: 0, idempotent: 2 });
  await assert.rejects(repository.createImmutableBatch("v2EvidenceSegments", [batchedSegments[0]!, batchedSegments[0]!]), /unique artifact IDs/);

  const claim = buildAtomicClaimVersion(TEST_CONTEXT, { scopeContractId: scope.scopeContractId, subject: { kind: "EVENT", id: null, label: "Apollo 11 launch" }, predicate: "DATE", object: { kind: "DATE", id: null, value: { year: 1969, month: 7, day: 16, precision: "DAY", earliestYear: null, latestYear: null, label: "July 16, 1969" } }, normalizedAssertion: "Apollo 11 launched July 16, 1969", claimType: "DATE", risk: "MATERIAL", temporal: null, candidateEventClusterId: null, locationEntityIds: [], qualifiers: [], extractedFromSnapshotId: "snapshot-existing", extractedFromSegmentIds: [segment.evidenceSegmentId], conflictState: "NONE", validationState: "STRUCTURALLY_VALID", evidenceVerdictId: null, supersedesClaimVersionId: null });
  await repository.createImmutable("v2AtomicClaimVersions", claim);
  const edge = buildClaimEvidenceEdge(TEST_CONTEXT, { claimVersionId: claim.claimVersionId, evidenceSegmentId: segment.evidenceSegmentId, relationship: "SUPPORTS", relevance: "DIRECT", authorityFinding: "STRONG", publisherVersionId: null, independenceGroupId: "independence-test", dependenceBasis: [], evaluator: "DETERMINISTIC" });
  assert.equal(await repository.createEdgeWithReferences({ collection: "v2ClaimEvidence", edge, references: [{ collection: "v2AtomicClaimVersions", id: claim.artifactId }, { collection: "v2EvidenceSegments", id: segment.artifactId }] }), "CREATED");
  const broken = buildClaimEvidenceEdge(TEST_CONTEXT, { claimVersionId: claim.claimVersionId, evidenceSegmentId: "missing-segment", relationship: "SUPPORTS", relevance: "DIRECT", authorityFinding: "STRONG", publisherVersionId: null, independenceGroupId: "independence-test", dependenceBasis: [], evaluator: "DETERMINISTIC" });
  await assert.rejects(repository.createEdgeWithReferences({ collection: "v2ClaimEvidence", edge: broken, references: [{ collection: "v2AtomicClaimVersions", id: claim.artifactId }, { collection: "v2EvidenceSegments", id: "missing-segment" }] }), /referential integrity/);

  assert.equal(await repository.advanceHead({ collection: "v2AtomicClaims", headId: claim.claimId, expectedCurrentVersionId: null, nextVersionId: claim.claimVersionId, data: { claimId: claim.claimId, state: "CANDIDATE", updatedAt: TEST_CONTEXT.createdAt } }), "CREATED");
  assert.equal(await repository.advanceHead({ collection: "v2AtomicClaims", headId: claim.claimId, expectedCurrentVersionId: null, nextVersionId: claim.claimVersionId, data: { claimId: claim.claimId, state: "CANDIDATE", updatedAt: TEST_CONTEXT.createdAt } }), "IDEMPOTENT");
  await assert.rejects(repository.boundedQuery("v2AtomicClaimVersions", [], 201), /explicit limit/);
  const reconstructed = await repository.reference("v2ScopeContracts", scope.artifactId).get();
  assert.equal(reconstructed.data()?.payloadHash, scope.payloadHash);
});

test("Firestore emulator proves publisher bootstrap retry, concurrency, immutable versioning, and stale-head rejection", { skip: !enabled }, async () => {
  const app = getApps()[0] || initializeApp({ projectId: "tiimeliines" });
  const firestore = getFirestore(app);
  const corpusId = "publisher-bootstrap-test-corpus";
  const repository = new V2FirestoreRepository({ firestore, corpusId });
  const firstContext = { ...TEST_CONTEXT, corpusId };
  const retryContext = { ...firstContext, topicId: "other-topic", runId: "a3-retry", createdAt: "2026-09-07T00:00:00.000Z", policyVersion: "knowledge-coverage-v2-a3.1" };
  const original = bootstrapPublisherRegistry(firstContext)[0]!;
  const retry = bootstrapPublisherRegistry(retryContext)[0]!;
  assert.deepEqual(retry, original);

  const concurrent = await Promise.all([repository.createImmutable("v2PublisherAuthorityVersions", original), repository.createImmutable("v2PublisherAuthorityVersions", retry)]);
  assert.deepEqual([...concurrent].sort(), ["CREATED", "IDEMPOTENT"]);
  assert.equal(await repository.createImmutable("v2PublisherAuthorityVersions", retry), "IDEMPOTENT");
  const conflicting = sealArtifact({ ...original, canonicalName: "Conflicting publisher payload" });
  await assert.rejects(repository.createImmutable("v2PublisherAuthorityVersions", conflicting), /collision/);

  const oldHead = publisherAuthorityRecordSchema.parse({ publisherId: original.publisherId, corpusId, canonicalNameKey: normalizedIdentityText(original.canonicalName), currentVersionId: original.publisherVersionId, currentVersion: original.version, state: original.state, updatedAt: original.effectiveAt });
  assert.equal(await repository.advanceHead({ collection: "v2PublisherAuthorityRecords", headId: original.publisherId, expectedCurrentVersionId: null, nextVersionId: original.publisherVersionId, data: oldHead }), "CREATED");
  const successor = buildPublisherAuthorityVersion(firstContext, { publisherId: original.publisherId, version: original.version + 1, effectiveAt: "2026-09-07T01:00:00.000Z", canonicalName: original.canonicalName, aliases: original.aliases, parentPublisherId: original.parentPublisherId, institutionType: original.institutionType, authorityDomains: [...original.authorityDomains, "Additional verified authority domain"], geographicScope: original.geographicScope, languages: original.languages, primarySecondaryTendency: original.primarySecondaryTendency, knownDomains: original.knownDomains, externalIdentifiers: original.externalIdentifiers, independenceGroupId: original.independenceGroupId, accessLimitations: original.accessLimitations, state: original.state, classificationEvidenceSegmentIds: original.classificationEvidenceSegmentIds, admittedBy: original.admittedBy });
  assert.equal(await repository.createImmutable("v2PublisherAuthorityVersions", successor), "CREATED");
  const nextHead = publisherAuthorityRecordSchema.parse({ ...oldHead, currentVersionId: successor.publisherVersionId, currentVersion: successor.version, updatedAt: successor.effectiveAt });
  assert.equal(await repository.advanceHead({ collection: "v2PublisherAuthorityRecords", headId: original.publisherId, expectedCurrentVersionId: original.publisherVersionId, nextVersionId: successor.publisherVersionId, data: nextHead }), "ADVANCED");
  assert.equal((await repository.getById("v2PublisherAuthorityVersions", original.publisherVersionId))?.payloadHash, original.payloadHash);
  await assert.rejects(repository.advanceHead({ collection: "v2PublisherAuthorityRecords", headId: original.publisherId, expectedCurrentVersionId: original.publisherVersionId, nextVersionId: "publisher-version-stale", data: nextHead }), /compare-and-set/);
});

test("Firestore emulator proves semantic A3 retry convergence, version coexistence, and concurrency", { skip: !enabled }, async () => {
  const app = getApps()[0] || initializeApp({ projectId: "tiimeliines" });
  const firestore = getFirestore(app);
  const context = { ...TEST_CONTEXT, corpusId: "a3-identity-test-corpus", runId: "a3-identity-run" };
  const repository = new V2FirestoreRepository({ firestore, corpusId: context.corpusId });
  const scope = scopeFixture();
  const researchMap = buildResearchMap(context, { ...scope, corpusId: context.corpusId }, { version: 1, phases: scope.expectedPhases.map((label, index) => ({ phaseId: `phase-${index + 1}`, label, temporalRule: `Locked phase ${label}.`, required: true, rationale: `The locked ${label} phase is material.` })), dimensions: scope.requiredDimensions.map((label, index) => ({ dimensionId: `dimension-${index + 1}`, label, required: true, rationale: `The locked ${label} dimension is material.` })), entities: [], questions: scope.expectedPhases.map((label, index) => ({ questionId: `question-${index + 1}`, text: `What authoritative evidence covers the locked ${label} phase?`, phaseIds: [`phase-${index + 1}`], dimensionIds: [`dimension-${index % scope.requiredDimensions.length + 1}`], claimTypesExpected: ["OCCURRENCE" as const], likelySourceClasses: ["PRIMARY_INSTITUTIONAL" as const], expectedAuthorities: ["Institutional archive"], languages: ["en"], geography: ["Earth"], contested: false, dateCritical: true, priority: "CRITICAL" as const, state: "UNRESEARCHED" as const })), terminology: [], knownUncertainty: [] });
  const auditInput = { stage: "INITIAL" as const, scope: { ...scope, corpusId: context.corpusId }, researchMap, sourceKnowledgeRunIds: ["source-run"], claims: [], authorityVerdicts: [], conflicts: [], events: [] };
  const audit = auditKnowledgeCoverage({ context, ...auditInput });
  const retryContext = { ...context, runId: "a3-identity-retry", createdAt: "2026-09-07T00:00:00.000Z" };
  const retryAudit = auditKnowledgeCoverage({ context: retryContext, ...auditInput });
  assert.equal(retryAudit.coverageAuditId, audit.coverageAuditId);
  assert.deepEqual(retryAudit, audit);
  assert.equal(await repository.createImmutable("v2KnowledgeCoverageAudits", audit), "CREATED");
  assert.equal(await repository.createImmutable("v2KnowledgeCoverageAudits", audit), "IDEMPOTENT");
  assert.equal(await repository.createImmutable("v2KnowledgeCoverageAudits", retryAudit), "IDEMPOTENT");
  const plan = planGapDirectedCompletion({ context, scope: auditInput.scope, researchMap, audit, originalKnowledgeRunId: "source-run" });
  const retryPlan = planGapDirectedCompletion({ context: retryContext, scope: auditInput.scope, researchMap, audit: retryAudit, originalKnowledgeRunId: "source-run" });
  assert.equal(retryPlan.completionPlanId, plan.completionPlanId);
  assert.deepEqual(retryPlan, plan);
  assert.equal(await repository.createImmutable("v2KnowledgeCompletionPlans", plan), "CREATED");
  assert.equal(await repository.createImmutable("v2KnowledgeCompletionPlans", retryPlan), "IDEMPOTENT");
  const payload = { authorityAcquisitionRounds: AUTHORITY_LINEAGE, completionPlanId: "completion-plan", initialCoverageAuditId: "audit-initial", initialCoverageAuditPayloadHash: "a".repeat(64), finalCoverageAuditId: "audit-final", finalCoverageAuditPayloadHash: "b".repeat(64), scopeContractId: "scope-contract", scopePayloadHash: "c".repeat(64), researchMapId: "research-map", researchMapPayloadHash: "d".repeat(64), candidateEventVersionIds: ["event-version-b", "event-version-a"], candidateClaimVersionIds: ["claim-version-b", "claim-version-a"], authorityVerdictIds: ["verdict-b", "verdict-a"], conflictSetIds: [], unresolvedGapIds: [], finalVerdict: "SUFFICIENT" as const };
  const result = buildKnowledgeCompletionResult(context, payload);
  const equivalent = buildKnowledgeCompletionResult(context, payload);
  const concurrent = await Promise.all([repository.createImmutable("v2KnowledgeCompletionResults", result), repository.createImmutable("v2KnowledgeCompletionResults", equivalent)]);
  assert.deepEqual([...concurrent].sort(), ["CREATED", "IDEMPOTENT"]);
  assert.equal(await repository.createImmutable("v2KnowledgeCompletionResults", result), "IDEMPOTENT");
  const reorderedMembership = buildKnowledgeCompletionResult({ ...context, runId: "a3-other-execution" }, { ...payload, candidateEventVersionIds: [...payload.candidateEventVersionIds].reverse(), candidateClaimVersionIds: [...payload.candidateClaimVersionIds].reverse(), authorityVerdictIds: [...payload.authorityVerdictIds].reverse() });
  assert.equal(reorderedMembership.completionResultId, result.completionResultId);
  assert.deepEqual(reorderedMembership, result);
  assert.equal(await repository.createImmutable("v2KnowledgeCompletionResults", reorderedMembership), "IDEMPOTENT");

  const successorContext = { ...retryContext, policyVersion: "knowledge-coverage-v2-a3.2" };
  const successorMap = buildResearchMap(successorContext, auditInput.scope, {
    version: researchMap.version + 1,
    phases: researchMap.phases,
    dimensions: researchMap.dimensions,
    entities: researchMap.entities,
    questions: researchMap.questions,
    terminology: researchMap.terminology,
    knownUncertainty: researchMap.knownUncertainty
  });
  assert.notEqual(successorMap.researchMapId, researchMap.researchMapId);
  assert.equal(await repository.createImmutable("v2ResearchMaps", researchMap), "CREATED");
  assert.equal(await repository.createImmutable("v2ResearchMaps", successorMap), "CREATED");
  assert.equal(await repository.createImmutable("v2ResearchMaps", successorMap), "IDEMPOTENT");
  assert.equal((await repository.getById("v2ResearchMaps", researchMap.researchMapId))?.payloadHash, researchMap.payloadHash);
});

test("Firestore emulator certifies exact completed-knowledge-set reconstruction, coexistence, exclusion, and fail-closed references", { skip: !enabled }, async () => {
  const app = getApps()[0] || initializeApp({ projectId: "tiimeliines" });
  const firestore = getFirestore(app);
  const context = { ...TEST_CONTEXT, corpusId: "b1-lineage-emulator-corpus", topicId: "topic-b1-lineage" };
  const coverageContext = { ...context, policyVersion: KNOWLEDGE_COVERAGE_POLICY_VERSION };
  const repository = new V2FirestoreRepository({ firestore, corpusId: context.corpusId });
  const scope = scopeFixture({ title: "Synthetic B1 lineage", topicClass: "LONG_DURATION", subjectDefinition: "A synthetic long-duration topic used to certify Firestore lineage reconstruction.", chronologyStart: date(1989), chronologyEnd: date(2026), contextBefore: date(1980), contextAfter: date(2026), expectedPhases: ["Early (1989-1994)", "Later (1995-2026)"], requiredDimensions: ["technical"] }, context);
  const map = buildResearchMap(context, scope, {
    version: 1,
    phases: scope.expectedPhases.map((label, index) => ({ phaseId: `phase-${index + 1}`, label, temporalRule: `Locked ${label} phase.`, required: true, rationale: `The ${label} phase is material.` })),
    dimensions: [{ dimensionId: "dimension-technical", label: "technical", required: true, rationale: "Technical development is material." }], entities: [],
    questions: scope.expectedPhases.map((label, index) => ({ questionId: `question-${index + 1}`, text: `What authoritative event covers ${label}?`, phaseIds: [`phase-${index + 1}`], dimensionIds: ["dimension-technical"], claimTypesExpected: ["OCCURRENCE" as const], likelySourceClasses: ["PRIMARY_INSTITUTIONAL" as const], expectedAuthorities: ["Institutional archive"], languages: ["en"], geography: ["Earth"], contested: false, dateCritical: true, priority: "CRITICAL" as const, state: "UNRESEARCHED" as const })),
    terminology: [], knownUncertainty: []
  });
  const initial = auditKnowledgeCoverage({ context: coverageContext, stage: "INITIAL", scope, researchMap: map, sourceKnowledgeRunIds: ["old-execution"], claims: [], authorityVerdicts: [], conflicts: [], events: [] });
  const plan = planGapDirectedCompletion({ context: coverageContext, scope, researchMap: map, audit: initial, originalKnowledgeRunId: "old-execution" });
  const completionMap = buildCompletionResearchMap({ context: coverageContext, scope, parent: map, plan });
  const buildVersion = (laterYear: number) => {
    const claims = completionMap.questions.map((question, index) => buildAtomicClaimVersion(context, { scopeContractId: scope.scopeContractId, subject: { kind: "EVENT", id: null, label: `Emulator event ${index + 1}` }, predicate: "OCCURRENCE", object: { kind: "TEXT", id: null, value: `Emulator occurrence ${index + 1}` }, normalizedAssertion: `Emulator occurrence ${index + 1} happened`, claimType: "OCCURRENCE", risk: "ROUTINE", temporal: { start: date(index === completionMap.questions.length - 1 ? laterYear : 1990), end: null }, candidateEventClusterId: `cluster-${index + 1}`, locationEntityIds: [], qualifiers: [{ key: "researchQuestionId", value: question.questionId }], extractedFromSnapshotId: `snapshot-${index + 1}`, extractedFromSegmentIds: [`segment-${index + 1}`], conflictState: "NONE", validationState: "SUPPORTED", evidenceVerdictId: null, supersedesClaimVersionId: null }));
    const verdicts = claims.map((claim) => {
      const id = semanticArtifactId("claim-verdict", context, { claimVersionId: claim.claimVersionId, evidence: "emulator" });
      return parseSealedArtifact(claimAuthorityVerdictSchema, { ...semanticEnvelope(context, id, claim.claimVersionId), artifactId: id, claimAuthorityVerdictId: id, claimVersionId: claim.claimVersionId, evidenceSetHash: "e".repeat(64), risk: claim.risk, verdict: "SUPPORTED", reasonCodes: ["DEFINITIVE_PRIMARY"], qualifyingText: null, acceptedEvidenceEdgeIds: [], rejectedEvidenceEdgeIds: [], independenceGroupCount: 1, definitivePrimary: true, deterministicEvaluator: true });
    });
    const events = claims.map((claim, index) => buildCanonicalEventVersion(context, { version: 1, scopeContractId: scope.scopeContractId, canonicalTitle: `Emulator event ${index + 1}`, semanticClass: "EVENT", eventSubtype: "OCCURRENCE", temporal: { start: claim.temporal!.start, end: null, uncertainty: null }, actionKey: `emulator-action-${index + 1}`, primaryEntityKeys: [`entity-${index + 1}`], locationKeys: ["place-earth"], coreClaimVersionIds: [claim.claimVersionId], supportingClaimVersionIds: [], authorityState: "FACTORY_CANDIDATE", canonicalizationState: "RESOLVED", parentEventId: null, supersedesEventVersionId: null }));
    const final = auditKnowledgeCoverage({ context: coverageContext, stage: "FINAL", scope, researchMap: completionMap, sourceKnowledgeRunIds: ["old-execution", "completion-execution"], claims, authorityVerdicts: verdicts, conflicts: [], events });
    assert.equal(final.verdict, "SUFFICIENT");
    const set = buildKnowledgeCompletionResult(coverageContext, { authorityAcquisitionRounds: AUTHORITY_LINEAGE, completionPlanId: plan.completionPlanId, initialCoverageAuditId: initial.coverageAuditId, initialCoverageAuditPayloadHash: initial.payloadHash, finalCoverageAuditId: final.coverageAuditId, finalCoverageAuditPayloadHash: final.payloadHash, scopeContractId: scope.scopeContractId, scopePayloadHash: scope.payloadHash, researchMapId: completionMap.researchMapId, researchMapPayloadHash: completionMap.payloadHash, candidateEventVersionIds: events.map((event) => event.eventVersionId), candidateClaimVersionIds: claims.map((claim) => claim.claimVersionId), authorityVerdictIds: verdicts.map((verdict) => verdict.claimAuthorityVerdictId), conflictSetIds: [], unresolvedGapIds: [], finalVerdict: "SUFFICIENT" });
    return { claims, verdicts, events, final, set };
  };
  const oldVersion = buildVersion(1994);
  const newVersion = buildVersion(2024);
  await repository.createImmutable("v2ScopeContracts", scope);
  await repository.createImmutableBatch("v2ResearchMaps", [map, completionMap]);
  await repository.createImmutable("v2KnowledgeCoverageAudits", initial);
  await repository.createImmutable("v2KnowledgeCompletionPlans", plan);
  for (const version of [oldVersion, newVersion]) {
    await repository.createImmutable("v2KnowledgeCoverageAudits", version.final);
    await repository.createImmutableBatch("v2AtomicClaimVersions", version.claims);
    await repository.createImmutableBatch("v2ClaimAuthorityVerdicts", version.verdicts);
    await repository.createImmutableBatch("v2CanonicalEventVersions", version.events);
    await repository.createImmutable("v2KnowledgeCompletionResults", version.set);
  }
  assert.notEqual(oldVersion.set.completedKnowledgeSetId, newVersion.set.completedKnowledgeSetId);
  assert.equal(await repository.createImmutable("v2KnowledgeCompletionResults", newVersion.set), "IDEMPOTENT");
  const extra = buildCanonicalEventVersion(context, { version: 1, scopeContractId: scope.scopeContractId, canonicalTitle: "Extra same-topic candidate", semanticClass: "EVENT", eventSubtype: "OCCURRENCE", temporal: { start: date(2025), end: null, uncertainty: null }, actionKey: "extra-action", primaryEntityKeys: ["entity-extra"], locationKeys: ["place-earth"], coreClaimVersionIds: [newVersion.claims[0]!.claimVersionId], supportingClaimVersionIds: [], authorityState: "FACTORY_CANDIDATE", canonicalizationState: "RESOLVED", parentEventId: null, supersedesEventVersionId: null });
  await repository.createImmutable("v2CanonicalEventVersions", extra);
  const reconstructed = await reconstructCompletedKnowledgeSetForB1(repository, { topicId: context.topicId, completedKnowledgeSetId: newVersion.set.completedKnowledgeSetId, expectedCompletedKnowledgeSetHash: newVersion.set.payloadHash });
  assert.ok(reconstructed.events.some((event) => event.temporal.start.year === 2024));
  assert.ok(!reconstructed.events.some((event) => event.eventVersionId === extra.eventVersionId));
  await repository.reference("v2CanonicalEventVersions", newVersion.events[0]!.eventVersionId).delete();
  await assert.rejects(reconstructCompletedKnowledgeSetForB1(repository, { topicId: context.topicId, completedKnowledgeSetId: newVersion.set.completedKnowledgeSetId }), /B1_LINEAGE_MISSING/);
});
