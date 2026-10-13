import {
  AUTHORITY_FIRST_POLICY_VERSION,
  AUTHORITY_REGISTRY_VERSION,
  CONTROLLED_RESEARCH_BUDGET_VERSION,
  SPECIALIST_COLLECTION_PROFILE_POLICY_VERSION,
  acquisitionConfidenceVectorSchema,
  authorityResearchPlanSchema,
  authorityRegistryCapabilitySchema,
  controlledResearchBudgetSchema,
  controlledResearchLedgerSchema,
  escalationDecisionSchema,
  perspectiveAuditSchema,
  routingObligationSetSchema,
  topicAuthoritySetSchema,
  type AcquisitionConfidenceVector,
  type AuthorityResearchPlan,
  type ControlledResearchOperation,
  type AuthorityFamily,
  type AuthorityRegistryCapability,
  type AffectedCommunityEvidenceCapacity,
  type HistoricalJurisdictionCapacity,
  type PerspectiveAudit,
  type PublisherAuthorityVersion,
  type ResearchMap,
  type ScopeContract,
  type RoutingObligationSet,
  type SpecialistCollectionProfile,
  type SubjectRelationship,
  type TopicAuthorityBinding,
  type TopicAuthorityProposal,
  type TopicAuthoritySet
} from "./contracts";
import { parseSealedArtifact, semanticArtifactId, semanticEnvelope, type ArtifactContext } from "./contracts/builders";
import { contentAddressedId, payloadHash } from "./hashing";
import { COMMUNITY_IDENTITY_POLICY_VERSION, COMMUNITY_IDENTITY_REGISTRY_VERSION, resolveGovernedCommunityIdentity } from "./community-identity";

export type RoutingEligibleCandidate = {
  routingObligationId: string;
  researchQuestionId: string;
  publisherVersionId: string;
  eligibleRoles: Array<"PRIMARY_RECORD" | "INTERPRETATION" | "PERSPECTIVE_TESTIMONY">;
  subjectRelationship: SubjectRelationship;
  authorityFamily: AuthorityFamily;
  independenceGroupId: string;
  specialistCollectionProfileIds: string[];
};

export type ProtectedRepresentationDiagnostic = {
  requirementId: string;
  requirementKind: "STAKEHOLDER" | "PARTY_PARTICIPANT" | "AFFECTED_COMMUNITY" | "CUSTODIAL_COMMUNITY" | "INDEPENDENT_SCHOLARSHIP" | "MATERIAL_JURISDICTION";
  canonicalLabel: string;
  researchMapId: string;
  researchQuestionId: string;
  phaseIds: string[];
  dimensionIds: string[];
  requiredRoles: Array<"PRIMARY_RECORD" | "CORROBORATION" | "INTERPRETATION" | "PERSPECTIVE_TESTIMONY">;
  permittedSubjectRelationships: Array<"INDEPENDENT" | "STATE_PARTY" | "PARTICIPANT" | "COMMUNITY_CUSTODIAN" | "COMMUNITY_EVIDENCE_RECORDS_HOLDER">;
  historicalJurisdiction: string | null;
  eligibleCandidates: Array<{ publisherVersionId: string; capacityIds: string[]; rejectionReason: string }>;
  registryVersion: string;
  policyVersion: string;
  releaseIdentity: string | null;
  communityIdentityResolution?: {
    rawLabel: string;
    normalizedLabel: string;
    communityIdentityId: string | null;
    canonicalLabel: string | null;
    aliasOrRule: string | null;
    qualifierComparison: { period: "MATCH" | "OUT_OF_RANGE"; geography: "MATCH" | "MISMATCH"; language: "MATCH" | "MISMATCH"; category: "MATCH" | "MISMATCH" };
    rejectionReason: string | null;
  } | null;
  communityCapacityEvaluations?: Array<{ publisherVersionId: string; capacityId: string; accepted: boolean; rejectionReason: string | null }>;
};

export type ProtectedAvailabilityCandidate = {
  requirementId: string;
  requirementKind: Exclude<ProtectedRepresentationDiagnostic["requirementKind"], "STAKEHOLDER">;
  requirementLabel: string;
  researchQuestionId: string;
  publisherVersionId: string;
  eligibleRoles: Array<"PRIMARY_RECORD" | "INTERPRETATION" | "PERSPECTIVE_TESTIMONY">;
  subjectRelationship: SubjectRelationship;
  authorityFamily: AuthorityFamily;
  historicalJurisdictionCapacityIds: string[];
  affectedCommunityEvidenceCapacityIds: string[];
};

export type ProtectedAvailabilityCompletion = {
  proposals: TopicAuthorityProposal[];
  decisions: Array<{
    requirementId: string;
    requirementKind: "INDEPENDENT_SCHOLARSHIP" | "PARTY_PARTICIPANT" | "AFFECTED_COMMUNITY" | "CUSTODIAL_COMMUNITY" | "MATERIAL_JURISDICTION";
    requirementLabel: string;
    researchQuestionId: string;
    resolvedCommunityIdentityId: string | null;
    communityIdentityRegistryVersion: string | null;
    communityIdentityPolicyVersion: string | null;
    eligibleCandidates: Array<{ publisherVersionId: string; eligibleRoles: Array<"PRIMARY_RECORD" | "INTERPRETATION" | "PERSPECTIVE_TESTIMONY">; subjectRelationship: SubjectRelationship; authorityFamily: AuthorityFamily; historicalJurisdictionCapacityIds: string[]; affectedCommunityEvidenceCapacityIds: string[]; rejectionReason: string | null }>;
    modelProposedPublisherVersionIds: string[];
    selectedPublisherVersionId: string | null;
    selectedHistoricalJurisdictionCapacityIds: string[];
    selectedAffectedCommunityEvidenceCapacityIds: string[];
    selectionMethod: "MODEL_PRESERVED" | "DETERMINISTIC_UNIQUE" | "DETERMINISTIC_REGISTRY_COMPLETION" | "NO_ELIGIBLE_CAPACITY";
    registryVersion: typeof AUTHORITY_REGISTRY_VERSION;
    policyVersion: typeof AUTHORITY_FIRST_POLICY_VERSION;
  }>;
  /** Retained for artifact/test compatibility; deterministic completion leaves no ambiguity. */
  unresolved: ProtectedAvailabilityCandidate[][];
};

export type ContestedAvailabilityCompletion = {
  proposals: TopicAuthorityProposal[];
  decisions: Array<{
    researchQuestionId: string;
    eligibleCandidates: Array<{ publisherVersionId: string; independenceGroupId: string; eligibleRoles: Array<"PRIMARY_RECORD" | "CORROBORATION" | "INTERPRETATION">; authorityFamily: AuthorityFamily }>;
    modelProposedPublisherVersionIds: string[];
    selectedPublisherVersionIds: string[];
    selectionMethod: "MODEL_PRESERVED" | "DETERMINISTIC_REGISTRY_COMPLETION" | "NO_ELIGIBLE_CAPACITY";
    registryVersion: typeof AUTHORITY_REGISTRY_VERSION;
    policyVersion: typeof AUTHORITY_FIRST_POLICY_VERSION;
  }>;
};

export class ProtectedRepresentationAvailabilityError extends Error {
  readonly diagnostic: ProtectedRepresentationDiagnostic;

  constructor(diagnostic: ProtectedRepresentationDiagnostic) {
    super(`PROTECTED_REPRESENTATION_AVAILABILITY_INSUFFICIENT:${diagnostic.researchQuestionId}:${diagnostic.requirementKind}`);
    this.name = "ProtectedRepresentationAvailabilityError";
    this.diagnostic = diagnostic;
  }
}

export const DEFAULT_CONTROLLED_RESEARCH_BUDGET = controlledResearchBudgetSchema.parse({
  version: CONTROLLED_RESEARCH_BUDGET_VERSION,
  maximumControlledDiscoveryOperations: 25,
  maximumGapRepairOperations: 5,
  maximumGroundingEscalationCalls: 2,
  maximumDirectRetrievals: 40,
  maximumConcurrency: 3,
  maximumCompletionRounds: 1,
  maximumWholeRunSeconds: 1200,
  maximumGapRoundSeconds: 480
});

/**
 * The initial bounded authority universe must cover critical questions and
 * contested subjects. Historical perspectives remain mandatory in the final
 * evidence audit, but are not predictive pre-acquisition source routes.
 */
export function isInitialAuthorityRequiredQuestion(question: Pick<ResearchMap["questions"][number], "priority" | "contested" | "historicalPerspectiveRequirements">): boolean {
  return question.priority === "CRITICAL"
    || question.contested
    || (question.historicalPerspectiveRequirements || []).some((requirement) => requiresProtectedPreAcquisitionAvailability(requirement.kind));
}

