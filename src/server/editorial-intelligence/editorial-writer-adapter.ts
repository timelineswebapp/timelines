import { ApiError } from "@/src/server/api/responses";
import {
  buildEditorialNarrativeWriterInput,
  fingerprintEditorialPrompt,
  fingerprintEditorialProviderProvenance,
  fingerprintEditorialWritingPolicy
} from "@/src/server/editorial-intelligence/editorial-writer-input-builder";
import { runEditorialWriter } from "@/src/server/editorial-intelligence/editorial-writer-runtime";
import type { EditorialTimelineCandidate } from "@/src/server/editorial-intelligence/timeline-compiler-contracts";
import type { EditorialComposition } from "@/src/server/editorial-intelligence/editorial-composition-contracts";
import type { ValidatedSection, GenerationDiagnostics, GenerationUnit } from "@/src/server/editorial-intelligence/editorial-generation-contracts";
import { getFactoryRuntimeProvider } from "@/src/server/factory/runtime-providers";
import { editorialCompositionRepository } from "@/src/server/repositories/editorial-composition-repository";
import { editorialEvidenceRepository } from "@/src/server/repositories/editorial-evidence-repository";
import { editorialGenerationUnitRepository, editorialWriterConfigurationBindingRepository } from "@/src/server/repositories/editorial-writer-binding-repository";
import {
  editorialPromptRepository,
  editorialProviderConfigurationRepository,
  editorialWritingPolicyRepository
} from "@/src/server/repositories/editorial-writer-configuration-repository";
import { editorialNarrativeRepository } from "@/src/server/repositories/editorial-narrative-repository";
import { editorialTimelineCandidateRepository } from "@/src/server/repositories/editorial-timeline-candidate-repository";
import { evidenceValidationRepository } from "@/src/server/repositories/evidence-validation-repository";
import { sourceAuthorityRepository } from "@/src/server/repositories/source-authority-repository";
import type { EditorialWriterConfigurationBinding } from "@/src/server/editorial-intelligence/editorial-writer-configuration-contracts";

export const EDITORIAL_WRITER_VERSION = "ei-004-writer-v1" as const;
export const EDITORIAL_GENERATION_ALGORITHM_VERSION = "ei-004-generation-v1" as const;

function fail(code: string, message: string): never {
  throw new ApiError(409, code, message);
}

async function loadExactConfiguration(binding: EditorialWriterConfigurationBinding) {
  const [title, introduction, phase, conclusion, policy, provider] = await Promise.all([
    editorialPromptRepository.getPromptById(binding.titlePromptVersionId),
    editorialPromptRepository.getPromptById(binding.introductionPromptVersionId),
    editorialPromptRepository.getPromptById(binding.phasePromptVersionId),
    editorialPromptRepository.getPromptById(binding.conclusionPromptVersionId),
    editorialWritingPolicyRepository.getPolicyById(binding.writingPolicyVersionId),
    editorialProviderConfigurationRepository.getProviderConfigurationById(binding.providerConfigurationId)
  ]);
  if (!title || !introduction || !phase || !conclusion) fail("EDITORIAL_WRITER_PROMPT_MISSING", "Pinned Editorial Writer prompt version is missing.");
  if (!policy) fail("EDITORIAL_WRITER_POLICY_MISSING", "Pinned Editorial Writing Policy is missing.");
  if (!provider) fail("EDITORIAL_WRITER_PROVIDER_MISSING", "Pinned Editorial Provider Configuration is missing.");
  const promptRecords = [title, introduction, phase, conclusion];
  const expectedKeys = ["editorial_title", "editorial_introduction", "editorial_phase", "editorial_conclusion"];
  if (promptRecords.some((item, index) =>
    item.promptKey !== expectedKeys[index] ||
    item.policyId !== policy.policyId ||
    item.policyVersion !== policy.version
  )) fail("EDITORIAL_WRITER_PROMPT_DRIFT", "Pinned prompt identity or policy lineage has drifted.");
  if (policy.locale !== binding.locale || policy.narrativeMode !== binding.narrativeMode) {
    fail("EDITORIAL_WRITER_POLICY_DRIFT", "Pinned policy no longer matches the Writer Configuration Binding.");
  }
  const writingPolicy = fingerprintEditorialWritingPolicy({
    policyId: policy.policyId,
    version: policy.version,
    schemaVersion: policy.schemaVersion as "ei-004-writing-policy-v1",
    locale: policy.locale,
    audience: policy.audience,
    tone: policy.tone as "neutral_educational" | "formal_academic" | "concise_executive",
    readingLevel: policy.readingLevel,
    targetLength: policy.targetLength,
    quotationPolicy: policy.quotationPolicy as "source_verbatim_only" | "quotations_forbidden",
    chronologyPolicy: policy.chronologyPolicy as "composition_order_locked",
    causalityPolicy: policy.causalityPolicy as "explicit_grounded_relationship_only",
    citationPolicy: policy.citationPolicy as "sentence_lineage_required",
    narrativeMode: policy.narrativeMode
  });
  if (writingPolicy.fingerprint !== policy.fingerprint) {
    fail("EDITORIAL_WRITER_POLICY_FINGERPRINT_DRIFT", "Pinned writing-policy fingerprint is invalid.");
  }
  const prompts = promptRecords.map((item) => fingerprintEditorialPrompt({
    promptId: item.promptId,
    promptKey: item.promptKey,
    promptVersion: item.version,
    templateFingerprint: item.contentFingerprint,
    schemaVersion: "ei-004-prompt-schema-v1",
    policyId: item.policyId,
    policyVersion: item.policyVersion,
    lifecycle: item.lifecycle
  }));
  const providerProvenance = fingerprintEditorialProviderProvenance({
    schemaVersion: provider.schemaVersion as "ei-004-provider-provenance-v1",
    provider: provider.providerKey,
    providerVersion: provider.providerVersion,
    model: provider.model,
    modelVersion: provider.modelVersion,
    structuredOutputSchemaVersion: provider.structuredOutputVersion,
    temperature: provider.temperature,
    seed: provider.seed
  });
  if (providerProvenance.runtimeFingerprint !== provider.provenanceFingerprint) {
    fail("EDITORIAL_WRITER_PROVIDER_FINGERPRINT_DRIFT", "Pinned provider-provenance fingerprint is invalid.");
  }
  return { prompts, promptRecords, writingPolicy, provider, providerProvenance };
}

