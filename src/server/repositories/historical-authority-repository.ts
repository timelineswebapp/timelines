import type {
  HistoricalAuthoritySnapshot,
  HistoricalObjectDetail,
  HistoricalObjectRecord,
  MilestoneContext,
  MilestoneContextItem,
  MilestoneParticipationRecord
} from "@/src/lib/types";
import { HISTORICAL_CONTEXT_FETCH_CAP, HISTORICAL_OBJECT_HISTORY_CAP, groupMilestoneContextItems } from "@/src/lib/historical-context";
import { slugify } from "@/src/lib/utils";
import { ApiError } from "@/src/server/api/responses";
import { getSql, getWriteSql } from "@/src/server/db/client";
import { assertGovernanceDecisionRequired } from "@/src/server/governance/lifecycle";
import { verifyApprovedGovernanceDecision } from "@/src/server/repositories/governance-repository";

type HistoricalObjectInput = {
  canonicalName: string;
  canonicalSlug?: string;
  primaryType: HistoricalObjectRecord["primaryType"];
  description: string;
  aliases?: string[];
  provenance: Record<string, unknown>;
  actor: string;
  reason: string;
  governanceDecisionId: string;
};

type ParticipationInput = {
  historicalObjectId: string;
  milestoneId: number;
  role: string;
  summary: string;
  participationPriority?: MilestoneParticipationRecord["priority"];
  provenance: Record<string, unknown>;
  actor: string;
  reason: string;
  governanceDecisionId: string;
};

type RevisionInput = Omit<HistoricalObjectInput, "aliases">;
type ParticipationRevisionInput = Omit<ParticipationInput, "historicalObjectId" | "milestoneId">;
type AuthorityActionInput = {
  reason: string;
  provenance: Record<string, unknown>;
  actor: string;
  governanceDecisionId: string;
};

