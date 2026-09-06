import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  atomicClaimVersionSchema,
  auditRecordSchema,
  canonicalEventVersionSchema,
  claimAuthorityVerdictSchema,
  claimConflictSetSchema,
  researchMapSchema,
  scopeContractSchema,
  sourceSnapshotSchema,
  type AtomicClaimVersion,
  type CanonicalEventVersion,
  type ClaimAuthorityVerdict,
  type ClaimConflictSet,
  type ResearchMap,
  type ScopeContract,
  type SourceSnapshot
} from "../../functions/src/factory-v2/contracts";
import { buildQueryPlan, executionArtifactId, immutableEnvelope, parseSealedArtifact, type ArtifactContext } from "../../functions/src/factory-v2/contracts/builders";
import { auditKnowledgeCoverage, buildCompletionResearchMap, buildKnowledgeCompletionResult, DEFAULT_COMPLETION_BUDGET, KNOWLEDGE_COVERAGE_POLICY_VERSION, mergeKnowledgeEventVersions, planGapDirectedCompletion } from "../../functions/src/factory-v2/coverage";
import { loadFactoryV2Config } from "../../functions/src/factory-v2/config";
import { contentAddressedId } from "../../functions/src/factory-v2/hashing";
import { runV2AShadowFixture } from "../../functions/src/factory-v2/orchestrator";
import { V2FirestoreRepository } from "../../functions/src/factory-v2/repositories/firestore";

const PROJECT_ID = "tiimeliines";
const CORPUS_ID = "timelines-clean-2026-09-v1";
const SOURCE_RUN_ID = "8b40de60-ad95-4d74-886c-1ffb0e1e585d";
const EXPECTED_TITLE = "The History of the World Wide Web";

if ((process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || PROJECT_ID) !== PROJECT_ID) throw new Error("Refusing A3 fixture outside the TiMELiNES project.");
if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });

async function loadRun<T>(name: string, runIds: string[], parse: (value: unknown) => T, limit: number): Promise<T[]> {
  const base = getFirestore().collection("corpora").doc(CORPUS_ID).collection(name);
  const groups = await Promise.all(runIds.map(async (runId) => (await base.where("runId", "==", runId).limit(limit).get()).docs.map((document) => parse(document.data()))));
  return groups.flat();
}

async function loadIds<T>(name: string, ids: string[], parse: (value: unknown) => T): Promise<T[]> {
  if (ids.length > 300) throw new Error(`Refusing unbounded ${name} identity load.`);
  const base = getFirestore().collection("corpora").doc(CORPUS_ID).collection(name);
  const snapshots = await Promise.all(ids.map((id) => base.doc(id).get()));
  return snapshots.map((snapshot, index) => {
    if (!snapshot.exists) throw new Error(`Missing ${name}/${ids[index]}.`);
    return parse(snapshot.data());
  });
}

function uniqueArtifacts<T>(values: T[], id: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [id(value), value])).values()].sort((left, right) => id(left).localeCompare(id(right)));
}

