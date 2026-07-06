import type { FactoryRuntimeProvider } from "@/src/server/factory/runtime-providers";
import type { EditorialNarrative } from "@/src/server/editorial-intelligence/editorial-narrative-contracts";
import type { EditorialNarrativeWriterInput } from "@/src/server/editorial-intelligence/editorial-writer-input";
import type {
  GenerationDiagnostics,
  GenerationUnit,
  ValidatedSection
} from "@/src/server/editorial-intelligence/editorial-generation-contracts";
import { editorialGenerationOutputSchema, parseGeneratedSection } from "@/src/server/editorial-intelligence/editorial-generation-schemas";
import {
  narrativeClaimId,
  validateGeneratedSection,
  validateNarrativeCoverage
} from "@/src/server/editorial-intelligence/editorial-grounding-validator";
import { assembleEditorialNarrative } from "@/src/server/editorial-intelligence/editorial-narrative-assembler";
import { createHash } from "node:crypto";

export type EditorialWriterRuntimeOptions = Readonly<{
  provider: FactoryRuntimeProvider;
  maxAttempts?: number;
  timeoutMs?: number;
  promptContent: Readonly<Record<"editorial_title" | "editorial_introduction" | "editorial_phase" | "editorial_conclusion", string>>;
  loadValidatedUnit?: (
    unit: GenerationUnit,
    inputFingerprint: string
  ) => Promise<{ validated: ValidatedSection; diagnostics: GenerationDiagnostics } | null>;
  persistValidatedUnit?: (
    unit: GenerationUnit,
    inputFingerprint: string,
    outputFingerprint: string,
    validated: ValidatedSection,
    diagnostics: GenerationDiagnostics
  ) => Promise<void>;
}>;

const unitFingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

function units(input: EditorialNarrativeWriterInput): GenerationUnit[] {
  const claimIdsFor = (milestoneIds: readonly string[]) => [...new Set(
    input.selectedMilestones
      .filter((item) => milestoneIds.includes(item.milestoneId))
      .flatMap((item) => item.evidenceRecordIds.map(narrativeClaimId))
  )].sort();
  const allMilestoneIds = input.selectedMilestones.map((item) => item.milestoneId);
  const introductionIds = input.composition.introduction.anchorMilestoneIds;
  const conclusionIds = input.composition.conclusion.anchorMilestoneIds;
  return [
    { unitId: "title", kind: "title", sequence: 1, compositionRef: "title", milestoneIds: allMilestoneIds, claimIds: claimIdsFor(allMilestoneIds) },
    { unitId: "subtitle", kind: "subtitle", sequence: 2, compositionRef: "subtitle", milestoneIds: allMilestoneIds, claimIds: claimIdsFor(allMilestoneIds) },
    { unitId: "introduction", kind: "introduction", sequence: 3, compositionRef: "introduction", milestoneIds: introductionIds, claimIds: claimIdsFor(introductionIds) },
    ...input.composition.phases.map((phase, index) => ({
      unitId: `phase-${index + 1}`, kind: "phase" as const, sequence: index + 4,
      compositionRef: phase.phaseId, milestoneIds: phase.milestoneIds, claimIds: claimIdsFor(phase.milestoneIds)
    })),
    {
      unitId: "conclusion", kind: "conclusion", sequence: input.composition.phases.length + 4,
      compositionRef: "conclusion", milestoneIds: conclusionIds, claimIds: claimIdsFor(conclusionIds)
    }
  ];
}

function promptKey(unit: GenerationUnit) {
  if (unit.kind === "title" || unit.kind === "subtitle") return "editorial_title" as const;
  if (unit.kind === "introduction") return "editorial_introduction" as const;
  if (unit.kind === "conclusion") return "editorial_conclusion" as const;
  return "editorial_phase" as const;
}

