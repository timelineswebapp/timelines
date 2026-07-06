import { createHash } from "node:crypto";
import type {
  EditorialPromptDefinition,
  EditorialPromptReference
} from "@/src/server/editorial-intelligence/editorial-prompt-contracts";
import type {
  EditorialProviderProvenance,
  EditorialProviderProvenanceDefinition
} from "@/src/server/editorial-intelligence/editorial-provider-provenance";
import type {
  EditorialWritingPolicy,
  EditorialWritingPolicyDefinition
} from "@/src/server/editorial-intelligence/editorial-writing-policy-contracts";
import {
  EDITORIAL_WRITER_INPUT_VERSION,
  type BuildEditorialNarrativeWriterInput,
  type EditorialNarrativeWriterInput
} from "@/src/server/editorial-intelligence/editorial-writer-input";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const REQUIRED_PROMPTS = new Set(["editorial_title", "editorial_introduction", "editorial_phase", "editorial_conclusion"]);

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function fingerprintEditorialPrompt(definition: EditorialPromptDefinition): EditorialPromptReference {
  if (!HASH_PATTERN.test(definition.templateFingerprint)) throw new Error("Prompt templateFingerprint must be SHA-256.");
  return Object.freeze({ ...definition, promptFingerprint: fingerprint(definition) });
}

export function fingerprintEditorialWritingPolicy(definition: EditorialWritingPolicyDefinition): EditorialWritingPolicy {
  if (definition.targetLength.minimumWords < 1 ||
      definition.targetLength.maximumWords < definition.targetLength.minimumWords) {
    throw new Error("Writing policy target length is invalid.");
  }
  return Object.freeze({
    ...definition,
    targetLength: Object.freeze({ ...definition.targetLength }),
    fingerprint: fingerprint(definition)
  });
}

export function fingerprintEditorialProviderProvenance(
  definition: EditorialProviderProvenanceDefinition
): EditorialProviderProvenance {
  if (!Number.isFinite(definition.temperature) || definition.temperature < 0 || definition.temperature > 2) {
    throw new Error("Provider temperature must be between 0 and 2.");
  }
  if (definition.seed !== null && !Number.isSafeInteger(definition.seed)) {
    throw new Error("Provider seed must be a safe integer or null.");
  }
  return Object.freeze({ ...definition, runtimeFingerprint: fingerprint(definition) });
}

