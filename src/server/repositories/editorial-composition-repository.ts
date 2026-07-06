import { randomUUID } from "node:crypto";
import { getWriteSql, withWriteTransaction } from "@/src/server/db/client";
import type {
  EditorialCompositionPersistence,
  PersistEditorialCompositionInput,
  PersistedEditorialComposition
} from "@/src/server/editorial-intelligence/editorial-composition-persistence-contracts";

type CompositionRow = Omit<
  PersistedEditorialComposition,
  "introduction" | "phases" | "turningPoints" | "transitions" | "continuity" |
  "historicalArcs" | "excludedMilestoneIds" | "conclusion"
>;

async function hydrateComposition(row: CompositionRow): Promise<PersistedEditorialComposition> {
  const sql = getWriteSql("loading EditorialComposition lineage");
  const [boundaries, phaseRows, phaseMilestones, turningPoints, transitions, continuity, arcRows, arcPhases, arcMilestones, exclusions] =
    await Promise.all([
      sql<Array<{ boundaryType: "introduction" | "conclusion"; anchorMilestoneId: string; purpose: PersistedEditorialComposition["introduction"]["purpose"] }>>`
        SELECT boundary_type AS "boundaryType", anchor_milestone_object_id::text AS "anchorMilestoneId", purpose
        FROM factory_editorial_composition_boundaries
        WHERE composition_id = ${row.compositionId}
        ORDER BY boundary_type
        LIMIT 2
      `,
      sql<Array<{ phaseId: string; sequence: number; startMilestoneId: string; endMilestoneId: string; basis: PersistedEditorialComposition["phases"][number]["basis"] }>>`
        SELECT phase_key AS "phaseId", sequence, start_milestone_object_id::text AS "startMilestoneId",
          end_milestone_object_id::text AS "endMilestoneId", basis
        FROM factory_editorial_composition_phases
        WHERE composition_id = ${row.compositionId}
        ORDER BY sequence
        LIMIT 200
      `,
      sql<Array<{ phaseId: string; milestoneId: string; position: number }>>`
        SELECT phase_key AS "phaseId", milestone_object_id::text AS "milestoneId", position
        FROM factory_editorial_composition_phase_milestones
        WHERE composition_id = ${row.compositionId}
        ORDER BY phase_key, position
        LIMIT 200
      `,
      sql<Array<{ milestoneId: string; evidenceRecordId: string; phaseBeforeId: string | null; phaseAfterId: string | null; source: "ei_001_identified_turning_point" }>>`
        SELECT milestone_object_id::text AS "milestoneId", evidence_record_id::text AS "evidenceRecordId",
          phase_before_key AS "phaseBeforeId", phase_after_key AS "phaseAfterId", source
        FROM factory_editorial_composition_turning_points
        WHERE composition_id = ${row.compositionId}
        ORDER BY milestone_object_id, evidence_record_id
        LIMIT 10000
      `,
      sql<PersistedEditorialComposition["transitions"][number][]>`
        SELECT from_phase_key AS "fromPhaseId", to_phase_key AS "toPhaseId",
          boundary_milestone_object_id::text AS "boundaryMilestoneId", transition_type AS "transitionType"
        FROM factory_editorial_composition_transitions
        WHERE composition_id = ${row.compositionId}
        ORDER BY sequence
        LIMIT 199
      `,
      sql<PersistedEditorialComposition["continuity"][number][]>`
        SELECT from_milestone_object_id::text AS "fromMilestoneId",
          to_milestone_object_id::text AS "toMilestoneId", basis
        FROM factory_editorial_composition_continuity
        WHERE composition_id = ${row.compositionId}
        ORDER BY sequence
        LIMIT 199
      `,
      sql<Array<{ arcId: string; sequence: number; basis: "full_timeline_arc" }>>`
        SELECT arc_key AS "arcId", sequence, basis
        FROM factory_editorial_composition_arcs
        WHERE composition_id = ${row.compositionId}
        ORDER BY sequence
        LIMIT 200
      `,
      sql<Array<{ arcId: string; phaseId: string; position: number }>>`
        SELECT arc_key AS "arcId", phase_key AS "phaseId", position
        FROM factory_editorial_composition_arc_phases
        WHERE composition_id = ${row.compositionId}
        ORDER BY arc_key, position
        LIMIT 40000
      `,
      sql<Array<{ arcId: string; milestoneId: string; position: number }>>`
        SELECT arc_key AS "arcId", milestone_object_id::text AS "milestoneId", position
        FROM factory_editorial_composition_arc_milestones
        WHERE composition_id = ${row.compositionId}
        ORDER BY arc_key, position
        LIMIT 40000
      `,
      sql<Array<{ milestoneId: string }>>`
        SELECT excluded_milestone_object_id::text AS "milestoneId"
        FROM factory_editorial_timeline_candidate_exclusions
        WHERE candidate_id = ${row.editorialTimelineCandidateId}
        ORDER BY excluded_milestone_object_id
        LIMIT 200
      `
    ]);
  const boundary = (type: "introduction" | "conclusion") => {
    const value = boundaries.find((item) => item.boundaryType === type);
    if (!value) throw new Error(`Persisted EditorialComposition is missing its ${type} boundary.`);
    return { anchorMilestoneIds: [value.anchorMilestoneId], purpose: value.purpose };
  };
  const turningPointGroups = new Map<string, Array<(typeof turningPoints)[number]>>();
  for (const item of turningPoints) {
    const key = `${item.milestoneId}:${item.phaseBeforeId || ""}:${item.phaseAfterId || ""}`;
    turningPointGroups.set(key, [...(turningPointGroups.get(key) || []), item]);
  }
  return {
    ...row,
    introduction: boundary("introduction"),
    phases: phaseRows.map((phase) => ({
      ...phase,
      milestoneIds: phaseMilestones.filter((item) => item.phaseId === phase.phaseId).map((item) => item.milestoneId)
    })),
    turningPoints: [...turningPointGroups.values()].map((items) => ({
      milestoneId: items[0]!.milestoneId,
      evidenceRecordIds: items.map((item) => item.evidenceRecordId),
      phaseBeforeId: items[0]!.phaseBeforeId,
      phaseAfterId: items[0]!.phaseAfterId,
      source: items[0]!.source
    })),
    transitions,
    continuity,
    historicalArcs: arcRows.map((arc) => ({
      ...arc,
      phaseIds: arcPhases.filter((item) => item.arcId === arc.arcId).map((item) => item.phaseId),
      milestoneIds: arcMilestones.filter((item) => item.arcId === arc.arcId).map((item) => item.milestoneId)
    })),
    excludedMilestoneIds: exclusions.map((item) => item.milestoneId),
    conclusion: boundary("conclusion")
  };
}

