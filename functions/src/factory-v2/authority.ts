import { immutableEnvelope, parseSealedArtifact, semanticArtifactId, semanticEnvelope, type ArtifactContext } from "./contracts/builders";
import {
  V2_POLICY_VERSION,
  claimAuthorityVerdictSchema,
  claimConflictSetSchema,
  publisherAuthorityVersionSchema,
  type AtomicClaimVersion,
  type ClaimAuthorityVerdict,
  type ClaimConflictSet,
  type ClaimEvidenceEdge,
  type PublisherAuthorityVersion
} from "./contracts";
import { contentAddressedId, deterministicUuid, payloadHash } from "./hashing";

export type AuthorityEvaluationInput = {
  context: ArtifactContext;
  claim: AtomicClaimVersion;
  evidenceEdges: ClaimEvidenceEdge[];
  publishersByVersionId: ReadonlyMap<string, PublisherAuthorityVersion>;
  conflictSet?: ClaimConflictSet | null;
};

function isWikipedia(publisher: PublisherAuthorityVersion | undefined): boolean {
  return Boolean(publisher?.knownDomains.some((domain) => domain === "wikipedia.org" || domain.endsWith(".wikipedia.org")));
}

function isStrong(edge: ClaimEvidenceEdge, publisher: PublisherAuthorityVersion | undefined): boolean {
  return edge.relationship === "SUPPORTS" && edge.relevance === "DIRECT" && edge.authorityFinding === "STRONG" && publisher?.state === "VERIFIED" && !isWikipedia(publisher);
}

function isSecondary(publisher: PublisherAuthorityVersion | undefined): boolean {
  return publisher?.primarySecondaryTendency === "SECONDARY" || publisher?.primarySecondaryTendency === "MIXED";
}

function isDefinitivePrimary(edge: ClaimEvidenceEdge, publisher: PublisherAuthorityVersion | undefined, claim: AtomicClaimVersion): boolean {
  if (!isStrong(edge, publisher) || publisher?.primarySecondaryTendency !== "PRIMARY") return false;
  if (!["DATE", "OCCURRENCE", "INSTITUTIONAL_ACTION", "IDENTITY", "LOCATION", "QUANTITY"].includes(claim.claimType)) return false;
  return publisher.institutionType === "GOVERNMENT" || publisher.institutionType === "ARCHIVE" || publisher.institutionType === "STANDARDS_BODY";
}

