import { ApiError } from "@/src/server/api/responses";
import type { EditorialEvidenceSet, RankedEditorialEvidence } from "@/src/server/editorial-intelligence/contracts";
import type { EditorialTimelineCompilerInput, GroundedMilestoneCandidate } from "@/src/server/editorial-intelligence/timeline-compiler-contracts";
import type { FactoryObject } from "@/src/server/factory/contracts";
import { parseHistoricalDateInput } from "@/src/lib/historical-date";
import type { DatePrecision } from "@/src/lib/types";

const DATE_PRECISIONS = new Set<DatePrecision>(["year", "month", "day", "approximate"]);

function evidenceIdsFromMilestone(milestone: FactoryObject): string[] {
  const ids = new Set<string>();
  const sourceRefs = milestone.payload.sourceRefs;
  if (Array.isArray(sourceRefs)) {
    for (const ref of sourceRefs) {
      if (typeof ref === "string" && ref) ids.add(ref);
    }
  }
  const evidence = milestone.payload.evidence;
  if (Array.isArray(evidence)) {
    for (const claim of evidence) {
      if (!claim || typeof claim !== "object") continue;
      const citations = (claim as Record<string, unknown>).citations;
      if (!Array.isArray(citations)) continue;
      for (const citation of citations) {
        if (!citation || typeof citation !== "object") continue;
        const evidenceRecordId = (citation as Record<string, unknown>).evidenceRecordId;
        if (typeof evidenceRecordId === "string" && evidenceRecordId) ids.add(evidenceRecordId);
      }
    }
  }
  return [...ids].sort();
}

function requireEditorialEvidence(
  milestone: FactoryObject,
  evidenceById: ReadonlyMap<string, RankedEditorialEvidence>
): RankedEditorialEvidence[] {
  const evidenceIds = evidenceIdsFromMilestone(milestone);
  if (evidenceIds.length === 0) {
    throw new ApiError(409, "EDITORIAL_COMPILER_MILESTONE_EVIDENCE_REQUIRED", "Compiler milestone input requires exact evidence lineage.");
  }
  return evidenceIds.map((evidenceRecordId) => {
    const evidence = evidenceById.get(evidenceRecordId);
    if (!evidence) {
      throw new ApiError(409, "EDITORIAL_COMPILER_UNRELATED_MILESTONE", "Milestone evidence is unrelated to the pinned Editorial Evidence Set.", {
        milestoneId: milestone.objectId,
        evidenceRecordId
      });
    }
    return evidence;
  });
}

function chronologyFromMilestone(milestone: FactoryObject) {
  const date = milestone.payload.date;
  const precision = milestone.payload.datePrecision;
  if (typeof date !== "string" || typeof precision !== "string" || !DATE_PRECISIONS.has(precision as DatePrecision)) {
    throw new ApiError(409, "EDITORIAL_COMPILER_CHRONOLOGY_REQUIRED", "Compiler milestone input requires a supported grounded date and precision.", {
      milestoneId: milestone.objectId
    });
  }
  try {
    const parsed = parseHistoricalDateInput(date, precision as DatePrecision);
    return {
      sortYear: parsed.sortYear,
      sortMonth: parsed.sortMonth,
      sortDay: parsed.sortDay,
      precision: parsed.datePrecision
    };
  } catch (error) {
    throw new ApiError(409, "EDITORIAL_COMPILER_CHRONOLOGY_INVALID", "Compiler milestone date cannot be canonicalized by Chronology Authority.", {
      milestoneId: milestone.objectId,
      reason: error instanceof Error ? error.message : "Invalid historical date."
    });
  }
}

export function adaptFactoryMilestonesToCompilerInput(input: {
  editorialEvidenceSet: EditorialEvidenceSet;
  milestones: readonly FactoryObject[];
}): EditorialTimelineCompilerInput {
  const editorialEvidenceSetId = input.editorialEvidenceSet.editorialEvidenceSetId;
  if (!editorialEvidenceSetId) {
    throw new ApiError(409, "EDITORIAL_EVIDENCE_SET_ID_REQUIRED", "Compiler input requires a persisted Editorial Evidence Set.");
  }
  if (input.milestones.length === 0 || input.milestones.length > 200) {
    throw new ApiError(409, "EDITORIAL_COMPILER_MILESTONE_BOUND_INVALID", "Compiler input requires between 1 and 200 milestone candidates.");
  }
  const evidenceById = new Map(input.editorialEvidenceSet.rankedEvidence.map((evidence) => [evidence.evidenceRecordId, evidence]));
  const milestoneRanks = new Map(
    input.editorialEvidenceSet.candidateMilestonesRanked.map((milestone) => [milestone.evidenceRecordId, milestone])
  );
  const milestones: GroundedMilestoneCandidate[] = input.milestones.map((milestone) => {
    if (milestone.objectType !== "candidate_milestone") {
      throw new ApiError(409, "EDITORIAL_COMPILER_OBJECT_TYPE_INVALID", "Compiler input may contain only candidate_milestone Factory objects.");
    }
    const evidence = requireEditorialEvidence(milestone, evidenceById);
    const ranked = [...evidence].sort((left, right) => left.rank - right.rank || left.evidenceRecordId.localeCompare(right.evidenceRecordId));
    const primary = ranked[0]!;
    const milestoneScores = ranked.map((item) => milestoneRanks.get(item.evidenceRecordId)).filter((item) => item !== undefined);
    return {
      milestoneId: milestone.objectId,
      canonicalIdentity: milestone.title,
      chronology: chronologyFromMilestone(milestone),
      evidenceLineage: ranked.map((item) => ({
        evidenceRecordId: item.evidenceRecordId,
        validationRecordId: item.validationRecordId
      })),
      editorialRank: primary.rank,
      importanceScore: Math.max(primary.score.historicalSignificance, ...milestoneScores.map((item) => item.importanceScore)),
      evidenceStrength: Math.max(...ranked.map((item) => item.score.evidenceStrength))
    };
  });
  return {
    canonicalSubject: input.editorialEvidenceSet.canonicalSubject.label,
    editorialEvidenceSetId,
    milestones
  };
}

