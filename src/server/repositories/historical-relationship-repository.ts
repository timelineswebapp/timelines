import type { AuthorityRef, EvidenceRef } from "@/src/server/governance/contracts";
import { assertGovernanceDecisionRequired } from "@/src/server/governance/lifecycle";
import { verifyApprovedGovernanceDecision } from "@/src/server/repositories/governance-repository";
import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";

export type HistoricalRelationshipType =
  | "influences"
  | "influenced_by"
  | "member_of"
  | "contains"
  | "located_in"
  | "succeeds"
  | "preceded_by"
  | "owns"
  | "owned_by"
  | "related_to";

export type HistoricalRelationshipRecord = {
  relationshipId: string;
  sourceAuthorityRef: AuthorityRef;
  targetAuthorityRef: AuthorityRef;
  relationshipType: HistoricalRelationshipType;
  summary: string;
  evidenceRefs: EvidenceRef[];
  provenance: Record<string, unknown>;
  lifecycleStatus: "established" | "revised" | "disputed" | "merged" | "retired" | "preserved";
  authorityState: "active" | "inactive";
  revision: number;
  mergedIntoId: string | null;
  disputeReason: string | null;
  retirementReason: string | null;
  preservationReason: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
};

type RelationshipInput = {
  sourceAuthorityRef: AuthorityRef;
  targetAuthorityRef: AuthorityRef;
  relationshipType: HistoricalRelationshipType;
  summary: string;
  evidenceRefs: EvidenceRef[];
  provenance: Record<string, unknown>;
  actor: string;
  reason: string;
  governanceDecisionId: string;
};

type RelationshipActionInput = {
  reason: string;
  continuityPath?: Record<string, unknown>;
  provenance: Record<string, unknown>;
  actor: string;
  governanceDecisionId: string;
};

function assertDistinctEndpoints(input: Pick<RelationshipInput, "sourceAuthorityRef" | "targetAuthorityRef">): void {
  if (
    input.sourceAuthorityRef.authorityType === input.targetAuthorityRef.authorityType &&
    input.sourceAuthorityRef.authorityId === input.targetAuthorityRef.authorityId
  ) {
    throw new ApiError(409, "RELATIONSHIP_SELF_REFERENCE", "Relationship endpoints must be distinct.");
  }
}

function assertRelationshipTransitionAllowed(relationship: HistoricalRelationshipRecord, mutation: string): void {
  const terminal = relationship.lifecycleStatus === "merged" || relationship.lifecycleStatus === "retired" || relationship.lifecycleStatus === "preserved";
  if (terminal || relationship.authorityState !== "active") {
    throw new ApiError(
      409,
      "INVALID_RELATIONSHIP_TRANSITION",
      `Relationship cannot ${mutation} from ${relationship.lifecycleStatus}/${relationship.authorityState}.`
    );
  }
}

