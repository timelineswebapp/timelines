import { GoogleGenAI } from "@google/genai";
import { PROJECT_ID, VERTEX_LOCATION, VERTEX_MODEL } from "../config";
import type { AtomicClaimVersion, EvidenceSegment } from "../factory-v2/contracts";
import { payloadHash, sha256 } from "../factory-v2/hashing";
import { constrainedCompositionProposalSchema, sealConstrainedComposition, type ConstrainedCompositionProposal, type EventLock, type LockedComposition } from "./contracts";

export const CONSTRAINED_COMPOSITION_PROMPT_VERSION = "evidence-first-composition-v1" as const;

type ProviderResponse = {
  text?: string | (() => string);
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
};

export type CompositionProvider = {
  generateContent(request: Record<string, unknown>): Promise<ProviderResponse>;
};

export type CompositionExecution = {
  executionId: string;
  stage: "CONSTRAINED_COMPOSITION";
  promptVersion: typeof CONSTRAINED_COMPOSITION_PROMPT_VERSION;
  inputHash: string;
  promptHash: string;
  responseHash: string;
  validationState: "VALID" | "REPAIRED";
  repairAttempt: number;
  transportAttempts: number;
  latencyMs: number;
  usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null; monetaryCost: null; costMeasurement: "NOT_MEASURABLE" };
};

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["eventLockId", "title", "description", "category", "tags", "events"],
  properties: {
    eventLockId: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    category: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    events: { type: "array", items: { type: "object", additionalProperties: false, required: ["eventVersionId", "description", "evidenceSummary", "location", "tags", "claimVersionIdsUsed", "evidenceSegmentIdsUsed"], properties: {
      eventVersionId: { type: "string" }, description: { type: "string" }, evidenceSummary: { type: "string" }, location: { anyOf: [{ type: "string" }, { type: "null" }] }, tags: { type: "array", items: { type: "string" } }, claimVersionIdsUsed: { type: "array", items: { type: "string" } }, evidenceSegmentIdsUsed: { type: "array", items: { type: "string" } }
    } } }
  }
} as const;

function defaultProvider(): CompositionProvider {
  const client = new GoogleGenAI({ vertexai: true, project: PROJECT_ID, location: VERTEX_LOCATION, apiVersion: "v1" });
  return { generateContent: (request) => client.models.generateContent(request as never) as Promise<ProviderResponse> };
}

function responseText(response: ProviderResponse): string {
  const text = typeof response.text === "function" ? response.text() : response.text;
  if (!text?.trim()) throw new Error("Composition provider returned an empty response.");
  if (text.length > 80_000) throw new Error("Composition provider response exceeded the bounded response size.");
  return text.trim();
}

function promptInput(lock: EventLock, claims: readonly AtomicClaimVersion[], evidenceSegments: readonly EvidenceSegment[]) {
  const claimMap = new Map(claims.map((claim) => [claim.claimVersionId, claim]));
  const evidenceMap = new Map(evidenceSegments.map((segment) => [segment.evidenceSegmentId, segment]));
  return {
    eventLockId: lock.eventLockId,
    events: lock.events.map((event) => ({
      eventVersionId: event.eventVersionId,
      canonicalTitle: event.canonicalTitle,
      temporal: event.temporal,
      significanceClass: event.significanceClass,
      selectionRationale: event.selectionRationale,
      claims: [...event.coreClaimVersionIds, ...event.supportingClaimVersionIds].map((claimId) => {
        const claim = claimMap.get(claimId);
        if (!claim) throw new Error(`COMPOSITION_INPUT_MISSING_CLAIM:${claimId}`);
        return { claimVersionId: claim.claimVersionId, assertion: claim.normalizedAssertion, core: event.coreClaimVersionIds.includes(claimId), evidenceSegmentIds: claim.extractedFromSegmentIds };
      }),
      evidence: event.evidenceSegmentIds.map((segmentId) => {
        const segment = evidenceMap.get(segmentId);
        if (!segment) throw new Error(`COMPOSITION_INPUT_MISSING_EVIDENCE:${segmentId}`);
        return { evidenceSegmentId: segment.evidenceSegmentId, exactText: segment.exactText };
      })
    }))
  };
}

