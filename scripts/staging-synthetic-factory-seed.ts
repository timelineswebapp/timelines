import "@/src/server/operations/environment";
import { sourceAuthorityRepository } from "@/src/server/repositories/source-authority-repository";
import { corpusGenerationService } from "@/src/server/services/corpus-generation-service";
import { evidenceExtractionService } from "@/src/server/services/evidence-extraction-service";
import { evidenceValidationService } from "@/src/server/services/evidence-validation-service";
import { factoryService } from "@/src/server/services/factory-service";
import type { EvidenceRef } from "@/src/server/governance/contracts";
import { closeSql } from "@/src/server/db/client";

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
  const topic = "Synthetic staging communications milestone";
  const evidenceRefs: EvidenceRef[] = [];
  for (const ordinal of [1, 2]) {
    const text = `Synthetic staging evidence ${ordinal}: the communications milestone was recorded in 1876 for controlled TiMELiNES staging certification.`;
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
  const object = await factoryService.createObject({ objectType: "candidate_milestone", title: "Synthetic communications milestone", payload: { title: "Synthetic communications milestone", date: "1876", datePrecision: "year", summary: "Synthetic staging-only milestone for governed certification.", sourceRefs: evidenceRefs.map((ref) => ref.evidenceRecordId) }, provenance: { synthetic: true, program: "TL-STAGING-004", runId, evidenceRefs }, actor, reason: "Create bounded staging Factory candidate." });
  const qualityMetrics = { publicationQualityScore: 1, researchQuality: 1, evidenceQuality: 1, groundingQuality: 1, authorityCompleteness: 1, chronologyCompleteness: 1, citationCompleteness: 1, sourceDiversity: 1, confidence: 1, unsupportedFields: [], unsupportedClaims: [], unsupportedChronology: [], unsupportedRelationships: [], unsupportedCitations: [] };
  const draft = await factoryService.createPackageDraft({ title: "Synthetic staging publication package", description: "Synthetic-only governed staging certification package.", packageType: "mixed_authority_publication", factoryObjectRefs: [object.objectId], artifactRefs: [], validatedEvidenceRefs: evidenceRefs, riskSummary: { unresolvedAuthorityRisks: [], validationWarnings: [], publicationBlockers: [], qualityMetrics }, actor, reason: "Assemble bounded synthetic Factory package." });
  await factoryService.transitionPackageDraft({ packageDraftId: draft.packageDraftId, lifecycle: "validating", actor, reason: "Begin synthetic editorial validation." });
  const review = await factoryService.validateCandidatePackage({ factoryPackageDraftId: draft.packageDraftId, reviewer: actor, evidenceReviewed: evidenceRefs.map((ref) => ({ evidenceRecordId: ref.evidenceRecordId, validationRecordId: ref.validationRecordId })), sourcesReviewed: evidenceRefs.map((ref) => ({ uri: ref.uri, evidenceRecordId: ref.evidenceRecordId })), validationSummary: { minimumSourceCount: 2, minimumEvidenceCount: 2, sourceDiversity: true, dateConsistency: true, chronologyConsistency: true, relationshipConsistency: true, objectIdentityConsistency: true }, actor, reason: "Validate bounded synthetic evidence." });
  await factoryService.reviewCandidatePackage({ editorialReviewId: review.reviewId, reviewer: actor, actor, reason: "Review bounded synthetic package." });
  await factoryService.approveEditorialReview({ editorialReviewId: review.reviewId, actor, reason: "Approve bounded synthetic editorial review.", confidence: { confidenceLevel: "verified", confidenceScore: 1, factors: { sourceQuality: 1, sourceCount: 1, evidenceCount: 1, crossSourceAgreement: 1, chronologicalConsistency: 1 } } });
  await factoryService.prepareAuthorityRecords({ editorialReviewId: review.reviewId, canonicalIdentityMapping: { milestone: object.objectId }, authorityReferences: { milestone: object.objectId }, sourceTraceability: { sources: evidenceRefs.map((ref) => ref.uri) }, evidenceTraceability: { evidenceRefs }, revisionTraceability: { runId, synthetic: true }, actor, reason: "Prepare synthetic authority traceability." });
  await factoryService.assessGovernanceReadiness({ editorialReviewId: review.reviewId, actor, reason: "Assess bounded synthetic Governance readiness." });
  await factoryService.transitionPackageDraft({ packageDraftId: draft.packageDraftId, lifecycle: "ready_for_governance", actor, reason: "Factory editorial gates complete." });
  const version = await factoryService.createPackageVersion({ packageDraftId: draft.packageDraftId, actor, reason: "Version synthetic governance-ready package." });
  console.log(JSON.stringify({ ok: true, runId, factoryObjectId: object.objectId, factoryPackageDraftId: draft.packageDraftId, factoryPackageVersionId: version.packageVersionId, evidenceCount: evidenceRefs.length, lifecycle: "ready_for_governance" }));
}

main().catch((error) => { console.error(JSON.stringify({ ok: false, component: "staging_synthetic_factory_seed", error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; }).finally(() => closeSql());