export function evaluateClaimAuthority(input: AuthorityEvaluationInput): ClaimAuthorityVerdict {
  const authorityContext = { ...input.context, policyVersion: V2_POLICY_VERSION };
  const accepted: string[] = [];
  const rejected: string[] = [];
  const reasonCodes = new Set<ClaimAuthorityVerdict["reasonCodes"][number]>();
  const strongGroups = new Set<string>();
  const secondaryGroups = new Set<string>();
  let definitivePrimary = false;
  const uniqueEvidenceEdges = [...new Map(input.evidenceEdges.map((edge) => [edge.claimEvidenceId, edge])).values()];
  for (const edge of uniqueEvidenceEdges) {
    const publisher = edge.publisherVersionId ? input.publishersByVersionId.get(edge.publisherVersionId) : undefined;
    if (edge.relationship === "MENTIONS") {
      rejected.push(edge.claimEvidenceId);
      reasonCodes.add("MENTION_ONLY");
      continue;
    }
    if (isWikipedia(publisher)) {
      rejected.push(edge.claimEvidenceId);
      reasonCodes.add("WIKIPEDIA_EXCLUDED");
      continue;
    }
    if (!isStrong(edge, publisher)) {
      rejected.push(edge.claimEvidenceId);
      reasonCodes.add(edge.authorityFinding === "UNCLASSIFIED" || publisher?.state !== "VERIFIED" ? "WEAK_AUTHORITY" : "MISSING_EVIDENCE");
      continue;
    }
    accepted.push(edge.claimEvidenceId);
    strongGroups.add(edge.independenceGroupId);
    if (isSecondary(publisher)) secondaryGroups.add(edge.independenceGroupId);
    if (isDefinitivePrimary(edge, publisher, input.claim)) definitivePrimary = true;
  }
  const duplicateCount = accepted.length - strongGroups.size;
  if (duplicateCount > 0) reasonCodes.add("DEPENDENT_DUPLICATE");
  if (strongGroups.size > 0) reasonCodes.add("DIRECT_STRONG_SOURCE");
  if (definitivePrimary) reasonCodes.add("DEFINITIVE_PRIMARY");
  if (strongGroups.size >= 2) reasonCodes.add("INDEPENDENT_CORROBORATION");
  const conflictBlocks = input.conflictSet?.material === true && input.conflictSet.state === "UNRESOLVED";
  if (conflictBlocks) reasonCodes.add("UNRESOLVED_CONFLICT");
  let verdict: ClaimAuthorityVerdict["verdict"] = "INSUFFICIENT";
  if (input.claim.risk === "SENSITIVE") {
    reasonCodes.add("SENSITIVE_HUMAN_REVIEW");
    verdict = "REVIEW_REQUIRED";
  } else if (conflictBlocks) verdict = "REVIEW_REQUIRED";
  else if (input.claim.risk === "ROUTINE" && strongGroups.size >= 1) verdict = "SUPPORTED";
  else if (input.claim.risk === "MATERIAL" && (definitivePrimary || strongGroups.size >= 2)) verdict = "SUPPORTED";
  else if (input.claim.risk === "INTERPRETIVE" && secondaryGroups.size >= 2) {
    reasonCodes.add("INTERPRETIVE_SECONDARY_BURDEN");
    verdict = "SUPPORTED";
  } else if (input.claim.risk === "CONTESTED" && strongGroups.size >= 2 && input.conflictSet?.state === "HISTORICALLY_CONTESTED") verdict = "QUALIFIED";
  if (accepted.length === 0) reasonCodes.add("MISSING_EVIDENCE");
  const evidenceSetHash = payloadHash(uniqueEvidenceEdges.map((edge) => ({ id: edge.claimEvidenceId, hash: edge.payloadHash })).sort((left, right) => left.id.localeCompare(right.id)));
  const claimAuthorityVerdictId = semanticArtifactId("claim-verdict", authorityContext, { claimVersionId: input.claim.claimVersionId, evidenceSetHash });
  return parseSealedArtifact(claimAuthorityVerdictSchema, {
    ...semanticEnvelope(authorityContext, claimAuthorityVerdictId, input.claim.claimVersionId),
    claimAuthorityVerdictId,
    claimVersionId: input.claim.claimVersionId,
    evidenceSetHash,
    risk: input.claim.risk,
    verdict,
    reasonCodes: [...reasonCodes].sort(),
    qualifyingText: verdict === "QUALIFIED" ? "Credible authorities preserve materially different historical accounts." : null,
    acceptedEvidenceEdgeIds: accepted.sort(),
    rejectedEvidenceEdgeIds: rejected.sort(),
    independenceGroupCount: strongGroups.size,
    definitivePrimary,
    deterministicEvaluator: true
  });
}

export function independenceGroup(input: {
  publisher: PublisherAuthorityVersion | undefined;
  contentHash: string;
  syndicatedFromPublisherId?: string | null;
  underlyingSourceId?: string | null;
}): { independenceGroupId: string; dependenceBasis: string[] } {
  const dependenceBasis: string[] = [];
  let key: string;
  if (input.underlyingSourceId) { key = `underlying:${input.underlyingSourceId}`; dependenceBasis.push("COMMON_UNDERLYING_SOURCE"); }
  else if (input.syndicatedFromPublisherId) { key = `syndicated:${input.syndicatedFromPublisherId}`; dependenceBasis.push("SYNDICATED_COPY"); }
  else if (input.publisher) {
    key = `publisher:${input.publisher.parentPublisherId || input.publisher.publisherId}`;
    dependenceBasis.push(input.publisher.parentPublisherId ? "SAME_PARENT_PUBLISHER" : "SAME_PUBLISHER");
  } else { key = `content:${input.contentHash}`; dependenceBasis.push("IDENTICAL_CONTENT_HASH"); }
  return { independenceGroupId: contentAddressedId("independence", key), dependenceBasis };
}

