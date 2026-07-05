import { createHash } from "node:crypto";
import {
  EDITORIAL_CERTIFICATION_FRAMEWORK_VERSION,
  EI002_TIER_A_CORPUS_VERSION,
  type EditorialCertificationCaseResult,
  type EditorialCertificationInvariantResult,
  type EditorialCertificationPersistence,
  type EditorialCertificationReport,
  type Ei002CertificationCase,
  type Ei002CertificationInvariantKey
} from "@/src/server/editorial-certification/contracts";
import { ei002TierACorpus } from "@/src/server/editorial-certification/ei002-tier-a-corpus";
import { compileEditorialTimeline } from "@/src/server/editorial-intelligence/timeline-compiler";
import { editorialCertificationRepository } from "@/src/server/repositories/editorial-certification-repository";

const INVARIANT_KEYS: readonly Ei002CertificationInvariantKey[] = [
  "compiler_execution",
  "deterministic_output",
  "duplicate_suppression",
  "chronology_ordering",
  "fingerprint_stability",
  "editorial_evidence_set_lineage",
  "extraction_lineage",
  "compiler_candidate_persistence",
  "package_dependency",
  "package_lineage_subset",
  "compiler_artifact_ownership",
  "compiler_exclusion_preservation",
  "governance_candidate_exclusion"
];

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function invariant(
  invariantKey: Ei002CertificationInvariantKey,
  passed: boolean,
  expected: unknown,
  actual: unknown,
  message: string
): EditorialCertificationInvariantResult {
  return { invariantKey, passed, expected, actual, message };
}

function chronologyIsOrdered(output: ReturnType<typeof compileEditorialTimeline>): boolean {
  return output.selectedMilestones.every((milestone, index, values) => {
    if (milestone.sequence !== index + 1 || index === 0) return milestone.sequence === index + 1;
    const prior = values[index - 1]!;
    const left = prior.chronology;
    const right = milestone.chronology;
    return left.sortYear < right.sortYear ||
      (left.sortYear === right.sortYear && (left.sortMonth ?? 0) < (right.sortMonth ?? 0)) ||
      (left.sortYear === right.sortYear && (left.sortMonth ?? 0) === (right.sortMonth ?? 0) &&
        (left.sortDay ?? 0) <= (right.sortDay ?? 0));
  });
}

function failedCase(testCase: Ei002CertificationCase, error: unknown): EditorialCertificationCaseResult {
  const reason = error instanceof Error ? error.message : String(error);
  return {
    caseId: testCase.caseId,
    topic: testCase.topic,
    status: "failed",
    compilerVersion: "unavailable",
    selectionAlgorithmVersion: "unavailable",
    expectedFingerprint: testCase.expectedCompilerFingerprint,
    actualFingerprint: "",
    exactInput: testCase,
    actualCompilerOutput: null,
    invariants: INVARIANT_KEYS.map((key) => invariant(key, false, "pass", reason, `Compiler execution failed before ${key}.`))
  };
}

