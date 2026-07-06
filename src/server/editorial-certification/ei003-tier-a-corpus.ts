import type { Ei003CertificationCase } from "@/src/server/editorial-certification/ei003-contracts";
import { planEditorialComposition } from "@/src/server/editorial-intelligence/editorial-composition-planner";
import type { EditorialCompositionPlannerInput } from "@/src/server/editorial-intelligence/editorial-composition-contracts";
import type { EditorialTimelineSelectedMilestone } from "@/src/server/editorial-intelligence/timeline-compiler-contracts";
import { createHash } from "node:crypto";

const id = (value: number) => `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function milestone(value: number, sequence: number, year: number, month: number | null = null, day: number | null = null): EditorialTimelineSelectedMilestone {
  return {
    milestoneId: id(value), sequence,
    chronology: { sortYear: year, sortMonth: month, sortDay: day, precision: day ? "day" : month ? "month" : "year" },
    evidenceLineage: [{ evidenceRecordId: id(value + 1000), validationRecordId: id(value + 2000) }],
    selectionReasons: ["unique_grounded_milestone"]
  };
}

function makeCase(input: {
  offset: number; caseId: string; topic: string; milestones: EditorialTimelineSelectedMilestone[];
  excluded?: number[]; turningIndexes?: number[]; gaps?: Array<{ afterYear: number; beforeYear: number; spanYears: number }>;
}): Ei003CertificationCase {
  const candidateId = id(input.offset + 1);
  const factoryObjectId = id(input.offset + 2);
  const compilerArtifactId = id(input.offset + 3);
  const compositionArtifactId = id(input.offset + 4);
  const excluded = (input.excluded || []).map((value) => ({
    milestoneId: id(value),
    canonicalMilestoneId: input.milestones[0]!.milestoneId,
    exclusionReason: "duplicate_of_canonical_milestone" as const
  }));
  const plannerInput: EditorialCompositionPlannerInput = {
    editorialTimelineCandidateId: candidateId,
    timelineCandidate: {
      canonicalSubject: input.topic,
      editorialEvidenceSetId: id(input.offset),
      compilerVersion: "ei-002-compiler-v1",
      selectionAlgorithmVersion: "ei-002-selection-v1",
      compilerInputFingerprint: hash([input.topic, input.milestones.map((item) => item.milestoneId)]),
      selectedMilestones: input.milestones,
      excludedMilestones: excluded,
      compilerMetadata: { authorityDecision: false, publicationReadinessDecision: false, sourceMilestoneCount: input.milestones.length + excluded.length }
    },
    identifiedTurningPoints: (input.turningIndexes || []).map((index) => ({
      evidenceRecordId: input.milestones[index]!.evidenceLineage[0]!.evidenceRecordId,
      year: input.milestones[index]!.chronology.sortYear,
      score: 90
    })),
    chronologyGaps: input.gaps || []
  };
  const output = planEditorialComposition(plannerInput);
  const milestoneIds = input.milestones.map((item) => item.milestoneId);
  return {
    caseId: input.caseId, topic: input.topic, plannerInput,
    expectedPlannerInputFingerprint: output.plannerInputFingerprint,
    expectedOutputFingerprint: hash(output),
    observedPersistence: {
      compositionId: id(input.offset + 5), factoryObjectId,
      plannerInputFingerprint: output.plannerInputFingerprint, output
    },
    observedArtifacts: {
      compilerArtifactId, compositionArtifactId, compositionFactoryObjectId: factoryObjectId,
      editorialTimelineCandidateId: candidateId
    },
    observedPackage: { artifactRefs: [compilerArtifactId, compositionArtifactId], milestoneAuthorityRefs: milestoneIds },
    observedGovernanceAuthorityRefs: milestoneIds
  };
}

export const ei003TierACorpus: readonly Ei003CertificationCase[] = [
  makeCase({ offset: 10000, caseId: "ei003-roman-republic-bce", topic: "Roman Republic", milestones: [milestone(101, 1, -509), milestone(102, 2, -450)] }),
  makeCase({ offset: 11000, caseId: "ei003-printing-exclusion", topic: "Printing Press", milestones: [milestone(111, 1, 1455), milestone(113, 2, 1469)], excluded: [112] }),
  makeCase({ offset: 12000, caseId: "ei003-meiji-same-day-turning-points", topic: "Meiji Restoration", milestones: [milestone(121, 1, 1867), milestone(122, 2, 1868, 1, 3), milestone(123, 3, 1868, 1, 3)], turningIndexes: [1, 2] }),
  makeCase({ offset: 13000, caseId: "ei003-internet-chronology-gap", topic: "Internet", milestones: [milestone(131, 1, 1965), milestone(132, 2, 1983), milestone(133, 3, 1989)], gaps: [{ afterYear: 1965, beforeYear: 1983, spanYears: 18 }] }),
  makeCase({ offset: 14000, caseId: "ei003-single-milestone", topic: "Vaccination", milestones: [milestone(141, 1, 1796)] }),
  makeCase({ offset: 15000, caseId: "ei003-multiple-turning-points", topic: "Industrial Revolution", milestones: [milestone(151, 1, 1760), milestone(152, 2, 1781), milestone(153, 3, 1825), milestone(154, 4, 1850)], turningIndexes: [1, 2] }),
  makeCase({ offset: 16000, caseId: "ei003-no-causal-metadata", topic: "Abolition", milestones: [milestone(161, 1, 1807), milestone(162, 2, 1833)] }),
  makeCase({ offset: 17000, caseId: "ei003-maximum-bound", topic: "Long Chronology", milestones: Array.from({ length: 200 }, (_, index) => milestone(100000 + index, index + 1, 1000 + index)) })
] as const;