async function main() {
  const planOnly = process.argv.includes("--plan-only");
  const totalStartedAt = Date.now();
  const initialReuseStartedAt = Date.now();
  const db = getFirestore();
  const repository = new V2FirestoreRepository({ firestore: db, corpusId: CORPUS_ID });
  const config = await loadFactoryV2Config();
  if (config.operatingMode !== "SHADOW" || config.pipelineVersion !== "factory-v2-a.13" || config.publicationEnabled || config.governanceSubmissionEnabled || config.autonomousDiscoveryEnabled) throw new Error("A3 requires the certified non-public V2-A shadow configuration.");
  const [scopes, maps, claims, verdicts, conflicts, events, snapshots] = await Promise.all([
    loadRun("v2ScopeContracts", [SOURCE_RUN_ID], (value) => scopeContractSchema.parse(value), 2),
    loadRun("v2ResearchMaps", [SOURCE_RUN_ID], (value) => researchMapSchema.parse(value), 2),
    loadRun("v2AtomicClaimVersions", [SOURCE_RUN_ID], (value) => atomicClaimVersionSchema.parse(value), 300),
    loadRun("v2ClaimAuthorityVerdicts", [SOURCE_RUN_ID], (value) => claimAuthorityVerdictSchema.parse(value), 300),
    loadRun("v2ClaimConflictSets", [SOURCE_RUN_ID], (value) => claimConflictSetSchema.parse(value), 100),
    loadRun("v2CanonicalEventVersions", [SOURCE_RUN_ID], (value) => canonicalEventVersionSchema.parse(value), 200),
    loadRun("v2SourceSnapshots", [SOURCE_RUN_ID], (value) => sourceSnapshotSchema.parse(value), 200)
  ] as const) as [ScopeContract[], ResearchMap[], AtomicClaimVersion[], ClaimAuthorityVerdict[], ClaimConflictSet[], CanonicalEventVersion[], SourceSnapshot[]];
  if (scopes.length !== 1 || maps.length !== 1 || scopes[0]!.title !== EXPECTED_TITLE) throw new Error("Certified Web knowledge input is missing or ambiguous.");
  const scope = scopes[0]!;
  const parentMap = maps[0]!;
  const initialKnowledgeReuseMs = Date.now() - initialReuseStartedAt;
  const runId = `v2-a3-web-${randomUUID()}`;
  const context: ArtifactContext = { corpusId: CORPUS_ID, topicId: scope.topicId, runId, generation: scope.generation, createdAt: new Date().toISOString(), policyVersion: KNOWLEDGE_COVERAGE_POLICY_VERSION };
  const persistCoverageExecution = async (artifact: { artifactId: string; payloadHash: string }, stage: string, details: Record<string, string | number | boolean | null>) => {
    const auditRecordId = executionArtifactId("audit", context, { action: "SEMANTIC_ARTIFACT_DERIVATION", stage, semanticArtifactId: artifact.artifactId, ...details });
    const audit = parseSealedArtifact(auditRecordSchema, { ...immutableEnvelope(context, auditRecordId), auditRecordId, action: "SEMANTIC_ARTIFACT_DERIVATION", actorType: "POLICY", actorId: KNOWLEDGE_COVERAGE_POLICY_VERSION, artifactRefs: [{ collection: stage, id: artifact.artifactId, payloadHash: artifact.payloadHash }], details: { semanticArtifactId: artifact.artifactId, ...details } });
    await repository.createImmutable("v2AuditRecords", audit);
  };
  const initialAudit = auditKnowledgeCoverage({ context, stage: "INITIAL", scope, researchMap: parentMap, sourceKnowledgeRunIds: [SOURCE_RUN_ID], claims, authorityVerdicts: verdicts, conflicts, events, sourceSnapshots: snapshots });
  if (initialAudit.verdict === "SUFFICIENT") throw new Error("A3 fixture did not reproduce the proven initial material coverage gap.");
  const completionPlan = planGapDirectedCompletion({ context, scope, researchMap: parentMap, audit: initialAudit, originalKnowledgeRunId: SOURCE_RUN_ID });
  if (planOnly) {
    console.log(JSON.stringify({ status: "PLAN_ONLY_NO_WRITES", initialVerdict: initialAudit.verdict, phaseCells: initialAudit.cells.filter((cell) => cell.kind === "PHASE"), dimensionCells: initialAudit.cells.filter((cell) => cell.kind === "DIMENSION"), gaps: initialAudit.gaps, tasks: completionPlan.tasks, unplannedMaterialGapIds: completionPlan.unplannedMaterialGapIds }, null, 2));
    return;
  }
  await repository.createImmutable("v2KnowledgeCoverageAudits", initialAudit);
  await persistCoverageExecution(initialAudit, "v2KnowledgeCoverageAudits", { auditStage: "INITIAL", sourceKnowledgeRunIds: SOURCE_RUN_ID });
  await repository.createImmutable("v2KnowledgeCompletionPlans", completionPlan);
  const completionMap = buildCompletionResearchMap({ context, scope, parent: parentMap, plan: completionPlan });
  const phaseGapCodes = new Set(["MISSING_PHASE_KNOWLEDGE", "WEAK_PHASE_KNOWLEDGE", "STALE_ONGOING_SCOPE"]);
  let dimensionRole = 0;
  const queries = completionPlan.tasks.map((task) => {
    const phaseTask = initialAudit.gaps.some((gap) => task.gapIds.includes(gap.gapId) && phaseGapCodes.has(gap.code));
    const role = phaseTask ? "PHASE_DIMENSION" as const : dimensionRole++ === 0 ? "ORIENTATION" as const : "AUTHORITY_TARGETED" as const;
    return { queryId: contentAddressedId("coverage-query", { taskId: task.taskId, providerQuery: task.providerQuery }), researchQuestionIds: [task.questionId], role, intendedSourceClass: task.intendedSourceClass, aliasesAndTerms: [scope.title, ...task.phaseIds.map((id) => completionMap.phases.find((phase) => phase.phaseId === id)!.label), ...task.dimensionIds.map((id) => completionMap.dimensions.find((dimension) => dimension.dimensionId === id)!.label)].slice(0, 30), language: scope.language, geography: scope.spatialScope.included.slice(0, 8), providerQuery: task.providerQuery, providerReportedQueries: [], budgetUnits: 1, resultArtifactIds: [] };
  });
  const completionResearchBudget = { maximumGroundingCalls: DEFAULT_COMPLETION_BUDGET.maximumGroundingCalls, maximumProviderQueries: DEFAULT_COMPLETION_BUDGET.maximumProviderQueries, maximumSourceDocuments: DEFAULT_COMPLETION_BUDGET.maximumSourceDocuments, maximumAtomicClaims: DEFAULT_COMPLETION_BUDGET.maximumAtomicClaims, maximumSemanticRepairs: config.budgetBundle.maximumSemanticRepairs, maximumTransportAttemptsPerCall: config.budgetBundle.maximumTransportAttemptsPerCall, maximumConcurrency: config.budgetBundle.maximumConcurrency, maximumWorkerSeconds: DEFAULT_COMPLETION_BUDGET.maximumWorkerSeconds };
  const queryPlan = buildQueryPlan(context, scope, completionMap, { queries, budget: completionResearchBudget });
  const completionConfig = { ...config, budgetBundle: completionResearchBudget };
  const acquisitionStartedAt = Date.now();
  const acquisition = await runV2AShadowFixture({ title: EXPECTED_TITLE, language: scope.language, ongoingAsOf: scope.ongoingAsOf! }, completionConfig, { repository, continuation: { context, originalKnowledgeRunId: SOURCE_RUN_ID, scope, researchMap: completionMap, queryPlan } });
  const gapAcquisitionMs = Date.now() - acquisitionStartedAt;
  const [newClaims, newVerdicts, newConflicts, newEvents, newSnapshots] = await Promise.all([
    loadIds("v2AtomicClaimVersions", acquisition.claimVersionIds, (value) => atomicClaimVersionSchema.parse(value)),
    loadIds("v2ClaimAuthorityVerdicts", acquisition.authorityVerdictIds, (value) => claimAuthorityVerdictSchema.parse(value)),
    loadIds("v2ClaimConflictSets", acquisition.conflictSetIds, (value) => claimConflictSetSchema.parse(value)),
    loadIds("v2CanonicalEventVersions", acquisition.eventVersionIds, (value) => canonicalEventVersionSchema.parse(value)),
    loadIds("v2SourceSnapshots", acquisition.sourceSnapshotIds, (value) => sourceSnapshotSchema.parse(value))
  ] as const) as [AtomicClaimVersion[], ClaimAuthorityVerdict[], ClaimConflictSet[], CanonicalEventVersion[], SourceSnapshot[]];
  const completedClaims = uniqueArtifacts([...claims, ...newClaims], (claim) => claim.claimVersionId);
  const completedVerdicts = uniqueArtifacts([...verdicts, ...newVerdicts], (verdict) => verdict.claimVersionId);
  const completedConflicts = uniqueArtifacts([...conflicts, ...newConflicts], (conflict) => conflict.conflictSetId);
  const completedEvents = mergeKnowledgeEventVersions([...events, ...newEvents]);
  const reAuditStartedAt = Date.now();
  const finalAudit = auditKnowledgeCoverage({ context, stage: "FINAL", scope, researchMap: completionMap, sourceKnowledgeRunIds: [SOURCE_RUN_ID, runId], claims: completedClaims, authorityVerdicts: completedVerdicts, conflicts: completedConflicts, events: completedEvents, sourceSnapshots: [...snapshots, ...newSnapshots] });
  const reAuditMs = Date.now() - reAuditStartedAt;
  await repository.createImmutable("v2KnowledgeCoverageAudits", finalAudit);
  await persistCoverageExecution(finalAudit, "v2KnowledgeCoverageAudits", { auditStage: "FINAL", sourceKnowledgeRunIds: `${SOURCE_RUN_ID},${runId}`, reAuditMs });
  const resultTelemetry = { budgetConsumed: { rounds: 1 as const, groundingCalls: acquisition.metrics.groundingCalls, providerQueries: acquisition.metrics.providerReportedSearchQueries, sourceDocuments: acquisition.metrics.sourceDocumentsSnapshotted, claimExtractions: acquisition.metrics.evidencePackets, atomicClaims: acquisition.metrics.claimsExtracted, writes: acquisition.metrics.firestoreWrites + 7 }, timings: { initialKnowledgeReuseMs, coverageAuditMs: 0, gapAcquisitionMs, reAuditMs } };
  const resultArtifact = buildKnowledgeCompletionResult(context, { completionPlanId: completionPlan.completionPlanId, initialCoverageAuditId: initialAudit.coverageAuditId, initialCoverageAuditPayloadHash: initialAudit.payloadHash, finalCoverageAuditId: finalAudit.coverageAuditId, finalCoverageAuditPayloadHash: finalAudit.payloadHash, scopeContractId: scope.scopeContractId, scopePayloadHash: scope.payloadHash, researchMapId: completionMap.researchMapId, researchMapPayloadHash: completionMap.payloadHash, candidateEventVersionIds: completedEvents.map((event) => event.eventVersionId), candidateClaimVersionIds: completedClaims.map((claim) => claim.claimVersionId), authorityVerdictIds: completedVerdicts.map((verdict) => verdict.claimAuthorityVerdictId), conflictSetIds: completedConflicts.map((conflict) => conflict.conflictSetId), unresolvedGapIds: finalAudit.gaps.map((gap) => gap.gapId), finalVerdict: finalAudit.verdict });
  await repository.createImmutable("v2KnowledgeCompletionResults", resultArtifact);
  await persistCoverageExecution(resultArtifact, "v2KnowledgeCompletionResults", { acquisitionRunId: runId, originalKnowledgeRunId: SOURCE_RUN_ID, ...resultTelemetry.timings, groundingCalls: resultTelemetry.budgetConsumed.groundingCalls, providerQueries: resultTelemetry.budgetConsumed.providerQueries, sourceDocuments: resultTelemetry.budgetConsumed.sourceDocuments, claimExtractions: resultTelemetry.budgetConsumed.claimExtractions, atomicClaims: resultTelemetry.budgetConsumed.atomicClaims, writes: resultTelemetry.budgetConsumed.writes });
  const evidence = { goal: "TL-KF-V2-A3", fixture: EXPECTED_TITLE, status: finalAudit.verdict === "SUFFICIENT" ? "PASS" : "FAIL", sourceKnowledgeRunId: SOURCE_RUN_ID, runId, initialAudit, completionPlan, completionResearchMapId: completionMap.researchMapId, completionQueryPlanId: queryPlan.queryPlanId, acquisition, newKnowledge: { claims: newClaims.length, supportedClaims: newVerdicts.filter((item) => item.verdict === "SUPPORTED" || item.verdict === "QUALIFIED").length, events: newEvents.length, chronologyEvents: newEvents.filter((event) => event.semanticClass === "EVENT" && event.canonicalizationState === "RESOLVED").length, durableSnapshots: newSnapshots.length }, finalAudit, completionResult: resultArtifact, executionTelemetry: resultTelemetry, totalExecutionMs: Date.now() - totalStartedAt };
  const outputDirectory = new URL("../../artifacts/factory-v2/", import.meta.url);
  await mkdir(outputDirectory, { recursive: true });
  const outputFile = new URL(`v2-a3-web-${Date.now()}.json`, outputDirectory);
  await writeFile(outputFile, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ status: evidence.status, runId, topicId: scope.topicId, completedKnowledgeSetId: resultArtifact.completedKnowledgeSetId, completedKnowledgeSetHash: resultArtifact.payloadHash, finalCoverageAuditId: finalAudit.coverageAuditId, initialCoverageAuditId: initialAudit.coverageAuditId, completionPlanId: completionPlan.completionPlanId, initialGaps: initialAudit.gaps.map((gap) => gap.code), finalGaps: finalAudit.gaps.map((gap) => gap.code), newKnowledge: evidence.newKnowledge, metrics: resultTelemetry.budgetConsumed, timings: resultTelemetry.timings, outputFile: outputFile.pathname }, null, 2));
  if (evidence.status !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