export const historicalRelationshipRepository = {
  async list(limit = 100): Promise<HistoricalRelationshipRecord[]> {
    const sql = getWriteSql("listing historical relationships");
    return sql<HistoricalRelationshipRecord[]>`
      SELECT
        id::text AS "relationshipId",
        source_authority_ref AS "sourceAuthorityRef",
        target_authority_ref AS "targetAuthorityRef",
        relationship_type AS "relationshipType",
        summary,
        evidence_refs AS "evidenceRefs",
        provenance,
        lifecycle_status AS "lifecycleStatus",
        authority_state AS "authorityState",
        revision,
        merged_into_id::text AS "mergedIntoId",
        dispute_reason AS "disputeReason",
        retirement_reason AS "retirementReason",
        preservation_reason AS "preservationReason",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM historical_relationships
      ORDER BY updated_at DESC, id DESC
      LIMIT ${limit}
    `;
  },

  async get(relationshipId: string): Promise<HistoricalRelationshipRecord | null> {
    const sql = getWriteSql("loading historical relationship");
    const [row] = await sql<HistoricalRelationshipRecord[]>`
      SELECT
        id::text AS "relationshipId",
        source_authority_ref AS "sourceAuthorityRef",
        target_authority_ref AS "targetAuthorityRef",
        relationship_type AS "relationshipType",
        summary,
        evidence_refs AS "evidenceRefs",
        provenance,
        lifecycle_status AS "lifecycleStatus",
        authority_state AS "authorityState",
        revision,
        merged_into_id::text AS "mergedIntoId",
        dispute_reason AS "disputeReason",
        retirement_reason AS "retirementReason",
        preservation_reason AS "preservationReason",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM historical_relationships
      WHERE id = ${relationshipId}
      LIMIT 1
    `;
    return row || null;
  },

  async getPublicationPayload(relationshipId: string): Promise<Record<string, unknown> | null> {
    const relationship = await historicalRelationshipRepository.get(relationshipId);
    if (!relationship) {
      return null;
    }
    return {
      readModelType: "relationship",
      relationship_id: relationship.relationshipId,
      id: relationship.relationshipId,
      source_authority_ref: relationship.sourceAuthorityRef,
      target_authority_ref: relationship.targetAuthorityRef,
      relationship_type: relationship.relationshipType,
      summary: relationship.summary,
      evidence_refs: relationship.evidenceRefs,
      provenance: relationship.provenance,
      authority_state: relationship.authorityState,
      lifecycle_status: relationship.lifecycleStatus,
      revision: relationship.revision,
      continuity_metadata: {
        source_relationship_id: relationship.relationshipId,
        continuity_state:
          relationship.lifecycleStatus === "merged"
            ? "merged"
            : relationship.lifecycleStatus === "retired"
              ? "retired"
              : "active",
        merged_into_id: relationship.mergedIntoId
      }
    };
  },

  async create(input: RelationshipInput): Promise<HistoricalRelationshipRecord> {
    assertDistinctEndpoints(input);
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Creating historical relationship");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["ADMIT_RELATIONSHIP"],
      expectedAuthorityType: "relationship"
    });
    const sql = getWriteSql("creating historical relationship");
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [created] = await tx<HistoricalRelationshipRecord[]>`
        INSERT INTO historical_relationships (
          source_authority_ref,
          target_authority_ref,
          relationship_type,
          summary,
          evidence_refs,
          provenance,
          created_by,
          updated_by
        )
        VALUES (
          ${tx.json(input.sourceAuthorityRef as any)},
          ${tx.json(input.targetAuthorityRef as any)},
          ${input.relationshipType},
          ${input.summary},
          ${tx.json(input.evidenceRefs as any)},
          ${tx.json(input.provenance as any)},
          ${input.actor},
          ${input.actor}
        )
        RETURNING
          id::text AS "relationshipId",
          source_authority_ref AS "sourceAuthorityRef",
          target_authority_ref AS "targetAuthorityRef",
          relationship_type AS "relationshipType",
          summary,
          evidence_refs AS "evidenceRefs",
          provenance,
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          revision,
          merged_into_id::text AS "mergedIntoId",
          dispute_reason AS "disputeReason",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
      `;
      await tx`
        INSERT INTO historical_relationship_revisions (relationship_id, revision, action, after_state, reason, provenance, created_by)
        VALUES (${created!.relationshipId}, ${created!.revision}, 'create', ${tx.json(created as any)}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;
      return created!;
    });
  },

  async revise(relationshipId: string, input: RelationshipInput): Promise<HistoricalRelationshipRecord> {
    assertDistinctEndpoints(input);
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Revising historical relationship");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["REVISE_RELATIONSHIP"],
      expectedAuthorityType: "relationship",
      expectedAuthorityId: relationshipId
    });
    const current = await historicalRelationshipRepository.get(relationshipId);
    if (!current) {
      throw new ApiError(404, "RELATIONSHIP_NOT_FOUND", "Historical relationship not found.");
    }
    assertRelationshipTransitionAllowed(current, "revise");
    const sql = getWriteSql("revising historical relationship");
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [updated] = await tx<HistoricalRelationshipRecord[]>`
        UPDATE historical_relationships
        SET source_authority_ref = ${tx.json(input.sourceAuthorityRef as any)},
            target_authority_ref = ${tx.json(input.targetAuthorityRef as any)},
            relationship_type = ${input.relationshipType},
            summary = ${input.summary},
            evidence_refs = ${tx.json(input.evidenceRefs as any)},
            provenance = ${tx.json(input.provenance as any)},
            lifecycle_status = 'revised',
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE id = ${relationshipId}
        RETURNING
          id::text AS "relationshipId",
          source_authority_ref AS "sourceAuthorityRef",
          target_authority_ref AS "targetAuthorityRef",
          relationship_type AS "relationshipType",
          summary,
          evidence_refs AS "evidenceRefs",
          provenance,
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          revision,
          merged_into_id::text AS "mergedIntoId",
          dispute_reason AS "disputeReason",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
      `;
      await tx`
        INSERT INTO historical_relationship_revisions (relationship_id, revision, action, before_state, after_state, reason, provenance, created_by)
        VALUES (${relationshipId}, ${updated!.revision}, 'revise', ${tx.json(current as any)}, ${tx.json(updated as any)}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;
      return updated!;
    });
  },

  async dispute(relationshipId: string, input: RelationshipActionInput): Promise<{ disputed: true }> {
    const current = await historicalRelationshipRepository.get(relationshipId);
    if (!current) {
      throw new ApiError(404, "RELATIONSHIP_NOT_FOUND", "Historical relationship not found.");
    }
    assertRelationshipTransitionAllowed(current, "dispute");
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Disputing historical relationship");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["REVISE_RELATIONSHIP"],
      expectedAuthorityType: "relationship",
      expectedAuthorityId: relationshipId
    });
    const sql = getWriteSql("disputing historical relationship");
    await sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [updated] = await tx<HistoricalRelationshipRecord[]>`
        UPDATE historical_relationships
        SET lifecycle_status = 'disputed',
            dispute_reason = ${input.reason},
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE id = ${relationshipId}
        RETURNING id::text AS "relationshipId", source_authority_ref AS "sourceAuthorityRef", target_authority_ref AS "targetAuthorityRef", relationship_type AS "relationshipType", summary, evidence_refs AS "evidenceRefs", provenance, lifecycle_status AS "lifecycleStatus", authority_state AS "authorityState", revision, merged_into_id::text AS "mergedIntoId", dispute_reason AS "disputeReason", retirement_reason AS "retirementReason", preservation_reason AS "preservationReason", created_by AS "createdBy", updated_by AS "updatedBy", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
      `;
      await tx`INSERT INTO historical_relationship_disputes (relationship_id, reason, provenance, created_by) VALUES (${relationshipId}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})`;
      await tx`
        INSERT INTO historical_relationship_revisions (relationship_id, revision, action, before_state, after_state, reason, provenance, created_by)
        VALUES (${relationshipId}, ${updated!.revision}, 'dispute', ${tx.json(current as any)}, ${tx.json(updated as any)}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;
    });
    return { disputed: true };
  },

  async retire(relationshipId: string, input: RelationshipActionInput): Promise<{ retired: true }> {
    const current = await historicalRelationshipRepository.get(relationshipId);
    if (!current) {
      throw new ApiError(404, "RELATIONSHIP_NOT_FOUND", "Historical relationship not found.");
    }
    assertRelationshipTransitionAllowed(current, "retire");
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Retiring historical relationship");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["RETIRE_RELATIONSHIP"],
      expectedAuthorityType: "relationship",
      expectedAuthorityId: relationshipId
    });
    const sql = getWriteSql("retiring historical relationship");
    await sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [updated] = await tx<HistoricalRelationshipRecord[]>`
        UPDATE historical_relationships
        SET lifecycle_status = 'retired',
            authority_state = 'inactive',
            retirement_reason = ${input.reason},
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE id = ${relationshipId}
        RETURNING id::text AS "relationshipId", source_authority_ref AS "sourceAuthorityRef", target_authority_ref AS "targetAuthorityRef", relationship_type AS "relationshipType", summary, evidence_refs AS "evidenceRefs", provenance, lifecycle_status AS "lifecycleStatus", authority_state AS "authorityState", revision, merged_into_id::text AS "mergedIntoId", dispute_reason AS "disputeReason", retirement_reason AS "retirementReason", preservation_reason AS "preservationReason", created_by AS "createdBy", updated_by AS "updatedBy", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
      `;
      await tx`INSERT INTO historical_relationship_retirements (relationship_id, reason, continuity_path, provenance, created_by) VALUES (${relationshipId}, ${input.reason}, ${tx.json((input.continuityPath || {}) as any)}, ${tx.json(input.provenance as any)}, ${input.actor})`;
      await tx`
        INSERT INTO historical_relationship_revisions (relationship_id, revision, action, before_state, after_state, reason, provenance, created_by)
        VALUES (${relationshipId}, ${updated!.revision}, 'retire', ${tx.json(current as any)}, ${tx.json(updated as any)}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;
    });
    return { retired: true };
  },

  async merge(sourceRelationshipId: string, targetRelationshipId: string, input: RelationshipActionInput): Promise<{ merged: true }> {
    if (sourceRelationshipId === targetRelationshipId) {
      throw new ApiError(409, "RELATIONSHIP_MERGE_SELF_REFERENCE", "Source and target relationships must be distinct.");
    }
    const [source, target] = await Promise.all([
      historicalRelationshipRepository.get(sourceRelationshipId),
      historicalRelationshipRepository.get(targetRelationshipId)
    ]);
    if (!source || !target) {
      throw new ApiError(404, "RELATIONSHIP_NOT_FOUND", "Relationship merge requires existing source and target relationships.");
    }
    assertRelationshipTransitionAllowed(source, "merge");
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Merging historical relationship");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["MERGE_RELATIONSHIP"],
      expectedAuthorityType: "relationship",
      expectedAuthorityId: sourceRelationshipId
    });
    const sql = getWriteSql("merging historical relationship");
    await sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [updated] = await tx<HistoricalRelationshipRecord[]>`
        UPDATE historical_relationships
        SET lifecycle_status = 'merged',
            authority_state = 'inactive',
            merged_into_id = ${targetRelationshipId},
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE id = ${sourceRelationshipId}
        RETURNING id::text AS "relationshipId", source_authority_ref AS "sourceAuthorityRef", target_authority_ref AS "targetAuthorityRef", relationship_type AS "relationshipType", summary, evidence_refs AS "evidenceRefs", provenance, lifecycle_status AS "lifecycleStatus", authority_state AS "authorityState", revision, merged_into_id::text AS "mergedIntoId", dispute_reason AS "disputeReason", retirement_reason AS "retirementReason", preservation_reason AS "preservationReason", created_by AS "createdBy", updated_by AS "updatedBy", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
      `;
      await tx`INSERT INTO historical_relationship_merges (source_relationship_id, target_relationship_id, reason, continuity_path, provenance, created_by) VALUES (${sourceRelationshipId}, ${targetRelationshipId}, ${input.reason}, ${tx.json((input.continuityPath || {}) as any)}, ${tx.json(input.provenance as any)}, ${input.actor})`;
      await tx`
        INSERT INTO historical_relationship_revisions (relationship_id, revision, action, before_state, after_state, reason, provenance, created_by)
        VALUES (${sourceRelationshipId}, ${updated!.revision}, 'merge', ${tx.json(source as any)}, ${tx.json(updated as any)}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;
    });
    return { merged: true };
  },

  async preserve(relationshipId: string, input: RelationshipActionInput): Promise<{ preserved: true }> {
    const current = await historicalRelationshipRepository.get(relationshipId);
    if (!current) {
      throw new ApiError(404, "RELATIONSHIP_NOT_FOUND", "Historical relationship not found.");
    }
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Preserving historical relationship");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["PRESERVE_RELATIONSHIP"],
      expectedAuthorityType: "relationship",
      expectedAuthorityId: relationshipId
    });
    const sql = getWriteSql("preserving historical relationship");
    await sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [updated] = await tx<HistoricalRelationshipRecord[]>`
        UPDATE historical_relationships
        SET lifecycle_status = 'preserved',
            preservation_reason = ${input.reason},
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE id = ${relationshipId}
        RETURNING id::text AS "relationshipId", source_authority_ref AS "sourceAuthorityRef", target_authority_ref AS "targetAuthorityRef", relationship_type AS "relationshipType", summary, evidence_refs AS "evidenceRefs", provenance, lifecycle_status AS "lifecycleStatus", authority_state AS "authorityState", revision, merged_into_id::text AS "mergedIntoId", dispute_reason AS "disputeReason", retirement_reason AS "retirementReason", preservation_reason AS "preservationReason", created_by AS "createdBy", updated_by AS "updatedBy", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
      `;
      await tx`
        INSERT INTO historical_relationship_revisions (relationship_id, revision, action, before_state, after_state, reason, provenance, created_by)
        VALUES (${relationshipId}, ${updated!.revision}, 'preserve', ${tx.json(current as any)}, ${tx.json(updated as any)}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;
    });
    return { preserved: true };
  }
};