export async function executeEditorialWriterCheckpoint(input: {
  editorialCompositionId: string;
  editorialTimelineCandidateId: string;
  editorialEvidenceSetId: string;
  expectedTimelineCandidate: EditorialTimelineCandidate;
  writerConfigurationBindingId: string;
  executionKey: string;
  actor: string;
  revision: number;
  supersedesNarrativeId: string | null;
}) {
  const [composition, candidate, evidenceSet, binding] = await Promise.all([
    editorialCompositionRepository.getById(input.editorialCompositionId),
    editorialTimelineCandidateRepository.getById(input.editorialTimelineCandidateId),
    editorialEvidenceRepository.getById(input.editorialEvidenceSetId),
    editorialWriterConfigurationBindingRepository.getWriterConfigurationBindingById(input.writerConfigurationBindingId)
  ]);
  if (!composition) fail("EDITORIAL_WRITER_COMPOSITION_MISSING", "Pinned EditorialComposition is missing.");
  if (!candidate) fail("EDITORIAL_WRITER_CANDIDATE_MISSING", "Pinned EditorialTimelineCandidate is missing.");
  if (!evidenceSet) fail("EDITORIAL_WRITER_EVIDENCE_SET_MISSING", "Pinned Editorial Evidence Set is missing.");
  if (!binding) fail("EDITORIAL_WRITER_BINDING_MISSING", "Pinned Writer Configuration Binding is missing.");
  if (composition.editorialTimelineCandidateId !== candidate.candidateId ||
      composition.editorialEvidenceSetId !== evidenceSet.editorialEvidenceSetId ||
      candidate.editorialEvidenceSetId !== evidenceSet.editorialEvidenceSetId ||
      composition.plannerInputFingerprint !== (composition as EditorialComposition).plannerInputFingerprint ||
      input.expectedTimelineCandidate.compilerInputFingerprint !== candidate.compilerInputFingerprint) {
    fail("EDITORIAL_WRITER_PREDECESSOR_DRIFT", "Editorial Writer predecessor lineage has drifted.");
  }
  const exactConfiguration = await loadExactConfiguration(binding);
  const evidenceLineage = input.expectedTimelineCandidate.selectedMilestones.flatMap((item) => item.evidenceLineage);
  const validationIds = [...new Set(evidenceLineage.map((item) => item.validationRecordId))];
  const evidenceIds = [...new Set(evidenceLineage.map((item) => item.evidenceRecordId))];
  const [validations, evidenceSubjects] = await Promise.all([
    evidenceValidationRepository.getValidationRecords(validationIds),
    Promise.all(evidenceIds.map((id) => evidenceValidationRepository.getEvidenceSubject(id)))
  ]);
  if (validations.length !== validationIds.length || evidenceSubjects.some((item) => !item)) {
    fail("EDITORIAL_WRITER_EVIDENCE_LINEAGE_MISSING", "Exact validated evidence lineage is incomplete.");
  }
  const validationById = new Map(validations.map((item) => [item.validationRecordId, item]));
  const lineageByEvidence = new Map(evidenceLineage.map((item) => [item.evidenceRecordId, item]));
  const validatedEvidence = evidenceIds.map((evidenceRecordId) => {
    const lineage = lineageByEvidence.get(evidenceRecordId)!;
    const evidence = evidenceSubjects.find((item) => item?.evidenceRecordId === evidenceRecordId)!;
    const validation = validationById.get(lineage.validationRecordId);
    if (!validation || validation.evidenceRecordId !== evidence.evidenceRecordId || validation.status !== "passed") {
      fail("EDITORIAL_WRITER_VALIDATION_DRIFT", "Pinned evidence validation lineage is invalid.");
    }
    return { evidence, validation };
  });
  const snapshotIds = [...new Set(validatedEvidence.map((item) => item.evidence.sourceSnapshotId))];
  const sourceSnapshots = await sourceAuthorityRepository.getSourceSnapshots(snapshotIds);
  if (sourceSnapshots.length !== snapshotIds.length) {
    fail("EDITORIAL_WRITER_SNAPSHOT_LINEAGE_MISSING", "Exact source snapshot lineage is incomplete.");
  }
  const writerInput = buildEditorialNarrativeWriterInput({
    locale: binding.locale,
    editorialCompositionId: composition.compositionId,
    composition: composition as EditorialComposition,
    timelineCandidate: input.expectedTimelineCandidate,
    editorialEvidenceSet: evidenceSet,
    validatedEvidence,
    sourceSnapshots,
    prompts: exactConfiguration.prompts,
    writingPolicy: exactConfiguration.writingPolicy,
    providerProvenance: exactConfiguration.providerProvenance
  });
  const existingNarrative = await editorialNarrativeRepository.getByExecutionKey(input.executionKey);
  if (existingNarrative) {
    if (existingNarrative.writerInputFingerprint !== writerInput.writerInputFingerprint) {
      fail("EDITORIAL_WRITER_INPUT_DRIFT", "Completed narrative WriterInput fingerprint has drifted.");
    }
    return { narrative: existingNarrative, reusedNarrative: true, writerInput };
  }
  const promptVersionId = new Map(exactConfiguration.promptRecords.map((item) => [item.promptKey, item.promptVersionId]));
  const keyForUnit = (unit: GenerationUnit) =>
    unit.kind === "title" || unit.kind === "subtitle" ? "editorial_title" :
    unit.kind === "introduction" ? "editorial_introduction" :
    unit.kind === "conclusion" ? "editorial_conclusion" : "editorial_phase";
  const result = await runEditorialWriter(writerInput, {
    provider: getFactoryRuntimeProvider(exactConfiguration.provider.providerKey),
    promptContent: Object.fromEntries(
      exactConfiguration.promptRecords.map((item) => [item.promptKey, item.content])
    ) as Record<"editorial_title" | "editorial_introduction" | "editorial_phase" | "editorial_conclusion", string>,
    maxAttempts: exactConfiguration.provider.retryLimit + 1,
    timeoutMs: exactConfiguration.provider.timeoutMs,
    loadValidatedUnit: async (unit, inputFingerprint) => {
      const persisted = await editorialGenerationUnitRepository.getValidatedGenerationUnit(
        input.executionKey, unit.kind, unit.sequence
      );
      if (!persisted) return null;
      if (persisted.inputFingerprint !== inputFingerprint ||
          persisted.promptVersionId !== promptVersionId.get(keyForUnit(unit))) {
        fail("EDITORIAL_WRITER_UNIT_DRIFT", "Validated generation-unit identity has drifted.");
      }
      return {
        validated: persisted.validatedOutput as unknown as ValidatedSection,
        diagnostics: persisted.diagnostics as unknown as GenerationDiagnostics
      };
    },
    persistValidatedUnit: async (unit, inputFingerprint, outputFingerprint, validated, diagnostics) => {
      await editorialGenerationUnitRepository.createValidatedGenerationUnit({
        executionKey: input.executionKey,
        unitType: unit.kind,
        unitSequence: unit.sequence,
        promptVersionId: promptVersionId.get(keyForUnit(unit))!,
        inputFingerprint,
        outputFingerprint,
        validatedOutput: validated as unknown as Record<string, unknown>,
        groundingValidationReport: validated.validation as unknown as Record<string, unknown>,
        diagnostics: diagnostics as unknown as Record<string, unknown>,
        createdBy: input.actor
      });
    }
  });
  const narrative = await editorialNarrativeRepository.create({
    narrative: result.narrative,
    executionKey: input.executionKey,
    writerVersion: EDITORIAL_WRITER_VERSION,
    generationAlgorithmVersion: EDITORIAL_GENERATION_ALGORITHM_VERSION,
    diagnostics: result.diagnostics,
    revision: {
      revision: input.revision,
      supersedesNarrativeId: input.supersedesNarrativeId,
      reason: input.supersedesNarrativeId ? "Explicit Factory regeneration." : "Initial Editorial Writer execution."
    },
    actor: input.actor
  });
  return { narrative, reusedNarrative: false, writerInput };
}