type ParticipationAuthorityState = {
  id: string;
  historicalObjectId: string;
  milestoneId: number;
  role: string;
  summary: string;
  priority: MilestoneParticipationRecord["priority"];
  lifecycleStatus: MilestoneParticipationRecord["lifecycleStatus"];
  authorityState: MilestoneParticipationRecord["authorityState"];
  provenance: Record<string, unknown>;
  revision: number;
  disputeReason: string | null;
  retirementReason: string | null;
  preservationReason: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

type HistoricalObjectAuthorityState = Omit<HistoricalObjectRecord, "aliasCount" | "participationCount">;
type HistoricalObjectMutation = "revise" | "merge" | "retire";
type ParticipationMutation = "revise" | "dispute" | "retire";

function normalizeObjectSlug(input: Pick<HistoricalObjectInput, "canonicalName" | "canonicalSlug">): string {
  const slug = slugify(input.canonicalSlug || input.canonicalName);
  if (!slug) {
    throw new ApiError(400, "INVALID_HISTORICAL_OBJECT_SLUG", "Historical object slug is invalid.");
  }
  return slug;
}

function assertObjectTransitionAllowed(object: HistoricalObjectAuthorityState, mutation: HistoricalObjectMutation): void {
  const isTerminal = object.lifecycleStatus === "merged" || object.lifecycleStatus === "retired" || object.lifecycleStatus === "preserved";
  if (isTerminal || object.authorityState !== "active") {
    throw new ApiError(
      409,
      "INVALID_HISTORICAL_OBJECT_TRANSITION",
      `Historical object cannot ${mutation} from ${object.lifecycleStatus}/${object.authorityState}.`
    );
  }
}

function assertParticipationTransitionAllowed(participation: ParticipationAuthorityState, mutation: ParticipationMutation): void {
  const isTerminal = participation.lifecycleStatus === "retired" || participation.lifecycleStatus === "preserved";
  if (isTerminal || participation.authorityState !== "active") {
    throw new ApiError(
      409,
      "INVALID_PARTICIPATION_TRANSITION",
      `Participation cannot ${mutation} from ${participation.lifecycleStatus}/${participation.authorityState}.`
    );
  }
}

function normalizeAliasRows(objectId: string, aliases: string[] | undefined, actor: string) {
  return Array.from(new Set((aliases || []).map((alias) => alias.trim()).filter(Boolean))).map((alias) => {
    const aliasSlug = slugify(alias);
    if (!aliasSlug) {
      throw new ApiError(400, "INVALID_HISTORICAL_OBJECT_ALIAS", "Historical object alias is invalid.");
    }
    return {
      object_id: objectId,
      alias,
      alias_slug: aliasSlug,
      created_by: actor
    };
  });
}

function buildSummary(objects: HistoricalObjectRecord[], participations: MilestoneParticipationRecord[]) {
  return {
    totalObjects: objects.length,
    activeObjects: objects.filter((object) => object.authorityState === "active").length,
    mergedObjects: objects.filter((object) => object.lifecycleStatus === "merged").length,
    retiredObjects: objects.filter((object) => object.lifecycleStatus === "retired").length,
    totalParticipations: participations.length,
    activeParticipations: participations.filter((participation) => participation.authorityState === "active").length,
    disputedParticipations: participations.filter((participation) => participation.lifecycleStatus === "disputed").length,
    retiredParticipations: participations.filter((participation) => participation.lifecycleStatus === "retired").length
  };
}

export const historicalAuthorityRepository = {
  async getSnapshot(limit = 500): Promise<HistoricalAuthoritySnapshot> {
    const sql = getSql();
    if (!sql) {
      return {
        objects: [],
        participations: [],
        summary: buildSummary([], [])
      };
    }

    const objects = await sql<HistoricalObjectRecord[]>`
      SELECT
        historical_objects.id::text AS "id",
        historical_objects.canonical_name AS "canonicalName",
        historical_objects.canonical_slug AS "canonicalSlug",
        historical_objects.primary_type AS "primaryType",
        historical_objects.lifecycle_status AS "lifecycleStatus",
        historical_objects.authority_state AS "authorityState",
        historical_objects.description,
        historical_objects.provenance,
        historical_objects.revision,
        historical_objects.merged_into_id::text AS "mergedIntoId",
        historical_objects.retirement_reason AS "retirementReason",
        historical_objects.preservation_reason AS "preservationReason",
        COALESCE(alias_counts.alias_count, 0)::int AS "aliasCount",
        COALESCE(participation_counts.participation_count, 0)::int AS "participationCount",
        historical_objects.created_by AS "createdBy",
        historical_objects.updated_by AS "updatedBy",
        historical_objects.created_at::text AS "createdAt",
        historical_objects.updated_at::text AS "updatedAt"
      FROM historical_objects
      LEFT JOIN (
        SELECT object_id, COUNT(*)::int AS alias_count
        FROM historical_object_aliases
        GROUP BY object_id
      ) alias_counts ON alias_counts.object_id = historical_objects.id
      LEFT JOIN (
        SELECT historical_object_id, COUNT(*)::int AS participation_count
        FROM milestone_participations
        GROUP BY historical_object_id
      ) participation_counts ON participation_counts.historical_object_id = historical_objects.id
      ORDER BY historical_objects.updated_at DESC, historical_objects.canonical_name ASC
      LIMIT ${limit}
    `;

    const participations = await sql<MilestoneParticipationRecord[]>`
      SELECT
        milestone_participations.id::text AS "id",
        milestone_participations.historical_object_id::text AS "historicalObjectId",
        historical_objects.canonical_name AS "historicalObjectName",
        milestone_participations.milestone_id AS "milestoneId",
        events.title AS "milestoneTitle",
        milestone_participations.role,
        milestone_participations.summary,
        milestone_participations.lifecycle_status AS "lifecycleStatus",
        milestone_participations.authority_state AS "authorityState",
        milestone_participations.provenance,
        milestone_participations.revision,
        milestone_participations.dispute_reason AS "disputeReason",
        milestone_participations.retirement_reason AS "retirementReason",
        milestone_participations.preservation_reason AS "preservationReason",
        milestone_participations.created_by AS "createdBy",
        milestone_participations.updated_by AS "updatedBy",
        milestone_participations.created_at::text AS "createdAt",
        milestone_participations.updated_at::text AS "updatedAt"
      FROM milestone_participations
      INNER JOIN historical_objects ON historical_objects.id = milestone_participations.historical_object_id
      INNER JOIN events ON events.id = milestone_participations.milestone_id
      ORDER BY milestone_participations.updated_at DESC, milestone_participations.id DESC
      LIMIT ${limit}
    `;

    return {
      objects,
      participations,
      summary: buildSummary(objects, participations)
    };
  },

  async createObject(input: HistoricalObjectInput): Promise<HistoricalObjectRecord> {
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Creating historical object");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["ADMIT_HISTORICAL_OBJECT"],
      expectedAuthorityType: "historical_object"
    });
    const sql = getWriteSql("creating historical object");
    const canonicalSlug = normalizeObjectSlug(input);

    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [created] = await tx<HistoricalObjectRecord[]>`
        INSERT INTO historical_objects (
          canonical_name,
          canonical_slug,
          primary_type,
          description,
          provenance,
          created_by,
          updated_by
        )
        VALUES (
          ${input.canonicalName},
          ${canonicalSlug},
          ${input.primaryType},
          ${input.description},
          ${tx.json(input.provenance as any)},
          ${input.actor},
          ${input.actor}
        )
        RETURNING
          id::text AS "id",
          canonical_name AS "canonicalName",
          canonical_slug AS "canonicalSlug",
          primary_type AS "primaryType",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          description,
          provenance,
          revision,
          merged_into_id::text AS "mergedIntoId",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          0 AS "aliasCount",
          0 AS "participationCount",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
      `;

      if (!created) {
        throw new ApiError(500, "HISTORICAL_OBJECT_CREATE_FAILED", "Historical object creation failed.");
      }

      const aliasRows = normalizeAliasRows(created.id, input.aliases, input.actor);
      for (const aliasRow of aliasRows) {
        await tx`
          INSERT INTO historical_object_aliases (object_id, alias, alias_slug, provenance, created_by)
          VALUES (${aliasRow.object_id}, ${aliasRow.alias}, ${aliasRow.alias_slug}, ${tx.json(input.provenance as any)}, ${aliasRow.created_by})
          ON CONFLICT (alias_slug) DO NOTHING
        `;
      }

      await tx`
        INSERT INTO historical_object_revisions (object_id, revision, action, after_state, reason, provenance, created_by)
        VALUES (${created.id}, ${1}, 'create', ${tx.json(created as any)}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;

      return {
        ...created,
        aliasCount: aliasRows.length
      };
    });
  },

  async reviseObject(id: string, input: RevisionInput): Promise<HistoricalObjectRecord | null> {
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Revising historical object");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["REVISE_HISTORICAL_OBJECT"],
      expectedAuthorityType: "historical_object",
      expectedAuthorityId: id
    });
    const sql = getWriteSql("revising historical object");
    const canonicalSlug = normalizeObjectSlug(input);

    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [before] = await tx<HistoricalObjectAuthorityState[]>`
        SELECT
          id::text AS "id",
          canonical_name AS "canonicalName",
          canonical_slug AS "canonicalSlug",
          primary_type AS "primaryType",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          description,
          provenance,
          revision,
          merged_into_id::text AS "mergedIntoId",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM historical_objects
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (!before) {
        return null;
      }
      assertObjectTransitionAllowed(before, "revise");

      const nextRevision = before.revision + 1;
      const [updated] = await tx<HistoricalObjectAuthorityState[]>`
        UPDATE historical_objects
        SET
          canonical_name = ${input.canonicalName},
          canonical_slug = ${canonicalSlug},
          primary_type = ${input.primaryType},
          description = ${input.description},
          lifecycle_status = 'revised',
          provenance = ${tx.json(input.provenance as any)},
          revision = ${nextRevision},
          updated_by = ${input.actor}
        WHERE id = ${id}
        RETURNING
          id::text AS "id",
          canonical_name AS "canonicalName",
          canonical_slug AS "canonicalSlug",
          primary_type AS "primaryType",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          description,
          provenance,
          revision,
          merged_into_id::text AS "mergedIntoId",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
      `;
      if (!updated) {
        return null;
      }

      await tx`
        INSERT INTO historical_object_revisions (object_id, revision, action, before_state, after_state, reason, provenance, created_by)
        VALUES (${id}, ${nextRevision}, 'revise', ${tx.json(before as any)}, ${tx.json(updated as any)}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;

      return {
        ...updated,
        aliasCount: 0,
        participationCount: 0
      };
    });
  },

  async mergeObject(sourceObjectId: string, targetObjectId: string, input: AuthorityActionInput): Promise<{ merged: true }> {
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Merging historical object");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["MERGE_HISTORICAL_OBJECT"],
      expectedAuthorityType: "historical_object",
      expectedAuthorityId: sourceObjectId
    });
    if (sourceObjectId === targetObjectId) {
      throw new ApiError(400, "INVALID_HISTORICAL_OBJECT_MERGE", "Source and target historical objects must differ.");
    }

    const sql = getWriteSql("merging historical object");
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [source] = await tx<HistoricalObjectAuthorityState[]>`
        SELECT
          id::text AS "id",
          canonical_name AS "canonicalName",
          canonical_slug AS "canonicalSlug",
          primary_type AS "primaryType",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          description,
          provenance,
          revision,
          merged_into_id::text AS "mergedIntoId",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM historical_objects
        WHERE id = ${sourceObjectId}
        FOR UPDATE
      `;
      const [target] = await tx<{ id: string }[]>`
        SELECT id::text
        FROM historical_objects
        WHERE id = ${targetObjectId} AND authority_state = 'active'
      `;
      if (!source || !target) {
        throw new ApiError(404, "HISTORICAL_OBJECT_NOT_FOUND", "Historical object merge source or target not found.");
      }
      assertObjectTransitionAllowed(source, "merge");

      const movableParticipations = await tx<ParticipationAuthorityState[]>`
        SELECT
          id::text AS "id",
          historical_object_id::text AS "historicalObjectId",
          milestone_id AS "milestoneId",
          role,
          summary,
          participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          provenance,
          revision,
          dispute_reason AS "disputeReason",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM milestone_participations
        WHERE historical_object_id = ${sourceObjectId}
          AND NOT EXISTS (
            SELECT 1
            FROM milestone_participations target_participation
            WHERE target_participation.historical_object_id = ${targetObjectId}
              AND target_participation.milestone_id = milestone_participations.milestone_id
              AND target_participation.role = milestone_participations.role
          )
        FOR UPDATE
      `;
      const preservedParticipations = await tx<ParticipationAuthorityState[]>`
        SELECT
          id::text AS "id",
          historical_object_id::text AS "historicalObjectId",
          milestone_id AS "milestoneId",
          role,
          summary,
          participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          provenance,
          revision,
          dispute_reason AS "disputeReason",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM milestone_participations
        WHERE historical_object_id = ${sourceObjectId}
          AND EXISTS (
            SELECT 1
            FROM milestone_participations target_participation
            WHERE target_participation.historical_object_id = ${targetObjectId}
              AND target_participation.milestone_id = milestone_participations.milestone_id
              AND target_participation.role = milestone_participations.role
          )
        FOR UPDATE
      `;

      await tx`
        UPDATE historical_objects
        SET lifecycle_status = 'merged',
            authority_state = 'inactive',
            merged_into_id = ${targetObjectId},
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE id = ${sourceObjectId}
      `;
      const [mergedSource] = await tx<HistoricalObjectAuthorityState[]>`
        SELECT
          id::text AS "id",
          canonical_name AS "canonicalName",
          canonical_slug AS "canonicalSlug",
          primary_type AS "primaryType",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          description,
          provenance,
          revision,
          merged_into_id::text AS "mergedIntoId",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM historical_objects
        WHERE id = ${sourceObjectId}
      `;
      if (!mergedSource) {
        throw new ApiError(500, "HISTORICAL_OBJECT_MERGE_TRACE_FAILED", "Historical object merge trace could not be reconstructed.");
      }
      await tx`
        UPDATE milestone_participations
        SET historical_object_id = ${targetObjectId},
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE historical_object_id = ${sourceObjectId}
          AND NOT EXISTS (
            SELECT 1
            FROM milestone_participations target_participation
            WHERE target_participation.historical_object_id = ${targetObjectId}
              AND target_participation.milestone_id = milestone_participations.milestone_id
              AND target_participation.role = milestone_participations.role
          )
      `;
      await tx`
        UPDATE milestone_participations
        SET lifecycle_status = 'preserved',
            authority_state = 'inactive',
            preservation_reason = ${input.reason},
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE historical_object_id = ${sourceObjectId}
          AND EXISTS (
            SELECT 1
            FROM milestone_participations target_participation
            WHERE target_participation.historical_object_id = ${targetObjectId}
              AND target_participation.milestone_id = milestone_participations.milestone_id
              AND target_participation.role = milestone_participations.role
          )
      `;

      for (const beforeParticipation of movableParticipations) {
        const [afterParticipation] = await tx<ParticipationAuthorityState[]>`
          SELECT
            id::text AS "id",
            historical_object_id::text AS "historicalObjectId",
            milestone_id AS "milestoneId",
            role,
            summary,
            participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
            authority_state AS "authorityState",
            provenance,
            revision,
            dispute_reason AS "disputeReason",
            retirement_reason AS "retirementReason",
            preservation_reason AS "preservationReason",
            created_by AS "createdBy",
            updated_by AS "updatedBy",
            created_at::text AS "createdAt",
            updated_at::text AS "updatedAt"
          FROM milestone_participations
          WHERE id = ${beforeParticipation.id}
        `;
        if (!afterParticipation) {
          throw new ApiError(500, "PARTICIPATION_MERGE_TRACE_FAILED", "Participation merge trace could not be reconstructed.");
        }
        await tx`
          INSERT INTO milestone_participation_revisions (
            participation_id,
            revision,
            action,
            before_state,
            after_state,
            reason,
            provenance,
            created_by
          )
          VALUES (
            ${beforeParticipation.id},
            ${afterParticipation.revision},
            'object_merge',
            ${tx.json(beforeParticipation as any)},
            ${tx.json(afterParticipation as any)},
            ${input.reason},
            ${tx.json(input.provenance as any)},
            ${input.actor}
          )
        `;
      }

      for (const beforeParticipation of preservedParticipations) {
        const [afterParticipation] = await tx<ParticipationAuthorityState[]>`
          SELECT
            id::text AS "id",
            historical_object_id::text AS "historicalObjectId",
            milestone_id AS "milestoneId",
            role,
            summary,
            participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
            authority_state AS "authorityState",
            provenance,
            revision,
            dispute_reason AS "disputeReason",
            retirement_reason AS "retirementReason",
            preservation_reason AS "preservationReason",
            created_by AS "createdBy",
            updated_by AS "updatedBy",
            created_at::text AS "createdAt",
            updated_at::text AS "updatedAt"
          FROM milestone_participations
          WHERE id = ${beforeParticipation.id}
        `;
        if (!afterParticipation) {
          throw new ApiError(500, "PARTICIPATION_MERGE_TRACE_FAILED", "Participation preservation trace could not be reconstructed.");
        }
        await tx`
          INSERT INTO milestone_participation_revisions (
            participation_id,
            revision,
            action,
            before_state,
            after_state,
            reason,
            provenance,
            created_by
          )
          VALUES (
            ${beforeParticipation.id},
            ${afterParticipation.revision},
            'object_merge',
            ${tx.json(beforeParticipation as any)},
            ${tx.json(afterParticipation as any)},
            ${input.reason},
            ${tx.json(input.provenance as any)},
            ${input.actor}
          )
        `;
      }

      await tx`
        INSERT INTO historical_object_merges (source_object_id, target_object_id, reason, provenance, created_by)
        VALUES (${sourceObjectId}, ${targetObjectId}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;
      await tx`
        INSERT INTO historical_object_revisions (object_id, revision, action, before_state, after_state, reason, provenance, created_by)
        VALUES (
          ${sourceObjectId},
          ${mergedSource.revision},
          'merge',
          ${tx.json(source as any)},
          ${tx.json(mergedSource as any)},
          ${input.reason},
          ${tx.json(input.provenance as any)},
          ${input.actor}
        )
      `;

      return { merged: true };
    });
  },

  async retireObject(id: string, input: AuthorityActionInput): Promise<{ retired: true }> {
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Retiring historical object");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["RETIRE_HISTORICAL_OBJECT"],
      expectedAuthorityType: "historical_object",
      expectedAuthorityId: id
    });
    const sql = getWriteSql("retiring historical object");
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [object] = await tx<HistoricalObjectAuthorityState[]>`
        SELECT
          id::text AS "id",
          canonical_name AS "canonicalName",
          canonical_slug AS "canonicalSlug",
          primary_type AS "primaryType",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          description,
          provenance,
          revision,
          merged_into_id::text AS "mergedIntoId",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM historical_objects
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (!object) {
        throw new ApiError(404, "HISTORICAL_OBJECT_NOT_FOUND", "Historical object not found.");
      }
      assertObjectTransitionAllowed(object, "retire");
      const activeParticipations = await tx<ParticipationAuthorityState[]>`
        SELECT
          id::text AS "id",
          historical_object_id::text AS "historicalObjectId",
          milestone_id AS "milestoneId",
          role,
          summary,
          participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          provenance,
          revision,
          dispute_reason AS "disputeReason",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM milestone_participations
        WHERE historical_object_id = ${id}
          AND authority_state = 'active'
        FOR UPDATE
      `;
      await tx`
        UPDATE historical_objects
        SET lifecycle_status = 'retired',
            authority_state = 'inactive',
            retirement_reason = ${input.reason},
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE id = ${id}
      `;
      const [retiredObject] = await tx<HistoricalObjectAuthorityState[]>`
        SELECT
          id::text AS "id",
          canonical_name AS "canonicalName",
          canonical_slug AS "canonicalSlug",
          primary_type AS "primaryType",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          description,
          provenance,
          revision,
          merged_into_id::text AS "mergedIntoId",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM historical_objects
        WHERE id = ${id}
      `;
      if (!retiredObject) {
        throw new ApiError(500, "HISTORICAL_OBJECT_RETIRE_TRACE_FAILED", "Historical object retirement trace could not be reconstructed.");
      }
      await tx`
        UPDATE milestone_participations
        SET lifecycle_status = 'retired',
            authority_state = 'inactive',
            retirement_reason = ${input.reason},
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE historical_object_id = ${id}
          AND authority_state = 'active'
      `;
      for (const beforeParticipation of activeParticipations) {
        const [afterParticipation] = await tx<ParticipationAuthorityState[]>`
          SELECT
            id::text AS "id",
            historical_object_id::text AS "historicalObjectId",
            milestone_id AS "milestoneId",
            role,
            summary,
            participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
            authority_state AS "authorityState",
            provenance,
            revision,
            dispute_reason AS "disputeReason",
            retirement_reason AS "retirementReason",
            preservation_reason AS "preservationReason",
            created_by AS "createdBy",
            updated_by AS "updatedBy",
            created_at::text AS "createdAt",
            updated_at::text AS "updatedAt"
          FROM milestone_participations
          WHERE id = ${beforeParticipation.id}
        `;
        if (!afterParticipation) {
          throw new ApiError(500, "PARTICIPATION_RETIRE_TRACE_FAILED", "Participation retirement trace could not be reconstructed.");
        }
        await tx`
          INSERT INTO milestone_participation_revisions (
            participation_id,
            revision,
            action,
            before_state,
            after_state,
            reason,
            provenance,
            created_by
          )
          VALUES (
            ${beforeParticipation.id},
            ${afterParticipation.revision},
            'retire',
            ${tx.json(beforeParticipation as any)},
            ${tx.json(afterParticipation as any)},
            ${input.reason},
            ${tx.json(input.provenance as any)},
            ${input.actor}
          )
        `;
      }
      await tx`
        INSERT INTO historical_object_retirements (object_id, reason, provenance, created_by)
        VALUES (${id}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;
      await tx`
        INSERT INTO historical_object_revisions (object_id, revision, action, before_state, after_state, reason, provenance, created_by)
        VALUES (${id}, ${retiredObject.revision}, 'retire', ${tx.json(object as any)}, ${tx.json(retiredObject as any)}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;
      return { retired: true };
    });
  },

  async createParticipation(input: ParticipationInput): Promise<MilestoneParticipationRecord> {
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Creating milestone participation");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["ADMIT_PARTICIPATION"],
      expectedAuthorityType: "participation"
    });
    const sql = getWriteSql("creating milestone participation");

    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [created] = await tx<MilestoneParticipationRecord[]>`
        INSERT INTO milestone_participations (
          historical_object_id,
          milestone_id,
          role,
          summary,
          participation_priority,
          provenance,
          created_by,
          updated_by
        )
        VALUES (
          ${input.historicalObjectId},
          ${input.milestoneId},
          ${input.role},
          ${input.summary},
          ${input.participationPriority || "SUPPORTING"},
          ${tx.json(input.provenance as any)},
          ${input.actor},
          ${input.actor}
        )
        RETURNING
          id::text AS "id",
          historical_object_id::text AS "historicalObjectId",
          ''::text AS "historicalObjectName",
          milestone_id AS "milestoneId",
          ''::text AS "milestoneTitle",
          role,
          summary,
          participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          provenance,
          revision,
          dispute_reason AS "disputeReason",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
      `;
      if (!created) {
        throw new ApiError(500, "PARTICIPATION_CREATE_FAILED", "Participation creation failed.");
      }
      await tx`
        INSERT INTO milestone_participation_revisions (participation_id, revision, action, after_state, reason, provenance, created_by)
        VALUES (${created.id}, ${1}, 'create', ${tx.json(created as any)}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;
      return created;
    });
  },

  async reviseParticipation(id: string, input: ParticipationRevisionInput): Promise<{ revised: true }> {
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Revising milestone participation");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["REVISE_PARTICIPATION", "CHANGE_PARTICIPATION_PRIORITY"],
      expectedAuthorityType: "participation",
      expectedAuthorityId: id
    });
    const sql = getWriteSql("revising milestone participation");
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [before] = await tx<ParticipationAuthorityState[]>`
        SELECT
          id::text AS "id",
          historical_object_id::text AS "historicalObjectId",
          milestone_id AS "milestoneId",
          role,
          summary,
          participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          provenance,
          revision,
          dispute_reason AS "disputeReason",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM milestone_participations
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (!before) {
        throw new ApiError(404, "PARTICIPATION_NOT_FOUND", "Participation not found.");
      }
      assertParticipationTransitionAllowed(before, "revise");
      await tx`
        UPDATE milestone_participations
        SET role = ${input.role},
            summary = ${input.summary},
            participation_priority = ${input.participationPriority || "SUPPORTING"},
            lifecycle_status = 'revised',
            provenance = ${tx.json(input.provenance as any)},
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE id = ${id}
      `;
      const [after] = await tx<ParticipationAuthorityState[]>`
        SELECT
          id::text AS "id",
          historical_object_id::text AS "historicalObjectId",
          milestone_id AS "milestoneId",
          role,
          summary,
          participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          provenance,
          revision,
          dispute_reason AS "disputeReason",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM milestone_participations
        WHERE id = ${id}
      `;
      if (!after) {
        throw new ApiError(500, "PARTICIPATION_REVISE_TRACE_FAILED", "Participation revision trace could not be reconstructed.");
      }
      await tx`
        INSERT INTO milestone_participation_revisions (
          participation_id,
          revision,
          action,
          before_state,
          after_state,
          reason,
          provenance,
          created_by
        )
        VALUES (
          ${id},
          ${after.revision},
          'revise',
          ${tx.json(before as any)},
          ${tx.json(after as any)},
          ${input.reason},
          ${tx.json(input.provenance as any)},
          ${input.actor}
        )
      `;
      return { revised: true };
    });
  },

  async disputeParticipation(id: string, input: AuthorityActionInput): Promise<{ disputed: true }> {
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Disputing milestone participation");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["OPEN_DISPUTE"],
      expectedAuthorityType: "participation",
      expectedAuthorityId: id
    });
    const sql = getWriteSql("disputing milestone participation");
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [before] = await tx<ParticipationAuthorityState[]>`
        SELECT
          id::text AS "id",
          historical_object_id::text AS "historicalObjectId",
          milestone_id AS "milestoneId",
          role,
          summary,
          participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          provenance,
          revision,
          dispute_reason AS "disputeReason",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM milestone_participations
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (!before) {
        throw new ApiError(404, "PARTICIPATION_NOT_FOUND", "Participation not found.");
      }
      assertParticipationTransitionAllowed(before, "dispute");
      await tx`
        UPDATE milestone_participations
        SET lifecycle_status = 'disputed',
            dispute_reason = ${input.reason},
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE id = ${id}
      `;
      await tx`
        INSERT INTO milestone_participation_disputes (participation_id, reason, provenance, created_by)
        VALUES (${id}, ${input.reason}, ${tx.json(input.provenance as any)}, ${input.actor})
      `;
      const [after] = await tx<ParticipationAuthorityState[]>`
        SELECT
          id::text AS "id",
          historical_object_id::text AS "historicalObjectId",
          milestone_id AS "milestoneId",
          role,
          summary,
          participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          provenance,
          revision,
          dispute_reason AS "disputeReason",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM milestone_participations
        WHERE id = ${id}
      `;
      if (!after) {
        throw new ApiError(500, "PARTICIPATION_DISPUTE_TRACE_FAILED", "Participation dispute trace could not be reconstructed.");
      }
      await tx`
        INSERT INTO milestone_participation_revisions (
          participation_id,
          revision,
          action,
          before_state,
          after_state,
          reason,
          provenance,
          created_by
        )
        VALUES (
          ${id},
          ${after.revision},
          'dispute',
          ${tx.json(before as any)},
          ${tx.json(after as any)},
          ${input.reason},
          ${tx.json(input.provenance as any)},
          ${input.actor}
        )
      `;
      return { disputed: true };
    });
  },

  async retireParticipation(id: string, input: AuthorityActionInput): Promise<{ retired: true }> {
    assertGovernanceDecisionRequired(input.governanceDecisionId, "Retiring milestone participation");
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["RETIRE_PARTICIPATION"],
      expectedAuthorityType: "participation",
      expectedAuthorityId: id
    });
    const sql = getWriteSql("retiring milestone participation");
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as import("postgres").Sql;
      const [before] = await tx<ParticipationAuthorityState[]>`
        SELECT
          id::text AS "id",
          historical_object_id::text AS "historicalObjectId",
          milestone_id AS "milestoneId",
          role,
          summary,
          participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          provenance,
          revision,
          dispute_reason AS "disputeReason",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM milestone_participations
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (!before) {
        throw new ApiError(404, "PARTICIPATION_NOT_FOUND", "Participation not found.");
      }
      assertParticipationTransitionAllowed(before, "retire");
      await tx`
        UPDATE milestone_participations
        SET lifecycle_status = 'retired',
            authority_state = 'inactive',
            retirement_reason = ${input.reason},
            revision = revision + 1,
            updated_by = ${input.actor}
        WHERE id = ${id}
      `;
      const [after] = await tx<ParticipationAuthorityState[]>`
        SELECT
          id::text AS "id",
          historical_object_id::text AS "historicalObjectId",
          milestone_id AS "milestoneId",
          role,
          summary,
          participation_priority AS "priority",
          lifecycle_status AS "lifecycleStatus",
          authority_state AS "authorityState",
          provenance,
          revision,
          dispute_reason AS "disputeReason",
          retirement_reason AS "retirementReason",
          preservation_reason AS "preservationReason",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM milestone_participations
        WHERE id = ${id}
      `;
      if (!after) {
        throw new ApiError(500, "PARTICIPATION_RETIRE_TRACE_FAILED", "Participation retirement trace could not be reconstructed.");
      }
      await tx`
        INSERT INTO milestone_participation_revisions (
          participation_id,
          revision,
          action,
          before_state,
          after_state,
          reason,
          provenance,
          created_by
        )
        VALUES (
          ${id},
          ${after.revision},
          'retire',
          ${tx.json(before as any)},
          ${tx.json(after as any)},
          ${input.reason},
          ${tx.json(input.provenance as any)},
          ${input.actor}
        )
      `;
      return { retired: true };
    });
  },

  async getMilestoneContext(milestoneId: number): Promise<MilestoneContext> {
    const contexts = await historicalAuthorityRepository.getMilestoneContexts([milestoneId]);
    return contexts.get(milestoneId) || groupMilestoneContextItems(milestoneId, []);
  },

  async getMilestoneContexts(milestoneIds: number[]): Promise<Map<number, MilestoneContext>> {
    const uniqueIds = Array.from(new Set(milestoneIds.filter((id) => Number.isSafeInteger(id) && id > 0)));
    const contextMap = new Map<number, MilestoneContext>();
    for (const milestoneId of uniqueIds) {
      contextMap.set(milestoneId, groupMilestoneContextItems(milestoneId, []));
    }

    const sql = getSql();
    if (!sql || uniqueIds.length === 0) {
      return contextMap;
    }

    const rows = await sql<Array<MilestoneContextItem & { milestoneId: number }>>`
      SELECT
        ranked."participationId",
        ranked."milestoneId",
        ranked."historicalObjectId",
        ranked."historicalObjectSlug",
        ranked."historicalObjectName",
        ranked."historicalObjectType",
        ranked.role,
        ranked.meaning,
        ranked.priority
      FROM (
        SELECT
          milestone_participations.id::text AS "participationId",
          milestone_participations.milestone_id::int AS "milestoneId",
          historical_objects.id::text AS "historicalObjectId",
          historical_objects.canonical_slug AS "historicalObjectSlug",
          historical_objects.canonical_name AS "historicalObjectName",
          historical_objects.primary_type AS "historicalObjectType",
          milestone_participations.role,
          milestone_participations.summary AS meaning,
          COALESCE(milestone_participations.participation_priority, 'SUPPORTING') AS priority,
          ROW_NUMBER() OVER (
            PARTITION BY milestone_participations.milestone_id
            ORDER BY
              CASE COALESCE(milestone_participations.participation_priority, 'SUPPORTING')
                WHEN 'PRIMARY' THEN 1
                WHEN 'SUPPORTING' THEN 2
                WHEN 'CONTEXT' THEN 3
                ELSE 4
              END,
              historical_objects.canonical_name ASC,
              milestone_participations.id ASC
          ) AS context_rank
        FROM milestone_participations
        INNER JOIN historical_objects ON historical_objects.id = milestone_participations.historical_object_id
        WHERE milestone_participations.milestone_id IN ${sql(uniqueIds)}
          AND milestone_participations.authority_state = 'active'
          AND milestone_participations.lifecycle_status IN ('established', 'revised')
          AND historical_objects.authority_state = 'active'
          AND historical_objects.lifecycle_status IN ('established', 'revised')
      ) ranked
      WHERE ranked.context_rank <= ${HISTORICAL_CONTEXT_FETCH_CAP}
    `;

    const itemsByMilestone = new Map<number, MilestoneContextItem[]>();
    for (const row of rows) {
      const { milestoneId, ...item } = row;
      const items = itemsByMilestone.get(milestoneId) || [];
      items.push(item);
      itemsByMilestone.set(milestoneId, items);
    }

    for (const milestoneId of uniqueIds) {
      contextMap.set(milestoneId, groupMilestoneContextItems(milestoneId, itemsByMilestone.get(milestoneId) || []));
    }

    return contextMap;
  },

  async getHistoricalObjectParticipationHistory(objectId: string): Promise<HistoricalObjectDetail["participationHistory"]> {
    const sql = getSql();
    if (!sql) {
      return [];
    }

    const rows = await sql<HistoricalObjectDetail["participationHistory"]>`
      SELECT
        milestone_participations.id::text AS "participationId",
        events.id::int AS "milestoneId",
        events.title AS "milestoneTitle",
        COALESCE(events.display_date, events.date::text) AS "milestoneDate",
        events.date_precision AS "milestoneDatePrecision",
        events.display_date AS "milestoneDisplayDate",
        events.sort_year AS "milestoneSortYear",
        events.sort_month AS "milestoneSortMonth",
        events.sort_day AS "milestoneSortDay",
        milestone_participations.role,
        milestone_participations.summary AS "meaning",
        COALESCE(milestone_participations.participation_priority, 'SUPPORTING') AS "priority",
        COALESCE(
          JSONB_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'timelineId', timelines.id,
              'slug', timelines.slug,
              'title', timelines.title,
              'eventOrder', timeline_events.event_order
            )
          ) FILTER (WHERE timelines.id IS NOT NULL),
          '[]'::jsonb
        ) AS "timelineLinks"
      FROM milestone_participations
      INNER JOIN events ON events.id = milestone_participations.milestone_id
      LEFT JOIN timeline_events ON timeline_events.event_id = events.id
      LEFT JOIN timelines ON timelines.id = timeline_events.timeline_id
      WHERE milestone_participations.historical_object_id = ${objectId}
        AND milestone_participations.authority_state = 'active'
        AND milestone_participations.lifecycle_status IN ('established', 'revised')
      GROUP BY milestone_participations.id, events.id
      ORDER BY
        COALESCE(events.sort_year, CAST(SUBSTRING(events.date::text FROM 1 FOR 4) AS INTEGER)) ASC NULLS LAST,
        events.sort_month ASC NULLS FIRST,
        events.sort_day ASC NULLS FIRST,
        events.id ASC
      LIMIT ${HISTORICAL_OBJECT_HISTORY_CAP}
    `;

    return rows;
  },

  async getHistoricalObjectRelatedMilestones(objectId: string): Promise<HistoricalObjectDetail["relatedMilestones"]> {
    const sql = getSql();
    if (!sql) {
      return [];
    }

    return sql<HistoricalObjectDetail["relatedMilestones"]>`
      SELECT DISTINCT
        events.id::int AS "milestoneId",
        events.title,
        events.description,
        COALESCE(events.display_date, events.date::text) AS date,
        events.date_precision AS "datePrecision",
        events.display_date AS "displayDate",
        events.sort_year AS "sortYear",
        events.sort_month AS "sortMonth",
        events.sort_day AS "sortDay"
      FROM milestone_participations
      INNER JOIN events ON events.id = milestone_participations.milestone_id
      WHERE milestone_participations.historical_object_id = ${objectId}
        AND milestone_participations.authority_state = 'active'
        AND milestone_participations.lifecycle_status IN ('established', 'revised')
      ORDER BY
        COALESCE(events.sort_year, CAST(SUBSTRING(events.date::text FROM 1 FOR 4) AS INTEGER)) ASC NULLS LAST,
        events.sort_month ASC NULLS FIRST,
        events.sort_day ASC NULLS FIRST,
        events.id ASC
      LIMIT ${HISTORICAL_OBJECT_HISTORY_CAP}
    `;
  },

  async getHistoricalObjectRelatedTimelines(objectId: string): Promise<HistoricalObjectDetail["relatedTimelines"]> {
    const sql = getSql();
    if (!sql) {
      return [];
    }

    return sql<HistoricalObjectDetail["relatedTimelines"]>`
      SELECT
        timelines.id::int AS "timelineId",
        timelines.slug,
        timelines.title,
        COUNT(DISTINCT milestone_participations.id)::int AS "participationCount"
      FROM milestone_participations
      INNER JOIN timeline_events ON timeline_events.event_id = milestone_participations.milestone_id
      INNER JOIN timelines ON timelines.id = timeline_events.timeline_id
      WHERE milestone_participations.historical_object_id = ${objectId}
        AND milestone_participations.authority_state = 'active'
        AND milestone_participations.lifecycle_status IN ('established', 'revised')
      GROUP BY timelines.id
      ORDER BY "participationCount" DESC, timelines.title ASC
      LIMIT 12
    `;
  },

  async getHistoricalObjectBySlug(slug: string): Promise<HistoricalObjectDetail | null> {
    const sql = getSql();
    if (!sql) {
      return null;
    }

    const [object] = await sql<HistoricalObjectDetail["object"][]>`
      SELECT
        id::text AS "id",
        canonical_name AS "canonicalName",
        canonical_slug AS "canonicalSlug",
        primary_type AS "primaryType",
        description
      FROM historical_objects
      WHERE canonical_slug = ${slug}
        AND authority_state = 'active'
        AND lifecycle_status IN ('established', 'revised')
      LIMIT 1
    `;

    if (!object) {
      return null;
    }

    const [participationHistory, relatedMilestones, relatedTimelines] = await Promise.all([
      historicalAuthorityRepository.getHistoricalObjectParticipationHistory(object.id),
      historicalAuthorityRepository.getHistoricalObjectRelatedMilestones(object.id),
      historicalAuthorityRepository.getHistoricalObjectRelatedTimelines(object.id)
    ]);

    return {
      object,
      participationHistory,
      relatedMilestones,
      relatedTimelines
    };
  }
};
