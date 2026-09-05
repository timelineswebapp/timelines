import type { GeneratedTimeline, GroundedEvidenceSegment, SourceCandidate } from "./schemas";

type GeneratedEvent = GeneratedTimeline["events"][number];

export const SOURCE_AUTHORITY_POLICY_VERSION = "source-authority-v2.0.1-certified-2026-09-05";

export type SourceClassification =
  | "primary_institutional"
  | "scholarly"
  | "edited_reference"
  | "high_quality_journalism"
  | "wikipedia"
  | "reputable_specialist"
  | "general_web"
  | "unclassified";

export type AuthorityTier = "A" | "A_B" | "B" | "B_C" | "C" | "D" | "UNCLASSIFIED";
export type EvidenceRole = "primary" | "secondary" | "orientation" | "unknown";
export type ClaimRelevance = "direct" | "contextual" | "insufficient";
export type ClaimRisk = "routine_fact" | "major_historical_milestone" | "contested_interpretive" | "exceptional_high_risk";
export type ClaimEvidenceVerdict = "passed" | "failed" | "exceptional_review";

export type SourceInventoryItem = {
  sourceRef: string;
  domain: string;
  publisher: string;
  pageTitle: string;
  publisherIdentity: string;
  sourceClassification: SourceClassification;
  authorityTier: AuthorityTier;
  defaultEvidenceRole: EvidenceRole;
  institutionalStatus: "verified_institutional" | "domain_pattern" | "not_established";
  scholarlyStatus: "verified_scholarly" | "academic_domain_pattern" | "not_established";
  geographicContext: string;
  geographicBasis: "verified_publisher_identity" | "country_code_domain" | "not_established";
  independenceKey: string;
  independenceBasis: "verified_publisher_identity" | "registrable_domain";
  classificationBasis: string[];
};

export type ClaimEvidenceAssessment = {
  evidenceRef: string;
  sourceRef: string;
  exactEvidence: string;
  sourceAuthorityTier: AuthorityTier;
  sourceClassification: SourceClassification;
  claimRelevance: ClaimRelevance;
  evidenceRole: EvidenceRole;
  claimAuthority: "authoritative" | "supporting" | "orientation" | "insufficient";
  independenceKey: string;
};

export type ClaimAuthorityAssessment = {
  claimId: string;
  eventIndex: number;
  eventTitle: string;
  claim: string;
  claimRisk: ClaimRisk;
  evidence: ClaimEvidenceAssessment[];
  corroborationRequired: boolean;
  corroborationGroups: string[];
  independentStrongSourceCount: number;
  definitivePrimaryAuthority: boolean;
  conflictFindings: string[];
  verdict: ClaimEvidenceVerdict;
  unresolvedIssues: string[];
};

export type SourceAuthorityAssessment = {
  policyVersion: typeof SOURCE_AUTHORITY_POLICY_VERSION;
  sourceInventory: SourceInventoryItem[];
  claims: ClaimAuthorityAssessment[];
  sourceDiversity: {
    publisherCount: number;
    sourceTypeCount: number;
    primarySourceCount: number;
    secondarySourceCount: number;
    wikipediaSourceCount: number;
    geographicContextCount: number;
  };
  conflictFindings: string[];
  unresolvedSourceIssues: string[];
  policyLimitations: string[];
  overallVerdict: ClaimEvidenceVerdict;
};

