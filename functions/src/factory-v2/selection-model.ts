import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { PROJECT_ID, VERTEX_LOCATION, VERTEX_MODEL } from "../config";
import type { AtomicClaimVersion, CanonicalEventVersion, ResearchMap, ScopeContract } from "./contracts";
import { selectionModelExecutionSchema, significanceProposalSchema, V2_B_PIPELINE_VERSION, V2_B_PROMPT_VERSION, V2_B_SCHEMA_VERSION, V2_B_SELECTION_POLICY_VERSION, type SelectionModelExecution, type SignificanceProposal } from "./contracts/assembly";
import { attachPayloadHash, contentAddressedId, payloadHash, sha256 } from "./hashing";
import { eventCompatibleWithPhase, type SelectionContext } from "./selection";
import type { V2ModelProvider } from "./vertex";

type ProviderResponse = {
  text?: string | (() => string);
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
};

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["judgments", "comparisons", "completenessFindings"],
  properties: {
    judgments: { type: "array", items: { type: "object", additionalProperties: false, required: ["eventVersionId", "significanceClass", "comparativeRank", "criteria", "rationale", "phaseCoverage", "dimensionCoverage", "redundantWithEventVersionIds", "redundancyRationale"], properties: {
      eventVersionId: { type: "string" }, significanceClass: { type: "string", enum: ["ESSENTIAL", "MAJOR", "SUPPORTING", "EXCLUDE"] }, comparativeRank: { type: "integer" },
      criteria: { type: "object", additionalProperties: false, required: ["turningPointValue", "causalImportance", "consequence", "institutionalImportance", "adoptionOrScale", "explanatoryValue", "topicRelevance", "historiographicalProminence", "relationshipToLaterDevelopments", "uniqueness"], properties: Object.fromEntries(["turningPointValue", "causalImportance", "consequence", "institutionalImportance", "adoptionOrScale", "explanatoryValue", "topicRelevance", "historiographicalProminence", "relationshipToLaterDevelopments", "uniqueness"].map((key) => [key, { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "NONE"] }])) },
      rationale: { type: "string" }, phaseCoverage: { type: "array", items: { type: "object", additionalProperties: false, required: ["phaseId", "relation", "rationale"], properties: { phaseId: { type: "string" }, relation: { type: "string", enum: ["PRIMARY", "SUPPORTING", "NONE"] }, rationale: { type: "string" } } } },
      dimensionCoverage: { type: "array", items: { type: "object", additionalProperties: false, required: ["dimensionId", "relation", "rationale"], properties: { dimensionId: { type: "string" }, relation: { type: "string", enum: ["PRIMARY", "SUPPORTING", "NONE"] }, rationale: { type: "string" } } } },
      redundantWithEventVersionIds: { type: "array", items: { type: "string" } }, redundancyRationale: { anyOf: [{ type: "string" }, { type: "null" }] }
    } } },
    comparisons: { type: "array", items: { type: "object", additionalProperties: false, required: ["preferredEventVersionId", "otherEventVersionId", "reason"], properties: { preferredEventVersionId: { type: "string" }, otherEventVersionId: { type: "string" }, reason: { type: "string" } } } },
    completenessFindings: { type: "array", items: { type: "object", additionalProperties: false, required: ["classification", "relatedPhaseIds", "relatedDimensionIds", "blocking", "rationale"], properties: { classification: { type: "string", enum: ["MISSING_MATERIAL_MILESTONE", "CONTEXTUAL_THEME", "STATE_LEGACY", "OUTSIDE_SCOPE", "INAPPROPRIATE_GRANULARITY", "ALREADY_REPRESENTED", "UNSUPPORTED_CANDIDATE"] }, relatedPhaseIds: { type: "array", items: { type: "string" } }, relatedDimensionIds: { type: "array", items: { type: "string" } }, blocking: { type: "boolean" }, rationale: { type: "string" } } } }
  }
} as const;

function defaultProvider(): V2ModelProvider {
  const client = new GoogleGenAI({ vertexai: true, project: PROJECT_ID, location: VERTEX_LOCATION, apiVersion: "v1" });
  return { generateContent: (request) => client.models.generateContent(request as never) as Promise<ProviderResponse> };
}

function responseText(response: ProviderResponse): string {
  const text = typeof response.text === "function" ? response.text() : response.text;
  if (!text?.trim()) throw new Error("Vertex returned an empty significance response.");
  return text.trim();
}

