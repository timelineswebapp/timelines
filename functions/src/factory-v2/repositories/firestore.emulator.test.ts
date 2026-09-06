import assert from "node:assert/strict";
import test from "node:test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { V2FirestoreRepository } from "./firestore";
import { scopeFixture, TEST_CONTEXT } from "../test-fixtures";
import { buildEvidenceSegment, buildAtomicClaimVersion, buildClaimEvidenceEdge, buildResearchMap, immutableEnvelope, sealArtifact } from "../contracts/builders";
import { bootstrapPublisherRegistry, buildPublisherAuthorityVersion } from "../authority";
import { publisherAuthorityRecordSchema } from "../contracts";
import { normalizedIdentityText } from "../contracts/builders";
import { auditKnowledgeCoverage, buildKnowledgeCompletionResult, planGapDirectedCompletion } from "../coverage";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

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
  const payload = { completionPlanId: "completion-plan", initialCoverageAuditId: "audit-initial", finalCoverageAuditId: "audit-final", acquisitionRunId: "acquisition-run", originalKnowledgeRunId: "source-run", newClaimVersionIds: [], newEventVersionIds: [], reusedEventVersionIds: [], unresolvedGapIds: [], budgetConsumed: { rounds: 1 as const, groundingCalls: 1, providerQueries: 1, sourceDocuments: 1, claimExtractions: 1, atomicClaims: 1, writes: 7 }, timings: { initialKnowledgeReuseMs: 1, coverageAuditMs: 2, gapAcquisitionMs: 3, reAuditMs: 4 }, finalVerdict: "SUFFICIENT" as const };
  const result = buildKnowledgeCompletionResult(context, payload);
  const equivalent = buildKnowledgeCompletionResult(context, payload);
  const concurrent = await Promise.all([repository.createImmutable("v2KnowledgeCompletionResults", result), repository.createImmutable("v2KnowledgeCompletionResults", equivalent)]);
  assert.deepEqual([...concurrent].sort(), ["CREATED", "IDEMPOTENT"]);
  assert.equal(await repository.createImmutable("v2KnowledgeCompletionResults", result), "IDEMPOTENT");
  const changedTelemetry = buildKnowledgeCompletionResult(context, { ...payload, timings: { ...payload.timings, gapAcquisitionMs: 5 } });
  assert.equal(changedTelemetry.completionResultId, result.completionResultId);
  assert.deepEqual(changedTelemetry, result);
  assert.equal(await repository.createImmutable("v2KnowledgeCompletionResults", changedTelemetry), "IDEMPOTENT");

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
