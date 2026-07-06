import { createHash } from "node:crypto";
import { EDITORIAL_CERTIFICATION_FRAMEWORK_VERSION, type EditorialCertificationPersistence } from "@/src/server/editorial-certification/contracts";
import {
  EI003_TIER_A_CORPUS_VERSION,
  type Ei003CertificationCase,
  type Ei003CertificationCaseResult,
  type Ei003CertificationInvariantKey,
  type Ei003CertificationInvariantResult,
  type Ei003CertificationReport
} from "@/src/server/editorial-certification/ei003-contracts";
import { ei003TierACorpus } from "@/src/server/editorial-certification/ei003-tier-a-corpus";
import { planEditorialComposition } from "@/src/server/editorial-intelligence/editorial-composition-planner";
import { editorialCertificationRepository } from "@/src/server/repositories/editorial-certification-repository";

const keys: readonly Ei003CertificationInvariantKey[] = [
  "planner_execution", "deterministic_output", "fingerprint_stability", "chronology_preservation",
  "membership_equality", "exclusion_preservation", "phase_ordering", "phase_membership",
  "turning_point_lineage", "continuity_integrity", "transition_integrity", "arc_integrity",
  "structural_boundaries", "generated_content_absence", "persistence_equality",
  "resume_fingerprint_reuse", "compiler_artifact_dependency", "composition_artifact_dependency",
  "artifact_ownership", "predecessor_lineage", "factory_ownership", "governance_exclusion"
];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const inv = (invariantKey: Ei003CertificationInvariantKey, passed: boolean, expected: unknown, actual: unknown, message: string): Ei003CertificationInvariantResult =>
  ({ invariantKey, passed, expected, actual, message });

