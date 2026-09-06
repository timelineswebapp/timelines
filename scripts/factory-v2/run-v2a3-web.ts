import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  atomicClaimVersionSchema,
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
import { buildQueryPlan, type ArtifactContext } from "../../functions/src/factory-v2/contracts/builders";
import { auditKnowledgeCoverage, buildCompletionResearchMap, buildKnowledgeCompletionResult, DEFAULT_COMPLETION_BUDGET, mergeKnowledgeEventVersions, planGapDirectedCompletion } from "../../functions/src/factory-v2/coverage";
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

async function main() {
  const planOnly = process.argv.includes("--plan-only");
  const totalStartedAt = Date.now();
  const initialReuseStartedAt = Date.now();
  const db = getFirestore();
  const repository = new V2FirestoreRepository({ firestore: db, corpusId: CORPUS_ID });
  const config = await loadFactoryV2Config();
  if (config.operatingMode !== "SHADOW" || config.pipelineVersion !== "factory-v2-a.11" || config.publicationEnabled || config.governanceSubmissionEnabled || config.autonomousDiscoveryEnabled) throw new Error("A3 requires the certified non-public V2-A shadow configuration.");
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
  const context: ArtifactContext = { corpusId: CORPUS_ID, topicId: scope.topicId, runId, generation: scope.generation, createdAt: new Date().toISOString(), policyVersion: "knowledge-coverage-v2-a3.2" };
  const initialAudit = auditKnowledgeCoverage({ context, stage: "INITIAL", scope, researchMap: parentMap, sourceKnowledgeRunIds: [SOURCE_RUN_ID], claims, authorityVerdicts: verdicts, conflicts, events, sourceSnapshots: snapshots });
  if (initialAudit.verdict === "SUFFICIENT") throw new Error("A3 fixture did not reproduce the proven initial material coverage gap.");
  const completionPlan = planGapDirectedCompletion({ context, scope, researchMap: parentMap, audit: initialAudit, originalKnowledgeRunId: SOURCE_RUN_ID });
  if (planOnly) {
    console.log(JSON.stringify({ status: "PLAN_ONLY_NO_WRITES", initialVerdict: initialAudit.verdict, phaseCells: initialAudit.cells.filter((cell) => cell.kind === "PHASE"), dimensionCells: initialAudit.cells.filter((cell) => cell.kind === "DIMENSION"), gaps: initialAudit.gaps, tasks: completionPlan.tasks, unplannedMaterialGapIds: completionPlan.unplannedMaterialGapIds }, null, 2));
    return;
  }
  await repository.createImmutable("v2KnowledgeCoverageAudits", initialAudit);
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
  const acquisition = await runV2AShadowFixture({ title: EXPECTED_TITLE, language: scope.language, ongoingAsOf: scope.ongoingAsOf! }, completionConfig, { repository, continuation: { originalKnowledgeRunId: SOURCE_RUN_ID, scope, researchMap: completionMap, queryPlan } });
  const gapAcquisitionMs = Date.now() - acquisitionStartedAt;
  const [newClaims, newVerdicts, newConflicts, newEvents, newSnapshots] = await Promise.all([
    loadRun("v2AtomicClaimVersions", [runId], (value) => atomicClaimVersionSchema.parse(value), 100),
    loadRun("v2ClaimAuthorityVerdicts", [runId], (value) => claimAuthorityVerdictSchema.parse(value), 100),
    loadRun("v2ClaimConflictSets", [runId], (value) => claimConflictSetSchema.parse(value), 100),
    loadRun("v2CanonicalEventVersions", [runId], (value) => canonicalEventVersionSchema.parse(value), 100),
    loadRun("v2SourceSnapshots", [runId], (value) => sourceSnapshotSchema.parse(value), 100)
  ] as const) as [AtomicClaimVersion[], ClaimAuthorityVerdict[], ClaimConflictSet[], CanonicalEventVersion[], SourceSnapshot[]];
  const reAuditStartedAt = Date.now();
  const finalAudit = auditKnowledgeCoverage({ context, stage: "FINAL", scope, researchMap: completionMap, sourceKnowledgeRunIds: [SOURCE_RUN_ID, runId], claims: [...claims, ...newClaims], authorityVerdicts: [...verdicts, ...newVerdicts], conflicts: [...conflicts, ...newConflicts], events: mergeKnowledgeEventVersions([...events, ...newEvents]), sourceSnapshots: [...snapshots, ...newSnapshots] });
  const reAuditMs = Date.now() - reAuditStartedAt;
  await repository.createImmutable("v2KnowledgeCoverageAudits", finalAudit);
  const resultArtifact = buildKnowledgeCompletionResult(context, { completionPlanId: completionPlan.completionPlanId, initialCoverageAuditId: initialAudit.coverageAuditId, finalCoverageAuditId: finalAudit.coverageAuditId, acquisitionRunId: runId, originalKnowledgeRunId: SOURCE_RUN_ID, newClaimVersionIds: newClaims.map((claim) => claim.claimVersionId), newEventVersionIds: newEvents.map((event) => event.eventVersionId), reusedEventVersionIds: newEvents.filter((event) => event.supersedesEventVersionId !== null).map((event) => event.eventVersionId), unresolvedGapIds: finalAudit.gaps.map((gap) => gap.gapId), budgetConsumed: { rounds: 1, groundingCalls: acquisition.metrics.groundingCalls, providerQueries: acquisition.metrics.providerReportedSearchQueries, sourceDocuments: acquisition.metrics.sourceDocumentsSnapshotted, claimExtractions: acquisition.metrics.evidencePackets, atomicClaims: acquisition.metrics.claimsExtracted, writes: acquisition.metrics.firestoreWrites + 4 }, timings: { initialKnowledgeReuseMs, coverageAuditMs: initialAudit.auditMs, gapAcquisitionMs, reAuditMs }, finalVerdict: finalAudit.verdict });
  await repository.createImmutable("v2KnowledgeCompletionResults", resultArtifact);
  const evidence = { goal: "TL-KF-V2-A3", fixture: EXPECTED_TITLE, status: finalAudit.verdict === "SUFFICIENT" ? "PASS" : "FAIL", sourceKnowledgeRunId: SOURCE_RUN_ID, runId, initialAudit, completionPlan, completionResearchMapId: completionMap.researchMapId, completionQueryPlanId: queryPlan.queryPlanId, acquisition, newKnowledge: { claims: newClaims.length, supportedClaims: newVerdicts.filter((item) => item.verdict === "SUPPORTED" || item.verdict === "QUALIFIED").length, events: newEvents.length, chronologyEvents: newEvents.filter((event) => event.semanticClass === "EVENT" && event.canonicalizationState === "RESOLVED").length, durableSnapshots: newSnapshots.length }, finalAudit, completionResult: resultArtifact, totalExecutionMs: Date.now() - totalStartedAt };
  const outputDirectory = new URL("../../artifacts/factory-v2/", import.meta.url);
  await mkdir(outputDirectory, { recursive: true });
  const outputFile = new URL(`v2-a3-web-${Date.now()}.json`, outputDirectory);
  await writeFile(outputFile, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ status: evidence.status, runId, initialCoverageAuditId: initialAudit.coverageAuditId, completionPlanId: completionPlan.completionPlanId, finalCoverageAuditId: finalAudit.coverageAuditId, initialGaps: initialAudit.gaps.map((gap) => gap.code), finalGaps: finalAudit.gaps.map((gap) => gap.code), newKnowledge: evidence.newKnowledge, metrics: resultArtifact.budgetConsumed, timings: resultArtifact.timings, outputFile: outputFile.pathname }, null, 2));
  if (evidence.status !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
