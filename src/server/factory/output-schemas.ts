import { z } from "zod";
import type { FactoryObjectType } from "@/src/server/factory/contracts";

const citationSchema = z.object({
  sourceId: z.string().min(1).optional(),
  evidenceRecordId: z.string().min(1).optional(),
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

export class FactoryWorkerOutputValidationError extends Error {
  diagnostics: Record<string, unknown>;

  constructor(message: string, diagnostics: Record<string, unknown> = {}) {
    super(message);
    this.name = "FactoryWorkerOutputValidationError";
    this.diagnostics = {
      failureClass: "output_validation_failed",
      validationErrors: [message],
      ...diagnostics
    };
  }
}

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
        throw new FactoryWorkerOutputValidationError(`Evidence citation references unknown sourceId ${citation.sourceId}.`);
      }
    }
  }
}

function sourceHost(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.host || null;
  } catch {
    return null;
  }
}

function normalizeCandidateSourcePayload(candidate: ValidatedFactoryWorkerOutput["candidates"][number]): string[] {
  if (candidate.objectType !== "candidate_source") {
    return [];
  }

  const normalizedFields: string[] = [];
  const publisher = stringField(candidate.payload, "publisher");
  if (publisher) {
    candidate.payload.publisher = publisher;
    return normalizedFields;
  }

  const host = sourceHost(candidate.payload.url) || sourceHost(candidate.sources[0]?.url);
  candidate.payload.publisher = host || "Unknown publisher";
  normalizedFields.push("publisher");
  candidate.payload.normalizationWarnings = [
    ...(
      Array.isArray(candidate.payload.normalizationWarnings)
        ? candidate.payload.normalizationWarnings.filter((warning): warning is string => typeof warning === "string")
        : []
    ),
    host
      ? "Publisher was normalized from source URL host for Factory candidate validation."
      : "Publisher was normalized to Unknown publisher for Factory candidate validation."
  ];
  return normalizedFields;
}

function assertCandidatePayloadQuality(workerKey: string, candidate: ValidatedFactoryWorkerOutput["candidates"][number]): void {
  if (Object.keys(candidate.payload).length === 0) {
    throw new FactoryWorkerOutputValidationError(`Worker ${workerKey} emitted candidate ${candidate.title} with empty payload.`);
  }
  if (candidate.objectType === "candidate_milestone" && !stringField(candidate.payload, "date")) {
    throw new FactoryWorkerOutputValidationError(`Milestone candidate ${candidate.title} is missing a date.`);
  }
  if (candidate.objectType === "candidate_relationship") {
    for (const field of ["sourceAuthorityRef", "targetAuthorityRef", "relationshipType", "summary"]) {
      if (!candidate.payload[field]) {
        throw new FactoryWorkerOutputValidationError(`Relationship candidate ${candidate.title} is missing ${field}.`);
      }
    }
  }
  if (candidate.objectType === "candidate_historical_object") {
    for (const field of ["name", "type", "summary"]) {
      if (!stringField(candidate.payload, field)) {
        throw new FactoryWorkerOutputValidationError(`Historical object candidate ${candidate.title} is missing ${field}.`);
      }
    }
  }
  if (candidate.objectType === "candidate_source") {
    for (const field of ["publisher", "credibility"]) {
      if (!candidate.payload[field]) {
        throw new FactoryWorkerOutputValidationError(`Source candidate ${candidate.title} is missing ${field}.`);
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
  let parsed: ValidatedFactoryWorkerOutput;
  try {
    parsed = candidateSchema.parse(input.output);
  } catch (error) {
    const validationErrors = error instanceof z.ZodError ? error.issues.map((issue) => issue.message) : ["Generated output failed schema validation."];
    throw new FactoryWorkerOutputValidationError("Generated output failed schema validation.", { validationErrors });
  }
  const allowed = new Set(input.allowedObjectTypes);
  if (input.allowedObjectTypes.length > 0 && parsed.candidates.length === 0) {
    throw new FactoryWorkerOutputValidationError(`Worker ${input.workerKey} emitted no candidates.`);
  }
  assertSourceTraceability(parsed);
  const normalizedFields: string[] = [];
  for (const candidate of parsed.candidates) {
    if (candidate.objectType && !allowed.has(candidate.objectType)) {
      throw new FactoryWorkerOutputValidationError(`Worker ${input.workerKey} emitted forbidden candidate object type ${candidate.objectType}.`);
    }
    normalizedFields.push(...normalizeCandidateSourcePayload(candidate));
    try {
      assertCandidatePayloadQuality(input.workerKey, candidate);
    } catch (error) {
      if (error instanceof FactoryWorkerOutputValidationError && normalizedFields.length > 0) {
        error.diagnostics = {
          ...error.diagnostics,
          normalizedFields: Array.from(new Set(normalizedFields))
        };
      }
      throw error;
    }
  }
  if (normalizedFields.length > 0) {
    (parsed as ValidatedFactoryWorkerOutput & { normalizedFields?: string[] }).normalizedFields = Array.from(new Set(normalizedFields));
  }
  return parsed;
}