export function certifyEi003Case(testCase: Ei003CertificationCase): Ei003CertificationCaseResult {
  try {
    const actual = planEditorialComposition(testCase.plannerInput);
    const replay = planEditorialComposition(testCase.plannerInput);
    const selected = testCase.plannerInput.timelineCandidate.selectedMilestones.map((item) => item.milestoneId);
    const composed = actual.phases.flatMap((phase) => phase.milestoneIds);
    const excluded = new Set(testCase.plannerInput.timelineCandidate.excludedMilestones.map((item) => item.milestoneId));
    const phaseIds = actual.phases.map((phase) => phase.phaseId);
    const turningEvidence = new Set(testCase.plannerInput.identifiedTurningPoints.map((item) => item.evidenceRecordId));
    const serialized = JSON.stringify(actual).toLowerCase();
    const forbidden = ["title", "summary", "narrative", "interpretation", "generated historical fact", "editorial prose", "causal"];
    const actualOutputFingerprint = hash(actual);
    const invariants = [
      inv("planner_execution", true, "successful", "successful", "Planner completed without fallback."),
      inv("deterministic_output", same(actual, replay), actual, replay, "Repeated output must be byte-identical."),
      inv("fingerprint_stability", actual.plannerInputFingerprint === testCase.expectedPlannerInputFingerprint && actualOutputFingerprint === testCase.expectedOutputFingerprint, { input: testCase.expectedPlannerInputFingerprint, output: testCase.expectedOutputFingerprint }, { input: actual.plannerInputFingerprint, output: actualOutputFingerprint }, "Input and output fingerprints must match Tier A."),
      inv("chronology_preservation", same(selected, composed), selected, composed, "EI-002 ordering must be unchanged."),
      inv("membership_equality", selected.length === new Set(composed).size && same(selected, testCase.observedPackage.milestoneAuthorityRefs), selected, { composed, packaged: testCase.observedPackage.milestoneAuthorityRefs }, "Compiler, composition, and package membership must be equal."),
      inv("exclusion_preservation", composed.every((id) => !excluded.has(id)), [...excluded], composed, "Excluded milestones must never appear."),
      inv("phase_ordering", actual.phases.every((phase, index) => phase.sequence === index + 1), "contiguous", actual.phases.map((item) => item.sequence), "Phase order must be contiguous."),
      inv("phase_membership", actual.phases.every((phase) => phase.milestoneIds.length > 0) && same(composed, selected), selected, composed, "Phases must be non-overlapping and complete."),
      inv("turning_point_lineage", actual.turningPoints.every((point) => point.source === "ei_001_identified_turning_point" && point.evidenceRecordIds.every((id) => turningEvidence.has(id))), [...turningEvidence], actual.turningPoints, "Turning points must originate only in EI-001."),
      inv("continuity_integrity", actual.continuity.every((item, index) => item.fromMilestoneId === selected[index] && item.toMilestoneId === selected[index + 1]), selected, actual.continuity, "Continuity must connect adjacent milestones."),
      inv("transition_integrity", actual.transitions.every((item, index) => item.fromPhaseId === phaseIds[index] && item.toPhaseId === phaseIds[index + 1]), phaseIds, actual.transitions, "Transitions must connect adjacent phases."),
      inv("arc_integrity", actual.historicalArcs.every((arc) => same(arc.phaseIds, phaseIds) && same(arc.milestoneIds, selected)), { phaseIds, selected }, actual.historicalArcs, "Arc ranges must be deterministic and complete."),
      inv("structural_boundaries", same(actual.introduction.anchorMilestoneIds, [selected[0]]) && same(actual.conclusion.anchorMilestoneIds, [selected.at(-1)]), "first and last references", { introduction: actual.introduction, conclusion: actual.conclusion }, "Boundaries must remain structural."),
      inv("generated_content_absence", forbidden.every((term) => !serialized.includes(term)) && actual.compositionMetadata.generatedText === false, forbidden, serialized, "Composition must contain no generated content."),
      inv("persistence_equality", same(actual, testCase.observedPersistence.output), actual, testCase.observedPersistence.output, "Persistence must equal planner output exactly."),
      inv("resume_fingerprint_reuse", testCase.observedPersistence.plannerInputFingerprint === actual.plannerInputFingerprint, actual.plannerInputFingerprint, testCase.observedPersistence.plannerInputFingerprint, "Resume must reuse exact fingerprint identity."),
      inv("compiler_artifact_dependency", testCase.observedPackage.artifactRefs.includes(testCase.observedArtifacts.compilerArtifactId), testCase.observedArtifacts.compilerArtifactId, testCase.observedPackage.artifactRefs, "Package must include EI-002 artifact."),
      inv("composition_artifact_dependency", testCase.observedPackage.artifactRefs.includes(testCase.observedArtifacts.compositionArtifactId), testCase.observedArtifacts.compositionArtifactId, testCase.observedPackage.artifactRefs, "Package must include EI-003 artifact."),
      inv("artifact_ownership", testCase.observedArtifacts.compositionFactoryObjectId === testCase.observedPersistence.factoryObjectId, testCase.observedPersistence.factoryObjectId, testCase.observedArtifacts.compositionFactoryObjectId, "Artifact must belong to exact composition Factory object."),
      inv("predecessor_lineage", testCase.observedArtifacts.editorialTimelineCandidateId === actual.editorialTimelineCandidateId, actual.editorialTimelineCandidateId, testCase.observedArtifacts.editorialTimelineCandidateId, "Composition must retain exact predecessor."),
      inv("factory_ownership", actual.compositionMetadata.authorityDecision === false && actual.compositionMetadata.publicationReadinessDecision === false, false, actual.compositionMetadata, "Composition remains Factory technical memory."),
      inv("governance_exclusion", !testCase.observedGovernanceAuthorityRefs.includes(testCase.observedPersistence.factoryObjectId) && same(testCase.observedGovernanceAuthorityRefs, selected), selected, testCase.observedGovernanceAuthorityRefs, "Governance authority excludes EditorialComposition.")
    ];
    return {
      caseId: testCase.caseId, topic: testCase.topic,
      status: invariants.every((item) => item.passed) ? "passed" : "failed",
      plannerVersion: actual.plannerVersion, structureAlgorithmVersion: actual.structureAlgorithmVersion,
      expectedFingerprint: testCase.expectedPlannerInputFingerprint, actualFingerprint: actual.plannerInputFingerprint,
      expectedOutputFingerprint: testCase.expectedOutputFingerprint, actualOutputFingerprint,
      exactInput: testCase, actualCompositionOutput: actual, invariants
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      caseId: testCase.caseId, topic: testCase.topic, status: "failed",
      plannerVersion: "unavailable", structureAlgorithmVersion: "unavailable",
      expectedFingerprint: testCase.expectedPlannerInputFingerprint, actualFingerprint: "",
      expectedOutputFingerprint: testCase.expectedOutputFingerprint, actualOutputFingerprint: "",
      exactInput: testCase, actualCompositionOutput: null,
      invariants: keys.map((key) => inv(key, false, "pass", reason, `Planner failed before ${key}.`))
    };
  }
}

export function buildEi003CertificationReport(corpus: readonly Ei003CertificationCase[] = ei003TierACorpus): Ei003CertificationReport {
  const caseResults = corpus.map(certifyEi003Case);
  const invariants = caseResults.flatMap((item) => item.invariants);
  const passedCaseCount = caseResults.filter((item) => item.status === "passed").length;
  const passedInvariantCount = invariants.filter((item) => item.passed).length;
  return {
    epic: "EI-003", frameworkVersion: EDITORIAL_CERTIFICATION_FRAMEWORK_VERSION,
    corpusVersion: EI003_TIER_A_CORPUS_VERSION, corpusFingerprint: hash(corpus),
    status: passedCaseCount === caseResults.length ? "passed" : "failed",
    authorityDecision: false, publicationReadinessDecision: false, caseResults,
    summary: {
      caseCount: caseResults.length, passedCaseCount, failedCaseCount: caseResults.length - passedCaseCount,
      invariantCount: invariants.length, passedInvariantCount,
      failedInvariantCount: invariants.length - passedInvariantCount
    }
  };
}

export const ei003CertificationService = {
  async certify(input: { actor: string; persistence?: EditorialCertificationPersistence }): Promise<Ei003CertificationReport> {
    const report = buildEi003CertificationReport();
    return (input.persistence || editorialCertificationRepository).createReport(report, input.actor) as Promise<Ei003CertificationReport>;
  }
};