const DOMAIN_PRIORS: Readonly<Record<string, { classification: SourceClassification; tier: AuthorityTier; identity?: string }>> = {
  "apnews.com": { classification: "high_quality_journalism", tier: "B", identity: "associated-press" },
  "aip.org": { classification: "scholarly", tier: "A", identity: "american-institute-of-physics" },
  "aps.org": { classification: "scholarly", tier: "A", identity: "american-physical-society" },
  "bbc.com": { classification: "high_quality_journalism", tier: "B", identity: "bbc" },
  "bbc.co.uk": { classification: "high_quality_journalism", tier: "B", identity: "bbc" },
  "britannica.com": { classification: "edited_reference", tier: "A_B", identity: "encyclopaedia-britannica" },
  "bundesarchiv.de": { classification: "primary_institutional", tier: "A", identity: "german-federal-archives" },
  "cern.ch": { classification: "primary_institutional", tier: "A", identity: "cern" },
  "cfr.org": { classification: "reputable_specialist", tier: "C", identity: "council-on-foreign-relations" },
  "diplo.de": { classification: "primary_institutional", tier: "A", identity: "german-federal-foreign-office" },
  "docsteach.org": { classification: "primary_institutional", tier: "A", identity: "us-national-archives" },
  "ebsco.com": { classification: "edited_reference", tier: "A_B", identity: "ebsco" },
  "enrs.eu": { classification: "reputable_specialist", tier: "C", identity: "european-network-remembrance-solidarity" },
  "esa.int": { classification: "primary_institutional", tier: "A", identity: "european-space-agency" },
  "germanhistorydocs.org": { classification: "scholarly", tier: "A", identity: "german-historical-institute" },
  "historians.org": { classification: "scholarly", tier: "A", identity: "american-historical-association" },
  "history.state.gov": { classification: "primary_institutional", tier: "A", identity: "us-state-department" },
  "home.cern": { classification: "primary_institutional", tier: "A", identity: "cern" },
  "iwm.org.uk": { classification: "primary_institutional", tier: "A", identity: "imperial-war-museums" },
  "loc.gov": { classification: "primary_institutional", tier: "A", identity: "library-of-congress" },
  "nasa.gov": { classification: "primary_institutional", tier: "A", identity: "nasa" },
  "nature.com": { classification: "scholarly", tier: "A", identity: "nature-portfolio" },
  "pewresearch.org": { classification: "reputable_specialist", tier: "C", identity: "pew-research-center" },
  "nla.gov.au": { classification: "primary_institutional", tier: "A", identity: "national-library-australia" },
  "ndl.go.jp": { classification: "primary_institutional", tier: "A", identity: "national-diet-library-japan" },
  "nobelprize.org": { classification: "primary_institutional", tier: "A", identity: "nobel-prize" },
  "oxfordreference.com": { classification: "edited_reference", tier: "A_B", identity: "oxford-reference" },
  "reuters.com": { classification: "high_quality_journalism", tier: "B", identity: "reuters" },
  "rusi.org": { classification: "reputable_specialist", tier: "C", identity: "rusi" },
  "state.gov": { classification: "primary_institutional", tier: "A", identity: "us-state-department" },
  "stiftung-berliner-mauer.de": { classification: "primary_institutional", tier: "A", identity: "berlin-wall-foundation" },
  "science.org": { classification: "scholarly", tier: "A", identity: "american-association-for-the-advancement-of-science" },
  "sciencedirect.com": { classification: "scholarly", tier: "A_B", identity: "elsevier-sciencedirect" },
  "springer.com": { classification: "scholarly", tier: "A", identity: "springer-nature" },
  "theworld.org": { classification: "high_quality_journalism", tier: "B", identity: "the-world-prx" },
  "un.org": { classification: "primary_institutional", tier: "A", identity: "united-nations" },
  "unesco.org": { classification: "primary_institutional", tier: "A", identity: "unesco" },
  "w3.org": { classification: "primary_institutional", tier: "A", identity: "w3c" },
  "who.int": { classification: "primary_institutional", tier: "A", identity: "world-health-organization" },
  "wipo.int": { classification: "primary_institutional", tier: "A", identity: "world-intellectual-property-organization" },
  "wikipedia.org": { classification: "wikipedia", tier: "B_C", identity: "wikimedia" }
};