function boundedUnitInput(unit: GenerationUnit, input: EditorialNarrativeWriterInput) {
  const claims = input.validatedEvidence
    .filter((item) => unit.claimIds.includes(narrativeClaimId(item.evidence.evidenceRecordId)))
    .map((item) => ({
      claimId: narrativeClaimId(item.evidence.evidenceRecordId),
      normalizedClaim: item.evidence.normalizedClaim,
      quoteText: item.evidence.quoteText
    }));
  const milestones = input.selectedMilestones.filter((item) => unit.milestoneIds.includes(item.milestoneId));
  return {
    unit: { ...unit },
    canonicalSubject: input.canonicalSubject,
    locale: input.locale,
    writingPolicy: input.writingPolicy,
    milestones,
    claims
  };
}

export async function runEditorialWriter(
  input: EditorialNarrativeWriterInput,
  options: EditorialWriterRuntimeOptions
): Promise<{ narrative: EditorialNarrative; diagnostics: readonly GenerationDiagnostics[] }> {
  if (input.selectedMilestones.length === 0 || input.selectedMilestones.length > 200) {
    throw new Error("Editorial Writer supports between 1 and 200 milestones.");
  }
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 2, 3));
  const successful: ValidatedSection[] = [];
  const diagnostics: GenerationDiagnostics[] = [];
  for (const unit of units(input)) {
    const key = promptKey(unit);
    const promptRef = input.prompts.find((item) => item.promptKey === key);
    if (!promptRef) throw new Error(`Missing versioned prompt ${key}.`);
    const promptContent = options.promptContent[key];
    if (!promptContent ||
        createHash("sha256").update(promptContent).digest("hex") !== promptRef.templateFingerprint) {
      throw new Error(`Prompt Registry content fingerprint mismatch for ${key}.`);
    }
    const exactUnitInput = boundedUnitInput(unit, input);
    const inputFingerprint = unitFingerprint({
      writerInputFingerprint: input.writerInputFingerprint,
      promptFingerprint: promptRef.promptFingerprint,
      unitInput: exactUnitInput
    });
    const reused = await options.loadValidatedUnit?.(unit, inputFingerprint);
    if (reused) {
      successful.push(reused.validated);
      diagnostics.push(reused.diagnostics);
      continue;
    }
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = Date.now();
      try {
        const response = await options.provider.execute({
          prompt: promptContent,
          input: exactUnitInput,
          outputSchema: editorialGenerationOutputSchema(unit),
          timeoutMs: options.timeoutMs,
          configuration: {
            promptId: promptRef.promptId,
            promptVersion: promptRef.promptVersion,
            promptFingerprint: promptRef.promptFingerprint,
            writingPolicyFingerprint: input.writingPolicy.fingerprint,
            providerRuntimeFingerprint: input.providerProvenance.runtimeFingerprint
          }
        });
        const generated = parseGeneratedSection(unit, response.output);
        const validated = validateGeneratedSection(generated, input);
        const unitDiagnostics = {
          unitId: unit.unitId,
          provider: response.providerKey,
          model: response.modelName,
          latencyMs: Number(response.diagnostics.durationMs ?? Date.now() - startedAt),
          usage: {
            inputTokens: typeof response.diagnostics.inputTokens === "number" ? response.diagnostics.inputTokens : null,
            outputTokens: typeof response.diagnostics.outputTokens === "number" ? response.diagnostics.outputTokens : null
          },
          retryCount: attempt - 1,
          completionReason: typeof response.diagnostics.completionReason === "string" ? response.diagnostics.completionReason : null
        };
        await options.persistValidatedUnit?.(
          unit,
          inputFingerprint,
          unitFingerprint(validated),
          validated,
          unitDiagnostics
        );
        successful.push(validated);
        diagnostics.push(unitDiagnostics);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
  }
  validateNarrativeCoverage(successful, input);
  return {
    narrative: assembleEditorialNarrative({ writerInput: input, sections: successful, diagnostics }),
    diagnostics
  };
}
