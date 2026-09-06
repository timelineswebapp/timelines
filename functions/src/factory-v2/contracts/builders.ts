import { z } from "zod";
import { attachPayloadHash, contentAddressedId, deterministicUuid, payloadHash, sha256 } from "../hashing";
import {
  V2_POLICY_VERSION,
  V2_SCHEMA_VERSION,
  type HistoricalDate
} from "./common";
import {
  atomicClaimVersionSchema,
  canonicalEntityVersionSchema,
  canonicalEventVersionSchema,
  claimEvidenceEdgeSchema,
  evidenceSegmentSchema,
  queryPlanSchema,
  researchMapSchema,
  scopeContractSchema,
  type AtomicClaimVersion,
  type CanonicalEntityVersion,
  type CanonicalEventVersion,
  type ClaimEvidenceEdge,
  type EvidenceSegment,
  type QueryPlan,
  type ResearchMap,
  type ScopeContract
} from "./knowledge";

export type ArtifactContext = {
  corpusId: string;
  topicId: string;
  runId: string;
  generation: number;
  createdAt: string;
  policyVersion?: string;
};

export function immutableEnvelope(context: ArtifactContext, artifactId: string, model: Record<string, unknown> | null = null) {
  return {
    artifactId,
    schemaVersion: V2_SCHEMA_VERSION as typeof V2_SCHEMA_VERSION,
    policyVersion: context.policyVersion || V2_POLICY_VERSION,
    promptVersion: model && typeof model.promptVersion === "string" ? model.promptVersion : null,
    modelExecutionRef: model,
    parentArtifactId: null,
    createdAt: context.createdAt,
    corpusId: context.corpusId,
    topicId: context.topicId,
    runId: context.runId,
    generation: context.generation,
    executionMode: "SHADOW" as const,
    publicationEligible: false as const,
    governanceSubmissionAllowed: false as const,
    immutable: true as const
  };
}

/** Build a provenance-neutral semantic version envelope. A retry or a new run
 * cannot change this payload; the originating execution remains independently
 * persisted and may be linked by an audit record. */
export function semanticEnvelope(context: ArtifactContext, artifactId: string, parentArtifactId: string | null = null) {
  return {
    artifactId,
    schemaVersion: V2_SCHEMA_VERSION as typeof V2_SCHEMA_VERSION,
    policyVersion: context.policyVersion || V2_POLICY_VERSION,
    promptVersion: null,
    modelExecutionRef: null,
    parentArtifactId,
    createdAt: null,
    corpusId: context.corpusId,
    topicId: context.topicId,
    runId: null,
    generation: context.generation,
    executionMode: "SHADOW" as const,
    publicationEligible: false as const,
    governanceSubmissionAllowed: false as const,
    immutable: true as const
  };
}

/** Semantic version identity contains every meaning-bearing construction
 * determinant and excludes run/time/retry/model-execution provenance. */
export function semanticArtifactId(
  prefix: string,
  context: ArtifactContext,
  semanticPayload: unknown,
  contract: { schemaVersion?: string; policyVersion?: string } = {}
): string {
  return contentAddressedId(prefix, {
    schemaVersion: contract.schemaVersion || V2_SCHEMA_VERSION,
    policyVersion: contract.policyVersion || context.policyVersion || V2_POLICY_VERSION,
    corpusId: context.corpusId,
    topicId: context.topicId,
    generation: context.generation,
    semanticPayload
  });
}

function factorySemanticContext(context: ArtifactContext): ArtifactContext {
  return { ...context, policyVersion: V2_POLICY_VERSION };
}

/** Address an immutable execution observation by the exact variable payload it
 * persists. A changed run, timestamp, attempt, latency, or result therefore
 * receives a new ID; replaying the exact observation remains idempotent. */
export function executionArtifactId(prefix: string, context: ArtifactContext, payload: Record<string, unknown>): string {
  return contentAddressedId(prefix, {
    schemaVersion: V2_SCHEMA_VERSION,
    policyVersion: context.policyVersion || V2_POLICY_VERSION,
    corpusId: context.corpusId,
    topicId: context.topicId,
    runId: context.runId,
    generation: context.generation,
    createdAt: context.createdAt,
    executionMode: "SHADOW",
    publicationEligible: false,
    governanceSubmissionAllowed: false,
    immutable: true,
    payload
  });
}