const LOW_ACCOUNTABILITY_DOMAINS = new Set([
  "facebook.com", "insightvacations.com", "lumenlearning.com", "medium.com", "onlineinvent.com.au",
  "pmfias.com", "preceden.com", "quora.com", "sofi.com", "study.com", "toursofberlin.com",
  "visualcapitalist.com", "youtube.com"
]);

const STOP_WORDS = new Set([
  "about", "after", "also", "among", "and", "are", "because", "been", "before", "being", "between", "but", "can",
  "during", "for", "from", "had", "has", "have", "into", "its", "later", "more", "most", "not", "over", "that", "the",
  "their", "then", "these", "this", "through", "under", "was", "were", "which", "while", "with", "would"
]);

function normalizedDomain(value: string): string | null {
  const candidate = value.trim().toLocaleLowerCase("en-US").replace(/^https?:\/\//u, "").replace(/^www\./u, "").split(/[\/?#\s]/u)[0] || "";
  return /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/u.test(candidate) ? candidate : null;
}

function registrableDomain(domain: string): string {
  const parts = domain.split(".");
  const compoundSuffix = parts.length >= 3 && new Set(["ac", "co", "com", "gov", "org"]).has(parts.at(-2)!);
  return parts.slice(compoundSuffix ? -3 : -2).join(".");
}

function sourceDomain(source: SourceCandidate): string {
  for (const candidate of [source.publisher, source.title]) {
    const domain = normalizedDomain(candidate);
    if (domain) return domain;
  }
  const hostname = new URL(source.url).hostname.replace(/^www\./u, "");
  return hostname === "vertexaisearch.cloud.google.com" ? "unresolved-grounding-destination" : hostname;
}

function isGovernmentDomain(domain: string) {
  return domain.endsWith(".gov") || /\.gov\.[a-z]{2}$/u.test(domain) || domain.endsWith(".gouv.fr") || domain.endsWith(".bund.de");
}

function isAcademicDomain(domain: string) {
  return domain.endsWith(".edu") || /\.ac\.[a-z]{2}$/u.test(domain) || domain.includes("university") || domain.includes("universitat");
}

function tokens(value: string): Set<string> {
  return new Set(value.normalize("NFKD").replace(/\p{M}+/gu, "").toLocaleLowerCase("en-US")
    .split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3 && !STOP_WORDS.has(token)));
}

