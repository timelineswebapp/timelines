const sharedContract = `
Return one compact JSON object only.
Required top-level keys: summary, confidence, boundary, sources, evidence, candidates.
boundary must be {"factoryOwned":true,"publicationAllowed":false,"governanceSubmissionAllowed":false}.
confidence must be numeric from 0 through 1.
sources and evidence must be non-empty and use citations, not evidence_refs.
Each candidate must include title, objectType, payload, evidence, sources.
candidate_source payload requires sourceId, title, url, publisher, credibility, citationNote, evidenceSourceRefs.
Use conservative historical claims and stable source titles/URLs only.
`;

const extractionContract = `
Return one compact JSON object only.
Required top-level keys: summary, confidence, boundary, candidates.
confidence must be a number from 0 through 1.
boundary must be {"factoryOwned":true,"publicationAllowed":false,"governanceSubmissionAllowed":false}.
Each candidate must include title, objectType, payload, and evidenceRecordIds.
Copy only supplied evidenceRecordIds. Never invent provenance, source IDs, URLs, publishers, citations, or metadata.
If evidence is insufficient, return candidates as exactly [].
`;

export const factoryWorkerPromptTemplates: Record<string, string> = {
  research_worker: `
Return one compact JSON object only.
Required top-level keys: summary, confidence, boundary, claims, candidates.
confidence must be numeric from 0 through 1.
boundary must be {"factoryOwned":true,"publicationAllowed":false,"governanceSubmissionAllowed":false}.
claims must be non-empty and use evidenceRecordIds only.
Each candidate must include title, objectType, payload, and evidenceRecordIds.
Emit at most three concise claims. Each claim may cite at most three evidenceRecordIds.
Emit at most two candidates total: one candidate_source and one candidate_context_record.
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
Supported four-digit year is a complete date: copy the year and set datePrecision to "year".
An event name containing a four-digit year is explicit chronology; for example, evidence saying "1918 Spanish flu pandemic" supports date "1918" and title "1918 Spanish flu pandemic".
Evidence saying "the most recent one being the 2009 flu pandemic" supports date "2009" and title "2009 flu pandemic".
Do not require a separate "date:" field when the event name itself contains a four-digit year.
Title, summary, location, and chronologyPosition must be directly evidence-grounded. Omit unsupported optional fields.
Treat each independently described historical event as a separate milestone candidate.
For broad historical topics, publication dates of books, articles, papers, studies, games, films, songs, datasets, or web pages are not historical milestones.
Do not emit a publication-date milestone unless the requested subject is that exact publication/work.
Claims containing "publication date:" are insufficient milestone evidence for broad historical topics.
Use the claim citation evidenceRecordId in evidenceRecordIds; do not use source IDs or candidate object IDs as evidenceRecordIds.
Apply date consistency within each event only; do not require dates from different events to reconcile.
Later publications, commentary, photographs, preservation records, or retrospective material do not invalidate an independently dated event.
Emit a candidate only when one or more supplied evidence records directly support that candidate's event and explicit date.
A single validated evidence record that directly supports the event and date is sufficient; never require corroboration.
If supplied evidence gives conflicting dates for the same event and does not resolve the conflict, emit no candidate for that event.
Use ISO-like years/dates exactly as supplied. Never infer chronology, events, titles, descriptions, or significance.
If the evidence does not support a complete milestone and explicit date, return candidates as exactly [] and state the grounding gap in summary.`,

  participation_extraction_worker: `${extractionContract}
Task: Extract candidate participations connecting historical objects to milestones.
Candidate object type allowed: candidate_participation.
Payload must include historicalObjectRef, milestoneRef, role, summary, and participationPriority.
Emit at most three participation candidates.
Use at most two evidenceRecordIds per candidate.`,

  relationship_extraction_worker: `${extractionContract}
Task: Extract candidate relationships between historical objects, milestones, institutions, technologies, places, or movements.
Candidate object type allowed: candidate_relationship.
Payload must include sourceAuthorityRef, targetAuthorityRef, relationshipType, summary, and directionality.
Allowed relationship types: influences, influenced_by, member_of, contains, located_in, succeeds, preceded_by, owns, owned_by, related_to.
Emit at most two relationship candidates.
Use at most two evidenceRecordIds per candidate.`,

  context_enrichment_worker: `${extractionContract}
Task: Produce candidate context records that explain historical significance without creating public authority.
Candidate object type allowed: candidate_context_record.
Payload must include contextType, summary, chronologyScope, and relatedCandidateRefs.
Emit at most one context candidate.
Use at most three unique evidenceRecordIds for that candidate. Never repeat an evidenceRecordId.`,

  package_assembly_worker: `${sharedContract}
Task: Assemble a Factory-only package summary from prior artifacts.
This worker produces a package assembly artifact, not a new Factory authority candidate.
candidates must be exactly [].
Never invent package, package_summary, factory_candidate, or any other objectType.
Keep summary under 500 characters and state material evidence gaps, source gaps, and publication blockers there.
Return exactly one top-level evidence claim and exactly one top-level source.
The single evidence claim must summarize package readiness in one sentence and include exactly one citation copied from input.
The single source must be copied from that same citation.
Do not enumerate milestones, validated evidence records, source records, quotes, or citations.
Never include more than one citation anywhere in the output.`,

  validation_worker: `${sharedContract}
Task: Validate Factory candidates for evidence sufficiency, source attribution, chronology consistency, relationship consistency, and object identity consistency.
This worker produces a validation artifact, not a new Factory authority candidate.
candidates must be exactly [].
Never invent validation_candidate, factory_candidate, or any other objectType.
Keep summary under 500 characters and state validation outcome, blockers, warnings, and confidence recommendation there.
Use no more than two concise top-level evidence claims and two concise top-level sources.
Each evidence claim must have at most one citation.
Every citation sourceId must be copied exactly from an input sourceId value.
Never use evidence:// URIs, validation IDs, evidenceRecordIds, URLs, or synthetic IDs as sourceId.
Do not invent example.com URLs or synthetic source titles.`
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
