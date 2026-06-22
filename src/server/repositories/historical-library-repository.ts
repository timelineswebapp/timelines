import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { AuthorityRef, EvidenceRef, GovernanceActorRef, PublicationPackage } from "@/src/server/governance/contracts";
import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";
import { historicalRelationshipRepository } from "@/src/server/repositories/historical-relationship-repository";

export type HistoricalLibraryAdmission = {
  admissionId: string;
  publicationPackageId: string;
  governanceDecisionId: string;
  admittedBy: GovernanceActorRef;
  admissionReason: string;
  sourcePackageSnapshot: PublicationPackage;
  includedAuthority: AuthorityRef[];
  validationArtifacts: EvidenceRef[];
  auditRefs: string[];
  lifecycle: "admitted" | "preserved";
  createdAt?: string;
};

export type PublishedMemorySnapshot = {
  snapshotId: string;
  admissionId: string;
  authorityRef: AuthorityRef;
  snapshot: Record<string, unknown>;
  snapshotHash: string;
  lifecycle: "active" | "preserved";
  createdAt?: string;
};

export type HistoricalLibraryRevision = {
  revisionId: string;
  publishedSnapshotId: string;
  publicationPackageId: string;
  governanceDecisionId: string;
  previousSnapshot: Record<string, unknown>;
  revisedSnapshot: Record<string, unknown>;
  revisedSnapshotHash: string;
  amendmentSummary: string;
  auditRecordId: string | null;
  createdBy: GovernanceActorRef;
  createdAt?: string;
};

export type HistoricalLibraryRetirement = {
  retirementId: string;
  publishedSnapshotId: string;
  publicationPackageId: string;
  governanceDecisionId: string;
  retirementReason: string;
  continuityPath: Record<string, unknown>;
  auditRecordId: string | null;
  createdBy: GovernanceActorRef;
  createdAt?: string;
};

export type HistoricalLibraryMerge = {
  mergeId: string;
  sourcePublishedRecordId: string;
  targetPublishedRecordId: string;
  publicationPackageId: string;
  governanceDecisionId: string;
  mergeReason: string;
  continuityPath: Record<string, unknown>;
  auditRecordId: string | null;
  createdBy: GovernanceActorRef;
  createdAt?: string;
};

export type HistoricalLibraryPreservation = {
  preservationId: string;
  publishedSnapshotId: string;
  publicationPackageId: string;
  governanceDecisionId: string;
  preservationReason: string;
  preservationMetadata: Record<string, unknown>;
  auditRecordId: string | null;
  createdBy: GovernanceActorRef;
  createdAt?: string;
};

export type HistoricalLibraryFeedbackLink = {
  feedbackLinkId: string;
  lifecycleActionType: "revision" | "retirement" | "merge" | "preservation";
  lifecycleActionId: string;
  feedbackPackageId: string;
  publicationPackageId: string;
  sourcePublishedRecordId: string | null;
  targetPublishedRecordId: string | null;
  createdBy: GovernanceActorRef;
  createdAt?: string;
};

export type HistoricalLibraryAdmissionResult = {
  admission: HistoricalLibraryAdmission;
  snapshots: PublishedMemorySnapshot[];
};

type CreateAdmissionInput = {
  admissionId?: string;
  publicationPackage: PublicationPackage;
  governanceDecisionId: string;
  admittedBy: GovernanceActorRef;
  admissionReason: string;
  auditRefs?: string[];
};

