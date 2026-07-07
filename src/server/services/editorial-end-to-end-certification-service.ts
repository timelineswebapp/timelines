import { createHash } from "node:crypto";
import { EDITORIAL_CERTIFICATION_FRAMEWORK_VERSION, type EditorialCertificationPersistence } from "@/src/server/editorial-certification/contracts";
import {
  EDITORIAL_END_TO_END_CERTIFICATION_VERSION,
  EDITORIAL_END_TO_END_CORPUS_VERSION,
  type EditorialEndToEndCase,
  type EditorialEndToEndCaseResult,
  type EditorialEndToEndCertificationReport,
  type EditorialEndToEndInvariantKey,
  type EditorialEndToEndInvariantResult
} from "@/src/server/editorial-certification/end-to-end-contracts";
import { editorialEndToEndTierACorpus } from "@/src/server/editorial-certification/end-to-end-tier-a-corpus";
import { ei002TierACorpus } from "@/src/server/editorial-certification/ei002-tier-a-corpus";
import { ei003TierACorpus } from "@/src/server/editorial-certification/ei003-tier-a-corpus";
import { ei004TierACorpus } from "@/src/server/editorial-certification/ei004-tier-a-corpus";
import { certifyEi002Case } from "@/src/server/services/editorial-certification-service";
import { certifyEi003Case } from "@/src/server/services/ei003-certification-service";
import { certifyEi004Case } from "@/src/server/services/ei004-certification-service";
import { editorialCertificationRepository } from "@/src/server/repositories/editorial-certification-repository";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const result = (invariantKey: EditorialEndToEndInvariantKey, passed: boolean, expected: unknown, actual: unknown, message: string): EditorialEndToEndInvariantResult =>
  ({ invariantKey, passed, expected, actual, message });

