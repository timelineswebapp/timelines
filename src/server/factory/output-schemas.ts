import { z } from "zod";
import type { FactoryObjectType } from "@/src/server/factory/contracts";

const citationSchema = z.object({
  sourceId: z.string().min(1).optional(),
  title: z.string().min(1),
  url: z.string().url().optional(),
  locator: z.string().min(1).optional(),
  quote: z.string().min(1).max(1200).optional()
});

const evidenceSchema = z.object({
  claim: z.string().min(1),
  citations: z.array(citationSchema).min(1)
});

const baseOutputSchema = z.object({
  summary: z.string().min(1),
  evidence: z.array(evidenceSchema).min(1),
  sources: z.array(citationSchema).min(1),
  confidence: z.number().min(0).max(1),
  boundary: z.object({
    factoryOwned: z.literal(true),
    publicationAllowed: z.literal(false),
    governanceSubmissionAllowed: z.literal(false)
  })
});

const candidateSchema = baseOutputSchema.extend({
  candidates: z.array(
    z.object({
      title: z.string().min(1),
      objectType: z
        .enum([
          "candidate_historical_object",
          "candidate_milestone",
          "candidate_participation",
          "candidate_relationship",
          "candidate_source",
          "candidate_context_record"
        ])
        .optional(),
      payload: z.record(z.unknown()),
      evidence: z.array(evidenceSchema).min(1),
      sources: z.array(citationSchema).min(1)
    })
  )
});

export type ValidatedFactoryWorkerOutput = z.infer<typeof candidateSchema>;

function stringField(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function assertSourceTraceability(output: ValidatedFactoryWorkerOutput): void {
  const sourceIds = new Set(output.sources.map((source) => source.sourceId).filter((sourceId): sourceId is string => Boolean(sourceId)));
  if (sourceIds.size === 0) return;
  const allEvidence = [
    ...output.evidence,
    ...output.candidates.flatMap((candidate) => candidate.evidence)
  ];
  for (const evidence of allEvidence) {
    for (const citation of evidence.citations) {
      if (citation.sourceId && !sourceIds.has(citation.sourceId)) {
        throw new Error(`Evidence citation references unknown sourceId ${citation.sourceId}.`);
      }
    }
  }
}

function assertCandidatePayloadQuality(workerKey: string, candidate: ValidatedFactoryWorkerOutput["candidates"][number]): void {
  if (Object.keys(candidate.payload).length === 0) {
    throw new Error(`Worker ${workerKey} emitted candidate ${candidate.title} with empty payload.`);
  }
  if (candidate.objectType === "candidate_milestone" && !stringField(candidate.payload, "date")) {
    throw new Error(`Milestone candidate ${candidate.title} is missing a date.`);
  }
  if (candidate.objectType === "candidate_relationship") {
    for (const field of ["sourceAuthorityRef", "targetAuthorityRef", "relationshipType", "summary"]) {
      if (!candidate.payload[field]) {
        throw new Error(`Relationship candidate ${candidate.title} is missing ${field}.`);
      }
    }
  }
  if (candidate.objectType === "candidate_historical_object") {
    for (const field of ["name", "type", "summary"]) {
      if (!stringField(candidate.payload, field)) {
        throw new Error(`Historical object candidate ${candidate.title} is missing ${field}.`);
      }
    }
  }
  if (candidate.objectType === "candidate_source") {
    for (const field of ["publisher", "credibility"]) {
      if (!candidate.payload[field]) {
        throw new Error(`Source candidate ${candidate.title} is missing ${field}.`);
      }
    }
  }
}

export function factoryWorkerOutputContractSchema(workerKey: string): Record<string, unknown> {
  const citation = {
    type: "object",
    required: ["sourceId", "title"],
    properties: {
      sourceId: { type: "string", minLength: 1 },
      title: { type: "string", minLength: 1 },
      url: { type: "string" },
      locator: { type: "string" },
      quote: { type: "string" }
    }
  };
  const evidence = {
    type: "object",
    required: ["claim", "citations"],
    properties: {
      claim: { type: "string", minLength: 1 },
      citations: { type: "array", minItems: 1, items: citation }
    }
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "evidence", "sources", "confidence", "boundary", "candidates"],
    properties: {
      summary: { type: "string", minLength: 1 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      boundary: {
        type: "object",
        required: ["factoryOwned", "publicationAllowed", "governanceSubmissionAllowed"],
        properties: {
          factoryOwned: { const: true },
          publicationAllowed: { const: false },
          governanceSubmissionAllowed: { const: false }
        }
      },
      evidence: { type: "array", minItems: 1, items: evidence },
      sources: { type: "array", minItems: 1, items: citation },
      candidates: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "objectType", "payload", "evidence", "sources"],
          properties: {
            title: { type: "string", minLength: 1 },
            objectType: { type: "string" },
            payload: { type: "object" },
            evidence: { type: "array", minItems: 1, items: evidence },
            sources: { type: "array", minItems: 1, items: citation }
          }
        }
      }
    },
    workerKey
  };
}

export function validateFactoryWorkerOutput(input: {
  workerKey: string;
  allowedObjectTypes: FactoryObjectType[];
  output: Record<string, unknown>;
}): ValidatedFactoryWorkerOutput {
  const parsed = candidateSchema.parse(input.output);
  const allowed = new Set(input.allowedObjectTypes);
  if (input.allowedObjectTypes.length > 0 && parsed.candidates.length === 0) {
    throw new Error(`Worker ${input.workerKey} emitted no candidates.`);
  }
  assertSourceTraceability(parsed);
  for (const candidate of parsed.candidates) {
    if (candidate.objectType && !allowed.has(candidate.objectType)) {
      throw new Error(`Worker ${input.workerKey} emitted forbidden candidate object type ${candidate.objectType}.`);
    }
    assertCandidatePayloadQuality(input.workerKey, candidate);
  }
  return parsed;
}
