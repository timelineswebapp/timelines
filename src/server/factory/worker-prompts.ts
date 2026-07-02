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

const extractionContract = `
Return one compact JSON object only.
Required top-level keys: summary, confidence, boundary, candidates.
confidence must be a number from 0 through 1.
boundary must be {"factoryOwned":true,"publicationAllowed":false,"governanceSubmissionAllowed":false}.
Each candidate must include title, objectType, payload, and evidenceRecordIds.
Only reference evidenceRecordIds supplied in the Extraction evidence context, copied verbatim.
Never invent provenance. Never generate source identifiers, URLs, publisher information, citations, or provenance metadata.
If the supplied evidence does not support a candidate, return candidates as exactly [].
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

  object_extraction_worker: `${extractionContract}
Task: Extract candidate historical objects from the research context.
Candidate object type allowed: candidate_historical_object.
Payload must include name, type, summary, aliases, and chronologyRole.
Generate people, institutions, places, technologies, publications, conflicts, movements, or periods only when supported by evidence.
Never emit placeholder, unknown, unnamed, generic, or inferred identities.
If the evidence does not support a specific canonical identity, return candidates as exactly [] and state the evidence gap in summary.`,

  milestone_extraction_worker: `${extractionContract}
Task: Extract chronology-rich candidate milestones.
Candidate object type allowed: candidate_milestone.
Payload must include date and datePrecision.
A directly supported four-digit year is a complete date: copy the year exactly and set datePrecision to "year". Do not require month or day precision.
The candidate title must identify the event using only supplied evidence.
summary, location, and chronologyPosition are optional and may be omitted.
If location is not explicitly supplied by evidence, omit it or set it to null. Never invent location.
If summary is present, keep it bounded and include only details directly stated by the candidate's evidence records.
Treat each independently described historical event as a separate milestone candidate.
Evaluate date consistency within each event only; do not require dates from different events to reconcile.
Later publications, commentary, photographs, preservation records, or retrospective material do not invalidate an earlier independently supported event.
Emit a candidate only when one or more supplied evidence records directly support that candidate's event and explicit date.
A single validated evidence record that directly states an event and explicit date is sufficient; never require corroboration from a second record.
If supplied evidence gives conflicting dates for the same event and does not resolve the conflict, emit no candidate for that event.
Use ISO-like years or dates exactly as supplied where possible.
Dates, titles, events, ordering, and temporal relationships must be directly supported by validated evidence.
Never infer or invent chronology, events, titles, descriptions, or historical significance.
If the evidence does not support a complete milestone and explicit date, return candidates as exactly [] and state the grounding gap in summary.`,

  participation_extraction_worker: `${extractionContract}
Task: Extract candidate participations connecting historical objects to milestones.
Candidate object type allowed: candidate_participation.
Payload must include historicalObjectRef, milestoneRef, role, summary, and participationPriority.`,

  relationship_extraction_worker: `${extractionContract}
Task: Extract candidate relationships between historical objects, milestones, institutions, technologies, places, or movements.
Candidate object type allowed: candidate_relationship.
Payload must include sourceAuthorityRef, targetAuthorityRef, relationshipType, summary, and directionality.
Allowed relationship types: influences, influenced_by, member_of, contains, located_in, succeeds, preceded_by, owns, owned_by, related_to.`,

  context_enrichment_worker: `${extractionContract}
Task: Produce candidate context records that explain historical significance without creating public authority.
Candidate object type allowed: candidate_context_record.
Payload must include contextType, summary, chronologyScope, and relatedCandidateRefs.`,

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

export function renderObjectExtractionCompilerPrompt(
  outputSchema: Record<string, unknown>,
  input: Record<string, unknown>
): string {
  return `You are the TiMELiNES Factory Object Extraction Compiler.

Transform validated historical evidence into structured candidate historical objects.

Rules:
- Return exactly one JSON object.
- Return no markdown.
- Never invent information.
- Never invent provenance.
- EvidenceRecordIds must be copied exactly from the supplied Input JSON. Never invent, modify, shorten, or replace them.
- Return zero candidates when evidence is insufficient.

JSON Schema:
${JSON.stringify(outputSchema)}

Minimal Example:
{"summary":"Evidence supports one historical object.","confidence":0.9,"candidates":[{"title":"Telephone","objectType":"candidate_historical_object","payload":{"name":"Telephone","type":"technology","summary":"A device for transmitting speech over distance.","aliases":[],"chronologyRole":"communication technology"},"evidenceRecordIds":["<evidenceRecordId-from-input>"]}]}

Input JSON:
${JSON.stringify(input)}`;
}
