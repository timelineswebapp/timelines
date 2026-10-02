import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../functions/src/firestore";
import { V2_CORPUS_COLLECTIONS, type V2CorpusCollectionName } from "../functions/src/corpus";
import { bootstrapPublisherRegistry } from "../functions/src/factory-v2/authority";
import { admitSourcesByQuestion, type DiscoveredSourceCandidate } from "../functions/src/factory-v2/reliability";
import { canonicalizeUrl } from "../functions/src/factory-v2/acquisition/url";
import type { ResearchMap } from "../functions/src/factory-v2/contracts";
import type { ArtifactContext } from "../functions/src/factory-v2/contracts/builders";

const corpusId = process.env.ACTIVE_CORPUS_ID || "";
const topicId = process.argv[2] || "";
const outputPath = process.argv[3] || "";
const preservedRunId = process.env.FORENSIC_RUN_ID || "";
const preservedScopeId = process.env.FORENSIC_SCOPE_ID || "";
if (!corpusId || !/^[a-f0-9]{64}$/u.test(topicId) || !outputPath) throw new Error("Usage: ACTIVE_CORPUS_ID=... tsx scripts/forensics-evidence-authority.ts <topicId> <outputPath>");

const corpus = db.collection("corpora").doc(corpusId);
async function topicDocs(name: V2CorpusCollectionName): Promise<Array<Record<string, any>>> {
  const snapshot = await corpus.collection(name).where("topicId", "==", topicId).limit(2000).get();
  return snapshot.docs.map((document) => ({ repositoryDocumentId: document.id, ...document.data() }));
}
async function docsByIds(name: V2CorpusCollectionName, ids: string[]): Promise<Array<Record<string, any>>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const snapshots = await Promise.all(unique.map((id) => corpus.collection(name).doc(id).get()));
  return snapshots.flatMap((snapshot) => snapshot.exists ? [{ repositoryDocumentId: snapshot.id, ...snapshot.data() }] : []);
}

async function main(): Promise<void> {
const [allDiscoveries, allMaps, allPlans, allClaims, allEdges, allVerdicts, allSnapshots, allSegments, allAudits, scopes] = await Promise.all([
  topicDocs("v2AcquisitionDiscoveries"), topicDocs("v2ResearchMaps"), topicDocs("v2QueryPlans"), topicDocs("v2AtomicClaimVersions"), topicDocs("v2ClaimEvidence"),
  topicDocs("v2ClaimAuthorityVerdicts"), topicDocs("v2SourceSnapshots"), topicDocs("v2EvidenceSegments"), topicDocs("v2AuditRecords"), topicDocs("v2ScopeContracts")
]);
const scope = scopes.find((item) => preservedScopeId ? item.scopeContractId === preservedScopeId : !preservedRunId || item.runId === preservedRunId);
if (!scope) throw new Error(`No preserved Scope Contract exists for topic ${topicId} and scope ${preservedScopeId || "ANY"}.`);
const runId = preservedRunId || scope.runId;
const discoveries = allDiscoveries.filter((item) => item.runId === runId);
const maps = allMaps.filter((item) => item.scopeContractId === scope.scopeContractId);
const plans = allPlans.filter((item) => item.scopeContractId === scope.scopeContractId);
const snapshots = allSnapshots.filter((item) => item.runId === runId);
const snapshotIds = new Set(snapshots.map((item) => item.sourceSnapshotId));
const audits = allAudits.filter((item) => item.runId === runId);
const derivedClaimIds = new Set(audits.filter((item) => item.action === "SEMANTIC_ARTIFACT_DERIVATION").flatMap((item) => item.artifactRefs || []).filter((ref: any) => ref.collection === "v2AtomicClaimVersions").map((ref: any) => ref.id));
const claims = allClaims.filter((item) => derivedClaimIds.has(item.claimVersionId) && snapshotIds.has(item.extractedFromSnapshotId));
const claimIds = new Set(claims.map((item) => item.claimVersionId));
const edges = allEdges.filter((item) => claimIds.has(item.claimVersionId));
const verdicts = allVerdicts.filter((item) => claimIds.has(item.claimVersionId));
const segments = allSegments.filter((item) => snapshotIds.has(item.sourceSnapshotId));
const sourceDocuments = await docsByIds("v2SourceDocuments", snapshots.map((snapshot) => snapshot.sourceId));
const publisherRecords = await docsByIds("v2PublisherAuthorityRecords", sourceDocuments.map((source) => source.publisherId).filter(Boolean));
const publisherVersions = await docsByIds("v2PublisherAuthorityVersions", [...edges.map((edge) => edge.publisherVersionId), ...publisherRecords.map((record) => record.currentVersionId)].filter(Boolean));
const sourceById = new Map(sourceDocuments.map((source) => [source.sourceId, source]));
const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.sourceSnapshotId, snapshot]));
const segmentById = new Map(segments.map((segment) => [segment.evidenceSegmentId, segment]));
const publisherByVersionId = new Map(publisherVersions.map((publisher) => [publisher.publisherVersionId, publisher]));
const verdictByClaim = new Map(verdicts.map((verdict) => [verdict.claimVersionId, verdict]));
const edgesByClaim = new Map<string, Array<Record<string, any>>>();
for (const edge of edges) edgesByClaim.set(edge.claimVersionId, [...(edgesByClaim.get(edge.claimVersionId) || []), edge]);

