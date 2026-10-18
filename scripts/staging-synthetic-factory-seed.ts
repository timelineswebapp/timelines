import "@/src/server/operations/environment";
import { sourceAuthorityRepository } from "@/src/server/repositories/source-authority-repository";
import { corpusGenerationService } from "@/src/server/services/corpus-generation-service";
import { evidenceExtractionService } from "@/src/server/services/evidence-extraction-service";
import { evidenceValidationService } from "@/src/server/services/evidence-validation-service";
import { factoryService } from "@/src/server/services/factory-service";
import type { EvidenceRef } from "@/src/server/governance/contracts";
import { closeSql } from "@/src/server/db/client";

type SyntheticFixtureProfile = {
  key: string;
  timelineTitle: string;
  description: string;
  startYear: number;
  yearStep: number;
  milestoneCount: number;
  sourceCount: number;
};

const DEFAULT_PROFILE: SyntheticFixtureProfile = {
  key: "baseline",
  timelineTitle: "Synthetic communications milestone",
  description: "Synthetic staging-only milestone for governed certification.",
  startYear: 1876,
  yearStep: 1,
  milestoneCount: 1,
  sourceCount: 2
};

const CAPACITY_PROFILES: Readonly<Record<string, SyntheticFixtureProfile>> = {
  "capacity-ancient-short": {
    key: "capacity-ancient-short",
    timelineTitle: "Synthetic ancient communications chronology",
    description: "Synthetic staging-only short chronology for bounded capacity qualification.",
    startYear: 240,
    yearStep: 11,
    milestoneCount: 3,
    sourceCount: 2
  },
  "capacity-early-modern-medium": {
    key: "capacity-early-modern-medium",
    timelineTitle: "Synthetic early-modern communications chronology",
    description: "Synthetic staging-only medium chronology for bounded capacity qualification.",
    startYear: 1492,
    yearStep: 7,
    milestoneCount: 12,
    sourceCount: 3
  },
  "capacity-industrial-long": {
    key: "capacity-industrial-long",
    timelineTitle: "Synthetic industrial communications chronology",
    description: "Synthetic staging-only long chronology for bounded capacity qualification.",
    startYear: 1800,
    yearStep: 3,
    milestoneCount: 30,
    sourceCount: 4
  },
  "capacity-modern-dense": {
    key: "capacity-modern-dense",
    timelineTitle: "Synthetic modern communications chronology",
    description: "Synthetic staging-only dense chronology for bounded capacity qualification.",
    startYear: 1960,
    yearStep: 1,
    milestoneCount: 60,
    sourceCount: 5
  }
};

function fixtureProfile(): SyntheticFixtureProfile {
  const requested = process.env.STAGING_SYNTHETIC_CAPACITY_PROFILE;
  if (!requested) return DEFAULT_PROFILE;
  const profile = CAPACITY_PROFILES[requested];
  if (!profile) {
    throw new Error(`Unsupported STAGING_SYNTHETIC_CAPACITY_PROFILE: ${requested}.`);
  }
  return profile;
}

function requireContext(): string {
  if (process.env.TIMELINES_ENVIRONMENT !== "staging" || process.env.ALLOW_SYNTHETIC_GOVERNANCE_CERTIFICATION !== "true" || process.env.ALLOW_STAGING_SYNTHETIC_FIXTURES !== "true") {
    throw new Error("Synthetic Factory seed requires explicit staging-only authorization flags.");
  }
  if (process.env.STAGING_NEON_PROJECT_ID !== "hidden-darkness-27048706" || process.env.STAGING_DATABASE_NAME !== "timelines-staging-primary") {
    throw new Error("Synthetic Factory seed refuses an unverified Neon target.");
  }
  const runId = process.env.STAGING_SYNTHETIC_FIXTURE_RUN_ID;
  if (!runId || !/^tl-staging-004-[a-z0-9-]{8,80}$/.test(runId)) throw new Error("An explicit TL-STAGING-004 run identifier is required.");
  return runId;
}

