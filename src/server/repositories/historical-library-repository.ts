import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { AuthorityRef, EvidenceRef, GovernanceActorRef, PublicationPackage } from "@/src/server/governance/contracts";
import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";

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

export type HistoricalLibraryWithdrawal = {
  withdrawalId: string;
  publishedSnapshotId: string;
  publicationPackageId: string;
  governanceDecisionId: string;
  withdrawalReason: string;
  continuityPath: Record<string, unknown>;
  auditRecordId: string | null;
  createdBy: GovernanceActorRef;
  createdAt?: string;
};

export type HistoricalLibrarySplit = {
  splitId: string;
  sourcePublishedRecordId: string;
  publicationPackageId: string;
  governanceDecisionId: string;
  splitReason: string;
  provenance: Record<string, unknown>;
  childPublishedRecordIds: string[];
  auditRecordId: string | null;
  createdBy: GovernanceActorRef;
  createdAt?: string;
};

export type HistoricalLibrarySupersession = {
  supersessionId: string;
  previousPublishedRecordId: string;
  newPublishedRecordId: string;
  publicationPackageId: string;
  governanceDecisionId: string;
  supersessionReason: string;
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

  const canonicalAuthority = (input.publicationPackage.canonicalAuthority || []).find(
    (authority) =>
      authority.authorityRef.authorityType === input.authorityRef.authorityType &&
      authority.authorityRef.authorityId === input.authorityRef.authorityId
  );
  if (!canonicalAuthority) {
    throw new ApiError(409, "CANONICAL_AUTHORITY_PAYLOAD_MISSING", "Historical Library admission requires a Governance-approved canonical authority payload.");
  }

  const canonicalPayload = {
    ...base,
    title: canonicalAuthority.title,
    payload: canonicalAuthority.payload,
    provenance: canonicalAuthority.provenance,
    factoryObjectId: canonicalAuthority.factoryObjectId,
    governanceDecisionRefs: input.publicationPackage.decisionRefs,
    validationArtifacts: input.publicationPackage.validationArtifacts
  };

  return canonicalPayload;
}

async function appendLifecycleRecords(tx: Sql, input: {
  operationType: "split" | "supersession" | "withdrawal";
  operationId: string;
  sourceId: string;
  targetIds: string[];
  relationship: "split_into" | "superseded_by" | "withdrawn";
  governanceDecisionId: string;
  reason: string;
  actor: GovernanceActorRef;
  references: Record<string, unknown>;
}): Promise<void> {
  const targets = input.targetIds.length > 0 ? input.targetIds : [null];
  for (const targetId of targets) {
    await tx`
      INSERT INTO historical_library_continuity_edges (
        operation_type, operation_id, source_published_record_id,
        target_published_record_id, relationship, lineage
      ) VALUES (
        ${input.operationType}, ${input.operationId}, ${input.sourceId},
        ${targetId}, ${input.relationship}, ${tx.json(input.references as any)}
      )
    `;
  }
  await tx`
    INSERT INTO historical_library_lifecycle_audit (
      operation_type, operation_id, authority_ids, previous_authority_id,
      new_authority_ids, governance_decision_id, reason, actor, reference_data
    ) VALUES (
      ${input.operationType}, ${input.operationId}, ${[input.sourceId, ...input.targetIds]},
      ${input.sourceId}, ${input.targetIds}, ${input.governanceDecisionId}, ${input.reason},
      ${tx.json(input.actor as any)}, ${tx.json(input.references as any)}
    )
  `;
}