export function sealArtifact<T extends Record<string, unknown>>(artifact: T): T & { payloadHash: string } {
  return attachPayloadHash(artifact);
}

/** Normalize with the authoritative schema, then hash and validate the exact
 * representation that will be persisted. The first hash is only a schema
 * placeholder because immutable envelope schemas require the field. */
export function parseSealedArtifact<T>(schema: z.ZodType<T>, artifact: Record<string, unknown>): T {
  const normalized = schema.parse(sealArtifact(artifact));
  if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) throw new Error("Immutable artifact schemas must produce objects.");
  return schema.parse(sealArtifact(normalized as Record<string, unknown>));
}

export function buildScopeContract(context: ArtifactContext, payload: Omit<ScopeContract, keyof ReturnType<typeof immutableEnvelope> | "artifactId" | "payloadHash" | "scopeContractId">, model: Record<string, unknown> | null = null): ScopeContract {
  void model;
  const scopeContractId = semanticArtifactId("scope", context, payload);
  return parseSealedArtifact(scopeContractSchema, { ...semanticEnvelope(context, scopeContractId), ...payload, scopeContractId });
}

export function assertScopeBinding(scope: ScopeContract, downstream: { scopeContractId: string; scopePayloadHash?: string }): void {
  if (downstream.scopeContractId !== scope.scopeContractId) throw new Error("Downstream artifact does not reference the locked Scope Contract.");
  if (downstream.scopePayloadHash !== undefined && downstream.scopePayloadHash !== scope.payloadHash) throw new Error("Downstream artifact attempts to reinterpret the locked Scope Contract payload.");
}

export function buildResearchMap(context: ArtifactContext, scope: ScopeContract, payload: Omit<ResearchMap, keyof ReturnType<typeof immutableEnvelope> | "artifactId" | "payloadHash" | "researchMapId" | "scopeContractId" | "scopePayloadHash">, model: Record<string, unknown> | null = null): ResearchMap {
  void model;
  const researchMapId = semanticArtifactId("research-map", context, { scopeContractId: scope.scopeContractId, scopePayloadHash: scope.payloadHash, payload });
  const map = parseSealedArtifact(researchMapSchema, { ...semanticEnvelope(context, researchMapId), ...payload, researchMapId, scopeContractId: scope.scopeContractId, scopePayloadHash: scope.payloadHash });
  assertScopeBinding(scope, map);
  return map;
}

export function normalizeProviderQuery(value: string): string {
  return Array.from(new Set(value.normalize("NFKC").trim().replace(/\s+/gu, " ").split(" "))).join(" ");
}

export function deduplicateQueries<T extends { providerQuery: string }>(queries: readonly T[]): T[] {
  const seen = new Set<string>();
  return queries.flatMap((query) => {
    const providerQuery = normalizeProviderQuery(query.providerQuery);
    const key = providerQuery.toLocaleLowerCase("en-US");
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...query, providerQuery }];
  });
}

export function buildQueryPlan(context: ArtifactContext, scope: ScopeContract, map: ResearchMap, payload: Omit<QueryPlan, keyof ReturnType<typeof immutableEnvelope> | "artifactId" | "payloadHash" | "queryPlanId" | "researchMapId" | "scopeContractId">, model: Record<string, unknown> | null = null): QueryPlan {
  assertScopeBinding(scope, map);
  const prepared = { ...payload, queries: deduplicateQueries(payload.queries) };
  void model;
  const queryPlanId = semanticArtifactId("query-plan", context, { researchMapId: map.researchMapId, scopeContractId: scope.scopeContractId, payload: prepared });
  return parseSealedArtifact(queryPlanSchema, { ...semanticEnvelope(context, queryPlanId, map.researchMapId), ...prepared, queryPlanId, researchMapId: map.researchMapId, scopeContractId: scope.scopeContractId });
}