function sourcePrior(source: SourceCandidate): SourceInventoryItem {
  const domain = sourceDomain(source);
  const exact = DOMAIN_PRIORS[domain] || DOMAIN_PRIORS[registrableDomain(domain)];
  let classification: SourceClassification;
  let tier: AuthorityTier;
  const basis: string[] = [];
  if (exact) {
    ({ classification, tier } = exact);
    basis.push("known_publisher_prior");
  } else if (isGovernmentDomain(domain) || /archive|museum|biblioth|library/u.test(domain)) {
    classification = "primary_institutional";
    tier = "A";
    basis.push("institutional_domain_pattern");
  } else if (isAcademicDomain(domain) || /journal|doi\.org/u.test(domain)) {
    classification = "scholarly";
    tier = "A";
    basis.push("scholarly_domain_pattern");
  } else if (LOW_ACCOUNTABILITY_DOMAINS.has(registrableDomain(domain))) {
    classification = "general_web";
    tier = "D";
    basis.push("low_accountability_publisher_prior");
  } else if (domain.endsWith(".org")) {
    classification = "unclassified";
    tier = "UNCLASSIFIED";
    basis.push("organization_without_verified_authority_prior");
  } else {
    classification = "general_web";
    tier = "D";
    basis.push("general_web_default");
  }
  const publisherIdentity = exact?.identity || registrableDomain(domain);
  const defaultEvidenceRole: EvidenceRole = classification === "wikipedia" ? "orientation"
    : classification === "primary_institutional" ? "primary"
      : classification === "unclassified" ? "unknown" : "secondary";
  const institutionalStatus = classification === "primary_institutional"
    ? (exact ? "verified_institutional" : "domain_pattern")
    : "not_established";
  const scholarlyStatus = classification === "scholarly"
    ? (exact ? "verified_scholarly" : "academic_domain_pattern")
    : "not_established";
  const verifiedGeography: Record<string, string> = {
    "national-library-australia": "Australia",
    "german-federal-archives": "Germany",
    "german-federal-foreign-office": "Germany",
    "german-historical-institute": "Germany/United States",
    "national-diet-library-japan": "Japan",
    "united-nations": "International",
    "unesco": "International",
    "world-health-organization": "International"
  };
  const countryCodeGeography = domain.endsWith(".de") ? "Germany"
    : domain.endsWith(".jp") ? "Japan"
      : domain.endsWith(".au") ? "Australia"
        : domain.endsWith(".uk") ? "United Kingdom"
          : domain.endsWith(".fr") ? "France"
            : domain.endsWith(".eu") ? "Europe"
              : domain.endsWith(".it") ? "Italy"
              : domain.endsWith(".ch") ? "Switzerland"
                : domain.endsWith(".int") ? "International"
                  : domain.endsWith(".gov") || domain.endsWith(".edu") ? "United States"
                    : "not_established";
  const geographicContext = verifiedGeography[publisherIdentity] || countryCodeGeography;
  const geographicBasis = verifiedGeography[publisherIdentity] ? "verified_publisher_identity"
    : geographicContext !== "not_established" ? "country_code_domain" : "not_established";
  return {
    sourceRef: source.sourceId,
    domain,
    publisher: source.publisher,
    pageTitle: source.title,
    publisherIdentity,
    sourceClassification: classification,
    authorityTier: tier,
    defaultEvidenceRole,
    institutionalStatus,
    scholarlyStatus,
    geographicContext,
    geographicBasis,
    independenceKey: publisherIdentity,
    independenceBasis: exact?.identity ? "verified_publisher_identity" : "registrable_domain",
    classificationBasis: basis
  };
}

function relevance(event: GeneratedEvent, evidence: GroundedEvidenceSegment): ClaimRelevance {
  const claimTokens = tokens(`${event.title} ${event.description}`);
  const evidenceTokens = tokens(evidence.exactEvidence);
  const overlap = [...claimTokens].filter((token) => evidenceTokens.has(token)).length;
  const denominator = Math.max(1, Math.min(claimTokens.size, evidenceTokens.size));
  const titleTokens = tokens(event.title);
  const titleOverlap = [...titleTokens].filter((token) => evidenceTokens.has(token)).length / Math.max(1, titleTokens.size);
  const yearGrounded = evidence.exactEvidence.includes(String(Math.abs(event.sortYear)));
  const evidenceYears = [...evidence.exactEvidence.matchAll(/\b(?:1[0-9]{3}|20[0-9]{2})\b/gu)].map((match) => Number(match[0]));
  if (evidenceYears.length > 0 && !evidenceYears.includes(Math.abs(event.sortYear))) {
    return overlap / denominator >= 0.14 || titleOverlap >= 0.5 ? "contextual" : "insufficient";
  }
  if (overlap / denominator >= 0.34 || titleOverlap >= 0.5 || (yearGrounded && overlap >= 2)) return "direct";
  if (overlap / denominator >= 0.14 || yearGrounded) return "contextual";
  return "insufficient";
}