export function buildRoutingObligationSet(input: { context: ArtifactContext; scope: ScopeContract; researchMap: ResearchMap; requiredQuestionIds?: readonly string[] }): RoutingObligationSet {
  const context = { ...input.context, policyVersion: AUTHORITY_FIRST_POLICY_VERSION };
  const requiredQuestionIds = input.requiredQuestionIds ? new Set(input.requiredQuestionIds) : undefined;
  if (requiredQuestionIds && (requiredQuestionIds.size === 0 || [...requiredQuestionIds].some((id) => !input.researchMap.questions.some((question) => question.questionId === id)))) throw new Error("ROUTING_OBLIGATION_TARGET_SET_INVALID");
  const obligations = input.researchMap.questions.filter((question) => !requiredQuestionIds || requiredQuestionIds.has(question.questionId)).flatMap((question) => (question.historicalPerspectiveRequirements || []).flatMap((requirement) => {
    if (!requiresProtectedPreAcquisitionAvailability(requirement.kind) || requirement.kind === "INDEPENDENT_SCHOLARSHIP") return [];
    const permittedSubjectRelationships = requirement.kind === "AFFECTED_COMMUNITY" || requirement.kind === "CUSTODIAL_COMMUNITY"
      ? ["COMMUNITY_CUSTODIAN", "PARTICIPANT", "INDEPENDENT"] as const
      : requirement.kind === "PARTY_PARTICIPANT"
        ? ["STATE_PARTY", "PARTICIPANT", "INDEPENDENT"] as const
        : ["SUBJECT_SELF", "STATE_PARTY", "PARTICIPANT", "COMMUNITY_CUSTODIAN", "INDEPENDENT"] as const;
    const semantic = {
      researchQuestionId: question.questionId,
      requirementKind: requirement.kind,
      semanticIdentity: `${requirement.kind}:${normalize(requirement.label)}`,
      label: requirement.label,
      rationale: requirement.rationale,
      historicalActionBasis: requirement.historicalActionBasis ?? null,
      requiredRoles: ["PRIMARY_RECORD", "INTERPRETATION", "PERSPECTIVE_TESTIMONY"] as const,
      permittedSubjectRelationships,
      materialGeography: requirement.kind === "MATERIAL_JURISDICTION" ? [requirement.label] : []
    };
    return [{ ...semantic, routingObligationId: contentAddressedId("routing-obligation", { researchMapId: input.researchMap.researchMapId, ...semantic }) }];
  })).sort((a, b) => a.routingObligationId.localeCompare(b.routingObligationId));
  const semantic = { scopeContractId: input.scope.scopeContractId, scopePayloadHash: input.scope.payloadHash, researchMapId: input.researchMap.researchMapId, researchMapPayloadHash: input.researchMap.payloadHash, obligations, validationStatus: "LOCKED" as const };
  const routingObligationSetId = semanticArtifactId("routing-obligation-set", context, semantic);
  return parseSealedArtifact(routingObligationSetSchema, { ...semanticEnvelope(context, routingObligationSetId, input.researchMap.researchMapId), routingObligationSetId, ...semantic });
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

/**
 * Community/custodial capacity must be explicitly declared by the verified
 * Registry authority metadata.  A model-supplied perspective label and a
 * publisher's ordinary geography are never capacity evidence.
 */
export function hasCommunityCustodialCapability(publisher: PublisherAuthorityVersion): boolean {
  return publisher.authorityDomains.some((domain) => /\b(?:community|custodial)\b/iu.test(domain));
}

/** Exact Registry capability match for acquiring attributable affected-community evidence. */
export function affectedCommunityEvidenceCapacityCovers(input: {
  capacity: AffectedCommunityEvidenceCapacity;
  communityIdentityId?: string;
  community?: string;
  period: { startYear: number; endYear: number };
  geography?: readonly string[];
  languages?: readonly string[];
  roles: readonly string[];
}): boolean {
  const communityMatches = input.communityIdentityId
    ? input.capacity.communityIdentityId === input.communityIdentityId
    : input.community !== undefined && [input.capacity.representedCommunity, ...input.capacity.communityAliases].some((label) => normalize(label) === normalize(input.community!));
  return communityMatches
    && input.capacity.period.startYear <= input.period.startYear
    && input.capacity.period.endYear >= input.period.endYear
    && (!input.geography || input.geography.some((value) => input.capacity.geography.some((capacityGeography) => normalize(capacityGeography) === normalize(value))))
    && input.capacity.permittedResearchRoles.some((role) => input.roles.includes(role));
}

/** Registry-only eligibility for protected pre-acquisition availability. */
export function protectedAvailabilityCandidates(input: {
  scope: ScopeContract;
  researchMap: ResearchMap;
  publishers: readonly PublisherAuthorityVersion[];
  questionId: string;
  requirement: NonNullable<ResearchMap["questions"][number]["historicalPerspectiveRequirements"]>[number];
}): ProtectedAvailabilityCandidate[] {
  if (input.requirement.kind === "STAKEHOLDER") return [];
  const question = input.researchMap.questions.find((item) => item.questionId === input.questionId);
  if (!question) throw new Error(`PROTECTED_AVAILABILITY_UNKNOWN_QUESTION:${input.questionId}`);
  const requirementIdValue = requirementId(input.researchMap, question.questionId, input.requirement);
  const endYear = input.scope.chronologyEnd?.latestYear ?? input.scope.chronologyEnd?.year ?? input.scope.chronologyStart.latestYear ?? input.scope.chronologyStart.year;
  const period = { startYear: input.scope.chronologyStart.earliestYear ?? input.scope.chronologyStart.year, endYear };
  const resolveCommunity = (requirement: typeof input.requirement) => resolveGovernedCommunityIdentity({ rawLabel: requirement.label, scopePeriod: period, geography: question.geography, languages: question.languages, category: "AFFECTED_POPULATION" });
  const communityResolution = input.requirement.kind === "AFFECTED_COMMUNITY" ? resolveCommunity(input.requirement) : null;
  return input.publishers.flatMap<ProtectedAvailabilityCandidate>((publisher): ProtectedAvailabilityCandidate[] => {
    if (publisher.state !== "VERIFIED") return [];
    if (!question.languages.some((language) => publisher.languages.includes(language))) return [];
    const family = authorityFamilyForPublisher(publisher);
    if (family === "EDITED_REFERENCE") return [];
    const affectedCommunityCapacity = input.requirement.kind === "AFFECTED_COMMUNITY"
      ? publisher.affectedCommunityEvidenceCapacities.find((capacity) => communityResolution?.communityIdentityId !== null && affectedCommunityEvidenceCapacityCovers({ capacity, communityIdentityId: communityResolution!.communityIdentityId!, period, geography: question.geography, languages: question.languages, roles: ["PRIMARY_RECORD", "PERSPECTIVE_TESTIMONY"] }))
      : undefined;
    const relationship = input.requirement.kind === "PARTY_PARTICIPANT"
      ? subjectRelationshipForRouting(publisher, [{ requirementKind: "PARTY_PARTICIPANT", label: input.requirement.label }])
      : affectedCommunityCapacity
        ? "COMMUNITY_EVIDENCE_RECORDS_HOLDER"
      : (input.requirement.kind === "AFFECTED_COMMUNITY" || input.requirement.kind === "CUSTODIAL_COMMUNITY") && hasCommunityCustodialCapability(publisher)
        ? "COMMUNITY_CUSTODIAN"
      : defaultSubjectRelationship(publisher);
    const base = {
      requirementId: requirementIdValue,
      requirementKind: input.requirement.kind as ProtectedAvailabilityCandidate["requirementKind"],
      requirementLabel: input.requirement.label.normalize("NFKC").trim(),
      researchQuestionId: question.questionId,
      publisherVersionId: publisher.publisherVersionId,
      subjectRelationship: relationship,
      authorityFamily: family
    } as const;
    if (input.requirement.kind === "INDEPENDENT_SCHOLARSHIP") {
      return relationship === "INDEPENDENT" && family === "ACADEMIC_SCHOLARLY"
        ? [{ ...base, eligibleRoles: ["INTERPRETATION"], historicalJurisdictionCapacityIds: [], affectedCommunityEvidenceCapacityIds: [] }]
        : [];
    }
    if (input.requirement.kind === "MATERIAL_JURISDICTION") {
      const capacity = publisher.historicalJurisdictionCapacities.find((item) => historicalJurisdictionCapacityCovers({ capacity: item, historicalJurisdiction: input.requirement.label, period, roles: ["PRIMARY_RECORD"], subjectRelationship: relationship }));
      return capacity ? [{ ...base, eligibleRoles: ["PRIMARY_RECORD"], historicalJurisdictionCapacityIds: [capacity.capacityId], affectedCommunityEvidenceCapacityIds: [] }] : [];
    }
    if (input.requirement.kind === "AFFECTED_COMMUNITY") return affectedCommunityCapacity
      ? [{ ...base, eligibleRoles: affectedCommunityCapacity.permittedResearchRoles, historicalJurisdictionCapacityIds: [], affectedCommunityEvidenceCapacityIds: [affectedCommunityCapacity.capacityId] }]
      : [];
    const permitted = input.requirement.kind === "PARTY_PARTICIPANT"
      ? relationship === "INDEPENDENT" && family === "ARCHIVE_LIBRARY"
        ? ["INDEPENDENT"]
        : ["STATE_PARTY", "PARTICIPANT"]
      : hasCommunityCustodialCapability(publisher)
        ? ["COMMUNITY_CUSTODIAN"]
        : [];
    return permitted.includes(relationship)
      ? [{ ...base, eligibleRoles: [relationship === "INDEPENDENT" ? "INTERPRETATION" : "PRIMARY_RECORD"], historicalJurisdictionCapacityIds: [], affectedCommunityEvidenceCapacityIds: [] }]
      : [];
  }).sort((left, right) => `${left.requirementId}:${left.publisherVersionId}`.localeCompare(`${right.requirementId}:${right.publisherVersionId}`));
}

/**
 * Preserves valid model choices, then deterministically completes the minimum
 * protected Registry capacity. This is availability accounting, not a claim
 * that an authority yields qualifying evidence or satisfies the perspective.
 */
export function completeProtectedAvailabilityProposals(input: {
  scope: ScopeContract;
  researchMap: ResearchMap;
  publishers: readonly PublisherAuthorityVersion[];
  proposals: readonly TopicAuthorityProposal[];
  requiredQuestionIds?: readonly string[];
}): ProtectedAvailabilityCompletion {
  const required = input.requiredQuestionIds ? new Set(input.requiredQuestionIds) : undefined;
  const proposals: TopicAuthorityProposal[] = input.proposals.map((proposal) => ({ ...proposal, researchQuestionIds: uniqueSorted(proposal.researchQuestionIds), roles: uniqueSorted(proposal.roles), claimTypes: uniqueSorted(proposal.claimTypes), perspectiveTags: uniqueSorted(proposal.perspectiveTags), historicalJurisdictionCapacityIds: uniqueSorted(proposal.historicalJurisdictionCapacityIds || []), affectedCommunityEvidenceCapacityIds: uniqueSorted(proposal.affectedCommunityEvidenceCapacityIds || []), routingObligationIds: [] }));
  const decisions: ProtectedAvailabilityCompletion["decisions"] = [];
  for (const question of input.researchMap.questions) {
    if (required && !required.has(question.questionId)) continue;
    for (const requirement of question.historicalPerspectiveRequirements || []) {
      if (requirement.kind === "STAKEHOLDER") continue;
      const candidates = protectedAvailabilityCandidates({ scope: input.scope, researchMap: input.researchMap, publishers: input.publishers, questionId: question.questionId, requirement });
      const modelProposedPublisherVersionIds = proposals.filter((proposal) => proposal.researchQuestionIds.includes(question.questionId)).map((proposal) => proposal.publisherVersionId).filter((publisherVersionId) => candidates.some((candidate) => candidate.publisherVersionId === publisherVersionId)).sort();
      const preserved = candidates.find((candidate) => proposals.some((proposal) => proposal.publisherVersionId === candidate.publisherVersionId && proposal.researchQuestionIds.includes(question.questionId) && proposal.subjectRelationship === candidate.subjectRelationship && proposal.roles.some((role) => candidate.eligibleRoles.includes(role as "PRIMARY_RECORD" | "INTERPRETATION" | "PERSPECTIVE_TESTIMONY")) && candidate.historicalJurisdictionCapacityIds.every((id) => (proposal.historicalJurisdictionCapacityIds || []).includes(id)) && candidate.affectedCommunityEvidenceCapacityIds.every((id) => (proposal.affectedCommunityEvidenceCapacityIds || []).includes(id))));
      let selected: ProtectedAvailabilityCandidate | undefined = preserved;
      let method: ProtectedAvailabilityCompletion["decisions"][number]["selectionMethod"] = preserved ? "MODEL_PRESERVED" : candidates.length === 0 ? "NO_ELIGIBLE_CAPACITY" : candidates.length === 1 ? "DETERMINISTIC_UNIQUE" : "DETERMINISTIC_REGISTRY_COMPLETION";
      if (!selected && candidates.length > 0) {
        // Publisher version identity is a canonical Registry key, not a
        // historical ranking. The resulting binding reserves one bounded
        // acquisition opportunity; final evidence audit remains mandatory.
        const registryCandidate = candidates[0]!;
        selected = registryCandidate;
        proposals.push({ publisherVersionId: registryCandidate.publisherVersionId, researchQuestionIds: [question.questionId], roles: registryCandidate.eligibleRoles, claimTypes: uniqueSorted(question.claimTypesExpected), subjectRelationship: registryCandidate.subjectRelationship, perspectiveTags: [requirement.label], historicalJurisdictionCapacityIds: registryCandidate.historicalJurisdictionCapacityIds, affectedCommunityEvidenceCapacityIds: registryCandidate.affectedCommunityEvidenceCapacityIds, routingObligationIds: registryCandidate.subjectRelationship === "STATE_PARTY" ? [registryCandidate.requirementId] : [], rationale: "Deterministically completed from exact eligible Registry capacity for the locked protected requirement; this is not evidence sufficiency." });
      }
      const resolution = requirement.kind === "AFFECTED_COMMUNITY"
        ? resolveGovernedCommunityIdentity({ rawLabel: requirement.label, scopePeriod: { startYear: input.scope.chronologyStart.earliestYear ?? input.scope.chronologyStart.year, endYear: input.scope.chronologyEnd?.latestYear ?? input.scope.chronologyEnd?.year ?? input.scope.chronologyStart.latestYear ?? input.scope.chronologyStart.year }, geography: question.geography, languages: question.languages, category: "AFFECTED_POPULATION" })
        : null;
      decisions.push({ requirementId: candidates[0]?.requirementId || requirementId(input.researchMap, question.questionId, requirement), requirementKind: requirement.kind, requirementLabel: requirement.label.normalize("NFKC").trim(), researchQuestionId: question.questionId, resolvedCommunityIdentityId: resolution?.communityIdentityId || null, communityIdentityRegistryVersion: resolution ? COMMUNITY_IDENTITY_REGISTRY_VERSION : null, communityIdentityPolicyVersion: resolution ? COMMUNITY_IDENTITY_POLICY_VERSION : null, eligibleCandidates: candidates.map((candidate) => ({ publisherVersionId: candidate.publisherVersionId, eligibleRoles: candidate.eligibleRoles, subjectRelationship: candidate.subjectRelationship, authorityFamily: candidate.authorityFamily, historicalJurisdictionCapacityIds: candidate.historicalJurisdictionCapacityIds, affectedCommunityEvidenceCapacityIds: candidate.affectedCommunityEvidenceCapacityIds, rejectionReason: null })), modelProposedPublisherVersionIds, selectedPublisherVersionId: selected?.publisherVersionId || null, selectedHistoricalJurisdictionCapacityIds: selected?.historicalJurisdictionCapacityIds || [], selectedAffectedCommunityEvidenceCapacityIds: selected?.affectedCommunityEvidenceCapacityIds || [], selectionMethod: method, registryVersion: AUTHORITY_REGISTRY_VERSION, policyVersion: AUTHORITY_FIRST_POLICY_VERSION });
    }
  }
  return { proposals: proposals.sort((left, right) => left.publisherVersionId.localeCompare(right.publisherVersionId)), decisions, unresolved: [] };
}

/** Registry-only independent capacity for contested-question acquisition. */
export function contestedAvailabilityCandidates(input: { researchMap: ResearchMap; publishers: readonly PublisherAuthorityVersion[]; questionId: string }): Array<{ publisherVersionId: string; independenceGroupId: string; eligibleRoles: Array<"PRIMARY_RECORD" | "CORROBORATION" | "INTERPRETATION">; authorityFamily: AuthorityFamily }> {
  const question = input.researchMap.questions.find((item) => item.questionId === input.questionId);
  if (!question) throw new Error(`CONTESTED_AVAILABILITY_UNKNOWN_QUESTION:${input.questionId}`);
  return input.publishers
    .filter((publisher) => publisher.state === "VERIFIED")
    .filter((publisher) => defaultSubjectRelationship(publisher) === "INDEPENDENT")
    .filter((publisher) => authorityFamilyForPublisher(publisher) !== "EDITED_REFERENCE")
    .filter((publisher) => question.languages.some((language) => publisher.languages.includes(language)))
    .map((publisher) => ({
      publisherVersionId: publisher.publisherVersionId,
      independenceGroupId: publisher.independenceGroupId,
      eligibleRoles: (authorityFamilyForPublisher(publisher) === "ACADEMIC_SCHOLARLY" ? ["INTERPRETATION"] : ["CORROBORATION"]) as Array<"PRIMARY_RECORD" | "CORROBORATION" | "INTERPRETATION">,
      authorityFamily: authorityFamilyForPublisher(publisher)
    }))
    .sort((left, right) => `${left.independenceGroupId}:${left.publisherVersionId}`.localeCompare(`${right.independenceGroupId}:${right.publisherVersionId}`));
}

/**
 * Locks the minimum two independent registered acquisition opportunities for
 * every contested question. It never treats planned bindings as corroborated
 * evidence; that proof remains exclusively in final evidence audit.
 */
export function completeContestedAvailabilityProposals(input: { researchMap: ResearchMap; publishers: readonly PublisherAuthorityVersion[]; proposals: readonly TopicAuthorityProposal[]; requiredQuestionIds?: readonly string[] }): ContestedAvailabilityCompletion {
  const required = input.requiredQuestionIds ? new Set(input.requiredQuestionIds) : undefined;
  const proposals = input.proposals.map((proposal) => ({ ...proposal, researchQuestionIds: uniqueSorted(proposal.researchQuestionIds), roles: uniqueSorted(proposal.roles), claimTypes: uniqueSorted(proposal.claimTypes), perspectiveTags: uniqueSorted(proposal.perspectiveTags), historicalJurisdictionCapacityIds: uniqueSorted(proposal.historicalJurisdictionCapacityIds || []), affectedCommunityEvidenceCapacityIds: uniqueSorted(proposal.affectedCommunityEvidenceCapacityIds || []), routingObligationIds: [] }));
  const publisherByVersion = new Map(input.publishers.map((publisher) => [publisher.publisherVersionId, publisher]));
  // When the model leaves a contested question one independent group short,
  // prefer a second *already topic-bound* Registry authority before adding a
  // new arbitrary Registry publisher.  This is a deterministic minimisation
  // of the acquisition universe, not a claim that the existing authority
  // supplies sufficient evidence; final authority, corroboration, and
  // coverage audits remain the only evidence-level proof.
  const topicBoundIndependentPublisherVersionIds = new Set(proposals
    .filter((proposal) => proposal.roles.some((role) => role !== "ORIENTATION"))
    .map((proposal) => publisherByVersion.get(proposal.publisherVersionId))
    .filter((publisher): publisher is PublisherAuthorityVersion => publisher !== undefined && defaultSubjectRelationship(publisher) === "INDEPENDENT")
    .map((publisher) => publisher.publisherVersionId));
  const decisions: ContestedAvailabilityCompletion["decisions"] = [];
  for (const question of input.researchMap.questions) {
    if (!question.contested || (required && !required.has(question.questionId))) continue;
    const candidates = contestedAvailabilityCandidates({ researchMap: input.researchMap, publishers: input.publishers, questionId: question.questionId });
    const candidateByVersion = new Map(candidates.map((candidate) => [candidate.publisherVersionId, candidate]));
    const modelProposedPublisherVersionIds = proposals.filter((proposal) => proposal.researchQuestionIds.includes(question.questionId) && candidateByVersion.has(proposal.publisherVersionId)).map((proposal) => proposal.publisherVersionId).sort();
    const selected = new Map<string, typeof candidates[number]>();
    for (const proposal of proposals) {
      if (!proposal.researchQuestionIds.includes(question.questionId)) continue;
      const candidate = candidateByVersion.get(proposal.publisherVersionId);
      if (candidate && proposal.roles.some((role) => role !== "ORIENTATION")) selected.set(candidate.independenceGroupId, candidate);
    }
    const completionCandidates = [...candidates].sort((left, right) => {
      const leftExisting = topicBoundIndependentPublisherVersionIds.has(left.publisherVersionId) ? 0 : 1;
      const rightExisting = topicBoundIndependentPublisherVersionIds.has(right.publisherVersionId) ? 0 : 1;
      return leftExisting - rightExisting || `${left.independenceGroupId}:${left.publisherVersionId}`.localeCompare(`${right.independenceGroupId}:${right.publisherVersionId}`);
    });
    for (const candidate of completionCandidates) {
      if (selected.size >= 2) break;
      if (!selected.has(candidate.independenceGroupId)) selected.set(candidate.independenceGroupId, candidate);
    }
    const selectedCandidates = [...selected.values()];
    const method: ContestedAvailabilityCompletion["decisions"][number]["selectionMethod"] = selectedCandidates.length < 2 ? "NO_ELIGIBLE_CAPACITY" : selectedCandidates.every((candidate) => modelProposedPublisherVersionIds.includes(candidate.publisherVersionId)) ? "MODEL_PRESERVED" : "DETERMINISTIC_REGISTRY_COMPLETION";
    for (const candidate of selectedCandidates) {
      const existing = proposals.find((proposal) => proposal.publisherVersionId === candidate.publisherVersionId);
      if (existing) {
        if (!existing.researchQuestionIds.includes(question.questionId)) existing.researchQuestionIds.push(question.questionId);
        // Role eligibility belongs to the Registry-derived candidate, never to
        // the model proposal.  An existing non-orientation role (for example a
        // primary-record role on another question) must not suppress the
        // interpretation/corroboration role that makes this contested binding
        // independently admissible.
        existing.roles.push(...candidate.eligibleRoles);
        continue;
      }
      const publisher = publisherByVersion.get(candidate.publisherVersionId)!;
      proposals.push({ publisherVersionId: candidate.publisherVersionId, researchQuestionIds: [question.questionId], roles: candidate.eligibleRoles, claimTypes: uniqueSorted(question.claimTypesExpected), subjectRelationship: defaultSubjectRelationship(publisher), perspectiveTags: ["Independent registered capacity"], historicalJurisdictionCapacityIds: [], affectedCommunityEvidenceCapacityIds: [], routingObligationIds: [], rationale: "Deterministically reserved as one of two independent Registry-governed acquisition opportunities for a contested question; final corroboration remains evidence-audited." });
    }
    decisions.push({ researchQuestionId: question.questionId, eligibleCandidates: candidates, modelProposedPublisherVersionIds, selectedPublisherVersionIds: selectedCandidates.map((candidate) => candidate.publisherVersionId).sort(), selectionMethod: method, registryVersion: AUTHORITY_REGISTRY_VERSION, policyVersion: AUTHORITY_FIRST_POLICY_VERSION });
  }
  return { proposals: proposals.map((proposal) => ({ ...proposal, researchQuestionIds: uniqueSorted(proposal.researchQuestionIds), roles: uniqueSorted(proposal.roles), claimTypes: uniqueSorted(proposal.claimTypes), perspectiveTags: uniqueSorted(proposal.perspectiveTags) })).sort((left, right) => left.publisherVersionId.localeCompare(right.publisherVersionId)), decisions };
}

/** Generic stakeholders are evidence-level actor requirements, not publishers. */
export function requiresProtectedPreAcquisitionAvailability(kind: NonNullable<ResearchMap["questions"][number]["historicalPerspectiveRequirements"]>[number]["kind"]): boolean {
  return kind !== "STAKEHOLDER";
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function authorityFamilyForPublisher(publisher: PublisherAuthorityVersion): AuthorityFamily {
  if (publisher.accessLimitations.includes("ORIENTATION_ONLY") || publisher.institutionType === "EDITED_REFERENCE") return "EDITED_REFERENCE";
  if (publisher.institutionType === "ARCHIVE") return "ARCHIVE_LIBRARY";
  if (publisher.institutionType === "UNIVERSITY" || publisher.institutionType === "SCHOLARLY_PUBLISHER") return "ACADEMIC_SCHOLARLY";
  if (publisher.institutionType === "MUSEUM") return "MUSEUM_HERITAGE_MEMORY";
  if (publisher.institutionType === "NEWSROOM") return "CONTEMPORARY_JOURNALISM";
  if (publisher.institutionType === "STANDARDS_BODY") return "INTERNATIONAL_STANDARDS_BODY";
  if (publisher.institutionType === "GOVERNMENT") return "PUBLIC_SCIENTIFIC_INSTITUTION";
  if (publisher.institutionType === "SPECIALIST") return "SPECIALIST";
  return publisher.primarySecondaryTendency === "PRIMARY" ? "SUBJECT_ASSOCIATED" : "SPECIALIST";
}

export function defaultSubjectRelationship(publisher: PublisherAuthorityVersion): SubjectRelationship {
  return publisher.primarySecondaryTendency === "PRIMARY" && ["GOVERNMENT", "OTHER", "STANDARDS_BODY"].includes(publisher.institutionType)
    ? "SUBJECT_SELF"
    : "INDEPENDENT";
}

/**
 * This relationship is derived from locked policy and registry metadata, not
 * a model label. A government records holder may represent a named party,
 * while its general registry default remains subject-associated.
 */
export function subjectRelationshipForRouting(publisher: PublisherAuthorityVersion, obligations: readonly Pick<RoutingObligationSet["obligations"][number], "requirementKind" | "label">[]): SubjectRelationship {
  const normalizedGeography = new Set(publisher.geographicScope.map(normalize));
  const representsNamedStateParty = publisher.institutionType === "GOVERNMENT"
    && obligations.some((obligation) => obligation.requirementKind === "PARTY_PARTICIPANT" && normalizedGeography.has(normalize(obligation.label)));
  return representsNamedStateParty ? "STATE_PARTY" : defaultSubjectRelationship(publisher);
}

/**
 * The registry is the sole source of eligibility. This deliberately does not
 * infer historical facts from an actor name or broad institutional prestige.
 */
export function buildEligibleRoutingCandidates(input: { routingObligationSet: RoutingObligationSet; publishers: readonly PublisherAuthorityVersion[] }): RoutingEligibleCandidate[] {
  const candidates = input.routingObligationSet.obligations.flatMap((obligation) => input.publishers.flatMap((publisher) => {
    if (publisher.state !== "VERIFIED") return [];
    const capability = registryCapability(publisher);
    if (capability.authorityFamily === "EDITED_REFERENCE") return [];
    const subjectRelationship = subjectRelationshipForRouting(publisher, [obligation]);
    if (!obligation.permittedSubjectRelationships.includes(subjectRelationship)) return [];
    // A material jurisdiction is an explicit historical requirement.  Do not
    // silently use an unrelated authority when registry geography disproves it.
    if (obligation.materialGeography.length > 0
      && !obligation.materialGeography.some((place) => publisher.geographicScope.some((scope) => normalize(scope) === normalize(place)))) return [];
    const eligibleRoles = obligation.requiredRoles.filter((role): role is RoutingEligibleCandidate["eligibleRoles"][number] => role !== "ORIENTATION");
    if (eligibleRoles.length === 0) return [];
    return [{
      routingObligationId: obligation.routingObligationId,
      researchQuestionId: obligation.researchQuestionId,
      publisherVersionId: publisher.publisherVersionId,
      eligibleRoles,
      subjectRelationship,
      authorityFamily: capability.authorityFamily,
      independenceGroupId: publisher.independenceGroupId,
      specialistCollectionProfileIds: capability.specialistCollectionProfiles.map((profile) => profile.profileId).sort()
    }];
  }));
  for (const obligation of input.routingObligationSet.obligations) {
    if (!candidates.some((candidate) => candidate.routingObligationId === obligation.routingObligationId)) throw new Error(`ROUTING_OBLIGATION_ZERO_ELIGIBLE_CANDIDATES:${obligation.routingObligationId}`);
  }
  return candidates.sort((left, right) => `${left.routingObligationId}:${left.publisherVersionId}`.localeCompare(`${right.routingObligationId}:${right.publisherVersionId}`));
}

/** Bounded batching is deterministic. A batch is never permitted to merge
 * incompatible candidate pools, and each obligation retains its own route. */
export function batchRoutingObligations(input: { routingObligationSet: RoutingObligationSet; candidates: readonly RoutingEligibleCandidate[]; maximumBatchSize?: number }): RoutingObligationSet["obligations"][] {
  const maximumBatchSize = input.maximumBatchSize ?? 8;
  const byKey = new Map<string, RoutingObligationSet["obligations"]>();
  for (const obligation of input.routingObligationSet.obligations) {
    const eligible = input.candidates.filter((candidate) => candidate.routingObligationId === obligation.routingObligationId)
      .map((candidate) => `${candidate.publisherVersionId}:${candidate.eligibleRoles.join(",")}:${candidate.subjectRelationship}`).sort();
    const key = `${obligation.researchQuestionId}\n${obligation.permittedSubjectRelationships.join(",")}\n${eligible.join("|")}`;
    byKey.set(key, [...(byKey.get(key) || []), obligation]);
  }
  return [...byKey.entries()].sort(([left], [right]) => left.localeCompare(right)).flatMap(([, obligations]) => {
    const batches: RoutingObligationSet["obligations"][] = [];
    for (let index = 0; index < obligations.length; index += maximumBatchSize) batches.push(obligations.slice(index, index + maximumBatchSize));
    return batches;
  });
}

/** Validated route locks are monotonic. This is deliberately independent of
 * provider output parsing so no stochastic omission can be mistaken for a
 * complete plan. */
export function lockRoutingProposals(input: { locked: readonly TopicAuthorityProposal[]; proposals: readonly TopicAuthorityProposal[]; candidates: readonly RoutingEligibleCandidate[] }): TopicAuthorityProposal[] {
  const candidateByRoute = new Map(input.candidates.map((candidate) => [`${candidate.routingObligationId}\n${candidate.publisherVersionId}`, candidate]));
  const lockedIds = new Set(input.locked.flatMap((proposal) => proposal.routingObligationIds));
  const accepted: TopicAuthorityProposal[] = [...input.locked];
  for (const proposal of input.proposals) {
    if (proposal.routingObligationIds.length !== 1 || proposal.researchQuestionIds.length !== 1) throw new Error(`ROUTING_LOCK_PROPOSAL_SHAPE_INVALID:${proposal.publisherVersionId}`);
    const obligationId = proposal.routingObligationIds[0]!;
    if (lockedIds.has(obligationId)) continue;
    const candidate = candidateByRoute.get(`${obligationId}\n${proposal.publisherVersionId}`);
    if (!candidate) throw new Error(`ROUTING_LOCK_CANDIDATE_INVALID:${obligationId}`);
    if (candidate.researchQuestionId !== proposal.researchQuestionIds[0] || !proposal.roles.some((role) => candidate.eligibleRoles.includes(role as RoutingEligibleCandidate["eligibleRoles"][number]))) throw new Error(`ROUTING_LOCK_ROLE_OR_QUESTION_INVALID:${obligationId}`);
    accepted.push(proposal);
    lockedIds.add(obligationId);
  }
  return accepted;
}

export function unresolvedRoutingObligationIds(input: { routingObligationSet: RoutingObligationSet; locked: readonly TopicAuthorityProposal[] }): string[] {
  const locked = new Set(input.locked.flatMap((proposal) => proposal.routingObligationIds));
  return input.routingObligationSet.obligations.filter((obligation) => !locked.has(obligation.routingObligationId)).map((obligation) => obligation.routingObligationId);
}

function collectionProfile(input: Omit<SpecialistCollectionProfile, "profileId">): SpecialistCollectionProfile {
  return { ...input, profileId: contentAddressedId("specialist-collection-profile", input) };
}

/** Registry-governed capabilities only; profiles contain no historical assertions. */
export function registeredSpecialistCollectionProfiles(publisher: PublisherAuthorityVersion): SpecialistCollectionProfile[] {
  const common = { publisherVersionId: publisher.publisherVersionId, version: 1, policyVersion: SPECIALIST_COLLECTION_PROFILE_POLICY_VERSION, supportedQueryParameters: [], effectiveAt: "2026-10-02T00:00:00.000Z" };
  const byName: Record<string, Omit<SpecialistCollectionProfile, "profileId" | "publisherVersionId" | "version" | "policyVersion" | "supportedQueryParameters" | "effectiveAt">[]> = {
    "British Library": [{ capabilityClass: "MANUSCRIPTS_RARE_BOOKS", collectionScope: "Official library collection guides and digitised collection discovery.", endpoint: "https://www.bl.uk/collection-guides/", discoveryMechanisms: ["DIRECT_URL", "INSTITUTIONAL_SITE_SEARCH"], languages: ["en", "multilingual"], geography: ["United Kingdom", "International"], historicalPeriods: ["premodern", "modern"], contentTypes: ["manuscripts", "rare books", "incunabula"], accessLimitations: [], verificationProvenance: "Official British Library collection-guide endpoint." }],
    "Library of Congress": [{ capabilityClass: "DIGITIZED_BOOKS", collectionScope: "Official Library of Congress books and digitised print collections.", endpoint: "https://www.loc.gov/books/", discoveryMechanisms: ["DIRECT_URL", "INSTITUTIONAL_SITE_SEARCH"], languages: ["en", "multilingual"], geography: ["United States", "International"], historicalPeriods: ["premodern", "modern"], contentTypes: ["books", "digitised collections"], accessLimitations: [], verificationProvenance: "Official Library of Congress books collection endpoint." }],
    "Metropolitan Museum of Art": [{ capabilityClass: "MUSEUM_COLLECTIONS", collectionScope: "Official museum object collection database.", endpoint: "https://www.metmuseum.org/art/collection", discoveryMechanisms: ["DIRECT_URL", "INSTITUTIONAL_SITE_SEARCH"], languages: ["en"], geography: ["International"], historicalPeriods: ["premodern", "modern"], contentTypes: ["museum objects", "material culture"], accessLimitations: [], verificationProvenance: "Official Metropolitan Museum collection endpoint." }],
    "Asian Art Museum of San Francisco": [{ capabilityClass: "MUSEUM_COLLECTIONS", collectionScope: "Official Asian Art Museum collection database.", endpoint: "https://searchcollection.asianart.org/", discoveryMechanisms: ["DIRECT_URL", "INSTITUTIONAL_SITE_SEARCH"], languages: ["en"], geography: ["Asia"], historicalPeriods: ["premodern", "modern"], contentTypes: ["museum objects", "material culture"], accessLimitations: [], verificationProvenance: "Official Asian Art Museum collection-search endpoint." }],
    "Museums Tempelhof-Schöneberg": [{ capabilityClass: "MUSEUM_COLLECTIONS", collectionScope: "Official Berlin municipal museum documentation for the Berlin Airlift exhibition, including identified contemporary witness accounts.", endpoint: "https://www.berlin.de/ba-tempelhof-schoeneberg/aktuelles/pressemitteilungen/2023/pressemitteilung.1361562.php", discoveryMechanisms: ["DIRECT_URL"], languages: ["de", "en"], geography: ["West Berlin", "Berlin"], historicalPeriods: ["1948-1949"], contentTypes: ["oral-history testimony", "first-person witness accounts"], accessLimitations: ["The exhibition was time-bounded; retrieval must establish that attributable witness material remains available."], verificationProvenance: "Official Berlin municipal museum exhibition documentation." }],
    "State Archive of the Russian Federation": [{ capabilityClass: "ARCHIVAL_FINDING_AIDS", collectionScope: "Official electronic archive and finding aids for the Soviet Military Administration in Germany (SVAG) fonds.", endpoint: "https://statearchive.ru/384", discoveryMechanisms: ["DIRECT_URL", "INSTITUTIONAL_SITE_SEARCH"], languages: ["ru"], geography: ["Soviet Occupation Zone of Germany", "Berlin"], historicalPeriods: ["1945-1951"], contentTypes: ["archival finding aids", "administrative records"], accessLimitations: ["Russian-language archival descriptions and reading-room or request access may apply."], verificationProvenance: "Official GARF electronic SVAG archive endpoint." }]
  };
  return (byName[publisher.canonicalName] || []).map((profile) => collectionProfile({ ...common, ...profile }));
}

export function registryCapability(publisher: PublisherAuthorityVersion): AuthorityRegistryCapability {
  const officialEndpoints = publisher.knownDomains.map((domain) => `https://${domain}/`);
  return authorityRegistryCapabilitySchema.parse({
    authorityFamily: authorityFamilyForPublisher(publisher),
    officialEndpoints,
    historicalPeriods: [],
    defaultSubjectRelationship: defaultSubjectRelationship(publisher),
    discoveryMechanisms: ["DIRECT_URL", "SITEMAP", "REGISTERED_DOMAIN_DISCOVERY"],
    specialistCollectionProfiles: registeredSpecialistCollectionProfiles(publisher),
    historicalJurisdictionCapacities: publisher.historicalJurisdictionCapacities,
    affectedCommunityEvidenceCapacities: publisher.affectedCommunityEvidenceCapacities,
    storageConstraints: publisher.accessLimitations,
    registryVersion: AUTHORITY_REGISTRY_VERSION
  });
}

function validateProposal(input: {
  proposal: TopicAuthorityProposal;
  publisher: PublisherAuthorityVersion;
  questionIds: ReadonlySet<string>;
}): TopicAuthorityBinding {
  const proposal = input.proposal;
  if (input.publisher.state !== "VERIFIED") throw new Error(`AUTHORITY_NOT_VERIFIED:${proposal.publisherVersionId}`);
  if (proposal.researchQuestionIds.some((id) => !input.questionIds.has(id))) throw new Error(`AUTHORITY_BINDING_UNKNOWN_QUESTION:${proposal.publisherVersionId}`);
  const capability = registryCapability(input.publisher);
  // Registry metadata, rather than a model-planned route, controls the
  // relationship classification. Evidence later establishes sufficiency.
  // Only the bounded protected selector can carry a STATE_PARTY relationship;
  // ordinary model proposals remain unable to relabel a publisher.
  const subjectRelationship = input.proposal.subjectRelationship === "STATE_PARTY"
    && input.proposal.routingObligationIds.length > 0
    && input.publisher.institutionType === "GOVERNMENT"
    ? "STATE_PARTY" as const
    : input.proposal.subjectRelationship === "COMMUNITY_EVIDENCE_RECORDS_HOLDER"
      && (input.proposal.affectedCommunityEvidenceCapacityIds || []).length > 0
      ? "COMMUNITY_EVIDENCE_RECORDS_HOLDER" as const
    : input.proposal.subjectRelationship === "COMMUNITY_CUSTODIAN"
      && hasCommunityCustodialCapability(input.publisher)
      ? "COMMUNITY_CUSTODIAN" as const
      : defaultSubjectRelationship(input.publisher);
  if (capability.authorityFamily === "EDITED_REFERENCE" && proposal.roles.some((role) => role !== "ORIENTATION")) throw new Error(`ORIENTATION_AUTHORITY_ROLE_VIOLATION:${proposal.publisherVersionId}`);
  if (["SUBJECT_SELF", "STATE_PARTY"].includes(subjectRelationship) && proposal.roles.includes("CORROBORATION")) throw new Error(`SELF_INTERESTED_CORROBORATION_FORBIDDEN:${proposal.publisherVersionId}`);
  const capacityById = new Map(input.publisher.historicalJurisdictionCapacities.map((item) => [item.capacityId, item]));
  const requestedHistoricalJurisdictionCapacityIds = proposal.historicalJurisdictionCapacityIds || [];
  const selectedHistoricalJurisdictionCapacities = uniqueSorted(requestedHistoricalJurisdictionCapacityIds)
    .map((capacityId) => capacityById.get(capacityId))
    .filter((capacity): capacity is HistoricalJurisdictionCapacity => capacity !== undefined);
  if (selectedHistoricalJurisdictionCapacities.length !== requestedHistoricalJurisdictionCapacityIds.length) throw new Error(`HISTORICAL_JURISDICTION_CAPACITY_UNKNOWN:${proposal.publisherVersionId}`);
  if (selectedHistoricalJurisdictionCapacities.some((capacity) => !capacity.permittedResearchRoles.some((role) => proposal.roles.includes(role)))) throw new Error(`HISTORICAL_JURISDICTION_CAPACITY_ROLE_INELIGIBLE:${proposal.publisherVersionId}`);
  if (selectedHistoricalJurisdictionCapacities.some((capacity) => !capacity.permittedSubjectRelationships.includes(subjectRelationship as "INDEPENDENT" | "STATE_PARTY" | "PARTICIPANT" | "COMMUNITY_CUSTODIAN"))) throw new Error(`HISTORICAL_JURISDICTION_CAPACITY_RELATIONSHIP_INELIGIBLE:${proposal.publisherVersionId}`);
  const capacityByAffectedCommunityId = new Map(input.publisher.affectedCommunityEvidenceCapacities.map((item) => [item.capacityId, item]));
  const requestedAffectedCommunityEvidenceCapacityIds = proposal.affectedCommunityEvidenceCapacityIds || [];
  const selectedAffectedCommunityEvidenceCapacities = uniqueSorted(requestedAffectedCommunityEvidenceCapacityIds)
    .map((capacityId) => capacityByAffectedCommunityId.get(capacityId))
    .filter((capacity): capacity is AffectedCommunityEvidenceCapacity => capacity !== undefined);
  if (selectedAffectedCommunityEvidenceCapacities.length !== requestedAffectedCommunityEvidenceCapacityIds.length) throw new Error(`AFFECTED_COMMUNITY_EVIDENCE_CAPACITY_UNKNOWN:${proposal.publisherVersionId}`);
  if (selectedAffectedCommunityEvidenceCapacities.length > 0 && subjectRelationship !== "COMMUNITY_EVIDENCE_RECORDS_HOLDER") throw new Error(`AFFECTED_COMMUNITY_EVIDENCE_CAPACITY_RELATIONSHIP_INELIGIBLE:${proposal.publisherVersionId}`);
  if (selectedAffectedCommunityEvidenceCapacities.some((capacity) => !capacity.permittedResearchRoles.some((role) => proposal.roles.includes(role)))) throw new Error(`AFFECTED_COMMUNITY_EVIDENCE_CAPACITY_ROLE_INELIGIBLE:${proposal.publisherVersionId}`);
  const semantic = {
    publisherVersionId: proposal.publisherVersionId,
    researchQuestionIds: uniqueSorted(proposal.researchQuestionIds),
    roles: uniqueSorted(proposal.roles),
    claimTypes: uniqueSorted(proposal.claimTypes),
    subjectRelationship,
    perspectiveTags: uniqueSorted(proposal.perspectiveTags),
    historicalJurisdictionCapacityIds: uniqueSorted(requestedHistoricalJurisdictionCapacityIds),
    affectedCommunityEvidenceCapacityIds: uniqueSorted(requestedAffectedCommunityEvidenceCapacityIds),
    routingObligationIds: [],
    rationale: proposal.rationale.normalize("NFKC").trim(),
    publisherId: input.publisher.publisherId,
    authorityFamily: capability.authorityFamily,
    independenceGroupId: input.publisher.independenceGroupId,
    verifiedDomains: uniqueSorted(input.publisher.knownDomains),
    languages: uniqueSorted(input.publisher.languages),
    geography: uniqueSorted(input.publisher.geographicScope),
    officialEndpoints: capability.officialEndpoints,
    discoveryMechanisms: capability.discoveryMechanisms,
    specialistCollectionProfiles: capability.specialistCollectionProfiles,
    historicalJurisdictionCapacities: selectedHistoricalJurisdictionCapacities,
    affectedCommunityEvidenceCapacities: selectedAffectedCommunityEvidenceCapacities,
    validationStatus: "ELIGIBLE" as const
  };
  return { ...semantic, bindingId: contentAddressedId("topic-authority-binding", semantic) };
}

function assertContestedBalance(map: ResearchMap, bindings: readonly TopicAuthorityBinding[], requiredQuestionIds?: ReadonlySet<string>): void {
  for (const question of map.questions.filter((item) => item.contested && (!requiredQuestionIds || requiredQuestionIds.has(item.questionId)))) {
    const relevant = bindings.filter((binding) => binding.researchQuestionIds.includes(question.questionId) && binding.roles.some((role) => role !== "ORIENTATION"));
    const independent = relevant.filter((binding) => binding.subjectRelationship === "INDEPENDENT");
    const groups = new Set(independent.map((binding) => binding.independenceGroupId));
    if (groups.size < 2) throw new Error(`PERSPECTIVE_INDEPENDENCE_INSUFFICIENT:${question.questionId}`);
    if (!independent.some((binding) => binding.roles.includes("INTERPRETATION") || binding.roles.includes("CORROBORATION"))) throw new Error(`INDEPENDENT_SCHOLARSHIP_REQUIRED:${question.questionId}`);
  }
}

/**
 * Protected-representation preflight is an availability guard, not a route
 * lock: it verifies that the bounded governed universe contains a registered
 * authority family capable of pursuing the requirement, while the evidence
 * audit alone decides whether the acquired material satisfies it.
 */
function requirementId(map: ResearchMap, questionId: string, requirement: { kind: string; label: string; rationale: string }): string {
  return contentAddressedId("perspective-requirement", { researchMapId: map.researchMapId, questionId, kind: requirement.kind, label: normalize(requirement.label), rationale: requirement.rationale.normalize("NFKC").trim() });
}

export function historicalJurisdictionCapacityCovers(input: {
  capacity: HistoricalJurisdictionCapacity;
  historicalJurisdiction: string;
  period: { startYear: number; endYear: number };
  authorityDomains?: readonly string[];
  roles: readonly string[];
  subjectRelationship: SubjectRelationship;
}): boolean {
  const relationship = input.subjectRelationship;
  return normalize(input.capacity.historicalJurisdiction) === normalize(input.historicalJurisdiction)
    && input.capacity.period.startYear <= input.period.startYear
    && input.capacity.period.endYear >= input.period.endYear
    && input.capacity.permittedResearchRoles.some((role) => input.roles.includes(role))
    && input.capacity.permittedSubjectRelationships.includes(relationship as "INDEPENDENT" | "STATE_PARTY" | "PARTICIPANT" | "COMMUNITY_CUSTODIAN")
    && (!input.authorityDomains || input.authorityDomains.every((domain) => input.capacity.authorityDomains.some((covered) => normalize(covered) === normalize(domain))));
}

/**
 * Completes only locked material-jurisdiction acquisition capacity from the
 * immutable registry. A language model may propose additional authorities,
 * but a valid registered capacity cannot be omitted merely because its
 * opaque identifier was not repeated in model output.
 */
export function completeMaterialJurisdictionProposals(input: {
  scope: ScopeContract;
  researchMap: ResearchMap;
  publishers: readonly PublisherAuthorityVersion[];
  proposals: readonly TopicAuthorityProposal[];
  requiredQuestionIds?: readonly string[];
}): TopicAuthorityProposal[] {
  const requiredQuestionIds = input.requiredQuestionIds ? new Set(input.requiredQuestionIds) : undefined;
  const publishersById = new Map(input.publishers.map((publisher) => [publisher.publisherVersionId, publisher]));
  const completed = input.proposals.map((proposal) => ({
    ...proposal,
    researchQuestionIds: uniqueSorted(proposal.researchQuestionIds),
    roles: uniqueSorted(proposal.roles),
    claimTypes: uniqueSorted(proposal.claimTypes),
    perspectiveTags: uniqueSorted(proposal.perspectiveTags),
    historicalJurisdictionCapacityIds: uniqueSorted(proposal.historicalJurisdictionCapacityIds || []),
    routingObligationIds: []
  }));
  const endYear = input.scope.chronologyEnd?.latestYear ?? input.scope.chronologyEnd?.year ?? input.scope.chronologyStart.latestYear ?? input.scope.chronologyStart.year;
  const period = { startYear: input.scope.chronologyStart.earliestYear ?? input.scope.chronologyStart.year, endYear };

  for (const question of input.researchMap.questions) {
    if (requiredQuestionIds && !requiredQuestionIds.has(question.questionId)) continue;
    for (const requirement of question.historicalPerspectiveRequirements || []) {
      if (requirement.kind !== "MATERIAL_JURISDICTION") continue;
      const alreadyCovered = completed.some((proposal) => {
        if (!proposal.researchQuestionIds.includes(question.questionId)) return false;
        const publisher = publishersById.get(proposal.publisherVersionId);
        if (!publisher) return false;
        return (proposal.historicalJurisdictionCapacityIds || []).some((capacityId) => {
          const capacity = publisher.historicalJurisdictionCapacities.find((item) => item.capacityId === capacityId);
          return capacity !== undefined && historicalJurisdictionCapacityCovers({ capacity, historicalJurisdiction: requirement.label, period, roles: proposal.roles, subjectRelationship: proposal.subjectRelationship });
        });
      });
      if (alreadyCovered) continue;

      const candidate = input.publishers
        .filter((publisher) => publisher.state === "VERIFIED")
        .flatMap((publisher) => publisher.historicalJurisdictionCapacities.flatMap((capacity) => {
          const relationship = defaultSubjectRelationship(publisher);
          const role = (["PRIMARY_RECORD", "CORROBORATION", "INTERPRETATION"] as const).find((item) => historicalJurisdictionCapacityCovers({ capacity, historicalJurisdiction: requirement.label, period, roles: [item], subjectRelationship: relationship }));
          return role ? [{ publisher, capacity, relationship, role }] : [];
        }))
        .sort((left, right) => `${left.publisher.publisherVersionId}:${left.capacity.capacityId}`.localeCompare(`${right.publisher.publisherVersionId}:${right.capacity.capacityId}`))[0];
      if (!candidate) continue;

      const existing = completed.find((proposal) => proposal.publisherVersionId === candidate.publisher.publisherVersionId);
      if (existing) {
        existing.researchQuestionIds = uniqueSorted([...existing.researchQuestionIds, question.questionId]);
        existing.roles = uniqueSorted([...existing.roles, candidate.role]);
        existing.claimTypes = uniqueSorted([...existing.claimTypes, ...question.claimTypesExpected]);
        existing.perspectiveTags = uniqueSorted([...existing.perspectiveTags, requirement.label]);
        existing.historicalJurisdictionCapacityIds = uniqueSorted([...(existing.historicalJurisdictionCapacityIds || []), candidate.capacity.capacityId]);
        continue;
      }
      completed.push({
        publisherVersionId: candidate.publisher.publisherVersionId,
        researchQuestionIds: [question.questionId],
        roles: [candidate.role],
        claimTypes: uniqueSorted(question.claimTypesExpected),
        subjectRelationship: candidate.relationship,
        perspectiveTags: [requirement.label],
        historicalJurisdictionCapacityIds: [candidate.capacity.capacityId],
        routingObligationIds: [],
        rationale: "Deterministically selected from the registered bounded historical-jurisdiction capacity required by the locked Research Map."
      });
    }
  }
  return completed.sort((left, right) => left.publisherVersionId.localeCompare(right.publisherVersionId));
}

function materialJurisdictionCapacityMatches(capacity: HistoricalJurisdictionCapacity, requirementLabel: string, binding: TopicAuthorityBinding, scope: ScopeContract): boolean {
  const endYear = scope.chronologyEnd?.latestYear ?? scope.chronologyEnd?.year ?? scope.chronologyStart.latestYear ?? scope.chronologyStart.year;
  return historicalJurisdictionCapacityCovers({ capacity, historicalJurisdiction: requirementLabel, period: { startYear: scope.chronologyStart.earliestYear ?? scope.chronologyStart.year, endYear }, roles: binding.roles, subjectRelationship: binding.subjectRelationship });
}

function communityCapacityEvaluations(scope: ScopeContract, question: ResearchMap["questions"][number], publishers: readonly PublisherAuthorityVersion[], resolution: ReturnType<typeof resolveGovernedCommunityIdentity>): Array<{ publisherVersionId: string; capacityId: string; accepted: boolean; rejectionReason: string | null }> {
  const endYear = scope.chronologyEnd?.latestYear ?? scope.chronologyEnd?.year ?? scope.chronologyStart.latestYear ?? scope.chronologyStart.year;
  const period = { startYear: scope.chronologyStart.earliestYear ?? scope.chronologyStart.year, endYear };
  return publishers.flatMap((publisher) => (publisher.affectedCommunityEvidenceCapacities || []).map((capacity) => {
    const rejectionReason = publisher.state !== "VERIFIED" ? "PUBLISHER_NOT_VERIFIED"
      : !question.languages.some((language) => publisher.languages.includes(language)) ? "PUBLISHER_LANGUAGE_MISMATCH"
      : resolution.rejectionReason ? resolution.rejectionReason
      : capacity.communityIdentityId !== resolution.communityIdentityId ? "CAPACITY_COMMUNITY_ID_MISMATCH"
      : capacity.period.startYear > period.startYear || capacity.period.endYear < period.endYear ? "CAPACITY_PERIOD_MISMATCH"
      : !question.geography.some((geography) => capacity.geography.some((item) => normalize(item) === normalize(geography))) ? "CAPACITY_GEOGRAPHY_MISMATCH"
      : !capacity.permittedResearchRoles.some((role) => ["PRIMARY_RECORD", "PERSPECTIVE_TESTIMONY"].includes(role)) ? "CAPACITY_ROLE_MISMATCH"
      : null;
    return { publisherVersionId: publisher.publisherVersionId, capacityId: capacity.capacityId, accepted: rejectionReason === null, rejectionReason };
  })).sort((left, right) => `${left.publisherVersionId}:${left.capacityId}`.localeCompare(`${right.publisherVersionId}:${right.capacityId}`));
}

function representationDiagnostic(scope: ScopeContract, map: ResearchMap, question: ResearchMap["questions"][number], requirement: NonNullable<ResearchMap["questions"][number]["historicalPerspectiveRequirements"]>[number], relevant: readonly TopicAuthorityBinding[], publishers: readonly PublisherAuthorityVersion[]): ProtectedRepresentationDiagnostic {
  const requiredRoles: ProtectedRepresentationDiagnostic["requiredRoles"] = requirement.kind === "MATERIAL_JURISDICTION" ? ["PRIMARY_RECORD", "CORROBORATION"] : ["PRIMARY_RECORD", "CORROBORATION", "INTERPRETATION", "PERSPECTIVE_TESTIMONY"];
  const permittedSubjectRelationships: ProtectedRepresentationDiagnostic["permittedSubjectRelationships"] = requirement.kind === "AFFECTED_COMMUNITY"
    ? ["COMMUNITY_EVIDENCE_RECORDS_HOLDER"]
    : ["INDEPENDENT", "STATE_PARTY", "PARTICIPANT", "COMMUNITY_CUSTODIAN"];
  const endYear = scope.chronologyEnd?.latestYear ?? scope.chronologyEnd?.year ?? scope.chronologyStart.latestYear ?? scope.chronologyStart.year;
  const communityIdentityResolution = requirement.kind === "AFFECTED_COMMUNITY" ? resolveGovernedCommunityIdentity({ rawLabel: requirement.label, scopePeriod: { startYear: scope.chronologyStart.earliestYear ?? scope.chronologyStart.year, endYear }, geography: question.geography, languages: question.languages, category: "AFFECTED_POPULATION" }) : null;
  return {
    requirementId: requirementId(map, question.questionId, requirement), requirementKind: requirement.kind, canonicalLabel: requirement.label.normalize("NFKC").trim(), researchMapId: map.researchMapId, researchQuestionId: question.questionId,
    phaseIds: [...question.phaseIds], dimensionIds: [...question.dimensionIds], requiredRoles, permittedSubjectRelationships,
    historicalJurisdiction: requirement.kind === "MATERIAL_JURISDICTION" ? requirement.label.normalize("NFKC").trim() : null,
    eligibleCandidates: relevant.map((binding) => ({ publisherVersionId: binding.publisherVersionId, capacityIds: requirement.kind === "AFFECTED_COMMUNITY" ? (binding.affectedCommunityEvidenceCapacities || []).map((capacity) => capacity.capacityId) : (binding.historicalJurisdictionCapacities || []).map((capacity) => capacity.capacityId), rejectionReason: requirement.kind === "AFFECTED_COMMUNITY"
      ? (binding.affectedCommunityEvidenceCapacities || []).length === 0 ? "NO_SELECTED_AFFECTED_COMMUNITY_EVIDENCE_CAPACITY" : "NO_SELECTED_CAPACITY_MATCHES_REQUIRED_AFFECTED_COMMUNITY"
      : requirement.kind === "MATERIAL_JURISDICTION"
      ? (binding.historicalJurisdictionCapacities || []).length === 0 ? "NO_SELECTED_HISTORICAL_JURISDICTION_CAPACITY" : "NO_SELECTED_CAPACITY_MATCHES_REQUIRED_HISTORICAL_JURISDICTION"
      : "RELATIONSHIP_OR_FAMILY_CONSTRAINT_NOT_MET" })).sort((left, right) => left.publisherVersionId.localeCompare(right.publisherVersionId)),
    registryVersion: AUTHORITY_REGISTRY_VERSION, policyVersion: AUTHORITY_FIRST_POLICY_VERSION, releaseIdentity: null,
    communityIdentityResolution,
    communityCapacityEvaluations: communityIdentityResolution ? communityCapacityEvaluations(scope, question, publishers, communityIdentityResolution) : []
  };
}

function assertProtectedRepresentationAvailability(scope: ScopeContract, map: ResearchMap, bindings: readonly TopicAuthorityBinding[], publishers: readonly PublisherAuthorityVersion[], requiredQuestionIds?: ReadonlySet<string>): void {
  for (const question of map.questions.filter((item) => !requiredQuestionIds || requiredQuestionIds.has(item.questionId))) {
    const relevant = bindings.filter((binding) => binding.researchQuestionIds.includes(question.questionId) && binding.roles.some((role) => role !== "ORIENTATION"));
    for (const requirement of question.historicalPerspectiveRequirements || []) {
      if (!requiresProtectedPreAcquisitionAvailability(requirement.kind)) continue;
      const available = requirement.kind === "AFFECTED_COMMUNITY"
        ? (() => { const endYear = scope.chronologyEnd?.latestYear ?? scope.chronologyEnd?.year ?? scope.chronologyStart.latestYear ?? scope.chronologyStart.year; const resolution = resolveGovernedCommunityIdentity({ rawLabel: requirement.label, scopePeriod: { startYear: scope.chronologyStart.earliestYear ?? scope.chronologyStart.year, endYear }, geography: question.geography, languages: question.languages, category: "AFFECTED_POPULATION" }); return resolution.communityIdentityId !== null && relevant.some((binding) => binding.subjectRelationship === "COMMUNITY_EVIDENCE_RECORDS_HOLDER" && (binding.affectedCommunityEvidenceCapacities || []).some((capacity) => affectedCommunityEvidenceCapacityCovers({ capacity, communityIdentityId: resolution.communityIdentityId!, period: { startYear: scope.chronologyStart.earliestYear ?? scope.chronologyStart.year, endYear }, geography: question.geography, languages: question.languages, roles: binding.roles }))); })()
        : requirement.kind === "CUSTODIAL_COMMUNITY"
          ? relevant.some((binding) => binding.subjectRelationship === "COMMUNITY_CUSTODIAN")
        : requirement.kind === "PARTY_PARTICIPANT"
          ? relevant.some((binding) => ["STATE_PARTY", "PARTICIPANT", "INDEPENDENT"].includes(binding.subjectRelationship))
          : requirement.kind === "MATERIAL_JURISDICTION"
            ? relevant.some((binding) => (binding.historicalJurisdictionCapacities || []).some((capacity) => materialJurisdictionCapacityMatches(capacity, requirement.label, binding, scope)))
            : requirement.kind === "INDEPENDENT_SCHOLARSHIP"
              ? relevant.some((binding) => binding.subjectRelationship === "INDEPENDENT" && binding.authorityFamily === "ACADEMIC_SCHOLARLY")
              : relevant.some((binding) => binding.subjectRelationship !== "SUBJECT_SELF");
      if (!available) throw new ProtectedRepresentationAvailabilityError(representationDiagnostic(scope, map, question, requirement, relevant, publishers));
    }
  }
}

export function buildTopicAuthoritySet(input: {
  context: ArtifactContext;
  scope: ScopeContract;
  researchMap: ResearchMap;
  publishers: readonly PublisherAuthorityVersion[];
  proposals: readonly TopicAuthorityProposal[];
  protectedAvailabilityDecisions?: ProtectedAvailabilityCompletion["decisions"];
  contestedAvailabilityDecisions?: ContestedAvailabilityCompletion["decisions"];
  /** Historical compatibility only; .16+ ignores this retired artifact. */
  routingObligationSet?: RoutingObligationSet;
  requiredQuestionIds?: readonly string[];
  parentTopicAuthoritySetId?: string;
}): TopicAuthoritySet {
  const context = { ...input.context, policyVersion: AUTHORITY_FIRST_POLICY_VERSION };
  const registry = new Map(input.publishers.map((publisher) => [publisher.publisherVersionId, publisher]));
  const questionIds = new Set(input.researchMap.questions.map((question) => question.questionId));
  const requiredQuestionIds = input.requiredQuestionIds ? new Set(input.requiredQuestionIds) : undefined;
  if (requiredQuestionIds && (requiredQuestionIds.size === 0 || [...requiredQuestionIds].some((id) => !questionIds.has(id)))) throw new Error("AUTHORITY_ROUTING_TARGET_SET_INVALID");
  const rejectedPublisherVersionIds: string[] = [];
  const bindings: TopicAuthorityBinding[] = [];
  for (const proposal of input.proposals) {
    const publisher = registry.get(proposal.publisherVersionId);
    if (!publisher) {
      rejectedPublisherVersionIds.push(proposal.publisherVersionId);
      continue;
    }
    if (requiredQuestionIds && proposal.researchQuestionIds.some((id) => !requiredQuestionIds.has(id))) throw new Error(`AUTHORITY_BINDING_OUTSIDE_COMPLETION_TARGET:${proposal.publisherVersionId}`);
    bindings.push(validateProposal({ proposal, publisher, questionIds }));
  }
  if (bindings.length === 0) throw new Error("NO_APPLICABLE_AUTHORITY");
  // The set proves bounded, registry-governed acquisition capacity. It does
  // not claim that any authority will yield perspective-sufficient evidence.
  const criticalQuestionIds = input.researchMap.questions
    .filter((question) => requiredQuestionIds
      ? requiredQuestionIds.has(question.questionId)
      : question.priority === "CRITICAL")
    .map((question) => question.questionId);
  const coreCoverage = new Set(bindings.filter((binding) => binding.roles.some((role) => role !== "ORIENTATION")).flatMap((binding) => binding.researchQuestionIds));
  const missingCritical = criticalQuestionIds.filter((id) => !coreCoverage.has(id));
  if (missingCritical.length > 0) throw new Error(`MISSING_CRITICAL_AUTHORITY_COVERAGE:${missingCritical.join(",")}`);
  assertContestedBalance(input.researchMap, bindings, requiredQuestionIds);
  assertProtectedRepresentationAvailability(input.scope, input.researchMap, bindings, input.publishers, requiredQuestionIds);
  const registryHash = payloadHash(input.publishers.map((publisher) => ({ publisherVersionId: publisher.publisherVersionId, payloadHash: publisher.payloadHash })).sort((left, right) => left.publisherVersionId.localeCompare(right.publisherVersionId)));
  const semantic = {
    scopeContractId: input.scope.scopeContractId,
    scopePayloadHash: input.scope.payloadHash,
    researchMapId: input.researchMap.researchMapId,
    researchMapPayloadHash: input.researchMap.payloadHash,
    registryVersion: AUTHORITY_REGISTRY_VERSION,
    registryHash,
    routingObligationSetId: null,
    bindings: bindings.sort((left, right) => left.bindingId.localeCompare(right.bindingId)),
    protectedAvailabilityDecisions: [...(input.protectedAvailabilityDecisions || [])].sort((left, right) => left.requirementId.localeCompare(right.requirementId)),
    contestedAvailabilityDecisions: [...(input.contestedAvailabilityDecisions || [])].sort((left, right) => left.researchQuestionId.localeCompare(right.researchQuestionId)),
    obligationRoutes: [],
    rejectedPublisherVersionIds: uniqueSorted(rejectedPublisherVersionIds),
    criticalQuestionIds: uniqueSorted(criticalQuestionIds),
    contestedQuestionIds: uniqueSorted(input.researchMap.questions.filter((question) => question.contested && (!requiredQuestionIds || requiredQuestionIds.has(question.questionId))).map((question) => question.questionId)),
    validationStatus: "VALIDATED" as const
  };
  const topicAuthoritySetId = semanticArtifactId("topic-authority-set", context, input.parentTopicAuthoritySetId ? { ...semantic, parentArtifactId: input.parentTopicAuthoritySetId } : semantic);
  return parseSealedArtifact(topicAuthoritySetSchema, { ...semanticEnvelope(context, topicAuthoritySetId, input.parentTopicAuthoritySetId || null), topicAuthoritySetId, ...semantic }) as TopicAuthoritySet;
}

export function registeredGroundingExpansionPublishers(input: {
  set: TopicAuthoritySet;
  publishers: readonly PublisherAuthorityVersion[];
  researchQuestionId: string;
  references: readonly { url: string; domain: string | null }[];
}): PublisherAuthorityVersion[] {
  const alreadyBound = new Set(input.set.bindings
    .filter((binding) => binding.researchQuestionIds.includes(input.researchQuestionId))
    .map((binding) => binding.publisherVersionId));
  const normalizedHost = (value: string): string => value.toLocaleLowerCase("en-US").replace(/^www\./u, "").replace(/\.$/u, "");
  const referencedDomains = new Set(input.references.flatMap((reference) => {
    const values: string[] = [];
    if (reference.domain) values.push(normalizedHost(reference.domain));
    try { values.push(normalizedHost(new URL(reference.url).hostname)); } catch { /* Invalid provider URLs cannot authorize expansion. */ }
    return values;
  }));
  return input.publishers.filter((publisher) => publisher.state === "VERIFIED"
    && !alreadyBound.has(publisher.publisherVersionId)
    && publisher.knownDomains.some((domain) => [...referencedDomains].some((referenced) => referenced === normalizedHost(domain) || referenced.endsWith(`.${normalizedHost(domain)}`))))
    .sort((left, right) => left.publisherVersionId.localeCompare(right.publisherVersionId));
}

function operationEndpoint(binding: TopicAuthorityBinding, mechanism: TopicAuthorityBinding["discoveryMechanisms"][number], profile: SpecialistCollectionProfile | null): string {
  if (profile) return profile.endpoint;
  const root = new URL(binding.officialEndpoints[0]!);
  if (mechanism === "SITEMAP") return new URL("/sitemap.xml", root).toString();
  return root.toString();
}

function profileTerms(profile: SpecialistCollectionProfile): Set<string> {
  return new Set([
    profile.capabilityClass,
    profile.collectionScope,
    ...profile.languages,
    ...profile.geography,
    ...profile.historicalPeriods,
    ...profile.contentTypes
  ].flatMap((value) => normalize(value).match(/[\p{L}\p{N}]{3,}/gu) || []));
}

/**
 * Ranks only profiles already admitted to the bound authority. The model can
 * propose a binding, but cannot grant an endpoint or make array order decide
 * historical routing.
 */
export function applicableSpecialistCollectionProfiles(input: {
  binding: TopicAuthorityBinding;
  researchMap: ResearchMap;
}): SpecialistCollectionProfile[] {
  const questionText = input.binding.researchQuestionIds
    .map((id) => input.researchMap.questions.find((question) => question.questionId === id)?.text || "")
    .join(" ");
  const queryTerms = new Set(normalize(`${questionText} ${input.binding.rationale}`).match(/[\p{L}\p{N}]{3,}/gu) || []);
  return input.binding.specialistCollectionProfiles
    .map((profile) => ({ profile, score: [...profileTerms(profile)].filter((term) => queryTerms.has(term)).length }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.profile.profileId.localeCompare(right.profile.profileId))
    .map((candidate) => candidate.profile);
}

export function buildAuthorityResearchPlan(input: { context: ArtifactContext; set: TopicAuthoritySet; researchMap: ResearchMap }): AuthorityResearchPlan {
  const operations: AuthorityResearchPlan["operations"] = [];
  if (input.researchMap.researchMapId !== input.set.researchMapId || input.researchMap.payloadHash !== input.set.researchMapPayloadHash) {
    throw new Error("AUTHORITY_RESEARCH_PLAN_RESEARCH_MAP_MISMATCH");
  }
  const questionTextById = new Map(input.researchMap.questions.map((question) => [question.questionId, question.text]));
  const baseOperationCount = input.set.bindings.length;
  // A generic operation is reserved for every sealed authority. The fixed
  // remainder is allocated at plan time to governed specialist collections
  // and registered direct-endpoint fallbacks; discovery results cannot grow it.
  let remainingSupplementalAttempts = Math.max(0, DEFAULT_CONTROLLED_RESEARCH_BUDGET.maximumControlledDiscoveryOperations - baseOperationCount);
  for (const binding of input.set.bindings) {
    const layer = binding.roles.every((role) => role === "ORIENTATION") ? "ORIENTATION" as const : "EVIDENTIARY_CORE" as const;
    const genericMechanism = layer === "ORIENTATION"
      ? "DIRECT_URL" as const
      : binding.discoveryMechanisms.includes("SITEMAP") ? "SITEMAP" as const : binding.discoveryMechanisms[0]!;
    const purpose = `Research questions: ${binding.researchQuestionIds.map((questionId) => questionTextById.get(questionId)).filter((text): text is string => Boolean(text)).join(" | ")}. Authority rationale: ${binding.rationale}. ${layer === "ORIENTATION" ? "Orient research" : "Acquire direct institutional evidence"}.`.slice(0, 1000);
    const directFallbackAvailable = layer === "EVIDENTIARY_CORE"
      && genericMechanism !== "DIRECT_URL"
      && binding.discoveryMechanisms.includes("DIRECT_URL");
    const specialistCapacity = Math.max(0, remainingSupplementalAttempts - (directFallbackAvailable ? 1 : 0));
    const profiles = layer === "EVIDENTIARY_CORE"
      ? applicableSpecialistCollectionProfiles({ binding, researchMap: input.researchMap }).slice(0, Math.min(3, specialistCapacity))
      : [];
    remainingSupplementalAttempts -= profiles.length;
    for (const [index, profile] of profiles.entries()) {
      const mechanism = profile.discoveryMechanisms[0]!;
      const semantic = {
        authorityBindingId: binding.bindingId, researchQuestionIds: uniqueSorted(binding.researchQuestionIds), routingObligationIds: [], layer,
        mechanism, endpoint: operationEndpoint(binding, mechanism, profile), specialistCollectionProfileId: profile.profileId,
        attemptOrder: index, purpose: `Specialist collection attempt ${index + 1}. ${purpose}`.slice(0, 1000)
      };
      operations.push({ ...semantic, plannedOperationId: contentAddressedId("planned-authority-operation", semantic) });
    }
    const generic = {
      authorityBindingId: binding.bindingId,
      researchQuestionIds: uniqueSorted(binding.researchQuestionIds),
      routingObligationIds: [],
      layer,
      mechanism: genericMechanism,
      endpoint: operationEndpoint(binding, genericMechanism, null),
      specialistCollectionProfileId: null,
      attemptOrder: profiles.length,
      purpose: `${profiles.length > 0 ? "Same-authority generic fallback. " : ""}${purpose}`.slice(0, 1000)
    };
    operations.push({ ...generic, plannedOperationId: contentAddressedId("planned-authority-operation", generic) });
    if (directFallbackAvailable && remainingSupplementalAttempts > 0) {
      const fallback = {
        authorityBindingId: binding.bindingId,
        researchQuestionIds: uniqueSorted(binding.researchQuestionIds),
        routingObligationIds: [],
        layer,
        mechanism: "DIRECT_URL" as const,
        endpoint: operationEndpoint(binding, "DIRECT_URL", null),
        specialistCollectionProfileId: null,
        attemptOrder: profiles.length + 1,
        purpose: `Same-authority registered direct-endpoint fallback. ${purpose}`.slice(0, 1000)
      };
      operations.push({ ...fallback, plannedOperationId: contentAddressedId("planned-authority-operation", fallback) });
      remainingSupplementalAttempts -= 1;
    }
  }
  if (operations.length > DEFAULT_CONTROLLED_RESEARCH_BUDGET.maximumControlledDiscoveryOperations) throw new Error("CONTROLLED_OPERATION_BUDGET_EXHAUSTED");
  const coveredCriticalQuestionIds = uniqueSorted(input.set.criticalQuestionIds);
  const coveredRoutingObligationIds: string[] = [];
  const semantic = { topicAuthoritySetId: input.set.topicAuthoritySetId, routingObligationSetId: null, budget: DEFAULT_CONTROLLED_RESEARCH_BUDGET, operations: operations.sort((left, right) => left.plannedOperationId.localeCompare(right.plannedOperationId)), coveredCriticalQuestionIds, coveredRoutingObligationIds, state: "AUTHORIZED" as const };
  const context = { ...input.context, policyVersion: AUTHORITY_FIRST_POLICY_VERSION };
  const authorityResearchPlanId = semanticArtifactId("authority-research-plan", context, semantic);
  return parseSealedArtifact(authorityResearchPlanSchema, { ...semanticEnvelope(context, authorityResearchPlanId, input.set.topicAuthoritySetId), authorityResearchPlanId, ...semantic }) as AuthorityResearchPlan;
}

export function sealControlledResearchLedger(input: {
  context: ArtifactContext;
  set: TopicAuthoritySet;
  operations: ControlledResearchOperation[];
  directRetrievalCount: number;
}) {
  if (input.operations.length > DEFAULT_CONTROLLED_RESEARCH_BUDGET.maximumControlledDiscoveryOperations) throw new Error("CONTROLLED_OPERATION_BUDGET_EXHAUSTED");
  const gapRepairOperationCount = input.operations.filter((operation) => operation.layer === "GAP_CONTEST_ESCALATION").length;
  const groundingEscalationCallCount = input.operations.filter((operation) => operation.mechanism === "GOOGLE_GROUNDING_ESCALATION").length;
  const semantic = {
    topicAuthoritySetId: input.set.topicAuthoritySetId,
    budget: DEFAULT_CONTROLLED_RESEARCH_BUDGET,
    operations: [...input.operations].sort((left, right) => left.operationId.localeCompare(right.operationId)),
    gapRepairOperationCount,
    groundingEscalationCallCount,
    directRetrievalCount: input.directRetrievalCount
  };
  const context = { ...input.context, policyVersion: AUTHORITY_FIRST_POLICY_VERSION };
  const controlledResearchLedgerId = semanticArtifactId("controlled-research-ledger", context, semantic);
  return parseSealedArtifact(controlledResearchLedgerSchema, { ...semanticEnvelope(context, controlledResearchLedgerId, input.set.topicAuthoritySetId), controlledResearchLedgerId, ...semantic });
}

export function claimAuthorityApplicability(input: {
  binding: TopicAuthorityBinding;
  claimType: TopicAuthorityBinding["claimTypes"][number];
  risk: "ROUTINE" | "MATERIAL" | "INTERPRETIVE" | "CONTESTED" | "SENSITIVE";
}): { eligible: boolean; independentlySufficient: boolean; reason: string } {
  if (!input.binding.claimTypes.includes(input.claimType)) return { eligible: false, independentlySufficient: false, reason: "CLAIM_TYPE_OUTSIDE_BINDING" };
  if (input.binding.roles.includes("ORIENTATION") && input.binding.roles.length === 1) return { eligible: false, independentlySufficient: false, reason: "ORIENTATION_ONLY" };
  const selfInterested = ["SUBJECT_SELF", "STATE_PARTY", "PARTICIPANT"].includes(input.binding.subjectRelationship);
  if (selfInterested && ["INTERPRETIVE", "CONTESTED", "SENSITIVE"].includes(input.risk)) return { eligible: true, independentlySufficient: false, reason: "SELF_INTERESTED_REQUIRES_INDEPENDENT_CORROBORATION" };
  const primaryRecordFact = input.binding.roles.includes("PRIMARY_RECORD") && ["OCCURRENCE", "DATE", "IDENTITY", "LOCATION", "QUANTITY", "INSTITUTIONAL_ACTION"].includes(input.claimType);
  return { eligible: true, independentlySufficient: !selfInterested || input.risk === "ROUTINE" || primaryRecordFact, reason: selfInterested ? primaryRecordFact ? "SUBJECT_PRIMARY_RECORD" : "SUBJECT_RECORD_ONLY" : "CLAIM_RELATIVE_AUTHORITY_APPLIES" };
}

export function auditPerspective(input: {
  context: ArtifactContext;
  set: TopicAuthoritySet;
  requiredPerspectiveTags: readonly string[];
  requiredPerspectiveRequirements?: readonly { kind: "STAKEHOLDER" | "PARTY_PARTICIPANT" | "AFFECTED_COMMUNITY" | "CUSTODIAL_COMMUNITY" | "INDEPENDENT_SCHOLARSHIP" | "MATERIAL_JURISDICTION"; label: string; rationale: string }[];
  sensitive: boolean;
}): PerspectiveAudit {
  const represented = uniqueSorted(input.set.bindings.flatMap((binding) => [...binding.perspectiveTags, ...binding.geography]));
  const representedKeys = new Set(represented.map(normalize));
  const missing = uniqueSorted(input.requiredPerspectiveTags.filter((tag) => {
    const required = normalize(tag);
    return ![...representedKeys].some((represented) => represented === required || represented.includes(required) || required.includes(represented));
  }));
  const evidentiary = input.set.bindings.filter((binding) => binding.roles.some((role) => role !== "ORIENTATION"));
  const independent = evidentiary.filter((binding) => binding.subjectRelationship === "INDEPENDENT");
  const independentGroupCount = new Set(independent.map((binding) => binding.independenceGroupId)).size;
  const hasIndependentScholarship = independent.some((binding) => binding.authorityFamily === "ACADEMIC_SCHOLARLY" || binding.roles.includes("INTERPRETATION") || binding.roles.includes("CORROBORATION"));
  if ((input.requiredPerspectiveRequirements || []).some((requirement) => requirement.kind === "INDEPENDENT_SCHOLARSHIP") && !hasIndependentScholarship) missing.push("Independent scholarship");
  const onlySelfInterestedEvidence = evidentiary.length > 0 && independent.length === 0;
  const reasons: PerspectiveAudit["reasonCodes"] = [];
  if (missing.length > 0) reasons.push("MISSING_REQUIRED_PERSPECTIVE");
  if ((input.set.contestedQuestionIds.length > 0 || input.sensitive) && independentGroupCount < 2) reasons.push("INSUFFICIENT_INDEPENDENCE");
  if (onlySelfInterestedEvidence && (input.set.contestedQuestionIds.length > 0 || input.sensitive)) reasons.push("ONLY_SELF_INTERESTED_EVIDENCE");
  if (input.sensitive && reasons.length === 0) reasons.push("CONTESTED_HUMAN_REVIEW");
  if (reasons.length === 0) reasons.push("PERSPECTIVE_REQUIREMENTS_MET");
  const verdict: PerspectiveAudit["verdict"] = reasons.includes("ONLY_SELF_INTERESTED_EVIDENCE") || reasons.includes("MISSING_REQUIRED_PERSPECTIVE") || reasons.includes("INSUFFICIENT_INDEPENDENCE")
    ? "INADEQUATE"
    : input.sensitive ? "REVIEW_REQUIRED" : "SUFFICIENT";
  const semantic = { topicAuthoritySetId: input.set.topicAuthoritySetId, contested: input.set.contestedQuestionIds.length > 0, representedPerspectiveTags: represented, missingPerspectiveTags: missing, independentGroupCount, hasIndependentScholarship, onlySelfInterestedEvidence, verdict, reasonCodes: uniqueSorted(reasons) as PerspectiveAudit["reasonCodes"] };
  const context = { ...input.context, policyVersion: AUTHORITY_FIRST_POLICY_VERSION };
  const perspectiveAuditId = semanticArtifactId("perspective-audit", context, semantic);
  return parseSealedArtifact(perspectiveAuditSchema, { ...semanticEnvelope(context, perspectiveAuditId, input.set.topicAuthoritySetId), perspectiveAuditId, ...semantic });
}

export function buildConfidenceVector(input: {
  context: ArtifactContext;
  topicAuthoritySetId: string;
  authorityApplicability: AcquisitionConfidenceVector["authorityApplicability"];
  evidenceDirectness: AcquisitionConfidenceVector["evidenceDirectness"];
  independentCorroboration: AcquisitionConfidenceVector["independentCorroboration"];
  perspectiveAdequacy: AcquisitionConfidenceVector["perspectiveAdequacy"];
  conflictStatus: AcquisitionConfidenceVector["conflictStatus"];
  coverageCompleteness: AcquisitionConfidenceVector["coverageCompleteness"];
  temporalPrecision: AcquisitionConfidenceVector["temporalPrecision"];
  provenanceIntegrity: AcquisitionConfidenceVector["provenanceIntegrity"];
  reasonCodes: string[];
}): AcquisitionConfidenceVector {
  const { context: inputContext, ...values } = input;
  const dimensions = [values.authorityApplicability, values.evidenceDirectness, values.independentCorroboration, values.perspectiveAdequacy, values.conflictStatus, values.coverageCompleteness, values.temporalPrecision, values.provenanceIntegrity];
  const verdict: AcquisitionConfidenceVector["verdict"] = dimensions.includes("FAIL") ? "FAIL" : dimensions.includes("REVIEW_REQUIRED") ? "REVIEW_REQUIRED" : dimensions.includes("QUALIFIED") ? "QUALIFIED" : "PASS";
  const semantic = { ...values, reasonCodes: uniqueSorted(values.reasonCodes), verdict };
  const context = { ...inputContext, policyVersion: AUTHORITY_FIRST_POLICY_VERSION };
  const confidenceVectorId = semanticArtifactId("acquisition-confidence", context, semantic);
  return parseSealedArtifact(acquisitionConfidenceVectorSchema, { ...semanticEnvelope(context, confidenceVectorId, input.topicAuthoritySetId), confidenceVectorId, ...semantic });
}

export function authorizeEscalation(input: {
  context: ArtifactContext;
  set: TopicAuthoritySet;
  researchQuestionIds: string[];
  gapIds: string[];
  reason: "MATERIAL_COVERAGE_GAP" | "PERSPECTIVE_GAP" | "UNRESOLVED_CONFLICT" | "AUTHORITY_INACCESSIBLE" | "MISSING_INDEPENDENT_CORROBORATION";
  mappedAuthorityOperationsAttempted: number;
  gapOperationsConsumed: number;
  allowedPurpose: string;
}) {
  if (input.mappedAuthorityOperationsAttempted < 1) throw new Error("ESCALATION_REQUIRES_MAPPED_AUTHORITY_ATTEMPT");
  const remainingGapOperations = DEFAULT_CONTROLLED_RESEARCH_BUDGET.maximumGapRepairOperations - input.gapOperationsConsumed;
  if (remainingGapOperations < 1) throw new Error("CONTROLLED_OPERATION_BUDGET_EXHAUSTED");
  const semantic = { topicAuthoritySetId: input.set.topicAuthoritySetId, researchQuestionIds: uniqueSorted(input.researchQuestionIds), gapIds: uniqueSorted(input.gapIds), reason: input.reason, mappedAuthorityOperationsAttempted: input.mappedAuthorityOperationsAttempted, remainingGapOperations, allowedPurpose: input.allowedPurpose.normalize("NFKC").trim(), state: "AUTHORIZED" as const };
  const context = { ...input.context, policyVersion: AUTHORITY_FIRST_POLICY_VERSION };
  const escalationDecisionId = semanticArtifactId("authority-escalation", context, semantic);
  return parseSealedArtifact(escalationDecisionSchema, { ...semanticEnvelope(context, escalationDecisionId, input.set.topicAuthoritySetId), escalationDecisionId, ...semantic });
}
