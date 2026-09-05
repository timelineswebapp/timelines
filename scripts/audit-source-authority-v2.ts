import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assessSourceAuthority } from "@/functions/src/source-authority";
import { generatedTimelineSchema, groundedEvidenceSegmentSchema, sourceCandidateSchema } from "@/functions/src/schemas";

const PROJECT_ID = "tiimeliines";
const CORPUS_ID = "timelines-clean-2026-09-v1";
const TITLES = ["The History of the World Wide Web", "The Fall of the Berlin Wall"] as const;

if ((process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || PROJECT_ID) !== PROJECT_ID) {
  throw new Error("Refusing to audit Source Authority outside the TiMELiNES production project.");
}
if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();
const root = db.collection("corpora").doc(CORPUS_ID);

async function auditTimeline(title: string) {
  const ledgerQuery = await root.collection("topicLedgers").where("displayTitle", "==", title).limit(2).get();
  if (ledgerQuery.size !== 1) throw new Error(`Expected one active-corpus ledger for ${title}.`);
  const ledger = ledgerQuery.docs[0]!;
  const topicId = ledger.id;
  const jobId = String(ledger.data().activeJobId);
  const [candidateQuery, evidenceQuery] = await Promise.all([
    root.collection("factoryObjects").where("runId", "==", jobId).where("objectType", "==", "candidate_timeline").limit(2).get(),
    root.collection("evidenceRecords").where("topicId", "==", topicId).limit(500).get()
  ]);
  if (candidateQuery.size !== 1) throw new Error(`Expected one persisted candidate for ${title}.`);
  const candidate = candidateQuery.docs[0]!;
  const snapshotRefs = new Set(evidenceQuery.docs.map((document) => document.data().sourceSnapshotId).filter((value): value is string => typeof value === "string"));
  const directSnapshotRef = typeof candidate.data().sourceSnapshotId === "string" ? candidate.data().sourceSnapshotId : null;
  const sourceSnapshotRef = directSnapshotRef || (snapshotRefs.size === 1 ? [...snapshotRefs][0]! : null);
  if (!sourceSnapshotRef) throw new Error(`Source snapshot lineage is ambiguous for ${title}.`);
  const sourceSnapshot = await root.collection("sourceSnapshots").doc(sourceSnapshotRef).get();
  if (!sourceSnapshot.exists) throw new Error(`Source snapshot is missing for ${title}.`);
  const timeline = generatedTimelineSchema.parse(candidate.data().payload);
  const sources = (sourceSnapshot.data()!.sources as unknown[]).map((source) => sourceCandidateSchema.parse(source));
  const evidenceSegments = (sourceSnapshot.data()!.evidenceSegments as unknown[]).map((segment) => groundedEvidenceSegmentSchema.parse(segment));
  const assessment = assessSourceAuthority({ timeline, sources, evidenceSegments });
  const inventory = new Map(assessment.sourceInventory.map((source) => [source.sourceRef, source]));
  const usage = new Map<string, {
    events: Set<string>;
    roles: Set<string>;
    claimAuthority: Set<string>;
    independentlyCorroborated: boolean;
  }>();
  for (const claim of assessment.claims) {
    for (const evidence of claim.evidence) {
      const current = usage.get(evidence.sourceRef) || { events: new Set<string>(), roles: new Set<string>(), claimAuthority: new Set<string>(), independentlyCorroborated: false };
      current.events.add(claim.eventTitle);
      current.roles.add(evidence.evidenceRole);
      current.claimAuthority.add(evidence.claimAuthority);
      current.independentlyCorroborated ||= claim.independentStrongSourceCount >= 2;
      usage.set(evidence.sourceRef, current);
    }
  }
  return {
    title,
    topicId,
    jobId,
    publicationState: ledger.data().state,
    sourceSnapshotRef,
    snapshotSelection: directSnapshotRef ? "candidate_exact_reference" : "legacy_unique_evidence_reference",
    overallAuthorityVerdict: assessment.overallVerdict,
    sourceDiversity: assessment.sourceDiversity,
    unresolvedSourceIssues: assessment.unresolvedSourceIssues,
    conflictFindings: assessment.conflictFindings,
    events: assessment.claims.map((claim) => ({
      eventTitle: claim.eventTitle,
      claimRisk: claim.claimRisk,
      evidenceRecordCount: evidenceQuery.docs.filter((document) => document.data().claim === timeline.events[claim.eventIndex]!.description).length,
      independentStrongSourceCount: claim.independentStrongSourceCount,
      definitivePrimaryAuthority: claim.definitivePrimaryAuthority,
      verdict: claim.verdict,
      unresolvedIssues: claim.unresolvedIssues,
      publishers: [...new Set(claim.evidence.map((evidence) => inventory.get(evidence.sourceRef)?.publisher || evidence.sourceRef))]
    })),
    usedSources: [...usage.entries()].map(([sourceRef, value]) => {
      const source = inventory.get(sourceRef)!;
      return {
        domain: source.domain,
        publisher: source.publisher,
        pageTitle: source.pageTitle,
        sourceType: source.sourceClassification,
        authorityTier: source.authorityTier,
        primaryOrSecondary: [...value.roles].sort(),
        supportedEvents: [...value.events].sort(),
        claimAuthority: [...value.claimAuthority].sort(),
        independentlyCorroborated: value.independentlyCorroborated,
        acquisition: "google_search_grounding",
        existingSourceAuthorityPreference: "research_prompt_preference_only_no_acceptance_enforcement"
      };
    }).sort((left, right) => left.domain.localeCompare(right.domain) || left.supportedEvents[0]!.localeCompare(right.supportedEvents[0]!))
  };
}

async function main() {
  const results = [];
  for (const title of TITLES) results.push(await auditTimeline(title));
  console.log(JSON.stringify({ auditId: "TL-SOURCE-AUTHORITY-002", corpusId: CORPUS_ID, readOnly: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