async function main(): Promise<void> {
  const runId = requireContext();
  const actor = `${runId}-factory`;
  const profile = fixtureProfile();
  const topic = profile.timelineTitle;
  const evidenceRefs: EvidenceRef[] = [];
  for (let ordinal = 1; ordinal <= profile.sourceCount; ordinal += 1) {
    const text = `Synthetic staging evidence ${ordinal}: the ${profile.timelineTitle} chronology is a clearly labelled, non-historical capacity fixture for controlled TiMELiNES staging certification.`;
    const source = await sourceAuthorityRepository.registerDiscoveredSource({
      discovery: { provider: "wikidata", providerRecordId: `${runId}-source-${ordinal}`, canonicalUrl: `https://staging.invalid/${runId}/source-${ordinal}`, originUrl: `https://staging.invalid/${runId}/source-${ordinal}`, title: `Synthetic staging source ${ordinal}`, description: "Synthetic, non-public certification source.", sourceType: "synthetic_fixture", raw: { synthetic: true, program: "TL-STAGING-004", runId, ordinal } },
      query: topic, actor,
      relevanceAssessment: { accepted: true, relevanceScore: 1, topicalRelevance: 1, historicalRelevance: 1, semanticRelevance: 1, authorityRelevance: 1, publicationSuitability: 1, rejectionReasons: [], semanticMismatch: null }
    });
    const snapshot = await sourceAuthorityRepository.createSnapshot({
      sourceRecord: source, retrievalUrl: source.canonicalUrl, contentType: "text/plain", contentText: text,
      rawMetadata: { synthetic: true, program: "TL-STAGING-004", runId, ordinal },
      provenance: { retrievalMethod: "synthetic_fixture", retrievedAt: new Date().toISOString(), retrievedBy: actor, sourceUrl: source.canonicalUrl } as never,
      actor
    });
    const corpus = await corpusGenerationService.generateFromSourceSnapshot({ sourceSnapshotId: snapshot.snapshotId, actor });
    const [evidence] = await evidenceExtractionService.extractFromCorpusDocument({ corpusDocumentId: corpus.corpusDocumentId, actor, maxEvidenceRecords: 1 });
    if (!evidence) throw new Error("Synthetic evidence extraction returned no record.");
    const validation = await evidenceValidationService.validateEvidence({ evidenceRecordId: evidence.evidenceRecordId, actor, topic });
    if (validation.status !== "passed") throw new Error("Synthetic evidence did not pass the existing validator.");
    evidenceRefs.push({ evidenceId: validation.validationRecordId, evidenceType: "validated_evidence", evidenceRecordId: evidence.evidenceRecordId, validationRecordId: validation.validationRecordId, authoritySafe: true, uri: source.canonicalUrl });
  }
  const objects = [];
  for (let ordinal = 1; ordinal <= profile.milestoneCount; ordinal += 1) {
    const date = String(profile.startYear + ((ordinal - 1) * profile.yearStep));
    const title = `${profile.timelineTitle} milestone ${String(ordinal).padStart(3, "0")}`;
    objects.push(await factoryService.createObject({
      objectType: "candidate_milestone",
      title,
      payload: {
        title,
        date,
        datePrecision: "year",
        summary: `${profile.description} Synthetic milestone ${ordinal} of ${profile.milestoneCount}.`,
        sourceRefs: evidenceRefs.map((ref) => ref.evidenceRecordId)
      },
      provenance: { synthetic: true, program: "TL-STAGING-004", runId, capacityProfile: profile.key, milestoneOrdinal: ordinal, evidenceRefs },
      actor,
      reason: "Create bounded staging Factory capacity candidate."
    }));
  }
  const qualityMetrics = { publicationQualityScore: 1, researchQuality: 1, evidenceQuality: 1, groundingQuality: 1, authorityCompleteness: 1, chronologyCompleteness: 1, citationCompleteness: 1, sourceDiversity: 1, confidence: 1, unsupportedFields: [], unsupportedClaims: [], unsupportedChronology: [], unsupportedRelationships: [], unsupportedCitations: [] };
  const draft = await factoryService.createPackageDraft({ title: `${profile.timelineTitle} publication package`, description: profile.description, packageType: "mixed_authority_publication", factoryObjectRefs: objects.map((object) => object.objectId), artifactRefs: [], validatedEvidenceRefs: evidenceRefs, riskSummary: { unresolvedAuthorityRisks: [], validationWarnings: [], publicationBlockers: [], qualityMetrics }, actor, reason: "Assemble bounded synthetic Factory capacity package." });
  await factoryService.transitionPackageDraft({ packageDraftId: draft.packageDraftId, lifecycle: "validating", actor, reason: "Begin synthetic editorial validation." });
  const review = await factoryService.validateCandidatePackage({ factoryPackageDraftId: draft.packageDraftId, reviewer: actor, evidenceReviewed: evidenceRefs.map((ref) => ({ evidenceRecordId: ref.evidenceRecordId, validationRecordId: ref.validationRecordId })), sourcesReviewed: evidenceRefs.map((ref) => ({ uri: ref.uri, evidenceRecordId: ref.evidenceRecordId })), validationSummary: { minimumSourceCount: 2, minimumEvidenceCount: 2, sourceDiversity: true, dateConsistency: true, chronologyConsistency: true, relationshipConsistency: true, objectIdentityConsistency: true }, actor, reason: "Validate bounded synthetic evidence." });
  await factoryService.reviewCandidatePackage({ editorialReviewId: review.reviewId, reviewer: actor, actor, reason: "Review bounded synthetic package." });
  await factoryService.approveEditorialReview({ editorialReviewId: review.reviewId, actor, reason: "Approve bounded synthetic editorial review.", confidence: { confidenceLevel: "verified", confidenceScore: 1, factors: { sourceQuality: 1, sourceCount: 1, evidenceCount: 1, crossSourceAgreement: 1, chronologicalConsistency: 1 } } });
  await factoryService.prepareAuthorityRecords({ editorialReviewId: review.reviewId, canonicalIdentityMapping: { milestones: objects.map((object) => object.objectId) }, authorityReferences: { milestones: objects.map((object) => object.objectId) }, sourceTraceability: { sources: evidenceRefs.map((ref) => ref.uri) }, evidenceTraceability: { evidenceRefs }, revisionTraceability: { runId, synthetic: true, capacityProfile: profile.key }, actor, reason: "Prepare synthetic capacity authority traceability." });
  await factoryService.assessGovernanceReadiness({ editorialReviewId: review.reviewId, actor, reason: "Assess bounded synthetic Governance readiness." });
  await factoryService.transitionPackageDraft({ packageDraftId: draft.packageDraftId, lifecycle: "ready_for_governance", actor, reason: "Factory editorial gates complete." });
  const version = await factoryService.createPackageVersion({ packageDraftId: draft.packageDraftId, actor, reason: "Version synthetic governance-ready package." });
  console.log(JSON.stringify({ ok: true, runId, capacityProfile: profile.key, factoryObjectIds: objects.map((object) => object.objectId), factoryPackageDraftId: draft.packageDraftId, factoryPackageVersionId: version.packageVersionId, evidenceCount: evidenceRefs.length, milestoneCount: objects.length, lifecycle: "ready_for_governance" }));
}

main().catch((error) => { console.error(JSON.stringify({ ok: false, component: "staging_synthetic_factory_seed", error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; }).finally(() => closeSql());