function institutionAffinity(inventory: SourceInventoryItem, event: GeneratedEvent): boolean {
  const claimTokens = tokens(`${event.title} ${event.description}`);
  if (inventory.publisherIdentity === "nasa" && ["nasa", "apollo", "webb", "jwst"].some((token) => claimTokens.has(token))) return true;
  if (inventory.publisherIdentity === "european-space-agency" && ["esa", "webb", "jwst"].some((token) => claimTokens.has(token))) return true;
  if (inventory.publisherIdentity === "cern" && ["cern", "lhc", "higgs", "atlas", "cms", "lep"].some((token) => claimTokens.has(token))) return true;
  if (inventory.publisherIdentity === "w3c" && (claimTokens.has("w3c") || claimTokens.has("consortium"))) return true;
  if (inventory.publisherIdentity === "united-nations" && (claimTokens.has("unesco") || (claimTokens.has("united") && claimTokens.has("nations")))) return true;
  const aliases: Record<string, string[]> = {
    cern: ["cern", "web", "worldwide"],
    w3c: ["w3c", "consortium", "web", "standards"],
    nasa: ["nasa", "mission", "spacecraft", "launch"],
    "berlin-wall-foundation": ["berlin", "wall"],
    "german-federal-archives": ["german", "federal", "archives", "bundesarchiv"],
    "national-diet-library-japan": ["national", "diet", "library", "japan"],
    "national-library-australia": ["national", "library", "australia"],
    "united-nations": ["united", "nations"],
    unesco: ["unesco"],
    "world-health-organization": ["world", "health", "organization", "who"],
    "imperial-war-museums": ["war", "military"],
    "german-federal-foreign-office": ["german", "germany", "reunification", "unification", "diplomatic"],
    "us-state-department": ["united", "states", "diplomatic"]
  };
  const expected = aliases[inventory.publisherIdentity] || tokens(inventory.publisherIdentity);
  const values = Array.isArray(expected) ? expected : [...expected];
  return values.filter((token) => claimTokens.has(token)).length >= Math.min(2, values.length);
}

function evidenceRole(inventory: SourceInventoryItem, event: GeneratedEvent): EvidenceRole {
  if (inventory.sourceClassification === "wikipedia") return "orientation";
  if (inventory.sourceClassification !== "primary_institutional") return inventory.defaultEvidenceRole;
  return institutionAffinity(inventory, event) ? "primary" : "secondary";
}

function classifyRisk(event: GeneratedEvent): ClaimRisk {
  const value = `${event.title} ${event.description}`.toLocaleLowerCase("en-US");
  if (/casualt|death toll|killed|genocide|war crime|ethnic cleansing|responsib|ongoing conflict|atrocit/u.test(value)) return "exceptional_high_risk";
  if (/disputed|controvers|accounts differ|historians debate|caused\b|responsible for|widely considered/u.test(value)) return "contested_interpretive";
  return event.importance >= 4 ? "major_historical_milestone" : "routine_fact";
}

function strongForClaim(evidence: ClaimEvidenceAssessment): boolean {
  if (evidence.claimRelevance !== "direct" || evidence.claimAuthority !== "authoritative") return false;
  return evidence.sourceAuthorityTier === "A" || evidence.sourceAuthorityTier === "A_B" || evidence.sourceAuthorityTier === "B" || evidence.sourceAuthorityTier === "C";
}

function tierRank(tier: AuthorityTier): number {
  return tier === "A" ? 6 : tier === "A_B" ? 5 : tier === "B" ? 4 : tier === "C" ? 3 : tier === "B_C" ? 2 : tier === "UNCLASSIFIED" ? 1 : 0;
}