function buildPrompt(input: ReturnType<typeof promptInput>, repair: string | null): string {
  return [
    `Policy ${CONSTRAINED_COMPOSITION_PROMPT_VERSION}.`,
    "Write reader-facing timeline prose only from the immutable Event Lock below.",
    "Return exactly one output event for every locked event, in the same order, using its exact eventVersionId.",
    "Do not add, remove, merge, split, rename, redraft, or reorder historical events. Do not state any historical fact that is not present in the supplied claims and evidence.",
    "Each output event must list every core claim ID and only supplied claim/evidence IDs actually used. Dates and event titles are server-owned and therefore absent from the output contract.",
    "Descriptions explain what happened and why it matters. Evidence summaries describe what the cited evidence establishes and must not repeat the description.",
    repair ? `The previous response failed validation. Correct only these contract failures: ${repair}` : "",
    JSON.stringify(input)
  ].filter(Boolean).join("\n\n");
}

export async function composeFromEventLock(input: {
  eventLock: EventLock;
  claims: readonly AtomicClaimVersion[];
  evidenceSegments: readonly EvidenceSegment[];
  provider?: CompositionProvider;
  deadlineAt: number;
}): Promise<{ composition: LockedComposition; proposal: ConstrainedCompositionProposal; execution: CompositionExecution }> {
  const provider = input.provider || defaultProvider();
  const boundedInput = promptInput(input.eventLock, input.claims, input.evidenceSegments);
  const inputHash = payloadHash(boundedInput);
  const startedAt = Date.now();
  let lastFailure = "";
  let transportAttempts = 0;
  let lastTransportFailure = "";
  let usageComplete = true;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  for (let repairAttempt = 0; repairAttempt <= 1; repairAttempt += 1) {
    if (Date.now() >= input.deadlineAt) throw new Error("CONSTRAINED_COMPOSITION_DEADLINE_EXCEEDED");
    const prompt = buildPrompt(boundedInput, repairAttempt === 0 ? null : lastFailure);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (Date.now() >= input.deadlineAt) throw new Error("CONSTRAINED_COMPOSITION_DEADLINE_EXCEEDED");
      transportAttempts += 1;
      try {
        const response = await provider.generateContent({
          model: VERTEX_MODEL,
          contents: prompt,
          config: { temperature: 0.1, maxOutputTokens: 16384, responseMimeType: "application/json", responseJsonSchema, abortSignal: AbortSignal.timeout(Math.min(120_000, input.deadlineAt - Date.now())) }
        });
        if (response.usageMetadata?.promptTokenCount === undefined || response.usageMetadata.candidatesTokenCount === undefined || response.usageMetadata.totalTokenCount === undefined) usageComplete = false;
        else {
          totalInputTokens += response.usageMetadata.promptTokenCount;
          totalOutputTokens += response.usageMetadata.candidatesTokenCount;
          totalTokens += response.usageMetadata.totalTokenCount;
        }
        const text = responseText(response);
        try {
          const proposal = constrainedCompositionProposalSchema.parse(JSON.parse(text));
          const composition = sealConstrainedComposition({ eventLock: input.eventLock, proposal });
          const execution: CompositionExecution = {
            executionId: sha256(`${input.eventLock.eventLockId}:${inputHash}:${sha256(prompt)}:${sha256(text)}:${repairAttempt}`),
            stage: "CONSTRAINED_COMPOSITION",
            promptVersion: CONSTRAINED_COMPOSITION_PROMPT_VERSION,
            inputHash,
            promptHash: sha256(prompt),
            responseHash: sha256(text),
            validationState: repairAttempt === 0 ? "VALID" : "REPAIRED",
            repairAttempt,
            transportAttempts,
            latencyMs: Date.now() - startedAt,
            usage: { inputTokens: usageComplete ? totalInputTokens : null, outputTokens: usageComplete ? totalOutputTokens : null, totalTokens: usageComplete ? totalTokens : null, monetaryCost: null, costMeasurement: "NOT_MEASURABLE" }
          };
          return { composition, proposal, execution };
        } catch (error) {
          lastFailure = error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);
          break;
        }
      } catch (error) {
        lastTransportFailure = error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);
        if (attempt === 3) throw new Error(`CONSTRAINED_COMPOSITION_TRANSPORT_EXHAUSTED:${lastTransportFailure}`);
      }
    }
  }
  throw new Error(`CONSTRAINED_COMPOSITION_FAILED:${lastFailure}`);
}