function assertSemanticReferences(proposal: SignificanceProposal, events: readonly CanonicalEventVersion[], scope: ScopeContract, map: ResearchMap): void {
  const eventIds = new Set(events.map((event) => event.eventVersionId));
  const phaseIds = new Set(map.phases.map((phase) => phase.phaseId));
  const dimensionIds = new Set(map.dimensions.map((dimension) => dimension.dimensionId));
  if (proposal.judgments.length !== eventIds.size || proposal.judgments.some((judgment) => !eventIds.has(judgment.eventVersionId)) || new Set(proposal.judgments.map((judgment) => judgment.eventVersionId)).size !== eventIds.size) throw new Error("Model must return exactly one judgment for every eligible event.");
  for (const judgment of proposal.judgments) {
    if (judgment.redundantWithEventVersionIds.some((id) => !eventIds.has(id) || id === judgment.eventVersionId)) throw new Error("Model returned an invalid redundancy reference.");
    if (judgment.phaseCoverage.some((cell) => !phaseIds.has(cell.phaseId)) || judgment.dimensionCoverage.some((cell) => !dimensionIds.has(cell.dimensionId))) throw new Error("Model returned coverage outside the locked Research Map.");
    const event = events.find((candidate) => candidate.eventVersionId === judgment.eventVersionId)!;
    for (const cell of judgment.phaseCoverage.filter((item) => item.relation !== "NONE")) {
      const phase = map.phases.find((item) => item.phaseId === cell.phaseId)!;
      if (!eventCompatibleWithPhase(scope, event, phase.label)) throw new Error(`Event ${event.eventVersionId} cannot cover temporally incompatible phase ${phase.phaseId}.`);
    }
  }
  for (const comparison of proposal.comparisons) if (!eventIds.has(comparison.preferredEventVersionId) || !eventIds.has(comparison.otherEventVersionId) || comparison.preferredEventVersionId === comparison.otherEventVersionId) throw new Error("Model returned an invalid comparative reference.");
  for (const finding of proposal.completenessFindings) if (finding.relatedPhaseIds.some((id) => !phaseIds.has(id)) || finding.relatedDimensionIds.some((id) => !dimensionIds.has(id))) throw new Error("Model returned an invalid omission reference.");
}

