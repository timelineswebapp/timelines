import { z } from "zod";
import type { AtomicClaimVersion, CanonicalEventVersion, EvidenceSegment, ScopeContract } from "../factory-v2/contracts";
import type { SelectionArtifact } from "../factory-v2/contracts/assembly";
import { historicalDateSchema } from "../factory-v2/contracts/common";
import { attachPayloadHash, contentAddressedId } from "../factory-v2/hashing";

export const EVIDENCE_FIRST_PIPELINE_VERSION = "evidence-first-generation-v1" as const;
export const EVENT_LOCK_SCHEMA_VERSION = "event-lock-v1" as const;
export const COMPOSITION_SCHEMA_VERSION = "locked-composition-v1" as const;

const id = z.string().trim().min(3).max(200);
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const unique = <T>(values: T[]) => values.length === new Set(values).size;

export const eventLockEntrySchema = z.object({
  ordinal: z.number().int().positive().max(20),
  eventVersionId: id,
  canonicalTitle: z.string().trim().min(3).max(300),
  temporal: z.object({ start: historicalDateSchema, end: historicalDateSchema.nullable(), uncertainty: z.string().trim().min(3).max(800).nullable() }).strict(),
  significanceClass: z.enum(["ESSENTIAL", "MAJOR", "SUPPORTING"]),
  selectionRationale: z.string().trim().min(10).max(2000),
  coreClaimVersionIds: z.array(id).min(1).max(20).refine(unique),
  supportingClaimVersionIds: z.array(id).max(40).refine(unique),
  evidenceSegmentIds: z.array(id).min(1).max(60).refine(unique),
  sourceSnapshotIds: z.array(id).min(1).max(60).refine(unique)
}).strict();

export const eventLockSchema = z.object({
  artifactId: id,
  eventLockId: id,
  artifactType: z.literal("EVENT_LOCK"),
  schemaVersion: z.literal(EVENT_LOCK_SCHEMA_VERSION),
  pipelineVersion: z.literal(EVIDENCE_FIRST_PIPELINE_VERSION),
  corpusId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/u),
  topicId: id,
  generation: z.number().int().positive(),
  generationReleaseId: id,
  scopeContractId: id,
  scopePayloadHash: hash,
  completedKnowledgeSetId: id,
  completedKnowledgeSetHash: hash,
  selectionArtifactId: id,
  selectionPayloadHash: hash,
  parentArtifactIds: z.array(id).length(3).refine(unique),
  events: z.array(eventLockEntrySchema).min(1).max(20),
  executionMode: z.literal("SHADOW"),
  publicationEligible: z.literal(false),
  immutable: z.literal(true),
  governanceSubmissionAllowed: z.literal(false),
  payloadHash: hash
}).strict().superRefine((lock, context) => {
  if (lock.artifactId !== lock.eventLockId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifactId"], message: "Artifact identity must equal Event Lock identity." });
  if (lock.events.some((event, index) => event.ordinal !== index + 1)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["events"], message: "Event Lock ordinals must be complete and ordered." });
  if (!unique(lock.events.map((event) => event.eventVersionId))) context.addIssue({ code: z.ZodIssueCode.custom, path: ["events"], message: "Event Lock membership must be unique." });
});

export type EventLock = z.infer<typeof eventLockSchema>;

export const constrainedCompositionProposalSchema = z.object({
  eventLockId: id,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(60).max(1600),
  category: z.string().trim().min(2).max(80),
  tags: z.array(z.string().trim().min(2).max(80)).min(2).max(12).refine(unique),
  events: z.array(z.object({
    eventVersionId: id,
    description: z.string().trim().min(30).max(1600),
    evidenceSummary: z.string().trim().min(20).max(800),
    location: z.string().trim().max(240).nullable(),
    tags: z.array(z.string().trim().min(2).max(80)).min(1).max(8).refine(unique),
    claimVersionIdsUsed: z.array(id).min(1).max(60).refine(unique),
    evidenceSegmentIdsUsed: z.array(id).min(1).max(60).refine(unique)
  }).strict()).min(1).max(20)
}).strict();