async function findComposition(
  where: "id" | "fingerprint",
  value: string,
  editorialTimelineCandidateId?: string
): Promise<PersistedEditorialComposition | null> {
  const sql = getWriteSql("loading EditorialComposition");
  const columns = sql`
    id::text AS "compositionId", factory_object_id::text AS "factoryObjectId",
    canonical_subject AS "canonicalSubject", editorial_evidence_set_id::text AS "editorialEvidenceSetId",
    editorial_timeline_candidate_id::text AS "editorialTimelineCandidateId",
    editorial_timeline_candidate_fingerprint AS "editorialTimelineCandidateFingerprint",
    planner_version AS "plannerVersion", structure_algorithm_version AS "structureAlgorithmVersion",
    planner_input_fingerprint AS "plannerInputFingerprint", composition_metadata AS "compositionMetadata",
    created_by AS "createdBy", created_at::text AS "createdAt"
  `;
  const [row] = where === "id"
    ? await sql<CompositionRow[]>`
      SELECT ${columns} FROM factory_editorial_compositions
      WHERE id = ${value}
      LIMIT 1
    `
    : await sql<CompositionRow[]>`
      SELECT ${columns} FROM factory_editorial_compositions
      WHERE editorial_timeline_candidate_id = ${editorialTimelineCandidateId!}
        AND planner_input_fingerprint = ${value}
      LIMIT 1
    `;
  return row ? hydrateComposition(row) : null;
}