export function certifyEditorialEndToEndCase(value: EditorialEndToEndCase): EditorialEndToEndCaseResult {
  const ei002Input = ei002TierACorpus.find((item) => item.caseId === value.ei002CaseId);
  const ei003Input = ei003TierACorpus.find((item) => item.caseId === value.ei003CaseId);
  const ei004Input = ei004TierACorpus.find((item) => item.caseId === value.ei004CaseId);
  if (!ei002Input || !ei003Input || !ei004Input) throw new Error(`Incomplete end-to-end corpus lineage for ${value.caseId}.`);
  if (ei002Input.topic !== value.topic || ei003Input.topic !== value.topic || ei004Input.topic !== value.topic) {
    throw new Error(`Cross-topic end-to-end corpus lineage for ${value.caseId}.`);
  }

  const ei002 = certifyEi002Case(ei002Input);
  const ei003 = certifyEi003Case(ei003Input);
  const ei004 = certifyEi004Case(ei004Input);
  const stageOrder = ["EI-001", "EI-002", "EI-003", "EI-004", "factory_narrative_package", "governance_ready"] as const;
  const executionLineage = {
    editorialEvidenceSetId: ei002Input.compilerInput.editorialEvidenceSetId,
    compilerFingerprint: ei002.actualFingerprint,
    compositionFingerprint: ei003.actualOutputFingerprint,
    writerInputFingerprint: ei004.actualFingerprint,
    narrativeOutputFingerprint: ei004.actualOutputFingerprint,
    narrativeArtifactId: ei004Input.observedArtifact.artifactId
  };
  const deterministicFingerprints = Object.values(executionLineage).filter((entry) => /^[a-f0-9]{64}$/.test(entry));
  const writerInvariants = new Map(ei004.invariants.map((item) => [item.invariantKey, item.passed]));
  const compositionInvariants = new Map(ei003.invariants.map((item) => [item.invariantKey, item.passed]));
  const compilerInvariants = new Map(ei002.invariants.map((item) => [item.invariantKey, item.passed]));
  const all = (values: readonly (boolean | undefined)[]) => values.every((entry) => entry === true);
  const expectedFingerprint = hash({ value, executionLineage });
  const actualFingerprint = hash({ value, executionLineage });
  const invariants: EditorialEndToEndInvariantResult[] = [
    result("stage_execution_order", stageOrder.join(">") === "EI-001>EI-002>EI-003>EI-004>factory_narrative_package>governance_ready", stageOrder, stageOrder, "Editorial stages must execute in institutional order."),
    result("ei002_certified", ei002.status === "passed", "passed", ei002.status, "EI-002 must pass for the exact topic."),
    result("ei003_certified", ei003.status === "passed", "passed", ei003.status, "EI-003 must pass for the exact topic."),
    result("ei004_certified", ei004.status === "passed", "passed", ei004.status, "EI-004 must pass for the exact topic."),
    result("deterministic_execution", all([compilerInvariants.get("deterministic_output"), compositionInvariants.get("deterministic_output"), writerInvariants.get("writer_input_determinism")]), true, deterministicFingerprints, "Every deterministic stage must pass."),
    result("writer_determinism", all([writerInvariants.get("writer_input_determinism"), writerInvariants.get("output_fingerprint")]), true, ei004.actualOutputFingerprint, "Writer input and output must be deterministic."),
    result("prompt_lineage", writerInvariants.get("prompt_execution_lineage") === true, true, ei004Input.narrative.prompts, "Executed prompt lineage must be exact."),
    result("policy_lineage", writerInvariants.get("policy_lineage") === true, true, ei004Input.narrative.writingPolicy.fingerprint, "Writing policy lineage must be exact."),
    result("provider_lineage", writerInvariants.get("provider_lineage") === true, true, ei004Input.narrative.providerProvenance.runtimeFingerprint, "Provider lineage must be exact."),
    result("evidence_lineage", all([compilerInvariants.get("editorial_evidence_set_lineage"), writerInvariants.get("evidence_set_lineage"), writerInvariants.get("validation_lineage")]), true, executionLineage.editorialEvidenceSetId, "Evidence and validation lineage must survive every stage."),
    result("claim_lineage", writerInvariants.get("sentence_claim_lineage") === true, true, ei004Input.narrative.narrativeClaimMap, "Narrative claims must resolve to evidence."),
    result("citation_lineage", writerInvariants.get("citation_snapshot_lineage") === true, true, ei004Input.narrative.citations, "Sentence citation lineage must be complete."),
    result("source_snapshot_lineage", ei004Input.narrative.citations.every((citation) => ei004Input.sourceSnapshotIds.includes(citation.sourceSnapshotId)), ei004Input.sourceSnapshotIds, ei004Input.narrative.citations, "Every citation must resolve to an exact source snapshot."),
    result("package_lineage", all([compilerInvariants.get("package_lineage_subset"), compositionInvariants.get("composition_artifact_dependency"), writerInvariants.get("package_lineage")]), true, ei004Input.observedPackage, "Package lineage must contain every required Editorial Intelligence artifact."),
    result("artifact_ownership", all([compilerInvariants.get("compiler_artifact_ownership"), compositionInvariants.get("artifact_ownership"), writerInvariants.get("artifact_ownership")]), true, ei004Input.observedArtifact, "Each artifact must be owned by its exact Factory object."),
    result("governance_ready_package_integrity", all([writerInvariants.get("package_lineage"), writerInvariants.get("milestone_coverage"), writerInvariants.get("citation_snapshot_lineage")]), true, ei004Input.observedPackage, "The Factory narrative package must be complete before Governance."),
    result("fingerprint_stability", all([compilerInvariants.get("fingerprint_stability"), compositionInvariants.get("fingerprint_stability"), writerInvariants.get("output_fingerprint")]) && expectedFingerprint === actualFingerprint, expectedFingerprint, actualFingerprint, "All stage and aggregate fingerprints must be stable."),
    result("revision_identity", writerInvariants.get("revision_identity") === true, true, ei004Input.narrative.revision, "Narrative revision identity must be exact."),
    result("resume_determinism", all([compositionInvariants.get("resume_fingerprint_reuse"), writerInvariants.get("generation_unit_reuse"), writerInvariants.get("narrative_resume_reuse")]), true, { calls: ei004Input.observedGenerationCallsOnResume, reused: ei004Input.observedReusedUnitCount }, "Resume must reuse immutable outputs without regeneration."),
    result("chronology_integrity", all([compilerInvariants.get("chronology_ordering"), compositionInvariants.get("chronology_preservation"), writerInvariants.get("chronology_grounding")]), true, stageOrder, "Chronology must remain grounded and ordered."),
    result("composition_integrity", all([compositionInvariants.get("phase_ordering"), compositionInvariants.get("phase_membership"), writerInvariants.get("composition_preservation")]), true, ei003.actualOutputFingerprint, "Composition structure must remain intact."),
    result("milestone_preservation", all([compositionInvariants.get("membership_equality"), writerInvariants.get("milestone_coverage"), writerInvariants.get("additional_milestone_absence"), writerInvariants.get("excluded_milestone_absence")]), true, ei004Input.selectedMilestoneIds, "Selected milestones must be preserved exactly."),
    result("compiler_invariants", ei002.invariants.every((item) => item.passed), true, ei002.invariants, "All compiler invariants must pass."),
    result("governance_exclusion", all([compilerInvariants.get("governance_candidate_exclusion"), compositionInvariants.get("governance_exclusion"), writerInvariants.get("governance_exclusion")]), true, ei004Input.observedGovernanceAuthorityRefs, "Editorial Factory objects must remain outside Governance authority inputs."),
    result("factory_ownership_boundaries", all([compositionInvariants.get("factory_ownership"), writerInvariants.get("factory_ownership")]), true, ei004Input.narrative.generationMetadata, "Editorial outputs must remain non-authoritative Factory Production Memory.")
  ];
  return {
    caseId: value.caseId, topic: value.topic,
    status: invariants.every((item) => item.passed) ? "passed" : "failed",
    expectedFingerprint, actualFingerprint, exactInput: value,
    actualOutput: { stageOrder, executionLineage, deterministicFingerprints },
    invariants
  };
}