export type ConstrainedCompositionProposal = z.infer<typeof constrainedCompositionProposalSchema>;

export const lockedCompositionSchema = constrainedCompositionProposalSchema.extend({
  artifactId: id,
  compositionId: id,
  artifactType: z.literal("LOCKED_COMPOSITION"),
  schemaVersion: z.literal(COMPOSITION_SCHEMA_VERSION),
  pipelineVersion: z.literal(EVIDENCE_FIRST_PIPELINE_VERSION),
  corpusId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/u),
  topicId: id,
  generation: z.number().int().positive(),
  generationReleaseId: id,
  eventLockPayloadHash: hash,
  parentArtifactIds: z.array(id).length(1),
  executionMode: z.literal("SHADOW"),
  publicationEligible: z.literal(false),
  immutable: z.literal(true),
  governanceSubmissionAllowed: z.literal(false),
  payloadHash: hash
}).strict();

export type LockedComposition = z.infer<typeof lockedCompositionSchema>;

function canonical(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function buildEventLock(input: {
  corpusId: string;
  topicId: string;
  generation: number;
  generationReleaseId: string;
  scope: ScopeContract;
  completedKnowledgeSet: { completedKnowledgeSetId: string; payloadHash: string };
  selection: SelectionArtifact;
  events: readonly CanonicalEventVersion[];
  claims: readonly AtomicClaimVersion[];
  evidenceSegments: readonly EvidenceSegment[];
}): EventLock {
  if (input.selection.status !== "PASS") throw new Error("EVENT_LOCK_SELECTION_NOT_PASSING");
  if (input.selection.scopeContractId !== input.scope.scopeContractId || input.selection.scopePayloadHash !== input.scope.payloadHash) throw new Error("EVENT_LOCK_SCOPE_LINEAGE_MISMATCH");
  if (input.selection.completedKnowledgeSetId !== input.completedKnowledgeSet.completedKnowledgeSetId || input.selection.completedKnowledgeSetHash !== input.completedKnowledgeSet.payloadHash) throw new Error("EVENT_LOCK_KNOWLEDGE_LINEAGE_MISMATCH");
  const events = new Map(input.events.map((event) => [event.eventVersionId, event]));
  const claims = new Map(input.claims.map((claim) => [claim.claimVersionId, claim]));
  const segments = new Map(input.evidenceSegments.map((segment) => [segment.evidenceSegmentId, segment]));
  const entries = input.selection.selectedEventVersionIds.map((eventVersionId, index) => {
    const event = events.get(eventVersionId);
    const assessment = input.selection.assessments.find((item) => item.eventVersionId === eventVersionId);
    if (!event || !assessment || assessment.selectionState !== "SELECTED" || !assessment.eligible || assessment.significanceClass === "EXCLUDE") throw new Error(`EVENT_LOCK_INVALID_SELECTION_MEMBER:${eventVersionId}`);
    const claimIds = canonical([...event.coreClaimVersionIds, ...event.supportingClaimVersionIds]);
    const eventClaims = claimIds.map((claimId) => claims.get(claimId));
    if (eventClaims.some((claim) => !claim)) throw new Error(`EVENT_LOCK_MISSING_CLAIM:${eventVersionId}`);
    const evidenceSegmentIds = canonical(eventClaims.flatMap((claim) => claim!.extractedFromSegmentIds));
    const sourceSnapshotIds = canonical(evidenceSegmentIds.map((segmentId) => segments.get(segmentId)?.sourceSnapshotId || ""));
    if (evidenceSegmentIds.length === 0 || sourceSnapshotIds.includes("")) throw new Error(`EVENT_LOCK_MISSING_EVIDENCE:${eventVersionId}`);
    return {
      ordinal: index + 1,
      eventVersionId,
      canonicalTitle: event.canonicalTitle,
      temporal: event.temporal,
      significanceClass: assessment.significanceClass as "ESSENTIAL" | "MAJOR" | "SUPPORTING",
      selectionRationale: assessment.selectionRationale,
      coreClaimVersionIds: canonical(event.coreClaimVersionIds),
      supportingClaimVersionIds: canonical(event.supportingClaimVersionIds),
      evidenceSegmentIds,
      sourceSnapshotIds
    };
  });
  const semantic = {
    artifactType: "EVENT_LOCK",
    schemaVersion: EVENT_LOCK_SCHEMA_VERSION,
    pipelineVersion: EVIDENCE_FIRST_PIPELINE_VERSION,
    corpusId: input.corpusId,
    topicId: input.topicId,
    generation: input.generation,
    generationReleaseId: input.generationReleaseId,
    scopeContractId: input.scope.scopeContractId,
    scopePayloadHash: input.scope.payloadHash,
    completedKnowledgeSetId: input.completedKnowledgeSet.completedKnowledgeSetId,
    completedKnowledgeSetHash: input.completedKnowledgeSet.payloadHash,
    selectionArtifactId: input.selection.selectionArtifactId,
    selectionPayloadHash: input.selection.payloadHash,
    parentArtifactIds: [input.scope.scopeContractId, input.completedKnowledgeSet.completedKnowledgeSetId, input.selection.selectionArtifactId],
    events: entries,
    executionMode: "SHADOW",
    publicationEligible: false,
    immutable: true,
    governanceSubmissionAllowed: false
  } as const;
  const eventLockId = contentAddressedId("event-lock", semantic);
  return eventLockSchema.parse(attachPayloadHash({ artifactId: eventLockId, eventLockId, ...semantic }));
}

export function sealConstrainedComposition(input: {
  eventLock: EventLock;
  proposal: ConstrainedCompositionProposal;
}): LockedComposition {
  const lock = eventLockSchema.parse(input.eventLock);
  const proposal = constrainedCompositionProposalSchema.parse(input.proposal);
  if (proposal.eventLockId !== lock.eventLockId) throw new Error("COMPOSITION_EVENT_LOCK_MISMATCH");
  if (proposal.events.length !== lock.events.length) throw new Error("COMPOSITION_MEMBERSHIP_CHANGED");
  for (let index = 0; index < lock.events.length; index += 1) {
    const locked = lock.events[index]!;
    const composed = proposal.events[index]!;
    if (composed.eventVersionId !== locked.eventVersionId) throw new Error("COMPOSITION_MEMBERSHIP_OR_ORDER_CHANGED");
    const allowedClaims = new Set([...locked.coreClaimVersionIds, ...locked.supportingClaimVersionIds]);
    const usedClaims = new Set(composed.claimVersionIdsUsed);
    if (locked.coreClaimVersionIds.some((claimId) => !usedClaims.has(claimId)) || composed.claimVersionIdsUsed.some((claimId) => !allowedClaims.has(claimId))) throw new Error(`COMPOSITION_CLAIM_BOUNDARY_VIOLATION:${locked.eventVersionId}`);
    const allowedEvidence = new Set(locked.evidenceSegmentIds);
    if (composed.evidenceSegmentIdsUsed.some((segmentId) => !allowedEvidence.has(segmentId))) throw new Error(`COMPOSITION_EVIDENCE_BOUNDARY_VIOLATION:${locked.eventVersionId}`);
    if (composed.description.toLocaleLowerCase("en-US") === composed.evidenceSummary.toLocaleLowerCase("en-US")) throw new Error(`COMPOSITION_EVIDENCE_SUMMARY_DUPLICATES_PROSE:${locked.eventVersionId}`);
  }
  const semantic = {
    ...proposal,
    artifactType: "LOCKED_COMPOSITION",
    schemaVersion: COMPOSITION_SCHEMA_VERSION,
    pipelineVersion: EVIDENCE_FIRST_PIPELINE_VERSION,
    corpusId: lock.corpusId,
    topicId: lock.topicId,
    generation: lock.generation,
    generationReleaseId: lock.generationReleaseId,
    eventLockPayloadHash: lock.payloadHash,
    parentArtifactIds: [lock.eventLockId],
    executionMode: "SHADOW",
    publicationEligible: false,
    immutable: true,
    governanceSubmissionAllowed: false
  } as const;
  const compositionId = contentAddressedId("locked-composition", semantic);
  return lockedCompositionSchema.parse(attachPayloadHash({ artifactId: compositionId, compositionId, ...semantic }));
}
