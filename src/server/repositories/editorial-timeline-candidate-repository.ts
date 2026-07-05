import { randomUUID } from "node:crypto";
import { getWriteSql, withWriteTransaction } from "@/src/server/db/client";
import type {
  PersistEditorialTimelineCandidateInput,
  PersistedEditorialTimelineCandidate,
  PersistedEditorialTimelineMilestone
} from "@/src/server/editorial-intelligence/timeline-candidate-persistence-contracts";
import type {
  EditorialTimelineExcludedMilestone,
  EditorialTimelineEvidenceLineage
} from "@/src/server/editorial-intelligence/timeline-compiler-contracts";

type CandidateRow = {
  candidateId: string;
  factoryObjectId: string;
  canonicalSubject: string;
  editorialEvidenceSetId: string;
  compilerVersion: string;
  selectionAlgorithmVersion: string;
  compilerInputFingerprint: string;
  compilerMetadata: PersistedEditorialTimelineCandidate["compilerMetadata"];
  createdBy: string;
  createdAt: string;
};

type MilestoneRow = Omit<PersistedEditorialTimelineMilestone, "evidenceLineage">;
type EvidenceRow = EditorialTimelineEvidenceLineage & { milestoneId: string };

async function hydrateCandidate(row: CandidateRow): Promise<PersistedEditorialTimelineCandidate> {
  const sql = getWriteSql("loading EditorialTimelineCandidate lineage");
  const [milestones, evidence, exclusions] = await Promise.all([
    sql<MilestoneRow[]>`
      SELECT milestone_object_id::text AS "milestoneId", sequence,
        selection_reasons AS "selectionReasons"
      FROM factory_editorial_timeline_candidate_milestones
      WHERE candidate_id = ${row.candidateId}
      ORDER BY sequence
      LIMIT 200
    `,
    sql<EvidenceRow[]>`
      SELECT milestone_object_id::text AS "milestoneId",
        evidence_record_id::text AS "evidenceRecordId",
        validation_record_id::text AS "validationRecordId"
      FROM factory_editorial_timeline_candidate_evidence
      WHERE candidate_id = ${row.candidateId}
      ORDER BY milestone_object_id, evidence_record_id, validation_record_id
      LIMIT 10000
    `,
    sql<EditorialTimelineExcludedMilestone[]>`
      SELECT excluded_milestone_object_id::text AS "milestoneId",
        canonical_milestone_object_id::text AS "canonicalMilestoneId",
        exclusion_reason AS "exclusionReason"
      FROM factory_editorial_timeline_candidate_exclusions
      WHERE candidate_id = ${row.candidateId}
      ORDER BY excluded_milestone_object_id
      LIMIT 200
    `
  ]);
  const evidenceByMilestone = new Map<string, EditorialTimelineEvidenceLineage[]>();
  for (const item of evidence) {
    evidenceByMilestone.set(item.milestoneId, [
      ...(evidenceByMilestone.get(item.milestoneId) || []),
      { evidenceRecordId: item.evidenceRecordId, validationRecordId: item.validationRecordId }
    ]);
  }
  return {
    ...row,
    selectedMilestones: milestones.map((milestone) => ({
      ...milestone,
      evidenceLineage: evidenceByMilestone.get(milestone.milestoneId) || []
    })),
    excludedMilestones: exclusions
  };
}

async function findCandidate(where: "id" | "fingerprint", value: string, editorialEvidenceSetId?: string) {
  const sql = getWriteSql("loading EditorialTimelineCandidate");
  const [row] = where === "id"
    ? await sql<CandidateRow[]>`
      SELECT id::text AS "candidateId", factory_object_id::text AS "factoryObjectId",
        canonical_subject AS "canonicalSubject", editorial_evidence_set_id::text AS "editorialEvidenceSetId",
        compiler_version AS "compilerVersion", selection_algorithm_version AS "selectionAlgorithmVersion",
        compiler_input_fingerprint AS "compilerInputFingerprint", compiler_metadata AS "compilerMetadata",
        created_by AS "createdBy", created_at::text AS "createdAt"
      FROM factory_editorial_timeline_candidates
      WHERE id = ${value}
      LIMIT 1
    `
    : await sql<CandidateRow[]>`
      SELECT id::text AS "candidateId", factory_object_id::text AS "factoryObjectId",
        canonical_subject AS "canonicalSubject", editorial_evidence_set_id::text AS "editorialEvidenceSetId",
        compiler_version AS "compilerVersion", selection_algorithm_version AS "selectionAlgorithmVersion",
        compiler_input_fingerprint AS "compilerInputFingerprint", compiler_metadata AS "compilerMetadata",
        created_by AS "createdBy", created_at::text AS "createdAt"
      FROM factory_editorial_timeline_candidates
      WHERE editorial_evidence_set_id = ${editorialEvidenceSetId!}
        AND compiler_input_fingerprint = ${value}
      LIMIT 1
    `;
  return row ? hydrateCandidate(row) : null;
}

