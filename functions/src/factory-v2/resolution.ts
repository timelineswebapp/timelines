import type { CanonicalEntityVersion, CanonicalEventVersion, EntityAlias, ScopeContract } from "./contracts";
import { normalizedIdentityText, sameCanonicalEvent } from "./contracts/builders";
import { contentAddressedId } from "./hashing";

export type EntityResolutionResult =
  | { state: "REUSED"; entityId: string; entityVersionId: string; basis: "EXTERNAL_ID" | "ALIAS" | "CANONICAL_NAME_GEOGRAPHY" }
  | { state: "NEW_CANDIDATE"; entityId: null; entityVersionId: null; basis: "NO_MATCH" }
  | { state: "REVIEW_REQUIRED"; entityId: null; entityVersionId: null; basis: "AMBIGUOUS_MATCH"; candidateVersionIds: string[] };

export function resolveEntityCandidate(input: {
  candidate: Pick<CanonicalEntityVersion, "entityType" | "canonicalName" | "language" | "externalIdentifiers" | "geographyKeys">;
  existing: CanonicalEntityVersion[];
  aliases: EntityAlias[];
}): EntityResolutionResult {
  if (input.existing.length > 20) throw new Error("Entity resolution candidate set exceeds the bounded maximum of 20.");
  const typed = input.existing.filter((entity) => entity.entityType === input.candidate.entityType);
  const externalKeys = new Set(input.candidate.externalIdentifiers.map((item) => `${normalizedIdentityText(item.scheme)}:${normalizedIdentityText(item.value)}`));
  const externalMatches = typed.filter((entity) => entity.externalIdentifiers.some((item) => externalKeys.has(`${normalizedIdentityText(item.scheme)}:${normalizedIdentityText(item.value)}`)));
  if (externalMatches.length === 1) return { state: "REUSED", entityId: externalMatches[0]!.entityId, entityVersionId: externalMatches[0]!.entityVersionId, basis: "EXTERNAL_ID" };
  if (externalMatches.length > 1) return { state: "REVIEW_REQUIRED", entityId: null, entityVersionId: null, basis: "AMBIGUOUS_MATCH", candidateVersionIds: externalMatches.map((item) => item.entityVersionId).sort() };

  const nameKey = normalizedIdentityText(input.candidate.canonicalName);
  const aliasEntityIds = new Set(input.aliases.filter((alias) => alias.entityType === input.candidate.entityType && alias.language === input.candidate.language && alias.aliasKey === nameKey).map((alias) => alias.entityId));
  const aliasMatches = typed.filter((entity) => aliasEntityIds.has(entity.entityId));
  if (aliasMatches.length === 1) return { state: "REUSED", entityId: aliasMatches[0]!.entityId, entityVersionId: aliasMatches[0]!.entityVersionId, basis: "ALIAS" };
  if (aliasMatches.length > 1) return { state: "REVIEW_REQUIRED", entityId: null, entityVersionId: null, basis: "AMBIGUOUS_MATCH", candidateVersionIds: aliasMatches.map((item) => item.entityVersionId).sort() };

  const nameMatches = typed.filter((entity) => normalizedIdentityText(entity.canonicalName) === nameKey);
  const geographyMatches = nameMatches.filter((entity) => input.candidate.geographyKeys.length === 0 || entity.geographyKeys.some((key) => input.candidate.geographyKeys.includes(key)));
  if (geographyMatches.length === 1) return { state: "REUSED", entityId: geographyMatches[0]!.entityId, entityVersionId: geographyMatches[0]!.entityVersionId, basis: "CANONICAL_NAME_GEOGRAPHY" };
  if (nameMatches.length > 0) return { state: "REVIEW_REQUIRED", entityId: null, entityVersionId: null, basis: "AMBIGUOUS_MATCH", candidateVersionIds: nameMatches.map((item) => item.entityVersionId).sort() };
  return { state: "NEW_CANDIDATE", entityId: null, entityVersionId: null, basis: "NO_MATCH" };
}

export type EventResolutionResult =
  | { state: "REUSED"; canonicalEventId: string; eventVersionId: string; basis: "EXACT_IDENTITY_KEY" }
  | { state: "NEW_CANDIDATE"; canonicalEventId: string; eventVersionId: string; basis: "DISTINCT_EVENT" }
  | { state: "REVIEW_REQUIRED"; canonicalEventId: null; eventVersionId: null; basis: "POTENTIAL_MATCH"; candidateVersionIds: string[] }
  | { state: "NON_EVENT_PRESERVED"; canonicalEventId: null; eventVersionId: string; basis: "SEMANTICALLY_INELIGIBLE" };