export function detectClaimConflicts(input: { context: ArtifactContext; claims: AtomicClaimVersion[]; evidenceEdges: ClaimEvidenceEdge[] }): ClaimConflictSet[] {
  const authorityContext = { ...input.context, policyVersion: V2_POLICY_VERSION };
  const groups = new Map<string, AtomicClaimVersion[]>();
  for (const claim of input.claims) {
    const key = payloadHash({ subject: claim.subject, predicate: claim.predicate, temporal: claim.temporal });
    const values = groups.get(key) || [];
    values.push(claim);
    groups.set(key, values);
  }
  const edgeByClaim = new Map<string, ClaimEvidenceEdge[]>();
  for (const edge of input.evidenceEdges) edgeByClaim.set(edge.claimVersionId, [...(edgeByClaim.get(edge.claimVersionId) || []), edge]);
  return [...groups.entries()].flatMap(([conflictKey, claims]) => {
    const valueKeys = new Set(claims.map((claim) => payloadHash(claim.object)));
    const hasContradictionEdge = claims.some((claim) => (edgeByClaim.get(claim.claimVersionId) || []).some((edge) => edge.relationship === "CONTRADICTS"));
    if (valueKeys.size < 2 && !hasContradictionEdge) return [];
    const claimVersionIds = claims.map((claim) => claim.claimVersionId).sort();
    const evidenceEdgeIds = claims.flatMap((claim) => edgeByClaim.get(claim.claimVersionId) || []).map((edge) => edge.claimEvidenceId).sort();
    if (evidenceEdgeIds.length < 2) return [];
    const material = claims.some((claim) => claim.risk !== "ROUTINE");
    const conflictSetId = semanticArtifactId("claim-conflict", authorityContext, { conflictKey, claimVersionIds, evidenceEdgeIds, state: "UNRESOLVED", material });
    return [parseSealedArtifact(claimConflictSetSchema, { ...semanticEnvelope(authorityContext, conflictSetId), conflictSetId, conflictKey, claimVersionIds, evidenceEdgeIds, state: "UNRESOLVED", material, resolutionReason: null, resolutionEvidenceSegmentIds: [], blocksPass: material })];
  });
}

type BootstrapPublisher = Omit<PublisherAuthorityVersion, keyof ReturnType<typeof immutableEnvelope> | "artifactId" | "payloadHash" | "publisherId" | "publisherVersionId" | "version" | "classificationEvidenceSegmentIds" | "admittedBy">;

export type PublisherAuthorityVersionInput = BootstrapPublisher & {
  publisherId?: string;
  version: number;
  effectiveAt: string;
  classificationEvidenceSegmentIds: string[];
  admittedBy: "POLICY" | "HUMAN";
};

function normalizedSet(values: string[], transform: (value: string) => string = (value) => value.normalize("NFKC").trim()): string[] {
  return [...new Set(values.map(transform))].sort((left, right) => left.localeCompare(right));
}

/** Build successor authority versions independently from the topic/run that
 * happened to request them. effectiveAt and authority policy are semantic;
 * caller execution coordinates are not. */
export function buildPublisherAuthorityVersion(context: ArtifactContext, input: PublisherAuthorityVersionInput): PublisherAuthorityVersion {
  const publisherId = input.publisherId || deterministicUuid("timelines.publisher", input.canonicalName.normalize("NFKC").trim());
  const policyVersion = context.policyVersion || V2_POLICY_VERSION;
  const semantic = {
    canonicalName: input.canonicalName.normalize("NFKC").trim(),
    aliases: normalizedSet(input.aliases),
    parentPublisherId: input.parentPublisherId,
    institutionType: input.institutionType,
    authorityDomains: normalizedSet(input.authorityDomains),
    geographicScope: normalizedSet(input.geographicScope),
    languages: normalizedSet(input.languages),
    primarySecondaryTendency: input.primarySecondaryTendency,
    knownDomains: normalizedSet(input.knownDomains, (value) => value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/^www\./u, "")),
    externalIdentifiers: [...new Map(input.externalIdentifiers.map((item) => [`${item.scheme.normalize("NFKC").trim()}:${item.value.normalize("NFKC").trim()}`, { scheme: item.scheme.normalize("NFKC").trim(), value: item.value.normalize("NFKC").trim() }])).values()].sort((left, right) => `${left.scheme}:${left.value}`.localeCompare(`${right.scheme}:${right.value}`)),
    independenceGroupId: input.independenceGroupId,
    accessLimitations: normalizedSet(input.accessLimitations),
    state: input.state,
    classificationEvidenceSegmentIds: normalizedSet(input.classificationEvidenceSegmentIds),
    admittedBy: input.admittedBy
  };
  const registryContext: ArtifactContext = { corpusId: context.corpusId, topicId: "publisher-registry", runId: "publisher-authority-versions", generation: input.version, createdAt: input.effectiveAt, policyVersion };
  const publisherVersionId = semanticArtifactId("publisher-version", registryContext, { publisherId, version: input.version, semantic, effectiveAt: input.effectiveAt });
  return parseSealedArtifact(publisherAuthorityVersionSchema, { ...semanticEnvelope(registryContext, publisherVersionId), ...semantic, publisherId, publisherVersionId, version: input.version, effectiveAt: input.effectiveAt });
}

