import assert from "node:assert/strict";
import test from "node:test";
import {
  claimAuthorityVerdictSchema,
  type AtomicClaimVersion,
  type CanonicalEventVersion,
  type ClaimAuthorityVerdict,
  type CompletedKnowledgeSet
} from "./contracts";
import { buildAtomicClaimVersion, buildCanonicalEventVersion, buildResearchMap, parseSealedArtifact, semanticArtifactId, semanticEnvelope } from "./contracts/builders";
import { auditKnowledgeCoverage, buildCompletionResearchMap, buildKnowledgeCompletionResult, KNOWLEDGE_COVERAGE_POLICY_VERSION, planGapDirectedCompletion } from "./coverage";
import { parseCompletedKnowledgeSetB1CliArguments, reconstructCompletedKnowledgeSetForB1, type CompletedKnowledgeSetReader } from "./completed-knowledge-set";
import { attachPayloadHash } from "./hashing";
import { TEST_CONTEXT, date, scopeFixture } from "./test-fixtures";
import type { V2CorpusCollectionName } from "../corpus";

class MemoryReader implements CompletedKnowledgeSetReader {
  readonly records = new Map<string, Record<string, unknown>>();
  readonly reads: string[] = [];

  constructor(private readonly corpusId = TEST_CONTEXT.corpusId) {}

  activeCorpusId(): string { return this.corpusId; }

  async getById(name: V2CorpusCollectionName, id: string): Promise<Record<string, unknown> | null> {
    this.reads.push(`${name}/${id}`);
    return this.records.get(`${name}/${id}`) || null;
  }

  put(name: V2CorpusCollectionName, artifact: { artifactId: string }): void {
    this.records.set(`${name}/${artifact.artifactId}`, artifact as unknown as Record<string, unknown>);
  }

  remove(name: V2CorpusCollectionName, id: string): void { this.records.delete(`${name}/${id}`); }

  copy(): MemoryReader {
    const copy = new MemoryReader(this.corpusId);
    for (const [key, value] of this.records) copy.records.set(key, value);
    return copy;
  }
}