export function buildEvidenceSegment(context: ArtifactContext, payload: Omit<EvidenceSegment, keyof ReturnType<typeof immutableEnvelope> | "artifactId" | "payloadHash" | "evidenceSegmentId" | "segmentHash">): EvidenceSegment {
  const semanticContext = factorySemanticContext(context);
  const segmentHash = sha256(`${payload.sourceSnapshotId}\n${payload.segmentType}\n${payload.exactText}\n${payload.startOffset ?? ""}\n${payload.endOffset ?? ""}\n${payload.page ?? ""}\n${payload.section ?? ""}`);
  const evidenceSegmentId = semanticArtifactId("segment", semanticContext, { ...payload, segmentHash });
  return parseSealedArtifact(evidenceSegmentSchema, { ...semanticEnvelope(semanticContext, evidenceSegmentId, payload.sourceSnapshotId), ...payload, evidenceSegmentId, segmentHash });
}

const sentenceBoundaryPattern = /[.!?]+\s+/gu;

export function atomicityFindings(assertion: string): string[] {
  const findings: string[] = [];
  if ((assertion.match(sentenceBoundaryPattern) || []).length > 0) findings.push("MULTIPLE_SENTENCES");
  const claimModes = [
    /\b(?:launched|occurred|began|ended|signed|opened|closed)\b/iu,
    /\b(?:caused|led to|resulted in|transformed|influenced)\b/iu,
    /\b(?:was born|was founded|is located|was known as)\b/iu,
    /\b(?:\d[\d,.]*)\s+(?:people|deaths|casualties|kilomet(?:er|re)s?|miles?|percent|%)\b/iu
  ].filter((pattern) => pattern.test(assertion)).length;
  if (claimModes > 1) findings.push("MULTIPLE_EVIDENTIARY_BURDENS");
  return findings;
}

export function buildAtomicClaimVersion(context: ArtifactContext, payload: Omit<AtomicClaimVersion, keyof ReturnType<typeof immutableEnvelope> | "artifactId" | "payloadHash" | "claimId" | "claimVersionId"> & { claimId?: string }, model: Record<string, unknown> | null = null): AtomicClaimVersion {
  const semanticContext = factorySemanticContext(context);
  const findings = atomicityFindings(payload.normalizedAssertion);
  if (findings.length > 0) throw new z.ZodError(findings.map((message) => ({ code: z.ZodIssueCode.custom, path: ["normalizedAssertion"], message })));
  const claimIdentity = {
    topicId: context.topicId,
    subject: { ...payload.subject, label: normalizedIdentityText(payload.subject.label) },
    predicate: payload.predicate,
    object: { ...payload.object, value: typeof payload.object.value === "string" ? normalizedIdentityText(payload.object.value) : payload.object.value },
    temporal: payload.temporal,
    qualifiers: payload.qualifiers.filter((item) => item.key !== "researchQuestionId").map((item) => ({ key: normalizedIdentityText(item.key), value: normalizedIdentityText(item.value) })).sort((left, right) => `${left.key}:${left.value}`.localeCompare(`${right.key}:${right.value}`)),
  };
  const claimId = payload.claimId || deterministicUuid("timelines.factory-v2.claim", claimIdentity);
  void model;
  const claimVersionId = semanticArtifactId("claim-version", semanticContext, { claimId, payload });
  return parseSealedArtifact(atomicClaimVersionSchema, { ...semanticEnvelope(semanticContext, claimVersionId, payload.scopeContractId), ...payload, claimId, claimVersionId });
}

export function buildClaimEvidenceEdge(context: ArtifactContext, payload: Omit<ClaimEvidenceEdge, keyof ReturnType<typeof immutableEnvelope> | "artifactId" | "payloadHash" | "claimEvidenceId">): ClaimEvidenceEdge {
  const semanticContext = factorySemanticContext(context);
  const claimEvidenceId = semanticArtifactId("claim-evidence", semanticContext, payload);
  return parseSealedArtifact(claimEvidenceEdgeSchema, { ...semanticEnvelope(semanticContext, claimEvidenceId, payload.claimVersionId), ...payload, claimEvidenceId });
}

export function normalizedIdentityText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