const BOOTSTRAP_PUBLISHERS: BootstrapPublisher[] = [
  { canonicalName: "National Aeronautics and Space Administration", aliases: ["NASA"], parentPublisherId: null, institutionType: "GOVERNMENT", authorityDomains: ["United States civil spaceflight and mission records"], geographicScope: ["United States", "International"], languages: ["en"], primarySecondaryTendency: "PRIMARY", knownDomains: ["nasa.gov"], externalIdentifiers: [], independenceGroupId: "publisher-nasa", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "CERN", aliases: ["European Organization for Nuclear Research"], parentPublisherId: null, institutionType: "OTHER", authorityDomains: ["World Wide Web origins", "particle physics"], geographicScope: ["International"], languages: ["en", "fr"], primarySecondaryTendency: "PRIMARY", knownDomains: ["cern.ch", "home.cern"], externalIdentifiers: [], independenceGroupId: "publisher-cern", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "World Wide Web Consortium", aliases: ["W3C"], parentPublisherId: null, institutionType: "STANDARDS_BODY", authorityDomains: ["Web standards and institutional history"], geographicScope: ["International"], languages: ["en"], primarySecondaryTendency: "PRIMARY", knownDomains: ["w3.org"], externalIdentifiers: [], independenceGroupId: "publisher-w3c", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "German Federal Archives", aliases: ["Bundesarchiv"], parentPublisherId: null, institutionType: "ARCHIVE", authorityDomains: ["German state records and modern German history"], geographicScope: ["Germany"], languages: ["de", "en"], primarySecondaryTendency: "PRIMARY", knownDomains: ["bundesarchiv.de"], externalIdentifiers: [], independenceGroupId: "publisher-bundesarchiv", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "National Archives and Records Administration", aliases: ["US National Archives", "NARA"], parentPublisherId: null, institutionType: "ARCHIVE", authorityDomains: ["United States federal records and presidential history"], geographicScope: ["United States"], languages: ["en"], primarySecondaryTendency: "PRIMARY", knownDomains: ["archives.gov"], externalIdentifiers: [], independenceGroupId: "publisher-nara", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "John F. Kennedy Presidential Library and Museum", aliases: ["JFK Library"], parentPublisherId: null, institutionType: "ARCHIVE", authorityDomains: ["John F. Kennedy administration and Cuban Missile Crisis records"], geographicScope: ["United States", "Cuba", "Soviet Union"], languages: ["en"], primarySecondaryTendency: "PRIMARY", knownDomains: ["jfklibrary.org"], externalIdentifiers: [], independenceGroupId: "publisher-jfk-library", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "Office of the Historian, United States Department of State", aliases: ["Office of the Historian"], parentPublisherId: null, institutionType: "GOVERNMENT", authorityDomains: ["United States diplomatic history and foreign relations records"], geographicScope: ["United States", "International"], languages: ["en"], primarySecondaryTendency: "PRIMARY", knownDomains: ["history.state.gov"], externalIdentifiers: [], independenceGroupId: "publisher-us-state-historian", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "Smithsonian National Air and Space Museum", aliases: ["National Air and Space Museum"], parentPublisherId: null, institutionType: "MUSEUM", authorityDomains: ["Aviation and spaceflight history"], geographicScope: ["United States", "International"], languages: ["en"], primarySecondaryTendency: "MIXED", knownDomains: ["airandspace.si.edu"], externalIdentifiers: [], independenceGroupId: "publisher-smithsonian-air-space", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "Berlin Wall Foundation", aliases: ["Stiftung Berliner Mauer"], parentPublisherId: null, institutionType: "MUSEUM", authorityDomains: ["Berlin Wall and divided Germany history"], geographicScope: ["Germany", "Berlin"], languages: ["de", "en"], primarySecondaryTendency: "MIXED", knownDomains: ["stiftung-berliner-mauer.de"], externalIdentifiers: [], independenceGroupId: "publisher-berlin-wall-foundation", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "Imperial War Museums", aliases: ["IWM"], parentPublisherId: null, institutionType: "MUSEUM", authorityDomains: ["Modern conflict and Cold War history"], geographicScope: ["United Kingdom", "International"], languages: ["en"], primarySecondaryTendency: "MIXED", knownDomains: ["iwm.org.uk"], externalIdentifiers: [], independenceGroupId: "publisher-iwm", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "Computer History Museum", aliases: ["CHM"], parentPublisherId: null, institutionType: "MUSEUM", authorityDomains: ["Computing and World Wide Web history"], geographicScope: ["United States", "International"], languages: ["en"], primarySecondaryTendency: "MIXED", knownDomains: ["computerhistory.org"], externalIdentifiers: [], independenceGroupId: "publisher-computer-history-museum", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "Associated Press", aliases: ["AP"], parentPublisherId: null, institutionType: "NEWSROOM", authorityDomains: ["Contemporary reporting"], geographicScope: ["International"], languages: ["en"], primarySecondaryTendency: "SECONDARY", knownDomains: ["apnews.com"], externalIdentifiers: [], independenceGroupId: "publisher-ap", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "Reuters", aliases: [], parentPublisherId: null, institutionType: "NEWSROOM", authorityDomains: ["Contemporary reporting"], geographicScope: ["International"], languages: ["en"], primarySecondaryTendency: "SECONDARY", knownDomains: ["reuters.com"], externalIdentifiers: [], independenceGroupId: "publisher-reuters", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "BBC", aliases: ["British Broadcasting Corporation"], parentPublisherId: null, institutionType: "NEWSROOM", authorityDomains: ["Edited journalism and historical reference"], geographicScope: ["United Kingdom", "International"], languages: ["en"], primarySecondaryTendency: "SECONDARY", knownDomains: ["bbc.com", "bbc.co.uk"], externalIdentifiers: [], independenceGroupId: "publisher-bbc", accessLimitations: [], state: "VERIFIED" },
  { canonicalName: "Encyclopaedia Britannica", aliases: ["Britannica"], parentPublisherId: null, institutionType: "EDITED_REFERENCE", authorityDomains: ["General edited historical reference"], geographicScope: ["International"], languages: ["en"], primarySecondaryTendency: "SECONDARY", knownDomains: ["britannica.com"], externalIdentifiers: [], independenceGroupId: "publisher-britannica", accessLimitations: ["Some pages may be access limited"], state: "VERIFIED" },
  { canonicalName: "Wikimedia Foundation", aliases: ["Wikipedia"], parentPublisherId: null, institutionType: "OTHER", authorityDomains: ["Orientation and reference discovery only"], geographicScope: ["International"], languages: ["multilingual"], primarySecondaryTendency: "SECONDARY", knownDomains: ["wikipedia.org"], externalIdentifiers: [], independenceGroupId: "publisher-wikimedia", accessLimitations: ["ORIENTATION_ONLY"], state: "VERIFIED" }
];

export function bootstrapPublisherRegistry(context: ArtifactContext): PublisherAuthorityVersion[] {
  // Bootstrap authority versions are semantic registry state governed by the
  // fixed authority policy, not by a topic operation's caller policy.
  const registryContext: ArtifactContext = { ...context, topicId: "publisher-registry", runId: "bootstrap-v2-a", generation: 1, createdAt: "2026-09-06T00:00:00.000Z", policyVersion: V2_POLICY_VERSION };
  return BOOTSTRAP_PUBLISHERS.map((publisher) => buildPublisherAuthorityVersion(registryContext, {
    ...publisher,
    version: 2,
    effectiveAt: "2026-09-06T00:00:00.000Z",
    classificationEvidenceSegmentIds: [],
    admittedBy: "POLICY"
  }));
}