export const editorialCompositionRepository: EditorialCompositionPersistence = {
  async create(input: PersistEditorialCompositionInput): Promise<PersistedEditorialComposition> {
    return withWriteTransaction("persisting immutable EditorialComposition", async () => {
      const sql = getWriteSql("persisting immutable EditorialComposition");
      const composition = input.composition;
      const fingerprintLock = `${composition.editorialTimelineCandidateId}:${composition.plannerInputFingerprint}`;
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${fingerprintLock}, 0))`;
      const existing = await findComposition(
        "fingerprint",
        composition.plannerInputFingerprint,
        composition.editorialTimelineCandidateId
      );
      if (existing) return existing;

      const compositionId = randomUUID();
      const factoryObjectId = randomUUID();
      await sql`
        INSERT INTO factory_objects
          (id, object_type, title, payload, lifecycle, provenance, created_by, updated_by)
        VALUES (
          ${factoryObjectId}, 'editorial_composition', 'EditorialComposition',
          ${sql.json({ editorialCompositionId: compositionId })}, 'draft',
          ${sql.json({
            institution: "factory",
            authorityDecision: false,
            publicationReadinessDecision: false,
            plannerInputFingerprint: composition.plannerInputFingerprint
          })},
          ${input.actor}, ${input.actor}
        )
      `;
      await sql`
        INSERT INTO factory_editorial_compositions (
          id, factory_object_id, editorial_timeline_candidate_id, editorial_evidence_set_id,
          canonical_subject, editorial_timeline_candidate_fingerprint, planner_version,
          structure_algorithm_version, planner_input_fingerprint, composition_metadata, created_by
        ) VALUES (
          ${compositionId}, ${factoryObjectId}, ${composition.editorialTimelineCandidateId},
          ${composition.editorialEvidenceSetId}, ${composition.canonicalSubject},
          ${composition.editorialTimelineCandidateFingerprint}, ${composition.plannerVersion},
          ${composition.structureAlgorithmVersion}, ${composition.plannerInputFingerprint},
          ${sql.json(composition.compositionMetadata as any)}, ${input.actor}
        )
      `;
      const phaseRows = composition.phases.map((phase) => ({
        phase_key: phase.phaseId, sequence: phase.sequence, start_id: phase.startMilestoneId,
        end_id: phase.endMilestoneId, basis: phase.basis
      }));
      await sql`
        INSERT INTO factory_editorial_composition_phases
          (composition_id, phase_key, sequence, start_milestone_object_id, end_milestone_object_id, basis)
        SELECT ${compositionId}, phase_key, sequence, start_id::uuid, end_id::uuid, basis
        FROM jsonb_to_recordset(${sql.json(phaseRows as any)})
          AS row(phase_key text, sequence integer, start_id text, end_id text, basis text)
      `;
      const membershipRows = composition.phases.flatMap((phase) =>
        phase.milestoneIds.map((milestoneId, index) => ({
          phase_key: phase.phaseId, milestone_id: milestoneId, position: index + 1
        }))
      );
      await sql`
        INSERT INTO factory_editorial_composition_phase_milestones
          (composition_id, phase_key, milestone_object_id, position)
        SELECT ${compositionId}, phase_key, milestone_id::uuid, position
        FROM jsonb_to_recordset(${sql.json(membershipRows as any)})
          AS row(phase_key text, milestone_id text, position integer)
      `;
      for (const boundary of [
        { boundaryType: "introduction", value: composition.introduction },
        { boundaryType: "conclusion", value: composition.conclusion }
      ] as const) {
        await sql`
          INSERT INTO factory_editorial_composition_boundaries
            (composition_id, boundary_type, anchor_milestone_object_id, purpose)
          VALUES (${compositionId}, ${boundary.boundaryType}, ${boundary.value.anchorMilestoneIds[0]!}, ${boundary.value.purpose})
        `;
      }
      const turningRows = composition.turningPoints.flatMap((turningPoint) =>
        turningPoint.evidenceRecordIds.map((evidenceRecordId) => ({
          milestone_id: turningPoint.milestoneId, evidence_id: evidenceRecordId,
          phase_before: turningPoint.phaseBeforeId, phase_after: turningPoint.phaseAfterId,
          source: turningPoint.source
        }))
      );
      if (turningRows.length > 0) await sql`
        INSERT INTO factory_editorial_composition_turning_points
          (composition_id, milestone_object_id, evidence_record_id, phase_before_key, phase_after_key, source)
        SELECT ${compositionId}, milestone_id::uuid, evidence_id::uuid, phase_before, phase_after, source
        FROM jsonb_to_recordset(${sql.json(turningRows as any)})
          AS row(milestone_id text, evidence_id text, phase_before text, phase_after text, source text)
      `;
      const transitionRows = composition.transitions.map((transition, index) => ({
        sequence: index + 1, from_phase: transition.fromPhaseId, to_phase: transition.toPhaseId,
        boundary_id: transition.boundaryMilestoneId, transition_type: transition.transitionType
      }));
      if (transitionRows.length > 0) await sql`
        INSERT INTO factory_editorial_composition_transitions
          (composition_id, sequence, from_phase_key, to_phase_key, boundary_milestone_object_id, transition_type)
        SELECT ${compositionId}, sequence, from_phase, to_phase, boundary_id::uuid, transition_type
        FROM jsonb_to_recordset(${sql.json(transitionRows as any)})
          AS row(sequence integer, from_phase text, to_phase text, boundary_id text, transition_type text)
      `;
      const continuityRows = composition.continuity.map((item, index) => ({
        sequence: index + 1, from_id: item.fromMilestoneId, to_id: item.toMilestoneId, basis: item.basis
      }));
      if (continuityRows.length > 0) await sql`
        INSERT INTO factory_editorial_composition_continuity
          (composition_id, sequence, from_milestone_object_id, to_milestone_object_id, basis)
        SELECT ${compositionId}, sequence, from_id::uuid, to_id::uuid, basis
        FROM jsonb_to_recordset(${sql.json(continuityRows as any)})
          AS row(sequence integer, from_id text, to_id text, basis text)
      `;
      const arcRows = composition.historicalArcs.map((arc) => ({
        arc_key: arc.arcId, sequence: arc.sequence, basis: arc.basis
      }));
      await sql`
        INSERT INTO factory_editorial_composition_arcs (composition_id, arc_key, sequence, basis)
        SELECT ${compositionId}, arc_key, sequence, basis
        FROM jsonb_to_recordset(${sql.json(arcRows as any)})
          AS row(arc_key text, sequence integer, basis text)
      `;
      const arcPhaseRows = composition.historicalArcs.flatMap((arc) =>
        arc.phaseIds.map((phaseId, index) => ({ arc_key: arc.arcId, phase_key: phaseId, position: index + 1 }))
      );
      await sql`
        INSERT INTO factory_editorial_composition_arc_phases (composition_id, arc_key, phase_key, position)
        SELECT ${compositionId}, arc_key, phase_key, position
        FROM jsonb_to_recordset(${sql.json(arcPhaseRows as any)})
          AS row(arc_key text, phase_key text, position integer)
      `;
      const arcMilestoneRows = composition.historicalArcs.flatMap((arc) =>
        arc.milestoneIds.map((milestoneId, index) => ({
          arc_key: arc.arcId, milestone_id: milestoneId, position: index + 1
        }))
      );
      await sql`
        INSERT INTO factory_editorial_composition_arc_milestones
          (composition_id, arc_key, milestone_object_id, position)
        SELECT ${compositionId}, arc_key, milestone_id::uuid, position
        FROM jsonb_to_recordset(${sql.json(arcMilestoneRows as any)})
          AS row(arc_key text, milestone_id text, position integer)
      `;
      return (await findComposition("id", compositionId))!;
    });
  },

  async getById(compositionId: string): Promise<PersistedEditorialComposition | null> {
    return findComposition("id", compositionId);
  },

  async getByFingerprint(
    editorialTimelineCandidateId: string,
    plannerInputFingerprint: string
  ): Promise<PersistedEditorialComposition | null> {
    return findComposition("fingerprint", plannerInputFingerprint, editorialTimelineCandidateId);
  }
};