export function buildCanonicalEntityVersion(context: ArtifactContext, payload: Omit<CanonicalEntityVersion, keyof ReturnType<typeof immutableEnvelope> | "artifactId" | "payloadHash" | "entityId" | "entityVersionId"> & { entityId?: string }, model: Record<string, unknown> | null = null): CanonicalEntityVersion {
  const semanticContext = factorySemanticContext(context);
  const primaryIdentifier = [...payload.externalIdentifiers].sort((left, right) => `${left.scheme}:${left.value}`.localeCompare(`${right.scheme}:${right.value}`))[0];
  const identity = primaryIdentifier || { type: payload.entityType, name: normalizedIdentityText(payload.canonicalName), geography: [...payload.geographyKeys].sort() };
  const entityId = payload.entityId || deterministicUuid("timelines.factory-v2.entity", identity);
  void model;
  const entityVersionId = semanticArtifactId("entity-version", semanticContext, { entityId, payload });
  return parseSealedArtifact(canonicalEntityVersionSchema, { ...semanticEnvelope(semanticContext, entityVersionId, payload.supersedesEntityVersionId), ...payload, entityId, entityVersionId });
}

function dateInterval(date: HistoricalDate): { earliest: number; latest: number } {
  const startYear = date.earliestYear ?? date.year;
  const endYear = date.latestYear ?? date.year;
  const month = date.month;
  const day = date.day;
  const earliest = startYear * 10_000 + (month ?? 1) * 100 + (day ?? 1);
  const endMonth = month ?? 12;
  const endDay = day ?? new Date(Date.UTC(Math.max(1, endYear), endMonth, 0)).getUTCDate();
  return { earliest, latest: endYear * 10_000 + endMonth * 100 + endDay };
}

export function temporalIntervalsCompatible(left: HistoricalDate, right: HistoricalDate): boolean {
  const l = dateInterval(left);
  const r = dateInterval(right);
  return l.earliest <= r.latest && r.earliest <= l.latest;
}

export function eventIdentityKey(input: Pick<CanonicalEventVersion, "actionKey" | "primaryEntityKeys" | "locationKeys" | "temporal">): string {
  return payloadHash({
    actionKey: normalizedIdentityText(input.actionKey),
    primaryEntityKeys: [...input.primaryEntityKeys].sort(),
    locationKeys: [...input.locationKeys].sort(),
    temporal: { start: input.temporal.start, end: input.temporal.end }
  });
}

export function buildCanonicalEventVersion(context: ArtifactContext, payload: Omit<CanonicalEventVersion, keyof ReturnType<typeof immutableEnvelope> | "artifactId" | "payloadHash" | "candidateEventId" | "eventVersionId" | "eventIdentityKey" | "canonicalEventId"> & { candidateEventId?: string; canonicalEventId?: string | null }, model: Record<string, unknown> | null = null): CanonicalEventVersion {
  const semanticContext = factorySemanticContext(context);
  const identityInput = { actionKey: payload.actionKey, primaryEntityKeys: payload.primaryEntityKeys, locationKeys: payload.locationKeys, temporal: payload.temporal };
  const identityKey = eventIdentityKey(identityInput);
  const candidateEventId = payload.candidateEventId || deterministicUuid("timelines.factory-v2.event-candidate", { topicId: context.topicId, identityKey });
  const canonicalEventId = payload.semanticClass === "EVENT" ? (payload.canonicalEventId || deterministicUuid("timelines.factory-v2.event", identityKey)) : null;
  const { candidateEventId: _candidateEventId, canonicalEventId: _canonicalEventId, ...versionPayload } = payload;
  void model;
  const eventVersionId = semanticArtifactId("event-version", semanticContext, { candidateEventId, canonicalEventId, payload: versionPayload, identityKey });
  return parseSealedArtifact(canonicalEventVersionSchema, { ...semanticEnvelope(semanticContext, eventVersionId, payload.supersedesEventVersionId), ...payload, candidateEventId, canonicalEventId, eventVersionId, eventIdentityKey: identityKey });
}

export function sameCanonicalEvent(left: CanonicalEventVersion, right: CanonicalEventVersion): boolean {
  if (left.semanticClass !== "EVENT" || right.semanticClass !== "EVENT") return false;
  if (normalizedIdentityText(left.actionKey) !== normalizedIdentityText(right.actionKey)) return false;
  if (!temporalIntervalsCompatible(left.temporal.start, right.temporal.start)) return false;
  if (!left.primaryEntityKeys.some((entity) => right.primaryEntityKeys.includes(entity))) return false;
  if (left.locationKeys.length > 0 && right.locationKeys.length > 0 && !left.locationKeys.some((location) => right.locationKeys.includes(location))) return false;
  return true;
}