export const historicalLibraryRepository = {
  async getPublishedSnapshotsByAdmissionId(admissionId: string): Promise<PublishedMemorySnapshot[]> {
    const sql = getWriteSql("loading published snapshots for admission");
    return sql<PublishedMemorySnapshot[]>`
      SELECT id::text AS "snapshotId", admission_id::text AS "admissionId",
        authority_ref AS "authorityRef", snapshot, snapshot_hash AS "snapshotHash",
        lifecycle, created_at::text AS "createdAt"
      FROM historical_library_published_snapshots
      WHERE admission_id = ${admissionId}
      ORDER BY created_at, id
    `;
  },

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

  async listUnprojectedPublishedSnapshots(limit = 1000, offset = 0): Promise<PublishedMemorySnapshot[]> {
    const sql = getWriteSql("listing unprojected published snapshots");
    return sql<PublishedMemorySnapshot[]>`
      SELECT s.id::text AS "snapshotId",s.admission_id::text AS "admissionId",s.authority_ref AS "authorityRef",
        s.snapshot,s.snapshot_hash AS "snapshotHash",s.lifecycle,s.created_at::text AS "createdAt"
      FROM historical_library_published_snapshots s
      WHERE s.lifecycle='active'
        AND s.authority_ref->>'authorityType' IN ('historical_object','milestone','relationship')
        AND NOT EXISTS (
        SELECT 1 FROM published_memory_projections p
        WHERE p.published_snapshot_id=s.id AND p.lifecycle='active'
      )
      ORDER BY s.created_at,s.id LIMIT ${limit} OFFSET ${offset}`;
  },

  async countUnprojectedPublishedSnapshots(): Promise<number> {
    const sql = getWriteSql("counting unprojected published snapshots");
    const [row] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM historical_library_published_snapshots s
      WHERE s.lifecycle='active'
        AND s.authority_ref->>'authorityType' IN ('historical_object','milestone','relationship')
        AND NOT EXISTS (
        SELECT 1 FROM published_memory_projections p WHERE p.published_snapshot_id=s.id AND p.lifecycle='active'
      )`;
    return row?.count || 0;
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

      await tx`
        INSERT INTO historical_library_lifecycle_audit (
          operation_type, operation_id, authority_ids, previous_authority_id,
          new_authority_ids, governance_decision_id, reason, actor, reference_data
        ) VALUES (
          'admission', ${admissionId}, ${insertedSnapshots.map((item) => item.snapshotId)}, NULL,
          ${insertedSnapshots.map((item) => item.snapshotId)}, ${input.governanceDecisionId},
          ${input.admissionReason}, ${tx.json(input.admittedBy as any)},
          ${tx.json({ publicationPackageId: input.publicationPackage.packageId, auditRefs } as any)}
        )
      `;

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

  async createWithdrawal(input: LifecycleBaseInput & {
    withdrawalReason: string;
    continuityPath: Record<string, unknown>;
  }): Promise<HistoricalLibraryWithdrawal> {
    const sql = getWriteSql("creating historical library withdrawal");
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${input.publishedSnapshot.snapshotId}, 0))`;
      const [existing] = await tx<HistoricalLibraryWithdrawal[]>`
        SELECT id::text AS "withdrawalId", published_snapshot_id::text AS "publishedSnapshotId",
          publication_package_id::text AS "publicationPackageId", governance_decision_id::text AS "governanceDecisionId",
          withdrawal_reason AS "withdrawalReason", continuity_path AS "continuityPath",
          audit_record_id::text AS "auditRecordId", created_by AS "createdBy", created_at::text AS "createdAt"
        FROM historical_library_withdrawals WHERE published_snapshot_id=${input.publishedSnapshot.snapshotId} LIMIT 1
      `;
      if (existing) {
        if (existing.governanceDecisionId !== input.governanceDecisionId) throw new ApiError(409, "HISTORICAL_LIBRARY_WITHDRAWAL_CONFLICT", "Authority was withdrawn by a different Governance decision.");
        return existing;
      }
      const [row] = await tx<HistoricalLibraryWithdrawal[]>`
        INSERT INTO historical_library_withdrawals (
          published_snapshot_id, publication_package_id, governance_decision_id, withdrawal_reason,
          continuity_path, audit_record_id, created_by
        ) VALUES (
          ${input.publishedSnapshot.snapshotId}, ${input.publicationPackageId}, ${input.governanceDecisionId},
          ${input.withdrawalReason}, ${tx.json(input.continuityPath as any)}, ${input.auditRecordId || null},
          ${tx.json(input.actor as any)}
        ) RETURNING id::text AS "withdrawalId", published_snapshot_id::text AS "publishedSnapshotId",
          publication_package_id::text AS "publicationPackageId", governance_decision_id::text AS "governanceDecisionId",
          withdrawal_reason AS "withdrawalReason", continuity_path AS "continuityPath",
          audit_record_id::text AS "auditRecordId", created_by AS "createdBy", created_at::text AS "createdAt"
      `;
      await appendLifecycleRecords(tx, {
        operationType: "withdrawal", operationId: row!.withdrawalId,
        sourceId: input.publishedSnapshot.snapshotId, targetIds: [], relationship: "withdrawn",
        governanceDecisionId: input.governanceDecisionId, reason: input.withdrawalReason,
        actor: input.actor, references: input.continuityPath
      });
      return row!;
    });
  },

  async createSupersession(input: {
    previousSnapshot: PublishedMemorySnapshot; newSnapshot: PublishedMemorySnapshot;
    publicationPackageId: string; governanceDecisionId: string; supersessionReason: string;
    auditRecordId?: string | null; actor: GovernanceActorRef;
  }): Promise<HistoricalLibrarySupersession> {
    const sql = getWriteSql("creating historical library supersession");
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${input.previousSnapshot.snapshotId}, 0))`;
      const [inserted] = await tx<HistoricalLibrarySupersession[]>`
        INSERT INTO historical_library_supersessions (
          previous_published_record_id, new_published_record_id, publication_package_id,
          governance_decision_id, supersession_reason, audit_record_id, created_by
        ) VALUES (
          ${input.previousSnapshot.snapshotId}, ${input.newSnapshot.snapshotId}, ${input.publicationPackageId},
          ${input.governanceDecisionId}, ${input.supersessionReason}, ${input.auditRecordId || null},
          ${tx.json(input.actor as any)}
        ) ON CONFLICT (previous_published_record_id) DO NOTHING
        RETURNING id::text AS "supersessionId", previous_published_record_id::text AS "previousPublishedRecordId",
          new_published_record_id::text AS "newPublishedRecordId", publication_package_id::text AS "publicationPackageId",
          governance_decision_id::text AS "governanceDecisionId", supersession_reason AS "supersessionReason",
          audit_record_id::text AS "auditRecordId", created_by AS "createdBy", created_at::text AS "createdAt"
      `;
      const [row] = inserted ? [inserted] : await tx<HistoricalLibrarySupersession[]>`
        SELECT id::text AS "supersessionId", previous_published_record_id::text AS "previousPublishedRecordId",
          new_published_record_id::text AS "newPublishedRecordId", publication_package_id::text AS "publicationPackageId",
          governance_decision_id::text AS "governanceDecisionId", supersession_reason AS "supersessionReason",
          audit_record_id::text AS "auditRecordId", created_by AS "createdBy", created_at::text AS "createdAt"
        FROM historical_library_supersessions WHERE previous_published_record_id=${input.previousSnapshot.snapshotId} LIMIT 1
      `;
      if (!row || row.governanceDecisionId !== input.governanceDecisionId || row.newPublishedRecordId !== input.newSnapshot.snapshotId) {
        throw new ApiError(409, "HISTORICAL_LIBRARY_SUPERSESSION_CONFLICT", "Authority already has a different explicit supersession.");
      }
      if (!inserted) return row;
      await appendLifecycleRecords(tx, {
        operationType: "supersession", operationId: row.supersessionId,
        sourceId: input.previousSnapshot.snapshotId, targetIds: [input.newSnapshot.snapshotId],
        relationship: "superseded_by", governanceDecisionId: input.governanceDecisionId,
        reason: input.supersessionReason, actor: input.actor, references: {}
      });
      return row;
    });
  },

  async createSplit(input: {
    sourceSnapshot: PublishedMemorySnapshot; childSnapshots: PublishedMemorySnapshot[];
    publicationPackageId: string; governanceDecisionId: string; splitReason: string;
    provenance: Record<string, unknown>; redirects: Record<string, Record<string, unknown>>;
    auditRecordId?: string | null; actor: GovernanceActorRef;
  }): Promise<HistoricalLibrarySplit> {
    const sql = getWriteSql("creating historical library split");
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${input.sourceSnapshot.snapshotId}, 0))`;
      const [existing] = await tx<Array<{ splitId: string; governanceDecisionId: string; childPublishedRecordIds: string[] }>>`
        SELECT s.id::text AS "splitId", s.governance_decision_id::text AS "governanceDecisionId",
          COALESCE(array_agg(c.child_published_record_id::text ORDER BY c.sequence), '{}') AS "childPublishedRecordIds"
        FROM historical_library_splits s
        LEFT JOIN historical_library_split_children c ON c.split_id=s.id
        WHERE s.source_published_record_id=${input.sourceSnapshot.snapshotId}
        GROUP BY s.id
        LIMIT 1
      `;
      const childIds = input.childSnapshots.map((item) => item.snapshotId);
      if (existing) {
        if (existing.governanceDecisionId !== input.governanceDecisionId ||
            JSON.stringify(existing.childPublishedRecordIds) !== JSON.stringify(childIds)) {
          throw new ApiError(409, "HISTORICAL_LIBRARY_SPLIT_CONFLICT", "Authority already has a different canonical split.");
        }
        const [persisted] = await tx<Omit<HistoricalLibrarySplit, "childPublishedRecordIds">[]>`
          SELECT id::text AS "splitId", source_published_record_id::text AS "sourcePublishedRecordId",
            publication_package_id::text AS "publicationPackageId", governance_decision_id::text AS "governanceDecisionId",
            split_reason AS "splitReason", provenance, audit_record_id::text AS "auditRecordId",
            created_by AS "createdBy", created_at::text AS "createdAt"
          FROM historical_library_splits WHERE id=${existing.splitId}
        `;
        return { ...persisted!, childPublishedRecordIds: existing.childPublishedRecordIds };
      }
      const [row] = await tx<Omit<HistoricalLibrarySplit, "childPublishedRecordIds">[]>`
        INSERT INTO historical_library_splits (
          source_published_record_id, publication_package_id, governance_decision_id,
          split_reason, provenance, audit_record_id, created_by
        ) VALUES (
          ${input.sourceSnapshot.snapshotId}, ${input.publicationPackageId}, ${input.governanceDecisionId},
          ${input.splitReason}, ${tx.json(input.provenance as any)}, ${input.auditRecordId || null},
          ${tx.json(input.actor as any)}
        ) RETURNING id::text AS "splitId", source_published_record_id::text AS "sourcePublishedRecordId",
          publication_package_id::text AS "publicationPackageId", governance_decision_id::text AS "governanceDecisionId",
          split_reason AS "splitReason", provenance, audit_record_id::text AS "auditRecordId",
          created_by AS "createdBy", created_at::text AS "createdAt"
      `;
      for (const [index, child] of input.childSnapshots.entries()) {
        await tx`INSERT INTO historical_library_split_children (
          split_id, child_published_record_id, sequence, redirect_metadata
        ) VALUES (${row!.splitId}, ${child.snapshotId}, ${index + 1}, ${tx.json(input.redirects[child.snapshotId] as any)})`;
      }
      await appendLifecycleRecords(tx, {
        operationType: "split", operationId: row!.splitId,
        sourceId: input.sourceSnapshot.snapshotId, targetIds: input.childSnapshots.map((item) => item.snapshotId),
        relationship: "split_into", governanceDecisionId: input.governanceDecisionId,
        reason: input.splitReason, actor: input.actor, references: input.provenance
      });
      return { ...row!, childPublishedRecordIds: childIds };
    });
  },

  async getContinuityByAuthorityId(authorityRecordId: string, limit = 200) {
    const sql = getWriteSql("loading bounded historical library continuity");
    return sql`
      SELECT id::text, operation_type AS "operationType", operation_id::text AS "operationId",
        source_published_record_id::text AS "sourcePublishedRecordId",
        target_published_record_id::text AS "targetPublishedRecordId", relationship, lineage,
        created_at::text AS "createdAt"
      FROM historical_library_continuity_edges
      WHERE source_published_record_id=${authorityRecordId} OR target_published_record_id=${authorityRecordId}
      ORDER BY created_at, id LIMIT ${Math.min(Math.max(limit, 1), 200)}
    `;
  },

  async getActiveCanonicalAuthority(authorityRef: AuthorityRef): Promise<PublishedMemorySnapshot | null> {
    const sql = getWriteSql("loading exact active Historical Library canonical authority");
    const [row] = await sql<PublishedMemorySnapshot[]>`
      SELECT id::text AS "snapshotId", admission_id::text AS "admissionId",
        authority_ref AS "authorityRef", snapshot, snapshot_hash AS "snapshotHash",
        lifecycle, created_at::text AS "createdAt"
      FROM historical_library_active_canonical_authority
      WHERE authority_ref->>'authorityType'=${authorityRef.authorityType}
        AND authority_ref->>'authorityId'=${authorityRef.authorityId}
      LIMIT 1
    `;
    return row || null;
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
