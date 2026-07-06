import { createHash } from "node:crypto";
import { EDITORIAL_CERTIFICATION_FRAMEWORK_VERSION, type EditorialCertificationPersistence } from "@/src/server/editorial-certification/contracts";
import {
  EI004_TIER_A_CORPUS_VERSION,
  type Ei004CertificationCase,
  type Ei004CertificationCaseResult,
  type Ei004CertificationInvariantKey,
  type Ei004CertificationInvariantResult,
  type Ei004CertificationReport
} from "@/src/server/editorial-certification/ei004-contracts";
import { ei004TierACorpus } from "@/src/server/editorial-certification/ei004-tier-a-corpus";
import { editorialCertificationRepository } from "@/src/server/repositories/editorial-certification-repository";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const inv = (invariantKey: Ei004CertificationInvariantKey, passed: boolean, expected: unknown, actual: unknown, message: string): Ei004CertificationInvariantResult =>
  ({ invariantKey, passed, expected, actual, message });

export function certifyEi004Case(value: Ei004CertificationCase): Ei004CertificationCaseResult {
  const narrative = value.narrative;
  const sections = narrative.sections;
  const paragraphs = sections.flatMap((section) => section.paragraphs);
  const sentences = paragraphs.flatMap((paragraph) => paragraph.sentences);
  const milestoneIds = sentences.flatMap((sentence) => sentence.milestoneIds);
  const claims = new Map(narrative.narrativeClaimMap.entries.map((entry) => [entry.sentenceId, entry]));
  const citationSentenceIds = new Set(narrative.citations.flatMap((citation) => citation.sentenceIds));
  const citationEvidenceIds = new Set(narrative.citations.flatMap((citation) => citation.evidenceRecordIds));
  const adversarial = value.adversarialRejections;
  const invariants: Ei004CertificationInvariantResult[] = [
    inv("writer_input_determinism", narrative.writerInputFingerprint === value.writerInputFingerprint, value.writerInputFingerprint, narrative.writerInputFingerprint, "WriterInput fingerprint must be stable."),
    inv("prompt_execution_lineage", same(narrative.prompts.map((p) => p.templateFingerprint), value.promptFingerprints) && adversarial.prompt_drift === true, value.promptFingerprints, narrative.prompts, "Executed prompt content must match persisted prompt lineage."),
    inv("policy_lineage", narrative.writingPolicy.fingerprint === value.policyFingerprint && adversarial.policy_drift === true, value.policyFingerprint, narrative.writingPolicy.fingerprint, "Policy provenance must be pinned."),
    inv("provider_lineage", narrative.providerProvenance.runtimeFingerprint === value.providerFingerprint && adversarial.provider_drift === true, value.providerFingerprint, narrative.providerProvenance.runtimeFingerprint, "Provider provenance must be pinned."),
    inv("composition_preservation", same([...new Set(milestoneIds)], value.selectedMilestoneIds), value.selectedMilestoneIds, milestoneIds, "Composition membership must remain unchanged."),
    inv("milestone_coverage", value.selectedMilestoneIds.every((id) => milestoneIds.includes(id)) && adversarial.missing_milestone === true, value.selectedMilestoneIds, milestoneIds, "Every selected milestone must be covered."),
    inv("additional_milestone_absence", milestoneIds.every((id) => value.selectedMilestoneIds.includes(id)), value.selectedMilestoneIds, milestoneIds, "No milestone may be invented."),
    inv("excluded_milestone_absence", milestoneIds.every((id) => !value.excludedMilestoneIds.includes(id)) && adversarial.duplicate_exclusion === true, value.excludedMilestoneIds, milestoneIds, "Compiler exclusions must remain absent."),
    inv("phase_ordering", sections.every((item, index) => item.sequence === index + 1), "contiguous", sections.map((s) => s.sequence), "Section and phase order must be contiguous."),
    inv("paragraph_ordering", sections.every((s) => s.paragraphs.every((p, i) => p.sequence === i + 1)), "contiguous", paragraphs.map((p) => p.sequence), "Paragraph order must be contiguous."),
    inv("sentence_ordering", paragraphs.every((p) => p.sentences.every((s, i) => s.sequence === i + 1)) && adversarial.broken_sentence === true, "contiguous", sentences.map((s) => s.sequence), "Sentence order must be contiguous."),
    inv("sentence_claim_lineage", sentences.every((s) => s.claimIds.length > 0 && claims.has(s.sentenceId)) && adversarial.unknown_claim === true, "all factual sentences", [...claims.keys()], "Every factual sentence requires exact claim lineage."),
    inv("evidence_set_lineage", [...claims.values()].flatMap((e) => e.evidenceRecordIds).every((id) => value.validatedEvidenceIds.includes(id)), value.validatedEvidenceIds, [...claims.values()], "Claims must belong to the exact EditorialEvidenceSet."),
    inv("validation_lineage", [...claims.values()].every((e) => e.evidenceRecordIds.length > 0), "validated evidence", [...claims.values()], "Evidence must retain validation lineage."),
    inv("citation_snapshot_lineage", sentences.every((s) => citationSentenceIds.has(s.sentenceId)) && narrative.citations.every((c) => value.sourceSnapshotIds.includes(c.sourceSnapshotId)) && [...claims.values()].flatMap((e) => e.evidenceRecordIds).every((id) => citationEvidenceIds.has(id)) && adversarial.broken_citation === true, value.sourceSnapshotIds, narrative.citations, "Citations must resolve sentence to evidence to snapshot."),
    inv("quotation_grounding", adversarial.unsupported_quotation === true, true, adversarial.unsupported_quotation === true, "Unsupported quotations must fail."),
    inv("number_grounding", adversarial.unsupported_quantity === true, true, adversarial.unsupported_quantity === true, "Unsupported quantities must fail."),
    inv("chronology_grounding", adversarial.unsupported_date === true && adversarial.chronology_gap === true && adversarial.bce === true, true, adversarial, "Unsupported chronology must fail while grounded BCE and gaps pass."),
    inv("causality_grounding", adversarial.unsupported_causality === true, true, adversarial.unsupported_causality === true, "Unsupported causal language must fail."),
    inv("output_fingerprint", narrative.narrativeOutputFingerprint === value.narrativeOutputFingerprint, value.narrativeOutputFingerprint, narrative.narrativeOutputFingerprint, "Narrative output fingerprint must be immutable."),
    inv("execution_key_identity", value.executionKey.length > 0, "non-empty exact key", value.executionKey, "Execution key must be pinned."),
    inv("generation_unit_reuse", value.observedReusedUnitCount > 0 && value.observedGenerationCallsOnResume === 0, "reuse with zero generation", { reused: value.observedReusedUnitCount, calls: value.observedGenerationCallsOnResume }, "Resume must reuse validated units."),
    inv("narrative_resume_reuse", value.observedGenerationCallsOnResume === 0, 0, value.observedGenerationCallsOnResume, "Completed narrative resume must not regenerate."),
    inv("revision_identity", narrative.revision.revision === value.observedRevision.revision && narrative.revision.supersedesNarrativeId === value.observedRevision.priorNarrativeId && adversarial.explicit_regeneration === true, value.observedRevision, narrative.revision, "Revision identity must be immutable and explicit."),
    inv("package_lineage", value.observedPackage.artifactRefs.includes(value.observedPackage.narrativeArtifactId) && value.observedPackage.narrativeArtifactId === value.observedArtifact.artifactId && adversarial.broken_package === true, value.observedArtifact.artifactId, value.observedPackage, "Package must pin the exact narrative artifact."),
    inv("artifact_ownership", value.observedArtifact.factoryObjectId === narrative.factoryObjectId && value.observedArtifact.outputFingerprint === narrative.narrativeOutputFingerprint, narrative.factoryObjectId, value.observedArtifact, "Narrative artifact must belong to its Factory object."),
    inv("factory_ownership", narrative.generationMetadata.factoryOwned && !narrative.generationMetadata.authorityDecision && !narrative.generationMetadata.publicationReadinessDecision, "Factory non-authority", narrative.generationMetadata, "Narrative remains Factory technical memory."),
    inv("governance_exclusion", narrative.factoryObjectId !== null && !value.observedGovernanceAuthorityRefs.includes(narrative.factoryObjectId) && same(value.observedGovernanceAuthorityRefs, value.selectedMilestoneIds), value.selectedMilestoneIds, value.observedGovernanceAuthorityRefs, "Narrative must be excluded from includedAuthority and canonicalAuthority.")
  ];
  return {
    caseId: value.caseId, topic: value.topic,
    status: invariants.every((item) => item.passed) ? "passed" : "failed",
    writerVersion: value.writerVersion, generationAlgorithmVersion: value.generationAlgorithmVersion,
    expectedFingerprint: value.writerInputFingerprint, actualFingerprint: narrative.writerInputFingerprint,
    expectedOutputFingerprint: value.narrativeOutputFingerprint,
    actualOutputFingerprint: narrative.narrativeOutputFingerprint,
    exactInput: value, actualNarrativeOutput: narrative, invariants
  };
}