export function selectAuthoritativeEvidence(input: {
  timeline: GeneratedTimeline;
  sources: SourceCandidate[];
  evidenceSegments: GroundedEvidenceSegment[];
}): GeneratedTimeline {
  const inventoryByRef = new Map(input.sources.map(sourcePrior).map((source) => [source.sourceRef, source]));
  const events = input.timeline.events.map((event) => {
    const originalEvidence = new Set(event.evidenceRefs);
    const ranked = input.evidenceSegments.flatMap((segment, catalogIndex) => {
      if (relevance(event, segment) !== "direct") return [];
      const inventories = segment.sourceRefs.map((sourceRef) => inventoryByRef.get(sourceRef)).filter((source): source is SourceInventoryItem => Boolean(source));
      const strongestTier = Math.max(-1, ...inventories.map((source) => tierRank(source.authorityTier)));
      const independentStrong = new Set(inventories
        .filter((source) => source.sourceClassification !== "wikipedia" && tierRank(source.authorityTier) >= tierRank("C"))
        .map((source) => source.independenceKey)).size;
      const primaryAffinity = inventories.some((source) => source.sourceClassification === "primary_institutional" && institutionAffinity(source, event));
      return [{ segment, catalogIndex, strongestTier, independentStrong, primaryAffinity, originallySelected: originalEvidence.has(segment.evidenceRef) }];
    }).sort((left, right) =>
      Number(right.primaryAffinity) - Number(left.primaryAffinity) ||
      right.independentStrong - left.independentStrong ||
      right.strongestTier - left.strongestTier ||
      Number(right.originallySelected) - Number(left.originallySelected) ||
      left.catalogIndex - right.catalogIndex
    );
    const selected = ranked.slice(0, 3).map((item) => item.segment);
    if (selected.length === 0) return event;
    const selectedSourceRefs = Array.from(new Set(selected.flatMap((segment) => segment.sourceRefs)))
      .sort((left, right) => {
        const leftSource = inventoryByRef.get(left);
        const rightSource = inventoryByRef.get(right);
        const leftPrimary = leftSource?.sourceClassification === "primary_institutional" && institutionAffinity(leftSource, event);
        const rightPrimary = rightSource?.sourceClassification === "primary_institutional" && institutionAffinity(rightSource, event);
        return Number(rightPrimary) - Number(leftPrimary) || tierRank(rightSource?.authorityTier || "UNCLASSIFIED") - tierRank(leftSource?.authorityTier || "UNCLASSIFIED") || left.localeCompare(right);
      })
      .slice(0, 3);
    return { ...event, evidenceRefs: selected.map((segment) => segment.evidenceRef), sourceRefs: selectedSourceRefs };
  });
  return { ...input.timeline, events };
}

function extractSingleYear(value: string): string | null {
  const years = [...value.matchAll(/\b(?:1[0-9]{3}|20[0-9]{2})\b/gu)].map((match) => match[0]);
  return new Set(years).size === 1 ? years[0]! : null;
}

function detectConflictFindings(
  event: GeneratedEvent,
  evidence: GroundedEvidenceSegment[],
  relevant: Map<string, ClaimRelevance>,
  inventoryByRef: Map<string, SourceInventoryItem>
): string[] {
  const findings: string[] = [];
  const hasStrongClaimAuthority = (item: GroundedEvidenceSegment) => item.sourceRefs.some((sourceRef) => {
    const inventory = inventoryByRef.get(sourceRef);
    if (!inventory || inventory.sourceClassification === "wikipedia" || !["A", "A_B", "B", "C"].includes(inventory.authorityTier)) return false;
    return inventory.sourceClassification !== "primary_institutional" || evidenceRole(inventory, event) === "primary";
  });
  const authoritativeEvidence = evidence.filter((item) => hasStrongClaimAuthority(item));
  const explicit = authoritativeEvidence.filter((item) => relevant.get(item.evidenceRef) === "direct" && /sources? (?:disagree|conflict)|accounts? differ|disputed|estimates? (?:range|vary)/iu.test(item.exactEvidence));
  if (explicit.length > 0) findings.push("Authoritative disagreement is explicitly present in grounded evidence.");
  const directYears = authoritativeEvidence
    .filter((item) => {
      if (relevant.get(item.evidenceRef) === "direct") return true;
      const titleTokens = tokens(event.title);
      const evidenceTokens = tokens(item.exactEvidence);
      return [...titleTokens].filter((token) => evidenceTokens.has(token)).length / Math.max(1, titleTokens.size) >= 0.75;
    })
    .map((item) => extractSingleYear(item.exactEvidence))
    .filter((year): year is string => Boolean(year));
  if (new Set(directYears).size > 1) findings.push(`Direct evidence gives conflicting event years: ${[...new Set(directYears)].sort().join(", ")}.`);
  const quantities = new Map<string, Set<string>>();
  for (const item of authoritativeEvidence.filter((entry) => relevant.get(entry.evidenceRef) === "direct")) {
    for (const match of item.exactEvidence.matchAll(/\b([0-9][0-9,.]*)\s+(people|deaths|casualties|killed|attendees|users)\b/giu)) {
      const unit = match[2]!.toLocaleLowerCase("en-US");
      const values = quantities.get(unit) || new Set<string>();
      values.add(match[1]!.replace(/,/gu, ""));
      quantities.set(unit, values);
    }
  }
  for (const [unit, values] of quantities) if (values.size > 1) findings.push(`Direct evidence gives conflicting ${unit} quantities: ${[...values].sort().join(", ")}.`);
  return findings;
}