export const editorialTimelineCandidateRepository = {
  async create(input: PersistEditorialTimelineCandidateInput): Promise<PersistedEditorialTimelineCandidate> {
    return withWriteTransaction("persisting immutable EditorialTimelineCandidate", async () => {
      const sql = getWriteSql("persisting immutable EditorialTimelineCandidate");
      const fingerprintLock = `${input.candidate.editorialEvidenceSetId}:${input.candidate.compilerInputFingerprint}`;
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${fingerprintLock}, 0))`;
      const existing = await findCandidate(
        "fingerprint",
        input.candidate.compilerInputFingerprint,
        input.candidate.editorialEvidenceSetId
      );
      if (existing) return existing;

      const candidateId = randomUUID();
      const factoryObjectId = randomUUID();
      await sql`
        INSERT INTO factory_objects
          (id, object_type, title, payload, lifecycle, provenance, created_by, updated_by)
        VALUES (
          ${factoryObjectId},
          'editorial_timeline_candidate',
          'EditorialTimelineCandidate',
          ${sql.json({ editorialTimelineCandidateId: candidateId })},
          'draft',
          ${sql.json({
            institution: "factory",
            authorityDecision: false,
            publicationReadinessDecision: false,
            compilerInputFingerprint: input.candidate.compilerInputFingerprint
          })},
          ${input.actor},
          ${input.actor}
        )
      `;
      await sql`
        INSERT INTO factory_editorial_timeline_candidates (
          id, factory_object_id, editorial_evidence_set_id, canonical_subject,
          compiler_version, selection_algorithm_version, compiler_input_fingerprint,
          compiler_metadata, created_by
        )
        VALUES (
          ${candidateId}, ${factoryObjectId}, ${input.candidate.editorialEvidenceSetId},
          ${input.candidate.canonicalSubject}, ${input.candidate.compilerVersion},
          ${input.candidate.selectionAlgorithmVersion}, ${input.candidate.compilerInputFingerprint},
          ${sql.json(input.candidate.compilerMetadata as any)}, ${input.actor}
        )
      `;

      const selectedRows = input.candidate.selectedMilestones.map((milestone) => ({
        milestone_id: milestone.milestoneId,
        sequence: milestone.sequence,
        selection_reasons: milestone.selectionReasons
      }));
      await sql`
        INSERT INTO factory_editorial_timeline_candidate_milestones
          (candidate_id, milestone_object_id, sequence, selection_reasons)
        SELECT ${candidateId}, record.milestone_id::uuid, record.sequence, record.selection_reasons
        FROM jsonb_to_recordset(${sql.json(selectedRows as any)})
          AS record(milestone_id text, sequence integer, selection_reasons jsonb)
      `;

      const evidenceRows = input.candidate.selectedMilestones.flatMap((milestone) =>
        milestone.evidenceLineage.map((lineage) => ({
          milestone_id: milestone.milestoneId,
          evidence_record_id: lineage.evidenceRecordId,
          validation_record_id: lineage.validationRecordId
        }))
      );
      await sql`
        INSERT INTO factory_editorial_timeline_candidate_evidence
          (candidate_id, milestone_object_id, evidence_record_id, validation_record_id)
        SELECT ${candidateId}, record.milestone_id::uuid, record.evidence_record_id::uuid,
          record.validation_record_id::uuid
        FROM jsonb_to_recordset(${sql.json(evidenceRows as any)})
          AS record(milestone_id text, evidence_record_id text, validation_record_id text)
      `;

      if (input.candidate.excludedMilestones.length > 0) {
        const exclusionRows = input.candidate.excludedMilestones.map((excluded) => ({
          milestone_id: excluded.milestoneId,
          canonical_milestone_id: excluded.canonicalMilestoneId,
          exclusion_reason: excluded.exclusionReason
        }));
        await sql`
          INSERT INTO factory_editorial_timeline_candidate_exclusions
            (candidate_id, excluded_milestone_object_id, canonical_milestone_object_id, exclusion_reason)
          SELECT ${candidateId}, record.milestone_id::uuid, record.canonical_milestone_id::uuid,
            record.exclusion_reason
          FROM jsonb_to_recordset(${sql.json(exclusionRows as any)})
            AS record(milestone_id text, canonical_milestone_id text, exclusion_reason text)
        `;
      }
      return (await findCandidate("id", candidateId))!;
    });
  },

  async getById(candidateId: string): Promise<PersistedEditorialTimelineCandidate | null> {
    return findCandidate("id", candidateId);
  },

  async getByFingerprint(
    editorialEvidenceSetId: string,
    compilerInputFingerprint: string
  ): Promise<PersistedEditorialTimelineCandidate | null> {
    return findCandidate("fingerprint", compilerInputFingerprint, editorialEvidenceSetId);
  }
};