type LifecycleBaseInput = {
  publishedSnapshot: PublishedMemorySnapshot;
  publicationPackageId: string;
  governanceDecisionId: string;
  auditRecordId?: string | null;
  actor: GovernanceActorRef;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashSnapshot(snapshot: Record<string, unknown>): string {
  return createHash("sha256").update(stableJson(snapshot)).digest("hex");
}

async function buildPublishedMemorySnapshotPayload(input: {
  authorityRef: AuthorityRef;
  publicationPackage: PublicationPackage;
}): Promise<Record<string, unknown>> {
  const base = {
    authorityRef: input.authorityRef,
    publicationPackageId: input.publicationPackage.packageId,
    packageScope: input.publicationPackage.scope,
    readinessCertification: input.publicationPackage.readinessCertification,
    acceptanceOutcome: input.publicationPackage.acceptanceOutcome,
    admittedAtPackageLifecycle: input.publicationPackage.lifecycle
  };

  if (input.authorityRef.authorityType !== "relationship") {
    return base;
  }

  const relationshipPayload = await historicalRelationshipRepository.getPublicationPayload(input.authorityRef.authorityId);
  if (!relationshipPayload) {
    throw new ApiError(409, "RELATIONSHIP_PUBLICATION_PAYLOAD_MISSING", "Relationship publication requires an existing relationship authority record.");
  }

  return {
    ...base,
    ...relationshipPayload,
    published_memory_payload_type: "relationship"
  };
}

export const historicalLibraryRepository = {
  async listPublishedSnapshots(limit = 1000, offset = 0): Promise<PublishedMemorySnapshot[]> {
    const sql = getWriteSql("listing historical library published snapshots");
    return sql<PublishedMemorySnapshot[]>`
      SELECT
        id::text AS "snapshotId",
        admission_id::text AS "admissionId",
        authority_ref AS "authorityRef",
        snapshot,
        snapshot_hash AS "snapshotHash",
        lifecycle,
        created_at::text AS "createdAt"
      FROM historical_library_published_snapshots
      WHERE lifecycle = 'active'
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  },

  async countPublishedSnapshots(): Promise<number> {
    const sql = getWriteSql("counting historical library published snapshots");
    const [row] = await sql<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM historical_library_published_snapshots
      WHERE lifecycle = 'active'
    `;
    return row?.count || 0;
  },

  async listRevisions(limit = 100): Promise<HistoricalLibraryRevision[]> {
    const sql = getWriteSql("listing historical library revisions");
    return sql<HistoricalLibraryRevision[]>`
      SELECT
        id::text AS "revisionId",
        published_snapshot_id::text AS "publishedSnapshotId",
        publication_package_id::text AS "publicationPackageId",
        governance_decision_id::text AS "governanceDecisionId",
        previous_snapshot AS "previousSnapshot",
        revised_snapshot AS "revisedSnapshot",
        revised_snapshot_hash AS "revisedSnapshotHash",
        amendment_summary AS "amendmentSummary",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM historical_library_published_revisions
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async listRetirements(limit = 100, offset = 0): Promise<HistoricalLibraryRetirement[]> {
    const sql = getWriteSql("listing historical library retirements");
    return sql<HistoricalLibraryRetirement[]>`
      SELECT
        id::text AS "retirementId",
        published_snapshot_id::text AS "publishedSnapshotId",
        publication_package_id::text AS "publicationPackageId",
        governance_decision_id::text AS "governanceDecisionId",
        retirement_reason AS "retirementReason",
        continuity_path AS "continuityPath",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM historical_library_retirements
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  },

  async countRetirements(): Promise<number> {
    const sql = getWriteSql("counting historical library retirements");
    const [row] = await sql<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM historical_library_retirements
    `;
    return row?.count || 0;
  },

  async listMerges(limit = 100, offset = 0): Promise<HistoricalLibraryMerge[]> {
    const sql = getWriteSql("listing historical library merges");
    return sql<HistoricalLibraryMerge[]>`
      SELECT
        id::text AS "mergeId",
        source_published_record_id::text AS "sourcePublishedRecordId",
        target_published_record_id::text AS "targetPublishedRecordId",
        publication_package_id::text AS "publicationPackageId",
        governance_decision_id::text AS "governanceDecisionId",
        merge_reason AS "mergeReason",
        continuity_path AS "continuityPath",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM historical_library_merges
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  },

  async countMerges(): Promise<number> {
    const sql = getWriteSql("counting historical library merges");
    const [row] = await sql<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM historical_library_merges
    `;
    return row?.count || 0;
  },

  async listPreservations(limit = 100): Promise<HistoricalLibraryPreservation[]> {
    const sql = getWriteSql("listing historical library preservations");
    return sql<HistoricalLibraryPreservation[]>`
      SELECT
        id::text AS "preservationId",
        published_snapshot_id::text AS "publishedSnapshotId",
        publication_package_id::text AS "publicationPackageId",
        governance_decision_id::text AS "governanceDecisionId",
        preservation_reason AS "preservationReason",
        preservation_metadata AS "preservationMetadata",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM historical_library_preservations
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async listFeedbackLinks(limit = 100): Promise<HistoricalLibraryFeedbackLink[]> {
    const sql = getWriteSql("listing historical library feedback links");
    return sql<HistoricalLibraryFeedbackLink[]>`
      SELECT
        id::text AS "feedbackLinkId",
        lifecycle_action_type AS "lifecycleActionType",
        lifecycle_action_id::text AS "lifecycleActionId",
        feedback_package_id::text AS "feedbackPackageId",
        publication_package_id::text AS "publicationPackageId",
        source_published_record_id::text AS "sourcePublishedRecordId",
        target_published_record_id::text AS "targetPublishedRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM historical_library_feedback_links
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async getPublishedSnapshot(snapshotId: string): Promise<PublishedMemorySnapshot | null> {
    const sql = getWriteSql("loading historical library published snapshot");
    const [row] = await sql<PublishedMemorySnapshot[]>`
      SELECT
        id::text AS "snapshotId",
        admission_id::text AS "admissionId",
        authority_ref AS "authorityRef",
        snapshot,
        snapshot_hash AS "snapshotHash",
        lifecycle,
        created_at::text AS "createdAt"
      FROM historical_library_published_snapshots
      WHERE id = ${snapshotId}
      LIMIT 1
    `;
    return row || null;
  },

  async getAdmissionByPackageId(publicationPackageId: string): Promise<HistoricalLibraryAdmission | null> {
    const sql = getWriteSql("loading historical library admission");
    const [row] = await sql<HistoricalLibraryAdmission[]>`
      SELECT
        id::text AS "admissionId",
        publication_package_id::text AS "publicationPackageId",
        governance_decision_id::text AS "governanceDecisionId",
        admitted_by AS "admittedBy",
        admission_reason AS "admissionReason",
        source_package_snapshot AS "sourcePackageSnapshot",
        included_authority AS "includedAuthority",
        validation_artifacts AS "validationArtifacts",
        audit_refs AS "auditRefs",
        lifecycle,
        created_at::text AS "createdAt"
      FROM historical_library_admissions
      WHERE publication_package_id = ${publicationPackageId}
      LIMIT 1
    `;
    return row || null;
  },

  async createAdmission(input: CreateAdmissionInput): Promise<HistoricalLibraryAdmissionResult> {
    const sql = getWriteSql("creating historical library admission");
    const admissionId = input.admissionId || randomUUID();
    const auditRefs = input.auditRefs || [];

    const snapshots = await Promise.all(
      input.publicationPackage.includedAuthority.map(async (authorityRef) => {
        const snapshot = await buildPublishedMemorySnapshotPayload({
          authorityRef,
          publicationPackage: input.publicationPackage
        });

        return {
        snapshotId: randomUUID(),
        admissionId,
        authorityRef,
        snapshot,
        snapshotHash: hashSnapshot(snapshot),
        lifecycle: "active" as const
        };
      })
    );

    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      const [admission] = await tx<HistoricalLibraryAdmission[]>`
        INSERT INTO historical_library_admissions (
          id,
          publication_package_id,
          governance_decision_id,
          admitted_by,
          admission_reason,
          source_package_snapshot,
          included_authority,
          validation_artifacts,
          audit_refs,
          lifecycle
        )
        VALUES (
          ${admissionId},
          ${input.publicationPackage.packageId},
          ${input.governanceDecisionId},
          ${tx.json(input.admittedBy as any)},
          ${input.admissionReason},
          ${tx.json(input.publicationPackage as any)},
          ${tx.json(input.publicationPackage.includedAuthority as any)},
          ${tx.json(input.publicationPackage.validationArtifacts as any)},
          ${tx.json(auditRefs as any)},
          'admitted'
        )
        ON CONFLICT (publication_package_id) DO NOTHING
        RETURNING
          id::text AS "admissionId",
          publication_package_id::text AS "publicationPackageId",
          governance_decision_id::text AS "governanceDecisionId",
          admitted_by AS "admittedBy",
          admission_reason AS "admissionReason",
          source_package_snapshot AS "sourcePackageSnapshot",
          included_authority AS "includedAuthority",
          validation_artifacts AS "validationArtifacts",
          audit_refs AS "auditRefs",
          lifecycle,
          created_at::text AS "createdAt"
      `;

      if (!admission) {
        throw new ApiError(409, "HISTORICAL_LIBRARY_DUPLICATE_ADMISSION", "PublicationPackage has already been admitted to Published Memory.");
      }

      const insertedSnapshots: PublishedMemorySnapshot[] = [];
      for (const snapshot of snapshots) {
        const [row] = await tx<PublishedMemorySnapshot[]>`
          INSERT INTO historical_library_published_snapshots (
            id,
            admission_id,
            authority_ref,
            snapshot,
            snapshot_hash,
            lifecycle
          )
          VALUES (
            ${snapshot.snapshotId},
            ${admissionId},
            ${tx.json(snapshot.authorityRef as any)},
            ${tx.json(snapshot.snapshot as any)},
            ${snapshot.snapshotHash},
            ${snapshot.lifecycle}
          )
          RETURNING
            id::text AS "snapshotId",
            admission_id::text AS "admissionId",
            authority_ref AS "authorityRef",
            snapshot,
            snapshot_hash AS "snapshotHash",
            lifecycle,
            created_at::text AS "createdAt"
        `;
        insertedSnapshots.push(row!);
      }

      return {
        admission,
        snapshots: insertedSnapshots
      };
    });
  },

  async createRevision(input: LifecycleBaseInput & { revisedSnapshot: Record<string, unknown>; amendmentSummary: string }): Promise<HistoricalLibraryRevision> {
    const sql = getWriteSql("creating historical library published revision");
    const revisedSnapshotHash = hashSnapshot(input.revisedSnapshot);
    const [row] = await sql<HistoricalLibraryRevision[]>`
      INSERT INTO historical_library_published_revisions (
        published_snapshot_id,
        publication_package_id,
        governance_decision_id,
        previous_snapshot,
        revised_snapshot,
        revised_snapshot_hash,
        amendment_summary,
        audit_record_id,
        created_by
      )
      VALUES (
        ${input.publishedSnapshot.snapshotId},
        ${input.publicationPackageId},
        ${input.governanceDecisionId},
        ${sql.json(input.publishedSnapshot.snapshot as any)},
        ${sql.json(input.revisedSnapshot as any)},
        ${revisedSnapshotHash},
        ${input.amendmentSummary},
        ${input.auditRecordId || null},
        ${sql.json(input.actor as any)}
      )
      RETURNING
        id::text AS "revisionId",
        published_snapshot_id::text AS "publishedSnapshotId",
        publication_package_id::text AS "publicationPackageId",
        governance_decision_id::text AS "governanceDecisionId",
        previous_snapshot AS "previousSnapshot",
        revised_snapshot AS "revisedSnapshot",
        revised_snapshot_hash AS "revisedSnapshotHash",
        amendment_summary AS "amendmentSummary",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async createRetirement(input: LifecycleBaseInput & { retirementReason: string; continuityPath: Record<string, unknown> }): Promise<HistoricalLibraryRetirement> {
    const sql = getWriteSql("creating historical library retirement");
    const [row] = await sql<HistoricalLibraryRetirement[]>`
      INSERT INTO historical_library_retirements (
        published_snapshot_id,
        publication_package_id,
        governance_decision_id,
        retirement_reason,
        continuity_path,
        audit_record_id,
        created_by
      )
      VALUES (
        ${input.publishedSnapshot.snapshotId},
        ${input.publicationPackageId},
        ${input.governanceDecisionId},
        ${input.retirementReason},
        ${sql.json(input.continuityPath as any)},
        ${input.auditRecordId || null},
        ${sql.json(input.actor as any)}
      )
      RETURNING
        id::text AS "retirementId",
        published_snapshot_id::text AS "publishedSnapshotId",
        publication_package_id::text AS "publicationPackageId",
        governance_decision_id::text AS "governanceDecisionId",
        retirement_reason AS "retirementReason",
        continuity_path AS "continuityPath",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async createMerge(input: {
    sourceSnapshot: PublishedMemorySnapshot;
    targetSnapshot: PublishedMemorySnapshot;
    publicationPackageId: string;
    governanceDecisionId: string;
    mergeReason: string;
    continuityPath: Record<string, unknown>;
    auditRecordId?: string | null;
    actor: GovernanceActorRef;
  }): Promise<HistoricalLibraryMerge> {
    const sql = getWriteSql("creating historical library merge");
    const [row] = await sql<HistoricalLibraryMerge[]>`
      INSERT INTO historical_library_merges (
        source_published_record_id,
        target_published_record_id,
        publication_package_id,
        governance_decision_id,
        merge_reason,
        continuity_path,
        audit_record_id,
        created_by
      )
      VALUES (
        ${input.sourceSnapshot.snapshotId},
        ${input.targetSnapshot.snapshotId},
        ${input.publicationPackageId},
        ${input.governanceDecisionId},
        ${input.mergeReason},
        ${sql.json(input.continuityPath as any)},
        ${input.auditRecordId || null},
        ${sql.json(input.actor as any)}
      )
      RETURNING
        id::text AS "mergeId",
        source_published_record_id::text AS "sourcePublishedRecordId",
        target_published_record_id::text AS "targetPublishedRecordId",
        publication_package_id::text AS "publicationPackageId",
        governance_decision_id::text AS "governanceDecisionId",
        merge_reason AS "mergeReason",
        continuity_path AS "continuityPath",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async createPreservation(input: LifecycleBaseInput & { preservationReason: string; preservationMetadata: Record<string, unknown> }): Promise<HistoricalLibraryPreservation> {
    const sql = getWriteSql("creating historical library preservation");
    const [row] = await sql<HistoricalLibraryPreservation[]>`
      INSERT INTO historical_library_preservations (
        published_snapshot_id,
        publication_package_id,
        governance_decision_id,
        preservation_reason,
        preservation_metadata,
        audit_record_id,
        created_by
      )
      VALUES (
        ${input.publishedSnapshot.snapshotId},
        ${input.publicationPackageId},
        ${input.governanceDecisionId},
        ${input.preservationReason},
        ${sql.json(input.preservationMetadata as any)},
        ${input.auditRecordId || null},
        ${sql.json(input.actor as any)}
      )
      RETURNING
        id::text AS "preservationId",
        published_snapshot_id::text AS "publishedSnapshotId",
        publication_package_id::text AS "publicationPackageId",
        governance_decision_id::text AS "governanceDecisionId",
        preservation_reason AS "preservationReason",
        preservation_metadata AS "preservationMetadata",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async createFeedbackLink(input: {
    lifecycleActionType: HistoricalLibraryFeedbackLink["lifecycleActionType"];
    lifecycleActionId: string;
    feedbackPackageId: string;
    publicationPackageId: string;
    sourcePublishedRecordId?: string | null;
    targetPublishedRecordId?: string | null;
    actor: GovernanceActorRef;
  }): Promise<HistoricalLibraryFeedbackLink> {
    const sql = getWriteSql("creating historical library feedback link");
    const [row] = await sql<HistoricalLibraryFeedbackLink[]>`
      INSERT INTO historical_library_feedback_links (
        lifecycle_action_type,
        lifecycle_action_id,
        feedback_package_id,
        publication_package_id,
        source_published_record_id,
        target_published_record_id,
        created_by
      )
      VALUES (
        ${input.lifecycleActionType},
        ${input.lifecycleActionId},
        ${input.feedbackPackageId},
        ${input.publicationPackageId},
        ${input.sourcePublishedRecordId || null},
        ${input.targetPublishedRecordId || null},
        ${sql.json(input.actor as any)}
      )
      RETURNING
        id::text AS "feedbackLinkId",
        lifecycle_action_type AS "lifecycleActionType",
        lifecycle_action_id::text AS "lifecycleActionId",
        feedback_package_id::text AS "feedbackPackageId",
        publication_package_id::text AS "publicationPackageId",
        source_published_record_id::text AS "sourcePublishedRecordId",
        target_published_record_id::text AS "targetPublishedRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
    `;
    return row!;
  }
};