export function assessSourceAuthority(input: {
  timeline: GeneratedTimeline;
  sources: SourceCandidate[];
  evidenceSegments: GroundedEvidenceSegment[];
}): SourceAuthorityAssessment {
  const sourceInventory = input.sources.map(sourcePrior);
  const inventoryByRef = new Map(sourceInventory.map((source) => [source.sourceRef, source]));
  const evidenceByRef = new Map(input.evidenceSegments.map((evidence) => [evidence.evidenceRef, evidence]));
  const claims = input.timeline.events.map((event, eventIndex): ClaimAuthorityAssessment => {
    const linkedEvidence = event.evidenceRefs.map((ref) => evidenceByRef.get(ref)).filter((item): item is GroundedEvidenceSegment => Boolean(item));
    const relevanceByRef = new Map(linkedEvidence.map((item) => [item.evidenceRef, relevance(event, item)]));
    const catalogRelevanceByRef = new Map(input.evidenceSegments.map((item) => [item.evidenceRef, relevance(event, item)]));
    const assessedEvidence = linkedEvidence.flatMap((item) => item.sourceRefs.map((sourceRef): ClaimEvidenceAssessment => {
      const inventory = inventoryByRef.get(sourceRef);
      if (!inventory) return {
        evidenceRef: item.evidenceRef, sourceRef, exactEvidence: item.exactEvidence, sourceAuthorityTier: "UNCLASSIFIED",
        sourceClassification: "unclassified", claimRelevance: "insufficient", evidenceRole: "unknown",
        claimAuthority: "insufficient", independenceKey: `unresolved:${sourceRef}`
      };
      const claimRelevance = relevanceByRef.get(item.evidenceRef)!;
      const role = evidenceRole(inventory, event);
      const claimAuthority = claimRelevance === "insufficient" ? "insufficient"
        : inventory.sourceClassification === "wikipedia" ? "orientation"
          : claimRelevance === "direct" && inventory.authorityTier !== "D" && inventory.authorityTier !== "UNCLASSIFIED" &&
            (inventory.sourceClassification !== "primary_institutional" || role === "primary") ? "authoritative"
            : "supporting";
      return {
        evidenceRef: item.evidenceRef,
        sourceRef,
        exactEvidence: item.exactEvidence,
        sourceAuthorityTier: inventory.authorityTier,
        sourceClassification: inventory.sourceClassification,
        claimRelevance,
        evidenceRole: role,
        claimAuthority,
        independenceKey: inventory.independenceKey
      };
    }));
    const risk = classifyRisk(event);
    const strong = assessedEvidence.filter(strongForClaim);
    const corroborationGroups = [...new Set(strong.map((item) => item.independenceKey))].sort();
    const definitivePrimaryAuthority = strong.some((item) => item.evidenceRole === "primary" && item.sourceAuthorityTier === "A");
    const conflicts = detectConflictFindings(event, input.evidenceSegments, catalogRelevanceByRef, inventoryByRef);
    const corroborationRequired = risk === "contested_interpretive" || risk === "exceptional_high_risk" ||
      (risk === "major_historical_milestone" && !definitivePrimaryAuthority);
    const unresolvedIssues: string[] = [];
    if (linkedEvidence.length === 0) unresolvedIssues.push("No persisted grounded evidence segment resolves for the material claim.");
    if (strong.length === 0) unresolvedIssues.push("No strong claim-relevant authority supports the material claim.");
    if (risk === "routine_fact" && corroborationGroups.length < 1) unresolvedIssues.push("Routine fact lacks one strong claim-relevant authority.");
    if (risk === "major_historical_milestone" && corroborationRequired && corroborationGroups.length < 2) unresolvedIssues.push("Major milestone lacks two independent strong authorities and has no definitive primary record.");
    if ((risk === "contested_interpretive" || risk === "exceptional_high_risk") && corroborationGroups.length < 2) unresolvedIssues.push("Contested or high-risk claim lacks multiple independent strong authorities.");
    if (conflicts.length > 0) unresolvedIssues.push("Material source conflict requires exceptional Governance review.");
    const verdict: ClaimEvidenceVerdict = conflicts.length > 0 ? "exceptional_review" : unresolvedIssues.length > 0 ? "failed" : "passed";
    return {
      claimId: `event-${eventIndex + 1}-material-claim`, eventIndex, eventTitle: event.title, claim: `${event.date} — ${event.description}`, claimRisk: risk,
      evidence: assessedEvidence, corroborationRequired, corroborationGroups, independentStrongSourceCount: corroborationGroups.length,
      definitivePrimaryAuthority, conflictFindings: conflicts, verdict, unresolvedIssues
    };
  });
  const conflictFindings = claims.flatMap((claim) => claim.conflictFindings.map((finding) => `${claim.eventTitle}: ${finding}`));
  const unresolvedSourceIssues = claims.flatMap((claim) => claim.unresolvedIssues.map((issue) => `${claim.eventTitle}: ${issue}`));
  const classifications = new Set(sourceInventory.map((source) => source.sourceClassification));
  const primarySourceRefs = new Set(claims.flatMap((claim) => claim.evidence
    .filter((item) => item.evidenceRole === "primary").map((item) => item.sourceRef)));
  const secondarySourceRefs = new Set(claims.flatMap((claim) => claim.evidence
    .filter((item) => item.evidenceRole === "secondary").map((item) => item.sourceRef)));
  const overallVerdict: ClaimEvidenceVerdict = claims.some((claim) => claim.verdict === "exceptional_review") ? "exceptional_review"
    : claims.every((claim) => claim.verdict === "passed") ? "passed" : "failed";
  return {
    policyVersion: SOURCE_AUTHORITY_POLICY_VERSION,
    sourceInventory,
    claims,
    sourceDiversity: {
      publisherCount: new Set(sourceInventory.map((source) => source.publisherIdentity)).size,
      sourceTypeCount: classifications.size,
      primarySourceCount: primarySourceRefs.size,
      secondarySourceCount: secondarySourceRefs.size,
      wikipediaSourceCount: sourceInventory.filter((source) => source.sourceClassification === "wikipedia").length,
      geographicContextCount: new Set(sourceInventory.map((source) => source.geographicContext).filter((value) => value !== "not_established")).size
    },
    conflictFindings,
    unresolvedSourceIssues,
    policyLimitations: [
      "Grounding metadata may expose only a publisher domain instead of a page title or final destination URL.",
      "Language, paywall, and retrieval-access status are not inferred when they are absent from persisted grounding metadata.",
      "Publisher-parent identity detects same-publisher dependence; syndication or copied text cannot be inferred when grounding metadata exposes no final URL or authorship.",
      "Unknown institutions fail closed at the claim threshold until deterministic publisher evidence establishes authority."
    ],
    overallVerdict
  };
}