export function certifyEi002Case(testCase: Ei002CertificationCase): EditorialCertificationCaseResult {
  try {
    const actual = compileEditorialTimeline(testCase.compilerInput);
    const repeated = compileEditorialTimeline(testCase.compilerInput);
    const permuted = compileEditorialTimeline({
      ...testCase.compilerInput,
      milestones: [...testCase.compilerInput.milestones].reverse()
    });
    const selectedIds = actual.selectedMilestones.map((item) => item.milestoneId);
    const excludedIds = actual.excludedMilestones.map((item) => item.milestoneId);
    const compilerEvidenceIds = new Set(
      actual.selectedMilestones.flatMap((item) => item.evidenceLineage.map((lineage) => lineage.evidenceRecordId))
    );
    const inputEvidenceIds = new Set(
      testCase.compilerInput.milestones.flatMap((item) => item.evidenceLineage.map((lineage) => lineage.evidenceRecordId))
    );
    const extractionIds = new Set(testCase.extractionMilestoneIds);
    const selectedSet = new Set(selectedIds);
    const packageRefs = testCase.observedPackage.milestoneAuthorityRefs;
    const invariants: EditorialCertificationInvariantResult[] = [
      invariant("compiler_execution", true, "successful", "successful", "Compiler completed without unsupported fallback."),
      invariant("deterministic_output", same(actual, repeated) && same(actual, permuted), actual, { repeated, permuted }, "Repeated and input-permuted compilation must be byte-equivalent."),
      invariant("duplicate_suppression", same(selectedIds, testCase.expectedSelectedMilestoneIds) && same(excludedIds, testCase.expectedExcludedMilestoneIds), {
        selected: testCase.expectedSelectedMilestoneIds, excluded: testCase.expectedExcludedMilestoneIds
      }, { selected: selectedIds, excluded: excludedIds }, "Selected and excluded milestone identities must match the corpus baseline."),
      invariant("chronology_ordering", chronologyIsOrdered(actual), "strict canonical chronology with contiguous sequence", actual.selectedMilestones.map((item) => ({
        milestoneId: item.milestoneId, sequence: item.sequence, chronology: item.chronology
      })), "Milestones must be ordered by certified chronology."),
      invariant("fingerprint_stability", actual.compilerInputFingerprint === testCase.expectedCompilerFingerprint, testCase.expectedCompilerFingerprint, actual.compilerInputFingerprint, "Compiler fingerprint must match the versioned corpus baseline."),
      invariant("editorial_evidence_set_lineage",
        actual.editorialEvidenceSetId === testCase.compilerInput.editorialEvidenceSetId &&
          [...compilerEvidenceIds].every((id) => inputEvidenceIds.has(id)),
        testCase.compilerInput.editorialEvidenceSetId,
        { editorialEvidenceSetId: actual.editorialEvidenceSetId, evidenceRecordIds: [...compilerEvidenceIds].sort() },
        "Compiler output must remain inside the exact Editorial Evidence Set lineage."),
      invariant("extraction_lineage",
        testCase.compilerInput.milestones.every((item) => extractionIds.has(item.milestoneId)) &&
          selectedIds.every((id) => extractionIds.has(id)),
        [...extractionIds].sort(), selectedIds, "Compiler inputs and selections must belong to the pinned extraction lineage."),
      invariant("compiler_candidate_persistence",
        testCase.observedPersistence.editorialEvidenceSetId === actual.editorialEvidenceSetId &&
          testCase.observedPersistence.compilerInputFingerprint === actual.compilerInputFingerprint &&
          same(testCase.observedPersistence.selectedMilestoneIds, selectedIds) &&
          same(testCase.observedPersistence.excludedMilestoneIds, excludedIds),
        { fingerprint: actual.compilerInputFingerprint, selectedIds, excludedIds },
        testCase.observedPersistence,
        "Observed immutable persistence must reproduce compiler identity and decisions."),
      invariant("package_dependency",
        testCase.observedPackage.artifactRefs.includes(testCase.observedCompilerArtifact.artifactId),
        testCase.observedCompilerArtifact.artifactId,
        testCase.observedPackage.artifactRefs,
        "Package lineage must contain the compiler artifact."),
      invariant("package_lineage_subset",
        packageRefs.every((id) => selectedSet.has(id)),
        selectedIds, packageRefs,
        "Every packaged milestone authority reference must be selected by the compiler."),
      invariant("compiler_artifact_ownership",
        testCase.observedCompilerArtifact.factoryObjectId === testCase.observedPersistence.factoryObjectId &&
          testCase.observedCompilerArtifact.editorialTimelineCandidateId === testCase.observedPersistence.candidateId &&
          testCase.observedCompilerArtifact.compilerInputFingerprint === actual.compilerInputFingerprint,
        testCase.observedPersistence,
        testCase.observedCompilerArtifact,
        "Compiler artifact must belong to the exact persisted EditorialTimelineCandidate."),
      invariant("compiler_exclusion_preservation",
        same(excludedIds, testCase.observedPersistence.excludedMilestoneIds) &&
          excludedIds.every((id) => !packageRefs.includes(id)),
        excludedIds,
        { persisted: testCase.observedPersistence.excludedMilestoneIds, packaged: packageRefs },
        "Compiler exclusions must persist and remain outside package milestone authority."),
      invariant("governance_candidate_exclusion",
        !testCase.observedGovernanceAuthorityRefs.includes(testCase.observedPersistence.factoryObjectId) &&
          packageRefs.every((id) => testCase.observedGovernanceAuthorityRefs.includes(id)),
        { excludedFactoryObjectId: testCase.observedPersistence.factoryObjectId, includedMilestones: packageRefs },
        testCase.observedGovernanceAuthorityRefs,
        "Governance authority must exclude EditorialTimelineCandidate while retaining selected milestone authority.")
    ];
    return {
      caseId: testCase.caseId,
      topic: testCase.topic,
      status: invariants.every((item) => item.passed) ? "passed" : "failed",
      compilerVersion: actual.compilerVersion,
      selectionAlgorithmVersion: actual.selectionAlgorithmVersion,
      expectedFingerprint: testCase.expectedCompilerFingerprint,
      actualFingerprint: actual.compilerInputFingerprint,
      exactInput: testCase,
      actualCompilerOutput: actual,
      invariants
    };
  } catch (error) {
    return failedCase(testCase, error);
  }
}

export function buildEi002CertificationReport(
  corpus: readonly Ei002CertificationCase[] = ei002TierACorpus
): EditorialCertificationReport {
  const caseResults = corpus.map(certifyEi002Case);
  const invariants = caseResults.flatMap((item) => item.invariants);
  const passedInvariantCount = invariants.filter((item) => item.passed).length;
  const passedCaseCount = caseResults.filter((item) => item.status === "passed").length;
  const corpusFingerprint = createHash("sha256").update(JSON.stringify(corpus)).digest("hex");
  return {
    epic: "EI-002",
    frameworkVersion: EDITORIAL_CERTIFICATION_FRAMEWORK_VERSION,
    corpusVersion: EI002_TIER_A_CORPUS_VERSION,
    corpusFingerprint,
    status: passedCaseCount === caseResults.length ? "passed" : "failed",
    authorityDecision: false,
    publicationReadinessDecision: false,
    caseResults,
    summary: {
      caseCount: caseResults.length,
      passedCaseCount,
      failedCaseCount: caseResults.length - passedCaseCount,
      invariantCount: invariants.length,
      passedInvariantCount,
      failedInvariantCount: invariants.length - passedInvariantCount
    }
  };
}

export const editorialCertificationService = {
  async certifyEi002(input: {
    actor: string;
    corpus?: readonly Ei002CertificationCase[];
    persistence?: EditorialCertificationPersistence;
  }): Promise<EditorialCertificationReport> {
    const report = buildEi002CertificationReport(input.corpus);
    return (input.persistence || editorialCertificationRepository).createReport(report, input.actor);
  }
};

