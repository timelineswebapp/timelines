import type { Ei002CertificationCase } from "@/src/server/editorial-certification/contracts";
import type { GroundedMilestoneCandidate } from "@/src/server/editorial-intelligence/timeline-compiler-contracts";

function id(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

function milestone(input: {
  id: number;
  identity: string;
  year: number;
  month?: number | null;
  day?: number | null;
  precision?: GroundedMilestoneCandidate["chronology"]["precision"];
  rank?: number;
  importance?: number;
  strength?: number;
}): GroundedMilestoneCandidate {
  return {
    milestoneId: id(input.id),
    canonicalIdentity: input.identity,
    chronology: {
      sortYear: input.year,
      sortMonth: input.month ?? null,
      sortDay: input.day ?? null,
      precision: input.precision ?? "year"
    },
    evidenceLineage: [{ evidenceRecordId: id(input.id + 1000), validationRecordId: id(input.id + 2000) }],
    editorialRank: input.rank ?? input.id,
    importanceScore: input.importance ?? 80,
    evidenceStrength: input.strength ?? 90
  };
}

function certificationCase(input: {
  caseId: string;
  topic: string;
  evidenceSetId: number;
  candidateId: number;
  factoryObjectId: number;
  artifactId: number;
  milestones: GroundedMilestoneCandidate[];
  expectedFingerprint: string;
  selected: number[];
  excluded?: number[];
}): Ei002CertificationCase {
  const selectedIds = input.selected.map(id);
  const excludedIds = (input.excluded || []).map(id);
  return {
    caseId: input.caseId,
    topic: input.topic,
    compilerInput: {
      canonicalSubject: input.topic,
      editorialEvidenceSetId: id(input.evidenceSetId),
      milestones: input.milestones
    },
    expectedCompilerFingerprint: input.expectedFingerprint,
    expectedSelectedMilestoneIds: selectedIds,
    expectedExcludedMilestoneIds: excludedIds,
    extractionMilestoneIds: input.milestones.map((item) => item.milestoneId),
    observedPersistence: {
      candidateId: id(input.candidateId),
      factoryObjectId: id(input.factoryObjectId),
      editorialEvidenceSetId: id(input.evidenceSetId),
      compilerInputFingerprint: input.expectedFingerprint,
      selectedMilestoneIds: selectedIds,
      excludedMilestoneIds: excludedIds
    },
    observedCompilerArtifact: {
      artifactId: id(input.artifactId),
      factoryObjectId: id(input.factoryObjectId),
      editorialTimelineCandidateId: id(input.candidateId),
      compilerInputFingerprint: input.expectedFingerprint
    },
    observedPackage: {
      artifactRefs: [id(input.artifactId)],
      milestoneAuthorityRefs: selectedIds
    },
    observedGovernanceAuthorityRefs: selectedIds
  };
}

export const ei002TierACorpus: readonly Ei002CertificationCase[] = [
  certificationCase({
    caseId: "ei002-roman-republic-bce",
    topic: "Roman Republic",
    evidenceSetId: 100,
    candidateId: 101,
    factoryObjectId: 102,
    artifactId: 103,
    milestones: [
      milestone({ id: 2, identity: "Twelve Tables", year: -450 }),
      milestone({ id: 1, identity: "Roman Republic established", year: -509 })
    ],
    expectedFingerprint: "57647af181efb9fecc669306a70299ad493ff05cb21e48caf5a1fbb37d0e8af6",
    selected: [1, 2]
  }),
  certificationCase({
    caseId: "ei002-printing-duplicate",
    topic: "Printing Press",
    evidenceSetId: 200,
    candidateId: 201,
    factoryObjectId: 202,
    artifactId: 203,
    milestones: [
      milestone({ id: 11, identity: "Gutenberg Bible printed", year: 1455, importance: 95, strength: 95, rank: 1 }),
      milestone({ id: 12, identity: " gutenberg bible PRINTED ", year: 1455, importance: 80, strength: 85, rank: 2 }),
      milestone({ id: 13, identity: "Printing reaches Venice", year: 1469 })
    ],
    expectedFingerprint: "28f12feba19a7b747f82a61cd2a5dd35aa23eec33506becdb2ce011139948dd6",
    selected: [11, 13],
    excluded: [12]
  }),
  certificationCase({
    caseId: "ei002-meiji-same-day",
    topic: "Meiji Restoration",
    evidenceSetId: 300,
    candidateId: 301,
    factoryObjectId: 302,
    artifactId: 303,
    milestones: [
      milestone({ id: 22, identity: "Distinct constitutional event", year: 1868, month: 1, day: 3, precision: "day" }),
      milestone({ id: 21, identity: "Restoration proclamation", year: 1868, month: 1, day: 3, precision: "day" }),
      milestone({ id: 20, identity: "Imperial transition", year: 1867 })
    ],
    expectedFingerprint: "4dd51dc829a8e9ecc047fcc0477cf8b14a06a1eae5ee4180f512305ee140db1d",
    selected: [20, 21, 22]
  }),
  certificationCase({
    caseId: "ei002-internet-long-chronology",
    topic: "Internet",
    evidenceSetId: 400,
    candidateId: 401,
    factoryObjectId: 402,
    artifactId: 403,
    milestones: [
      milestone({ id: 33, identity: "World Wide Web proposal", year: 1989 }),
      milestone({ id: 31, identity: "Packet switching research", year: 1965 }),
      milestone({ id: 32, identity: "ARPANET adopts TCP/IP", year: 1983 })
    ],
    expectedFingerprint: "9cc8797a2f86d766cc13c194e34bcfbcd62562ace9fab1902568ee8885009805",
    selected: [31, 32, 33]
  })
] as const;