const scope = scopeFixture({
  title: "Synthetic Web lineage history",
  topicClass: "LONG_DURATION",
  subjectDefinition: "A synthetic long-duration history used only to certify exact knowledge-set lineage.",
  chronologyStart: date(1989),
  chronologyEnd: date(2026),
  contextBefore: date(1980),
  contextAfter: date(2026)
});
const originalMap = buildResearchMap(TEST_CONTEXT, scope, {
  version: 1,
  phases: scope.expectedPhases.map((label, index) => ({ phaseId: `phase-${index + 1}`, label, temporalRule: `Locked synthetic phase ${index + 1}.`, required: true, rationale: `Synthetic phase ${index + 1} is required for lineage certification.` })),
  dimensions: scope.requiredDimensions.map((label, index) => ({ dimensionId: `dimension-${index + 1}`, label, required: true, rationale: `Synthetic dimension ${index + 1} is required for lineage certification.` })),
  entities: [],
  questions: scope.expectedPhases.map((label, index) => ({ questionId: `question-${index + 1}`, text: `What authoritative evidence covers synthetic phase ${index + 1}?`, phaseIds: [`phase-${index + 1}`], dimensionIds: [`dimension-${index % scope.requiredDimensions.length + 1}`], claimTypesExpected: ["OCCURRENCE"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["Synthetic institutional archive"], languages: ["en"], geography: ["Earth"], contested: false, dateCritical: true, priority: "CRITICAL", state: "UNRESEARCHED" })),
  terminology: [],
  knownUncertainty: []
});
const coverageContext = { ...TEST_CONTEXT, policyVersion: KNOWLEDGE_COVERAGE_POLICY_VERSION };
const initialAudit = auditKnowledgeCoverage({ context: coverageContext, stage: "INITIAL", scope, researchMap: originalMap, sourceKnowledgeRunIds: ["historical-execution"], claims: [], authorityVerdicts: [], conflicts: [], events: [] });
const completionPlan = planGapDirectedCompletion({ context: coverageContext, scope, researchMap: originalMap, audit: initialAudit, originalKnowledgeRunId: "historical-execution" });
const completionMap = buildCompletionResearchMap({ context: coverageContext, scope, parent: originalMap, plan: completionPlan });

function verdict(claim: AtomicClaimVersion): ClaimAuthorityVerdict {
  const id = semanticArtifactId("claim-verdict", TEST_CONTEXT, { claimVersionId: claim.claimVersionId, evidence: "synthetic-authoritative-evidence" });
  return parseSealedArtifact(claimAuthorityVerdictSchema, {
    ...semanticEnvelope(TEST_CONTEXT, id, claim.claimVersionId), artifactId: id, claimAuthorityVerdictId: id, claimVersionId: claim.claimVersionId,
    evidenceSetHash: "e".repeat(64), risk: claim.risk, verdict: "SUPPORTED", reasonCodes: ["DEFINITIVE_PRIMARY"], qualifyingText: null,
    acceptedEvidenceEdgeIds: [], rejectedEvidenceEdgeIds: [], independenceGroupCount: 1, definitivePrimary: true, deterministicEvaluator: true
  });
}

function knowledge(yearForLastQuestion: number): { claims: AtomicClaimVersion[]; verdicts: ClaimAuthorityVerdict[]; events: CanonicalEventVersion[] } {
  const claims = completionMap.questions.map((question, index) => {
    const year = index === completionMap.questions.length - 1 ? yearForLastQuestion : 1990 + (index % 5);
    return buildAtomicClaimVersion(TEST_CONTEXT, {
      scopeContractId: scope.scopeContractId,
      subject: { kind: "EVENT", id: null, label: `Synthetic lineage event ${index + 1}` }, predicate: "OCCURRENCE",
      object: { kind: "TEXT", id: null, value: `Synthetic occurrence ${index + 1}` }, normalizedAssertion: `Synthetic lineage occurrence ${index + 1} happened in ${year}`,
      claimType: "OCCURRENCE", risk: "ROUTINE", temporal: { start: date(year), end: null }, candidateEventClusterId: `cluster-${index + 1}`,
      locationEntityIds: [], qualifiers: [{ key: "researchQuestionId", value: question.questionId }], extractedFromSnapshotId: `snapshot-${index + 1}`,
      extractedFromSegmentIds: [`segment-${index + 1}`], conflictState: "NONE", validationState: "SUPPORTED", evidenceVerdictId: null, supersedesClaimVersionId: null
    });
  });
  const verdicts = claims.map(verdict);
  const events = claims.map((claim, index) => buildCanonicalEventVersion(TEST_CONTEXT, {
    version: 1, scopeContractId: scope.scopeContractId, canonicalTitle: `Synthetic lineage event ${index + 1}`, semanticClass: "EVENT", eventSubtype: "OCCURRENCE",
    temporal: { start: claim.temporal!.start, end: null, uncertainty: null }, actionKey: `synthetic-action-${index + 1}`, primaryEntityKeys: [`entity-${index + 1}`],
    locationKeys: ["place-earth"], coreClaimVersionIds: [claim.claimVersionId], supportingClaimVersionIds: [], authorityState: "FACTORY_CANDIDATE",
    canonicalizationState: "RESOLVED", parentEventId: null, supersedesEventVersionId: null
  }));
  return { claims, verdicts, events };
}

function completedSet(yearForLastQuestion: number): { set: CompletedKnowledgeSet; finalAudit: ReturnType<typeof auditKnowledgeCoverage>; claims: AtomicClaimVersion[]; verdicts: ClaimAuthorityVerdict[]; events: CanonicalEventVersion[] } {
  const values = knowledge(yearForLastQuestion);
  const finalAudit = auditKnowledgeCoverage({ context: coverageContext, stage: "FINAL", scope, researchMap: completionMap, sourceKnowledgeRunIds: ["historical-execution", "completion-execution"], claims: values.claims, authorityVerdicts: values.verdicts, conflicts: [], events: values.events });
  assert.equal(finalAudit.verdict, "SUFFICIENT");
  const set = buildKnowledgeCompletionResult(coverageContext, {
    completionPlanId: completionPlan.completionPlanId, initialCoverageAuditId: initialAudit.coverageAuditId, initialCoverageAuditPayloadHash: initialAudit.payloadHash,
    finalCoverageAuditId: finalAudit.coverageAuditId, finalCoverageAuditPayloadHash: finalAudit.payloadHash, scopeContractId: scope.scopeContractId,
    scopePayloadHash: scope.payloadHash, researchMapId: completionMap.researchMapId, researchMapPayloadHash: completionMap.payloadHash,
    candidateEventVersionIds: values.events.map((event) => event.eventVersionId), candidateClaimVersionIds: values.claims.map((claim) => claim.claimVersionId),
    authorityVerdictIds: values.verdicts.map((item) => item.claimAuthorityVerdictId), conflictSetIds: [], unresolvedGapIds: [], finalVerdict: finalAudit.verdict
  });
  return { set, finalAudit, ...values };
}

function readerWith(...versions: ReturnType<typeof completedSet>[]): MemoryReader {
  const reader = new MemoryReader();
  reader.put("v2ScopeContracts", scope);
  reader.put("v2ResearchMaps", originalMap);
  reader.put("v2ResearchMaps", completionMap);
  reader.put("v2KnowledgeCoverageAudits", initialAudit);
  reader.put("v2KnowledgeCompletionPlans", completionPlan);
  for (const version of versions) {
    reader.put("v2KnowledgeCompletionResults", version.set);
    reader.put("v2KnowledgeCoverageAudits", version.finalAudit);
    version.events.forEach((artifact) => reader.put("v2CanonicalEventVersions", artifact));
    version.claims.forEach((artifact) => reader.put("v2AtomicClaimVersions", artifact));
    version.verdicts.forEach((artifact) => reader.put("v2ClaimAuthorityVerdicts", artifact));
  }
  return reader;
}

const oldKnowledge = completedSet(1994);
const newKnowledge = completedSet(2024);
const request = (set = newKnowledge.set) => ({ topicId: scope.topicId, completedKnowledgeSetId: set.completedKnowledgeSetId, expectedCompletedKnowledgeSetHash: set.payloadHash });

test("B1 reconstructs only exact completed-set membership and excludes stale and extra same-topic candidates", async () => {
  const reader = readerWith(oldKnowledge, newKnowledge);
  const base = newKnowledge.events[0]!;
  const extra = buildCanonicalEventVersion(TEST_CONTEXT, { version: 1, scopeContractId: base.scopeContractId, canonicalTitle: "Valid same-topic candidate outside the completed set", semanticClass: "EVENT", eventSubtype: "OCCURRENCE", temporal: { start: date(2025), end: null, uncertainty: null }, actionKey: "extra-action", primaryEntityKeys: ["entity-extra"], locationKeys: ["place-earth"], coreClaimVersionIds: base.coreClaimVersionIds, supportingClaimVersionIds: [], authorityState: "FACTORY_CANDIDATE", canonicalizationState: "RESOLVED", parentEventId: null, supersedesEventVersionId: null });
  reader.put("v2CanonicalEventVersions", extra);
  const reconstructedNew = await reconstructCompletedKnowledgeSetForB1(reader, request());
  const reconstructedOld = await reconstructCompletedKnowledgeSetForB1(reader, request(oldKnowledge.set));
  assert.ok(reconstructedNew.events.some((event) => event.temporal.start.year === 2024));
  assert.ok(reconstructedOld.events.every((event) => event.temporal.start.year <= 1994));
  assert.ok(!reconstructedNew.events.some((event) => event.eventVersionId === extra.eventVersionId));
  assert.ok(!reader.reads.includes(`v2CanonicalEventVersions/${extra.eventVersionId}`));
  assert.notEqual(reconstructedNew.candidateInputHash, reconstructedOld.candidateInputHash);
  assert.notEqual(newKnowledge.set.completedKnowledgeSetId, oldKnowledge.set.completedKnowledgeSetId);
});

test("B1 completed-set input fails closed for absent, invalid, mismatched, tampered, and non-passing lineage", async () => {
  assert.throws(() => parseCompletedKnowledgeSetB1CliArguments([]), /--topic-id/);
  assert.throws(() => parseCompletedKnowledgeSetB1CliArguments(["--topic-id", scope.topicId]), /--completed-knowledge-set-id/);
  const reader = readerWith(newKnowledge);
  await assert.rejects(reconstructCompletedKnowledgeSetForB1(reader, { topicId: scope.topicId } as never));
  await assert.rejects(reconstructCompletedKnowledgeSetForB1(reader, { topicId: scope.topicId, completedKnowledgeSetId: "completed-knowledge-set-missing" }), /B1_LINEAGE_MISSING/);
  await assert.rejects(reconstructCompletedKnowledgeSetForB1(reader, { ...request(), topicId: "another-topic" }), /TOPIC_MISMATCH/);
  await assert.rejects(reconstructCompletedKnowledgeSetForB1(reader, { ...request(), expectedCompletedKnowledgeSetHash: "f".repeat(64) }), /EXPECTED_HASH_MISMATCH/);
  await assert.rejects(reconstructCompletedKnowledgeSetForB1(reader, { ...request(), expectedScopeContractId: "different-scope" }), /SCOPE_MISMATCH/);
  await assert.rejects(reconstructCompletedKnowledgeSetForB1(reader, { ...request(), expectedFinalCoverageAuditId: "different-final-audit" }), /COVERAGE_AUDIT_MISMATCH/);

  const tampered = reader.copy();
  tampered.records.set(`v2KnowledgeCompletionResults/${newKnowledge.set.completedKnowledgeSetId}`, { ...newKnowledge.set, finalVerdict: "KNOWLEDGE_COVERAGE_INSUFFICIENT" });
  await assert.rejects(reconstructCompletedKnowledgeSetForB1(tampered, request()), /HASH_MISMATCH/);

  const failedSet = buildKnowledgeCompletionResult(coverageContext, {
    completionPlanId: completionPlan.completionPlanId, initialCoverageAuditId: initialAudit.coverageAuditId, initialCoverageAuditPayloadHash: initialAudit.payloadHash,
    finalCoverageAuditId: "failed-final-audit", finalCoverageAuditPayloadHash: "a".repeat(64), scopeContractId: scope.scopeContractId, scopePayloadHash: scope.payloadHash,
    researchMapId: completionMap.researchMapId, researchMapPayloadHash: completionMap.payloadHash, candidateEventVersionIds: [], candidateClaimVersionIds: [],
    authorityVerdictIds: [], conflictSetIds: [], unresolvedGapIds: ["gap-still-open"], finalVerdict: "KNOWLEDGE_COVERAGE_INSUFFICIENT"
  });
  const failedReader = reader.copy();
  failedReader.put("v2KnowledgeCompletionResults", failedSet);
  await assert.rejects(reconstructCompletedKnowledgeSetForB1(failedReader, request(failedSet)), /COVERAGE_NOT_SUFFICIENT/);

  const nonFinalAuditSet = buildKnowledgeCompletionResult(coverageContext, { completionPlanId: completionPlan.completionPlanId, initialCoverageAuditId: initialAudit.coverageAuditId, initialCoverageAuditPayloadHash: initialAudit.payloadHash, finalCoverageAuditId: initialAudit.coverageAuditId, finalCoverageAuditPayloadHash: initialAudit.payloadHash, scopeContractId: scope.scopeContractId, scopePayloadHash: scope.payloadHash, researchMapId: completionMap.researchMapId, researchMapPayloadHash: completionMap.payloadHash, candidateEventVersionIds: [], candidateClaimVersionIds: [], authorityVerdictIds: [], conflictSetIds: [], unresolvedGapIds: [], finalVerdict: "SUFFICIENT" });
  const nonFinalReader = reader.copy();
  nonFinalReader.put("v2KnowledgeCompletionResults", nonFinalAuditSet);
  await assert.rejects(reconstructCompletedKnowledgeSetForB1(nonFinalReader, request(nonFinalAuditSet)), /FINAL_AUDIT_MISMATCH/);
});

test("B1 fails closed when an exact candidate reference is missing and rejects cross-corpus consumption", async () => {
  const missingCandidate = readerWith(newKnowledge);
  missingCandidate.remove("v2CanonicalEventVersions", newKnowledge.set.candidateEventVersionIds[0]!);
  await assert.rejects(reconstructCompletedKnowledgeSetForB1(missingCandidate, request()), /B1_LINEAGE_MISSING/);
  const wrongCorpus = new MemoryReader("other-clean-corpus");
  for (const [key, value] of readerWith(newKnowledge).records) wrongCorpus.records.set(key, value);
  await assert.rejects(reconstructCompletedKnowledgeSetForB1(wrongCorpus, request()), /CORPUS_MISMATCH/);
});

test("completed knowledge-set semantic versions coexist and retry/order normalization is idempotent", () => {
  const reader = readerWith(oldKnowledge, newKnowledge);
  assert.ok(reader.records.has(`v2KnowledgeCompletionResults/${oldKnowledge.set.completedKnowledgeSetId}`));
  assert.ok(reader.records.has(`v2KnowledgeCompletionResults/${newKnowledge.set.completedKnowledgeSetId}`));
  const replay = buildKnowledgeCompletionResult({ ...coverageContext, runId: "retry-execution", createdAt: "2027-01-01T00:00:00.000Z" }, {
    completionPlanId: completionPlan.completionPlanId, initialCoverageAuditId: initialAudit.coverageAuditId, initialCoverageAuditPayloadHash: initialAudit.payloadHash,
    finalCoverageAuditId: newKnowledge.finalAudit.coverageAuditId, finalCoverageAuditPayloadHash: newKnowledge.finalAudit.payloadHash, scopeContractId: scope.scopeContractId,
    scopePayloadHash: scope.payloadHash, researchMapId: completionMap.researchMapId, researchMapPayloadHash: completionMap.payloadHash,
    candidateEventVersionIds: [...newKnowledge.set.candidateEventVersionIds].reverse(), candidateClaimVersionIds: [...newKnowledge.set.candidateClaimVersionIds].reverse(),
    authorityVerdictIds: [...newKnowledge.set.authorityVerdictIds].reverse(), conflictSetIds: [], unresolvedGapIds: [], finalVerdict: "SUFFICIENT"
  });
  assert.deepEqual(replay, newKnowledge.set);
  const semanticallyCorrupt = attachPayloadHash({ ...newKnowledge.set, scopeContractId: "different-scope" });
  reader.records.set(`v2KnowledgeCompletionResults/${newKnowledge.set.completedKnowledgeSetId}`, semanticallyCorrupt);
  return assert.rejects(reconstructCompletedKnowledgeSetForB1(reader, request()), /SEMANTIC_ID_MISMATCH/);
});
