const sharedContract = `
Return one compact JSON object only.
Required top-level keys: summary, confidence, boundary, sources, evidence, candidates.
confidence must be a number such as 0.82, never "high", "medium", or text.
boundary must be {"factoryOwned":true,"publicationAllowed":false,"governanceSubmissionAllowed":false}.
sources must be non-empty: [{"sourceId":"source_1","title":"...","url":"..."}].
evidence must be non-empty and use citations, not evidence_refs: [{"claim":"...","citations":[{"sourceId":"source_1","evidenceRecordId":"evidence_record_uuid","title":"...","url":"..."}]}].
Each candidate must include title, objectType, payload, evidence, sources.
For every candidate_source payload include sourceId, title, url, publisher, credibility, citationNote, and evidenceSourceRefs.
candidate_source publisher must never be empty. If exact publisher is unknown, derive a conservative publisher from the URL host or use "Unknown publisher".
Use conservative historical claims and stable source titles/URLs only.
`;

export const factoryWorkerPromptTemplates: Record<string, string> = {
  research_worker: `
Return one compact JSON object only.
Required top-level keys: summary, confidence, boundary, claims, candidates.
confidence must be a number such as 0.82, never "high", "medium", or text.
boundary must be {"factoryOwned":true,"publicationAllowed":false,"governanceSubmissionAllowed":false}.
claims must be non-empty and use evidenceRecordIds only.
Each candidate must include title, objectType, payload, and evidenceRecordIds.
Task: Produce bounded research notes and context candidates for the requested historical topic.
Candidate object types allowed: candidate_source, candidate_context_record.
Context payload must include topic, scope, chronologyNotes, keyActors, keyPlaces, and openQuestions.
Source payload must include coveragePeriod, relevance, and sourceLimitations only when supported by the reasoning context.
Generate at least one source candidate and one context record when enough information is available.`,

  source_discovery_worker: `${sharedContract}
Task: Discover candidate sources for the requested historical topic.
Candidate object type allowed: candidate_source.
Payload must include sourceId, title, url, publisher, sourceType, credibility, citationNote, evidenceSourceRefs, coveragePeriod, relevance, and sourceLimitations.
Generate one strong source candidate unless the input explicitly requests more.`,

  source_validation_worker: `${sharedContract}
Task: Validate proposed sources and evidence claims for historical reliability.
Candidate object type allowed: candidate_source.
Payload must include sourceId, title, url, publisher, accepted, credibility, citationNote, evidenceSourceRefs, reliabilityReasons, limitations, and recommendedUse.
Only mark a source high-confidence when source quality and relevance are clear.`,

  object_extraction_worker: `${sharedContract}
Task: Extract candidate historical objects from the research context.
Candidate object type allowed: candidate_historical_object.
Payload must include name, type, summary, aliases, chronologyRole, and sourceRefs.
Generate people, institutions, places, technologies, publications, conflicts, movements, or periods only when supported by evidence.`,

  milestone_extraction_worker: `${sharedContract}
Task: Extract chronology-rich candidate milestones.
Candidate object type allowed: candidate_milestone.
Payload must include title, date, datePrecision, summary, location, chronologyPosition, and sourceRefs.
Dates must be internally consistent. Use ISO-like years or dates where possible.`,

  participation_extraction_worker: `${sharedContract}
Task: Extract candidate participations connecting historical objects to milestones.
Candidate object type allowed: candidate_participation.
Payload must include historicalObjectRef, milestoneRef, role, summary, participationPriority, and sourceRefs.`,

  relationship_extraction_worker: `${sharedContract}
Task: Extract candidate relationships between historical objects, milestones, institutions, technologies, places, or movements.
Candidate object type allowed: candidate_relationship.
Payload must include sourceAuthorityRef, targetAuthorityRef, relationshipType, summary, directionality, and sourceRefs.
Allowed relationship types: influences, influenced_by, member_of, contains, located_in, succeeds, preceded_by, owns, owned_by, related_to.`,

  context_enrichment_worker: `${sharedContract}
Task: Produce candidate context records that explain historical significance without creating public authority.
Candidate object type allowed: candidate_context_record.
Payload must include contextType, summary, chronologyScope, relatedCandidateRefs, and sourceRefs.`,

  package_assembly_worker: `${sharedContract}
Task: Assemble a Factory-only package summary from prior artifacts.
This worker produces a package assembly artifact, not a new Factory authority candidate.
candidates must be exactly [].
Never invent package, package_summary, factory_candidate, or any other objectType.
Keep summary under 500 characters and state material evidence gaps, source gaps, and publication blockers there.
Use no more than three concise top-level evidence claims and three concise top-level sources.`,

  validation_worker: `${sharedContract}
Task: Validate Factory candidates for evidence sufficiency, source attribution, chronology consistency, relationship consistency, and object identity consistency.
This worker produces a validation artifact, not a new Factory authority candidate.
candidates must be exactly [].
Never invent validation_candidate, factory_candidate, or any other objectType.
Keep summary under 500 characters and state validation outcome, blockers, warnings, and confidence recommendation there.
Use no more than three concise top-level evidence claims and three concise top-level sources.`
};

export function getFactoryWorkerPromptTemplate(workerKey: string): string {
  return factoryWorkerPromptTemplates[workerKey] || sharedContract;
}