function validate(input: BuildEditorialNarrativeWriterInput): void {
  if (!UUID_PATTERN.test(input.editorialCompositionId)) throw new Error("editorialCompositionId must be a UUID.");
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.locale)) throw new Error("locale must be a BCP 47 language tag.");
  if (input.locale !== input.writingPolicy.locale) throw new Error("Writer locale must equal writing policy locale.");
  if (!input.composition.canonicalSubject.trim() ||
      input.composition.canonicalSubject !== input.timelineCandidate.canonicalSubject ||
      input.composition.canonicalSubject !== input.editorialEvidenceSet.canonicalSubject.label) {
    throw new Error("Canonical subject lineage does not match.");
  }
  if (!input.editorialEvidenceSet.editorialEvidenceSetId ||
      input.composition.editorialEvidenceSetId !== input.editorialEvidenceSet.editorialEvidenceSetId ||
      input.timelineCandidate.editorialEvidenceSetId !== input.editorialEvidenceSet.editorialEvidenceSetId) {
    throw new Error("Editorial Evidence Set lineage does not match.");
  }
  if (input.composition.editorialTimelineCandidateFingerprint !== input.timelineCandidate.compilerInputFingerprint) {
    throw new Error("EditorialTimelineCandidate fingerprint lineage does not match.");
  }
  if (input.timelineCandidate.selectedMilestones.length === 0 ||
      input.timelineCandidate.selectedMilestones.length > 200) {
    throw new Error("Writer input requires between 1 and 200 selected milestones.");
  }
  const selectedIds = input.timelineCandidate.selectedMilestones.map((item) => item.milestoneId);
  const composedIds = input.composition.phases.flatMap((phase) => phase.milestoneIds);
  if (stableJson(selectedIds) !== stableJson(composedIds)) throw new Error("Composition membership must equal EI-002 selection.");

  const rankedEvidenceIds = new Set(input.editorialEvidenceSet.rankedEvidence.map((item) => item.evidenceRecordId));
  const evidenceById = new Map(input.validatedEvidence.map((item) => [item.evidence.evidenceRecordId, item]));
  if (evidenceById.size !== input.validatedEvidence.length) throw new Error("Validated evidence IDs must be unique.");
  for (const item of input.validatedEvidence) {
    if (item.validation.status !== "passed" ||
        item.validation.evidenceRecordId !== item.evidence.evidenceRecordId ||
        !rankedEvidenceIds.has(item.evidence.evidenceRecordId)) {
      throw new Error("Writer evidence must be passed and belong to the exact Editorial Evidence Set.");
    }
  }
  for (const milestone of input.timelineCandidate.selectedMilestones) {
    if (milestone.sequence < 1 || milestone.evidenceLineage.length === 0) throw new Error("Selected milestone lineage is incomplete.");
    for (const lineage of milestone.evidenceLineage) {
      const item = evidenceById.get(lineage.evidenceRecordId);
      if (!item || item.validation.validationRecordId !== lineage.validationRecordId) {
        throw new Error("Selected milestone evidence lineage cannot be resolved exactly.");
      }
    }
  }
  const snapshots = new Map(input.sourceSnapshots.map((item) => [item.snapshotId, item]));
  if (snapshots.size !== input.sourceSnapshots.length) throw new Error("Source snapshot IDs must be unique.");
  for (const item of input.validatedEvidence) {
    const snapshot = snapshots.get(item.evidence.sourceSnapshotId);
    if (!snapshot || snapshot.sourceRecordId !== item.evidence.sourceRecordId) {
      throw new Error("Evidence source snapshot lineage cannot be resolved exactly.");
    }
  }
  const promptKeys = new Set(input.prompts.map((item) => item.promptKey));
  if (input.prompts.length !== REQUIRED_PROMPTS.size ||
      [...REQUIRED_PROMPTS].some((key) => !promptKeys.has(key as never))) {
    throw new Error("Writer input requires exactly one prompt for every editorial prompt key.");
  }
  for (const prompt of input.prompts) {
    const { promptFingerprint, ...promptDefinition } = prompt;
    if (prompt.policyId !== input.writingPolicy.policyId ||
        prompt.policyVersion !== input.writingPolicy.version ||
        fingerprintEditorialPrompt(promptDefinition).promptFingerprint !== promptFingerprint) {
      throw new Error("Prompt provenance does not match the exact writing policy or fingerprint.");
    }
  }
  const { fingerprint: policyFingerprint, ...policyDefinition } = input.writingPolicy;
  if (fingerprintEditorialWritingPolicy(policyDefinition).fingerprint !== policyFingerprint) {
    throw new Error("Writing policy fingerprint is invalid.");
  }
  const { runtimeFingerprint, ...providerDefinition } = input.providerProvenance;
  if (fingerprintEditorialProviderProvenance(providerDefinition).runtimeFingerprint !== runtimeFingerprint) {
    throw new Error("Provider provenance fingerprint is invalid.");
  }
}

export function buildEditorialNarrativeWriterInput(
  input: BuildEditorialNarrativeWriterInput
): EditorialNarrativeWriterInput {
  validate(input);
  const selectedMilestones = input.timelineCandidate.selectedMilestones.map((milestone) => ({
    milestoneId: milestone.milestoneId,
    sequence: milestone.sequence,
    chronology: { ...milestone.chronology },
    evidenceRecordIds: milestone.evidenceLineage.map((item) => item.evidenceRecordId).sort()
  }));
  const canonical = {
    version: EDITORIAL_WRITER_INPUT_VERSION,
    locale: input.locale,
    canonicalSubject: input.composition.canonicalSubject,
    editorialCompositionId: input.editorialCompositionId,
    composition: structuredClone(input.composition),
    timelineCandidate: structuredClone(input.timelineCandidate),
    editorialEvidenceSet: structuredClone(input.editorialEvidenceSet),
    selectedMilestones,
    validatedEvidence: [...input.validatedEvidence]
      .map((item) => structuredClone(item))
      .sort((left, right) => left.evidence.evidenceRecordId.localeCompare(right.evidence.evidenceRecordId)),
    sourceSnapshots: [...input.sourceSnapshots]
      .map((item) => structuredClone(item))
      .sort((left, right) => left.snapshotId.localeCompare(right.snapshotId)),
    prompts: [...input.prompts]
      .map((item) => ({ ...item }))
      .sort((left, right) => left.promptKey.localeCompare(right.promptKey) || left.promptVersion - right.promptVersion),
    writingPolicy: structuredClone(input.writingPolicy),
    providerProvenance: structuredClone(input.providerProvenance)
  };
  return {
    ...canonical,
    writerInputFingerprint: fingerprint(canonical)
  };
}