export function buildEditorialEndToEndCertificationReport(
  corpus: readonly EditorialEndToEndCase[] = editorialEndToEndTierACorpus
): EditorialEndToEndCertificationReport {
  const caseResults = corpus.map(certifyEditorialEndToEndCase);
  const invariants = caseResults.flatMap((item) => item.invariants);
  const passedCaseCount = caseResults.filter((item) => item.status === "passed").length;
  const passedInvariantCount = invariants.filter((item) => item.passed).length;
  const failures = caseResults.flatMap((item) => item.invariants
    .filter((invariant) => !invariant.passed)
    .map((invariant) => ({ caseId: item.caseId, invariantKey: invariant.invariantKey, message: invariant.message })));
  const status = failures.length === 0 && passedCaseCount === caseResults.length ? "passed" : "failed";
  return {
    epic: "EI-END-TO-END", certificationScope: "end-to-end",
    certificationKind: "end_to_end_editorial_intelligence",
    frameworkVersion: EDITORIAL_CERTIFICATION_FRAMEWORK_VERSION,
    certificationVersion: EDITORIAL_END_TO_END_CERTIFICATION_VERSION,
    corpusVersion: EDITORIAL_END_TO_END_CORPUS_VERSION,
    corpusFingerprint: hash(corpus), status,
    authorityDecision: false, publicationReadinessDecision: false,
    stageResults: ["EI-001", "EI-002", "EI-003", "EI-004", "factory_narrative_package", "governance_ready"]
      .map((stage) => ({ stage, status })),
    caseResults, failures,
    finalInstitutionalDecision: status === "passed" ? "certified" : "not_certified",
    summary: {
      caseCount: caseResults.length, passedCaseCount, failedCaseCount: caseResults.length - passedCaseCount,
      invariantCount: invariants.length, passedInvariantCount,
      failedInvariantCount: invariants.length - passedInvariantCount
    }
  };
}

export const editorialEndToEndCertificationService = {
  async certify(input: { actor: string; persistence?: EditorialCertificationPersistence }): Promise<EditorialEndToEndCertificationReport> {
    const report = buildEditorialEndToEndCertificationReport();
    return (input.persistence || editorialCertificationRepository).createReport(report, input.actor) as Promise<EditorialEndToEndCertificationReport>;
  }
};
