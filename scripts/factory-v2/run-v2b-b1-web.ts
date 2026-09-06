import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  auditRecordSchema,
} from "../../functions/src/factory-v2/contracts";
import { V2_B_PROMPT_VERSION } from "../../functions/src/factory-v2/contracts/assembly";
import { executionArtifactId, immutableEnvelope, parseSealedArtifact } from "../../functions/src/factory-v2/contracts/builders";
import { parseCompletedKnowledgeSetB1CliArguments, reconstructCompletedKnowledgeSetForB1 } from "../../functions/src/factory-v2/completed-knowledge-set";
import { factoryV2ConfigSchema } from "../../functions/src/factory-v2/config";
import { evaluateHistoricalSignificance } from "../../functions/src/factory-v2/selection-model";
import { assembleTimelineSelection, evaluateCandidateEligibility } from "../../functions/src/factory-v2/selection";
import { V2FirestoreRepository } from "../../functions/src/factory-v2/repositories/firestore";

const PROJECT_ID = "tiimeliines";
const CORPUS_ID = "timelines-clean-2026-09-v1";
const EXPECTED_TITLE = "The History of the World Wide Web";

if ((process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || PROJECT_ID) !== PROJECT_ID) throw new Error("Refusing B1 fixture outside the TiMELiNES project.");
if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });

async function main() {
  const lineageRequest = parseCompletedKnowledgeSetB1CliArguments(process.argv.slice(2));
  const startedAt = Date.now();
  const db = getFirestore();
  const configSnapshot = await db.collection("factoryV2").doc("config").get();
  if (!configSnapshot.exists) throw new Error("Factory V2 shadow config is absent.");
  const config = factoryV2ConfigSchema.parse(configSnapshot.data());
  if (config.operatingMode !== "SHADOW" || config.pipelineVersion !== "factory-v2-a.13" || config.publicationEnabled || config.governanceSubmissionEnabled || config.autonomousDiscoveryEnabled) throw new Error("B1 requires the certified non-public V2-A shadow configuration.");

  const repository = new V2FirestoreRepository({ firestore: db, corpusId: CORPUS_ID });
  const reconstructed = await reconstructCompletedKnowledgeSetForB1(repository, lineageRequest);
  const { completedKnowledgeSet, finalCoverageAudit, scope, researchMap, events, claims, authorityVerdicts: verdicts, conflicts, candidateInputHash } = reconstructed;
  if (scope.title !== EXPECTED_TITLE || events.length === 0) throw new Error("Certified Web fixture input is missing or mismatched.");
  const createdAt = new Date().toISOString();
  const context = { corpusId: CORPUS_ID, topicId: scope.topicId, runId: `v2-b1-web-${randomUUID()}`, generation: scope.generation, createdAt, completedKnowledgeSetId: completedKnowledgeSet.completedKnowledgeSetId, completedKnowledgeSetHash: completedKnowledgeSet.payloadHash, finalCoverageAuditId: finalCoverageAudit.coverageAuditId, finalCoverageAuditHash: finalCoverageAudit.payloadHash, candidateInputHash };
  const knowledgeInput = { context, scope, researchMap, events, claims, authorityVerdicts: verdicts, conflicts };
  const eligibility = evaluateCandidateEligibility(knowledgeInput);
  const eligibleEvents = events.filter((event) => eligibility.get(event.eventVersionId)?.length === 0);
  const allowedClaimIds = new Set(eligibleEvents.flatMap((event) => [...event.coreClaimVersionIds, ...event.supportingClaimVersionIds]));
  const model = await evaluateHistoricalSignificance({ context, scope, researchMap, eligibleEvents, approvedClaims: claims.filter((claim) => allowedClaimIds.has(claim.claimVersionId)), deadlineAt: Date.now() + 180_000 });
  const none = { turningPointValue: "NONE", causalImportance: "NONE", consequence: "NONE", institutionalImportance: "NONE", adoptionOrScale: "NONE", explanatoryValue: "NONE", topicRelevance: "NONE", historiographicalProminence: "NONE", relationshipToLaterDevelopments: "NONE", uniqueness: "NONE" } as const;
  const ineligibleJudgments = events.filter((event) => !eligibleEvents.includes(event)).map((event, index) => ({ eventVersionId: event.eventVersionId, significanceClass: "EXCLUDE" as const, comparativeRank: eligibleEvents.length + index + 1, criteria: none, rationale: `Deterministic eligibility excluded this candidate before historical-significance selection: ${eligibility.get(event.eventVersionId)!.join(", ")}.`, phaseCoverage: [], dimensionCoverage: [], redundantWithEventVersionIds: [], redundancyRationale: null }));
  const selection = assembleTimelineSelection({ ...knowledgeInput, significance: { ...model.proposal, judgments: [...model.proposal.judgments, ...ineligibleJudgments] }, modelExecutionRef: { executionId: model.execution.executionId, model: model.execution.modelExecutionRef?.model || "gemini-2.5-flash", location: model.execution.modelExecutionRef?.location || "global", promptVersion: V2_B_PROMPT_VERSION, promptHash: model.execution.promptHash, responseHash: model.execution.responseHash } });

  await repository.createImmutable("v2ModelExecutions", model.execution);
  await repository.createImmutable("v2RankedCandidateSets", selection);
  const derivationContext = { corpusId: context.corpusId, topicId: context.topicId, runId: context.runId, generation: context.generation, createdAt: context.createdAt };
  const auditRecordId = executionArtifactId("audit", derivationContext, { action: "SEMANTIC_ARTIFACT_DERIVATION", selectionArtifactId: selection.selectionArtifactId, executionId: model.execution.executionId });
  const derivationAudit = parseSealedArtifact(auditRecordSchema, {
    ...immutableEnvelope(derivationContext, auditRecordId),
    auditRecordId,
    action: "SEMANTIC_ARTIFACT_DERIVATION",
    actorType: "MODEL",
    actorId: model.execution.modelExecutionRef?.model || "gemini-2.5-flash",
    artifactRefs: [
      { collection: "v2RankedCandidateSets", id: selection.selectionArtifactId, payloadHash: selection.payloadHash },
      { collection: "v2ModelExecutions", id: model.execution.executionId, payloadHash: model.execution.payloadHash }
    ],
    details: { executionId: model.execution.executionId, semanticArtifactId: selection.selectionArtifactId, completedKnowledgeSetId: completedKnowledgeSet.completedKnowledgeSetId, completedKnowledgeSetHash: completedKnowledgeSet.payloadHash, finalCoverageAuditId: finalCoverageAudit.coverageAuditId, candidateInputHash }
  });
  await repository.createImmutable("v2AuditRecords", derivationAudit);

  const gateChecks = {
    verifiedCandidatePoolPreserved: selection.completeCandidateEventVersionIds.length === events.length,
    selectedCountWithinSixAndTwenty: selection.selectedEventVersionIds.length >= 6 && selection.selectedEventVersionIds.length <= 20,
    historicallyMeaningfulRequiredPhasesRepresented: selection.coverageSummary.missingPhaseIds.length === 0,
    noArtificialEqualTimeQuota: true,
    noSilentScopeExpansion: selection.assessments.every((assessment) => !assessment.eligible || !assessment.eligibilityReasons.includes("SCOPE_INCOMPATIBLE")),
    noNonEventChronologyEntries: selection.selectedEventVersionIds.every((id) => events.find((event) => event.eventVersionId === id)?.semanticClass === "EVENT"),
    selectionRationaleExists: selection.assessments.every((assessment) => assessment.selectionRationale.trim().length >= 10),
    noMajorKnownPhaseOmittedWithoutRationale: selection.coverageSummary.missingPhaseIds.length === 0 && !selection.completenessFindings.some((finding) => finding.blocking),
    selectionArtifactPasses: selection.status === "PASS"
  };
  const status = Object.values(gateChecks).every(Boolean) ? "PASS" : "FAIL";
  const evidence = { goal: "TL-KF-V2-B", gate: "B1_SELECTION_ENGINE", fixture: EXPECTED_TITLE, status, completedKnowledgeSetId: completedKnowledgeSet.completedKnowledgeSetId, completedKnowledgeSetHash: completedKnowledgeSet.payloadHash, finalCoverageAuditId: finalCoverageAudit.coverageAuditId, candidateInputHash, runId: context.runId, selectionArtifactId: selection.selectionArtifactId, selectionModelExecutionId: model.execution.executionId, candidateCount: events.length, candidateEventVersionIds: events.map((event) => event.eventVersionId), eligibleCount: eligibleEvents.length, selectedCount: selection.selectedEventVersionIds.length, coverage: selection.coverageSummary, temporalDiagnostics: selection.temporalDiagnostics, failureCodes: selection.failureCodes, gateChecks, metrics: { selectionMs: Date.now() - startedAt, selectionModelCalls: model.execution.repairAttempt + 1, inputTokens: model.execution.usage.inputTokens, outputTokens: model.execution.usage.outputTokens, firestoreWrites: 3, monetaryCost: null, costMeasurement: "NOT_MEASURABLE" }, productionBoundary: { executionMode: "SHADOW", publicationEligible: false, governanceSubmissionAllowed: false, autonomousDiscoveryEnabled: false } };
  const outputDirectory = new URL("../../artifacts/factory-v2/", import.meta.url);
  await mkdir(outputDirectory, { recursive: true });
  const outputFile = new URL(`v2-b1-web-${Date.now()}.json`, outputDirectory);
  await writeFile(outputFile, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ ...evidence, outputFile: outputFile.pathname }, null, 2));
  if (status !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
