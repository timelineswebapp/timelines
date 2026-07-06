import { createHash } from "node:crypto";
import type { Ei004CertificationCase } from "@/src/server/editorial-certification/ei004-contracts";

const id = (value: number) => `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function makeCase(topic: string, offset: number, year: number): Ei004CertificationCase {
  const milestoneId = id(offset + 1), evidenceId = id(offset + 2), snapshotId = id(offset + 3);
  const sentenceId = `phase-1:paragraph:1:sentence:1`;
  const promptFingerprints = [1, 2, 3, 4].map((value) => hash([topic, "prompt", value]));
  const writerInputFingerprint = hash([topic, milestoneId, evidenceId]);
  const narrative: any = {
    contractVersion: "ei-004-narrative-v1", narrativeId: id(offset + 4), factoryObjectId: id(offset + 5),
    canonicalSubject: topic, locale: "en", editorialCompositionId: id(offset + 6),
    editorialCompositionFingerprint: hash([topic, "composition"]), editorialTimelineCandidateId: id(offset + 7),
    editorialTimelineCandidateFingerprint: hash([topic, "candidate"]), editorialEvidenceSetId: id(offset + 8),
    prompts: promptFingerprints.map((fingerprint, index) => ({
      promptId: id(offset + 20 + index), promptKey: ["editorial_title", "editorial_introduction", "editorial_phase", "editorial_conclusion"][index],
      promptVersion: 1, templateFingerprint: fingerprint, schemaVersion: "ei-004-prompt-schema-v1",
      policyId: "general-en", policyVersion: "1", lifecycle: "active", promptFingerprint: fingerprint
    })),
    writingPolicy: { policyId: "general-en", version: "1", schemaVersion: "ei-004-writing-policy-v1", locale: "en",
      audience: "general", tone: "neutral_educational", readingLevel: "grade-9", targetLength: { minimumWords: 1, maximumWords: 1000 },
      quotationPolicy: "source_verbatim_only", chronologyPolicy: "composition_order_locked",
      causalityPolicy: "explicit_grounded_relationship_only", citationPolicy: "sentence_lineage_required",
      narrativeMode: "historical_article", fingerprint: hash([topic, "policy"]) },
    providerProvenance: { schemaVersion: "ei-004-provider-provenance-v1", provider: "qwen14", providerVersion: "1",
      model: "qwen", modelVersion: "1", structuredOutputSchemaVersion: "v1", temperature: 0, seed: 7,
      runtimeFingerprint: hash([topic, "provider"]) },
    writerInputFingerprint, title: { text: topic, claimIds: [`claim:${evidenceId}`], milestoneIds: [milestoneId] },
    subtitle: null,
    introduction: { sectionId: "introduction", sequence: 1, sectionType: "introduction", compositionRef: "introduction", paragraphs: [] },
    phases: [{ sectionId: "phase-1", sequence: 2, sectionType: "phase", compositionRef: "phase-1",
      paragraphs: [{ paragraphId: "phase-1:paragraph:1", sequence: 1, milestoneIds: [milestoneId],
        sentences: [{ sentenceId, sequence: 1, text: `The grounded milestone occurred in ${year}.`,
          milestoneIds: [milestoneId], claimIds: [`claim:${evidenceId}`], chronologyRefs: [`${year}:x:x`] }] }] }],
    transitions: [],
    conclusion: { sectionId: "conclusion", sequence: 3, sectionType: "conclusion", compositionRef: "conclusion", paragraphs: [] },
    sections: [] as any[], citations: [{ citationReferenceId: `citation:${snapshotId}`, sentenceIds: [sentenceId],
      evidenceRecordIds: [evidenceId], sourceRecordId: id(offset + 9), sourceSnapshotId: snapshotId }],
    narrativeClaimMap: { entries: [{ sentenceId, claimIds: [`claim:${evidenceId}`], evidenceRecordIds: [evidenceId], milestoneIds: [milestoneId] }] },
    generationMetrics: { sectionCount: 3, paragraphCount: 1, sentenceCount: 1, wordCount: 7, coveredMilestoneCount: 1, citedEvidenceCount: 1 },
    generationMetadata: { factoryOwned: true, authorityDecision: false, publicationReadinessDecision: false, generatedText: true },
    revision: { revision: 1, supersedesNarrativeId: null }
  };
  narrative.sections = [narrative.introduction, ...narrative.phases, narrative.conclusion];
  narrative.narrativeOutputFingerprint = hash({ narrative: { ...narrative, narrativeOutputFingerprint: undefined } });
  const artifactId = id(offset + 10);
  return {
    caseId: `ei004-${topic.toLowerCase().replaceAll(" ", "-")}`, topic,
    writerVersion: "ei-004-writer-v1", generationAlgorithmVersion: "ei-004-generation-v1",
    executionKey: `certification:${topic}`, promptFingerprints,
    policyFingerprint: narrative.writingPolicy.fingerprint,
    providerFingerprint: narrative.providerProvenance.runtimeFingerprint,
    writerInputFingerprint, narrativeOutputFingerprint: narrative.narrativeOutputFingerprint, narrative,
    selectedMilestoneIds: [milestoneId], excludedMilestoneIds: [], validatedEvidenceIds: [evidenceId],
    sourceSnapshotIds: [snapshotId], observedGenerationCallsOnResume: 0, observedReusedUnitCount: 5,
    observedRevision: { priorNarrativeId: null, revision: 1 },
    observedArtifact: { artifactId, factoryObjectId: narrative.factoryObjectId, outputFingerprint: narrative.narrativeOutputFingerprint },
    observedPackage: { artifactRefs: [artifactId], narrativeArtifactId: artifactId },
    observedGovernanceAuthorityRefs: [milestoneId],
    adversarialRejections: Object.fromEntries([
      "prompt_drift","policy_drift","provider_drift","unsupported_quotation","unsupported_date",
      "unsupported_quantity","unsupported_causality","missing_milestone","unknown_claim",
      "broken_citation","broken_sentence","broken_prompt","broken_provider","broken_package",
      "duplicate_exclusion","chronology_gap","same_day","bce","maximum_composition","explicit_regeneration"
    ].map((key) => [key, true]))
  };
}

export const ei004TierACorpus = [
  makeCase("Roman Republic", 20000, -509),
  makeCase("Printing Press", 21000, 1455),
  makeCase("Meiji Restoration", 22000, 1868),
  makeCase("Internet", 23000, 1983)
] as const;
