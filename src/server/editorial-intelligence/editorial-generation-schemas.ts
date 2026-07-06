import { z } from "zod";
import type { GeneratedSection, GenerationUnit } from "@/src/server/editorial-intelligence/editorial-generation-contracts";

const sentenceSchema = z.object({
  sequence: z.number().int().positive().max(100),
  text: z.string().min(1).max(1000),
  milestoneIds: z.array(z.string()).min(1).max(200),
  claimIds: z.array(z.string()).min(1).max(200)
}).strict();

const paragraphSchema = z.object({
  sequence: z.number().int().positive().max(200),
  milestoneIds: z.array(z.string()).min(1).max(200),
  sentences: z.array(sentenceSchema).min(1).max(100)
}).strict();

const textSchema = z.object({
  text: z.string().min(1).max(500),
  milestoneIds: z.array(z.string()).min(1).max(200),
  claimIds: z.array(z.string()).min(1).max(200)
}).strict();

const sectionSchema = z.object({
  paragraphs: z.array(paragraphSchema).min(1).max(200)
}).strict();

export function editorialGenerationOutputSchema(unit: GenerationUnit): Record<string, unknown> {
  const claimEnum = [...unit.claimIds];
  const milestoneEnum = [...unit.milestoneIds];
  const lineage = {
    milestoneIds: { type: "array", minItems: 1, maxItems: 200, items: { enum: milestoneEnum } },
    claimIds: { type: "array", minItems: 1, maxItems: 200, items: { enum: claimEnum } }
  };
  if (unit.kind === "title" || unit.kind === "subtitle") {
    return {
      type: "object", additionalProperties: false,
      required: ["text", "milestoneIds", "claimIds"],
      properties: { text: { type: "string", minLength: 1, maxLength: 500 }, ...lineage }
    };
  }
  return {
    type: "object", additionalProperties: false, required: ["paragraphs"],
    properties: {
      paragraphs: {
        type: "array", minItems: 1, maxItems: 200,
        items: {
          type: "object", additionalProperties: false,
          required: ["sequence", "milestoneIds", "sentences"],
          properties: {
            sequence: { type: "integer", minimum: 1, maximum: 200 },
            milestoneIds: lineage.milestoneIds,
            sentences: {
              type: "array", minItems: 1, maxItems: 100,
              items: {
                type: "object", additionalProperties: false,
                required: ["sequence", "text", "milestoneIds", "claimIds"],
                properties: { sequence: { type: "integer", minimum: 1, maximum: 100 }, text: { type: "string", minLength: 1, maxLength: 1000 }, ...lineage }
              }
            }
          }
        }
      }
    }
  };
}

export function parseGeneratedSection(unit: GenerationUnit, output: Record<string, unknown>): GeneratedSection {
  if (unit.kind === "title" || unit.kind === "subtitle") {
    const value = textSchema.parse(output);
    return { unit, ...value };
  }
  const value = sectionSchema.parse(output);
  return { unit, paragraphs: value.paragraphs };
}