const discoveredByUrl = new Map<string, DiscoveredSourceCandidate>();
let discoveryOrder = 0;
for (const discovery of discoveries) for (const chunk of discovery.chunks || []) {
  let canonicalUrl: string;
  try { canonicalUrl = canonicalizeUrl(chunk.url); } catch { continue; }
  const queryId = discovery.queryId;
  const supportText = (discovery.supports || []).filter((support: any) => (support.chunkIndices || []).includes(chunk.chunkIndex)).map((support: any) => support.attributedText).join(" ").slice(0, 12_000);
  const query = plans[0]?.queries?.find((item: any) => item.queryId === queryId);
  const existing = discoveredByUrl.get(canonicalUrl);
  if (existing) {
    existing.researchQuestionIds = [...new Set([...existing.researchQuestionIds, ...(query?.researchQuestionIds || [])])];
    existing.discoveryText = [...new Set([existing.discoveryText, supportText].filter(Boolean))].join(" ").slice(0, 12_000);
  } else discoveredByUrl.set(canonicalUrl, {
    canonicalUrl, originalUrl: chunk.url, title: chunk.title || "", domain: String(chunk.domain || new URL(canonicalUrl).hostname).toLowerCase().replace(/^www\./u, ""),
    queryId, researchQuestionIds: query?.researchQuestionIds || [], role: query?.role || "PHASE_DIMENSION", intendedSourceClass: query?.intendedSourceClass || "SCHOLARLY_SECONDARY", discoveryOrder: discoveryOrder++, discoveryText: supportText
  });
}
const context: ArtifactContext = { corpusId, topicId, runId, generation: scope.generation, createdAt: scope.createdAt || new Date(0).toISOString() };
const registry = bootstrapPublisherRegistry(context);
const admitted = admitSourcesByQuestion({ candidates: [...discoveredByUrl.values()], map: maps[0] as ResearchMap, publishers: registry, maximumSources: 60 });
const admittedUrls = new Set(admitted.map((item) => item.canonicalUrl));
const snapshotByRetrievalUrl = new Map(snapshots.map((snapshot) => [canonicalizeUrl(snapshot.retrievalUrl), snapshot]));

const sourceFunnel = [...discoveredByUrl.values()].map((candidate) => {
  const snapshot = snapshotByRetrievalUrl.get(candidate.canonicalUrl);
  const source = snapshot ? sourceById.get(snapshot.sourceId) : undefined;
  const publisher = source ? publisherVersions.find((item) => item.publisherId === source.publisherId) : undefined;
  const knownPublisher = registry.find((item) => item.knownDomains.some((domain) => candidate.domain === domain || candidate.domain.endsWith(`.${domain}`)));
  const institutionalSignal = /(?:library|archive|museum|university|college|society|journal|press|institute|academy|britannica)/iu.test(`${candidate.title} ${candidate.domain}`);
  let category: string;
  if (candidate.domain === "wikipedia.org" || candidate.domain.endsWith(".wikipedia.org")) category = "orientation_provisional";
  else if (snapshot?.retrievalDisposition === "UNAVAILABLE" || snapshot?.accessLimitations?.length) category = "inaccessible";
  else if (snapshot && ["NEWLY_RETRIEVED", "CACHE_REUSED", "REVALIDATED"].includes(snapshot.retrievalDisposition) && publisher?.state === "VERIFIED") category = "authoritative_and_retrieved";
  else if (!snapshot && knownPublisher?.state === "VERIFIED") category = "authoritative_not_retrieved";
  else if ((!publisher || publisher.state !== "VERIFIED") && institutionalSignal) category = "potentially_authoritative_unrecognized";
  else if (!snapshot && admittedUrls.has(candidate.canonicalUrl)) category = "retrieval_failed_or_unpersisted";
  else if (!admittedUrls.has(candidate.canonicalUrl)) category = "not_selected_by_ranking";
  else category = "orientation_provisional";
  return { discoveryOrder: candidate.discoveryOrder, title: candidate.title, declaredDomain: candidate.domain, discoveryUrl: candidate.canonicalUrl, researchQuestionIds: candidate.researchQuestionIds, role: candidate.role, intendedSourceClass: candidate.intendedSourceClass, admitted: admittedUrls.has(candidate.canonicalUrl), retrieved: Boolean(snapshot), retrievalDisposition: snapshot?.retrievalDisposition || null, resolvedUrl: snapshot?.resolvedUrl || null, sourceId: source?.sourceId || null, sourceClass: source?.sourceClass || null, publisherId: source?.publisherId || null, publisherVersionId: publisher?.publisherVersionId || null, publisherState: publisher?.state || null, publisherInstitutionType: publisher?.institutionType || null, category };
});