export function resolveEventCandidate(candidate: CanonicalEventVersion, existing: CanonicalEventVersion[]): EventResolutionResult {
  if (existing.length > 50) throw new Error("Event resolution candidate set exceeds the bounded maximum of 50.");
  if (candidate.semanticClass !== "EVENT") return { state: "NON_EVENT_PRESERVED", canonicalEventId: null, eventVersionId: candidate.eventVersionId, basis: "SEMANTICALLY_INELIGIBLE" };
  const exact = existing.filter((event) => event.semanticClass === "EVENT" && event.eventIdentityKey === candidate.eventIdentityKey && event.canonicalEventId !== null);
  if (exact.length === 1) return { state: "REUSED", canonicalEventId: exact[0]!.canonicalEventId!, eventVersionId: exact[0]!.eventVersionId, basis: "EXACT_IDENTITY_KEY" };
  if (exact.length > 1) return { state: "REVIEW_REQUIRED", canonicalEventId: null, eventVersionId: null, basis: "POTENTIAL_MATCH", candidateVersionIds: exact.map((event) => event.eventVersionId).sort() };
  const possible = existing.filter((event) => sameCanonicalEvent(candidate, event));
  if (possible.length > 0) return { state: "REVIEW_REQUIRED", canonicalEventId: null, eventVersionId: null, basis: "POTENTIAL_MATCH", candidateVersionIds: possible.map((event) => event.eventVersionId).sort() };
  return { state: "NEW_CANDIDATE", canonicalEventId: candidate.canonicalEventId!, eventVersionId: candidate.eventVersionId, basis: "DISTINCT_EVENT" };
}

function dateOrdinal(date: ScopeContract["chronologyStart"]): { start: number; end: number } {
  const firstYear = date.earliestYear ?? date.year;
  const lastYear = date.latestYear ?? date.year;
  const month = date.month;
  const day = date.day;
  const start = firstYear * 10_000 + (month ?? 1) * 100 + (day ?? 1);
  const endMonth = month ?? 12;
  const endDay = day ?? new Date(Date.UTC(Math.max(lastYear, 1), endMonth, 0)).getUTCDate();
  return { start, end: lastYear * 10_000 + endMonth * 100 + endDay };
}

export function eventWithinLockedScope(scope: ScopeContract, event: CanonicalEventVersion): boolean {
  if (event.semanticClass !== "EVENT") return false;
  const eventStart = dateOrdinal(event.temporal.start);
  const eventEnd = event.temporal.end ? dateOrdinal(event.temporal.end) : eventStart;
  const scopeStart = dateOrdinal(scope.chronologyStart);
  const scopeEnd = scope.chronologyEnd ? dateOrdinal(scope.chronologyEnd) : null;
  if (eventStart.start < scopeStart.start) return false;
  if (scopeEnd && eventEnd.end > scopeEnd.end) return false;
  return true;
}

export type EventMergeSplitDecision = {
  decisionId: string;
  kind: "MERGE" | "SPLIT" | "DISTINCT";
  sourceEventVersionIds: string[];
  resultingEventVersionIds: string[];
  reason: string;
  destructive: false;
};

export function createEventMergeSplitDecision(input: Omit<EventMergeSplitDecision, "decisionId" | "destructive">): EventMergeSplitDecision {
  if (input.sourceEventVersionIds.length === 0 || input.resultingEventVersionIds.length === 0) throw new Error("Merge/split decisions require source and resulting immutable versions.");
  if (input.kind === "MERGE" && input.sourceEventVersionIds.length < 2) throw new Error("MERGE requires at least two source event versions.");
  if (input.kind === "SPLIT" && input.resultingEventVersionIds.length < 2) throw new Error("SPLIT requires at least two result event versions.");
  const value = { ...input, sourceEventVersionIds: [...new Set(input.sourceEventVersionIds)].sort(), resultingEventVersionIds: [...new Set(input.resultingEventVersionIds)].sort(), destructive: false as const };
  return { decisionId: contentAddressedId("event-decision", value), ...value };
}

export function classifyKnowledgeReuse(input: { admitted: boolean; immutableHistorical: boolean; evidencePreserved: boolean; higherRiskUse: boolean; newConflict: boolean; ongoing: boolean }): "REUSE_DIRECTLY" | "REVALIDATE" {
  if (!input.admitted || !input.immutableHistorical || !input.evidencePreserved || input.higherRiskUse || input.newConflict || input.ongoing) return "REVALIDATE";
  return "REUSE_DIRECTLY";
}