export function buildEi004CertificationReport(corpus: readonly Ei004CertificationCase[] = ei004TierACorpus): Ei004CertificationReport {
  const caseResults = corpus.map(certifyEi004Case);
  const invariants = caseResults.flatMap((item) => item.invariants);
  const passedCaseCount = caseResults.filter((item) => item.status === "passed").length;
  const passedInvariantCount = invariants.filter((item) => item.passed).length;
  return {
    epic: "EI-004", frameworkVersion: EDITORIAL_CERTIFICATION_FRAMEWORK_VERSION,
    corpusVersion: EI004_TIER_A_CORPUS_VERSION, corpusFingerprint: hash(corpus),
    status: passedCaseCount === caseResults.length ? "passed" : "failed",
    authorityDecision: false, publicationReadinessDecision: false, caseResults,
    summary: {
      caseCount: caseResults.length, passedCaseCount, failedCaseCount: caseResults.length - passedCaseCount,
      invariantCount: invariants.length, passedInvariantCount,
      failedInvariantCount: invariants.length - passedInvariantCount
    }
  };
}

export const ei004CertificationService = {
  async certify(input: { actor: string; persistence?: EditorialCertificationPersistence }): Promise<Ei004CertificationReport> {
    const report = buildEi004CertificationReport();
    return (input.persistence || editorialCertificationRepository).createReport(report, input.actor) as Promise<Ei004CertificationReport>;
  }
};