const claimForensics = claims.sort((a, b) => a.claimVersionId.localeCompare(b.claimVersionId)).map((claim) => {
  const claimEdges = edgesByClaim.get(claim.claimVersionId) || [];
  const evidence = claimEdges.map((edge) => {
    const segment = segmentById.get(edge.evidenceSegmentId);
    const snapshot = segment ? snapshotById.get(segment.sourceSnapshotId) : undefined;
    const source = snapshot ? sourceById.get(snapshot.sourceId) : undefined;
    const publisher = edge.publisherVersionId ? publisherByVersionId.get(edge.publisherVersionId) : undefined;
    return { claimEvidenceId: edge.claimEvidenceId, evidenceSegmentId: edge.evidenceSegmentId, exactEvidenceText: segment?.exactText || null, sourceSnapshotId: snapshot?.sourceSnapshotId || null, sourceUrl: source?.canonicalUrl || snapshot?.resolvedUrl || null, sourceDomain: source?.canonicalUrl ? new URL(source.canonicalUrl).hostname : null, sourceClass: source?.sourceClass || null, retrieved: Boolean(snapshot), retrievalDisposition: snapshot?.retrievalDisposition || null, publisherId: publisher?.publisherId || null, publisherIdentity: publisher?.canonicalName || null, publisherState: publisher?.state || null, publisherInstitutionType: publisher?.institutionType || null, relationship: edge.relationship, relevance: edge.relevance, authorityFinding: edge.authorityFinding, independenceGroupId: edge.independenceGroupId };
  });
  const verdict = verdictByClaim.get(claim.claimVersionId);
  const strongerRetrievedEvidenceExistedButWasNotLinked = sourceFunnel.some((source) => source.retrieved && source.publisherState === "VERIFIED") && evidence.every((item) => item.publisherState !== "VERIFIED");
  const strongerDiscoveredSourcesExistedButWereNotRetrieved = sourceFunnel.some((source) => source.category === "authoritative_not_retrieved" || source.category === "potentially_authoritative_unrecognized");
  return { claimVersionId: claim.claimVersionId, claimText: claim.normalizedAssertion, claimType: claim.claimType, risk: claim.risk, historicalImportance: claim.qualifiers?.find((item: any) => item.key === "historicalImportance")?.value || null, evidence, evidenceEdgeCount: evidence.length, corroboratingIndependenceGroupCount: new Set(evidence.filter((item) => item.relationship === "SUPPORTS").map((item) => item.independenceGroupId)).size, authorityVerdict: verdict?.verdict || null, authorityReasonCodes: verdict?.reasonCodes || [], acceptedEvidenceEdgeIds: verdict?.acceptedEvidenceEdgeIds || [], rejectedEvidenceEdgeIds: verdict?.rejectedEvidenceEdgeIds || [], strongerDiscoveredSourcesExistedButWereNotRetrieved, strongerRetrievedEvidenceExistedButWasNotLinked, finalReason: (verdict?.reasonCodes || []).join(",") || "NO_VERDICT" };
});

const categoryCounts = sourceFunnel.reduce<Record<string, number>>((counts, source) => { counts[source.category] = (counts[source.category] || 0) + 1; return counts; }, {});
const report = { corpusId, topicId, generatedAt: new Date().toISOString(), preservedRunId: scope.runId, counts: { discoveries: sourceFunnel.length, admitted: sourceFunnel.filter((item) => item.admitted).length, snapshots: snapshots.length, sourceDocuments: sourceDocuments.length, claims: claimForensics.length, evidenceEdges: edges.length, verdicts: verdicts.length }, sourceCategoryCounts: categoryCounts, sourceFunnel, claimForensics, retrievalAuditRecords: audits.filter((audit) => ["COVERAGE_SOURCE_ADMISSION", "COVERAGE_SOURCE_RETRIEVAL", "COVERAGE_SOURCE_POST_RETRIEVAL", "SOURCE_CACHE_DECISION"].includes(audit.action)) };
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, counts: report.counts, sourceCategoryCounts: categoryCounts }));
}

void main();