export async function evaluateHistoricalSignificance(input: {
  context: SelectionContext;
  scope: ScopeContract;
  researchMap: ResearchMap;
  eligibleEvents: readonly CanonicalEventVersion[];
  approvedClaims: readonly AtomicClaimVersion[];
  provider?: V2ModelProvider;
  deadlineAt?: number;
}): Promise<{ proposal: SignificanceProposal; execution: SelectionModelExecution }> {
  if (input.eligibleEvents.length < 1 || input.eligibleEvents.length > 200) throw new Error("Significance evaluation requires 1-200 eligible events.");
  const allowedClaims = new Set(input.eligibleEvents.flatMap((event) => [...event.coreClaimVersionIds, ...event.supportingClaimVersionIds]));
  const claims = input.approvedClaims.filter((claim) => allowedClaims.has(claim.claimVersionId) && ["SUPPORTED", "QUALIFIED", "STRUCTURALLY_VALID"].includes(claim.validationState)).map((claim) => ({ claimVersionId: claim.claimVersionId, assertion: claim.normalizedAssertion, type: claim.claimType, risk: claim.risk, qualifiers: claim.qualifiers }));
  const promptBase = [
    "You are the bounded comparative historical-significance evaluator for TiMELiNES V2-B. Return JSON only. You select among already verified candidates; you do not research or decide what happened.",
    "Classify every supplied candidate exactly once as ESSENTIAL, MAJOR, SUPPORTING, or EXCLUDE. ESSENTIAL means omission would materially mislead; MAJOR is important but not indispensable; SUPPORTING aids continuity; EXCLUDE is valid history inappropriate for this view.",
    "Evaluate turning-point value, causal importance, consequence, institutional importance, adoption/scale, explanatory value, topic relevance, historiographical prominence, relationship to later developments, and uniqueness using HIGH/MEDIUM/LOW/NONE findings. Do not calculate a universal score. comparativeRank is only a stable ordinal within this candidate set.",
    "Map coverage only to the exact locked phase/dimension IDs. PRIMARY means the event directly represents the cell; SUPPORTING cannot satisfy it alone. An event may not cover a phase outside its evidenced date interval. Do not distribute events evenly through time.",
    "Identify redundancy only when records appear to represent the same occurrence or the same event at a different granularity. Never merge merely similar titles or same-day distinct actions. Record material omissions; contextual themes are not fake events.",
    `LOCKED_SCOPE=${JSON.stringify({ id: input.scope.scopeContractId, title: input.scope.title, class: input.scope.topicClass, subject: input.scope.subjectDefinition, chronologyStart: input.scope.chronologyStart, chronologyEnd: input.scope.chronologyEnd, ongoingAsOf: input.scope.ongoingAsOf, exclusions: input.scope.explicitExclusions })}`,
    `LOCKED_RESEARCH_MAP=${JSON.stringify({ phases: input.researchMap.phases, dimensions: input.researchMap.dimensions })}`,
    `VERIFIED_CANDIDATES=${JSON.stringify(input.eligibleEvents.map((event) => ({ eventVersionId: event.eventVersionId, title: event.canonicalTitle, subtype: event.eventSubtype, temporal: event.temporal, actionKey: event.actionKey, primaryEntityKeys: event.primaryEntityKeys, locationKeys: event.locationKeys, coreClaimVersionIds: event.coreClaimVersionIds, supportingClaimVersionIds: event.supportingClaimVersionIds })))}`,
    `APPROVED_CLAIMS=${JSON.stringify(claims)}`
  ].join("\n\n");
  const provider = input.provider || defaultProvider();
  const inputArtifactIds = [input.scope.scopeContractId, input.researchMap.researchMapId, ...input.eligibleEvents.map((event) => event.eventVersionId)];
  let validationMessage = "";
  let lastError: unknown;
  for (let repairAttempt = 0; repairAttempt <= 1; repairAttempt += 1) {
    const prompt = `${promptBase}${validationMessage ? `\n\nVALIDATION_ERROR=${validationMessage}\nReturn a complete corrected JSON object without changing the locked inputs.` : ""}`;
    for (let transportAttempts = 1; transportAttempts <= 3; transportAttempts += 1) {
      const startedAt = Date.now();
      try {
        const timeout = Math.min(120_000, input.deadlineAt ? input.deadlineAt - Date.now() : 120_000);
        if (timeout <= 0) throw new Error("SIGNIFICANCE_DEADLINE_EXCEEDED");
        const response = await provider.generateContent({ model: VERTEX_MODEL, contents: prompt, config: { responseMimeType: "application/json", responseJsonSchema, temperature: 0, maxOutputTokens: 10_000, thinkingConfig: { thinkingBudget: 0 }, abortSignal: AbortSignal.timeout(timeout) } });
        const body = responseText(response as ProviderResponse);
        try {
          const proposal = significanceProposalSchema.parse(JSON.parse(body));
          assertSemanticReferences(proposal, input.eligibleEvents, input.scope, input.researchMap);
          const promptHash = sha256(prompt);
          const responseHash = sha256(body);
          const executionPayload = { artifactType: "SELECTION_MODEL_EXECUTION" as const, schemaVersion: V2_B_SCHEMA_VERSION, pipelineVersion: V2_B_PIPELINE_VERSION, policyVersion: V2_B_SELECTION_POLICY_VERSION, promptVersion: V2_B_PROMPT_VERSION, modelExecutionRef: null, parentArtifactIds: [input.scope.scopeContractId, input.researchMap.researchMapId], createdAt: input.context.createdAt, corpusId: input.context.corpusId, topicId: input.context.topicId, runId: input.context.runId, generation: input.context.generation, sourceKnowledgeRunId: input.context.sourceKnowledgeRunId, sourceKnowledgeBundle: { pipelineVersion: "factory-v2-a.10" as const, schemaVersion: "factory-v2-a.3" as const, policyVersion: "evidence-first-v2-a.9" as const, promptVersion: "factory-v2-a-prompts.8" as const }, executionMode: "SHADOW" as const, publicationEligible: false as const, governanceSubmissionAllowed: false as const, immutable: true as const, stage: "SIGNIFICANCE_SELECTION" as const, inputArtifactIds, inputHash: payloadHash({ scope: input.scope.payloadHash, map: input.researchMap.payloadHash, events: input.eligibleEvents.map((event) => event.payloadHash), claims: claims.map((claim) => claim.claimVersionId) }), promptHash, responseHash, validationState: repairAttempt ? "REPAIRED" as const : "VALID" as const, boundedResponse: body.slice(0, 80_000), responseTruncated: body.length > 80_000, repairAttempt, transportAttempts, usage: { inputTokens: (response as ProviderResponse).usageMetadata?.promptTokenCount ?? null, outputTokens: (response as ProviderResponse).usageMetadata?.candidatesTokenCount ?? null, totalTokens: (response as ProviderResponse).usageMetadata?.totalTokenCount ?? null, monetaryCost: null, costMeasurement: "NOT_MEASURABLE" as const }, startedAt: new Date(startedAt).toISOString(), completedAt: new Date().toISOString(), latencyMs: Date.now() - startedAt };
          const executionId = contentAddressedId("selection-execution", executionPayload);
          const execution = selectionModelExecutionSchema.parse(attachPayloadHash({ artifactId: executionId, executionId, ...executionPayload }));
          return { proposal, execution };
        } catch (error) {
          lastError = error;
          validationMessage = error instanceof z.ZodError ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ").slice(0, 4000) : String(error).slice(0, 4000);
          break;
        }
      } catch (error) {
        lastError = error;
        if (transportAttempts === 3) break;
      }
    }
  }
  throw new Error(`Significance evaluation failed within bounded repair/transport limits: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}
