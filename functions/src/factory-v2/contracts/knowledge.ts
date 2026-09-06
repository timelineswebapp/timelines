import { z } from "zod";
import {
  boundedText,
  executionEnvelopeFields,
  hashSchema,
  historicalDateSchema,
  httpsUrlSchema,
  idSchema,
  immutableEnvelopeFields,
  languageSchema,
  modelExecutionRefSchema
} from "./common";

const unique = <T>(values: T[]) => new Set(values).size === values.length;
const stringList = (min: number, max: number, itemMax = 500) => z.array(boundedText(1, itemMax)).min(min).max(max).refine(unique, "Values must be unique.");

export const topicClassSchema = z.enum(["CLOSED_EPISODE", "ONGOING_SUBJECT", "BIOGRAPHY", "INSTITUTION", "LONG_DURATION"]);
export const entityTypeSchema = z.enum(["Person", "Institution", "Place", "Technology", "Publication", "Conflict", "Movement", "Period"]);
export const claimTypeSchema = z.enum(["OCCURRENCE", "DATE", "IDENTITY", "LOCATION", "QUANTITY", "INSTITUTIONAL_ACTION", "RELATIONSHIP", "ATTRIBUTION", "QUOTATION", "CAUSATION", "INTERPRETATION", "CONSEQUENCE"]);
export const claimRiskSchema = z.enum(["ROUTINE", "MATERIAL", "INTERPRETIVE", "CONTESTED", "SENSITIVE"]);
export const semanticClassSchema = z.enum(["EVENT", "STATE_LEGACY", "CONTEXT", "FUTURE"]);
export const sourceClassSchema = z.enum(["PRIMARY_INSTITUTIONAL", "SCHOLARLY_SECONDARY", "EDITED_REFERENCE", "ESTABLISHED_JOURNALISM", "SPECIALIST", "GENERAL_WEB", "WIKIPEDIA", "OTHER"]);

export const entityRefSchema = z.object({
  entityId: idSchema.nullable(),
  name: boundedText(1, 240),
  type: entityTypeSchema,
  language: languageSchema
}).strict();

export const researchBudgetSchema = z.object({
  maximumGroundingCalls: z.number().int().min(0).max(7),
  maximumProviderQueries: z.number().int().min(0).max(40),
  maximumSourceDocuments: z.number().int().min(1).max(60),
  maximumAtomicClaims: z.number().int().min(1).max(300),
  maximumSemanticRepairs: z.number().int().min(0).max(2),
  maximumTransportAttemptsPerCall: z.number().int().min(1).max(3),
  maximumConcurrency: z.number().int().min(1).max(3),
  maximumWorkerSeconds: z.number().int().min(60).max(1200)
}).strict();

export const scopeContractSchema = z.object({
  ...immutableEnvelopeFields,
  scopeContractId: idSchema,
  version: z.number().int().positive(),
  status: z.literal("LOCKED"),
  title: boundedText(3, 200),
  language: languageSchema,
  topicClass: topicClassSchema,
  subjectDefinition: boundedText(20, 2000),
  includedQuestions: stringList(1, 40),
  excludedQuestions: stringList(1, 40),
  chronologyStart: historicalDateSchema,
  chronologyEnd: historicalDateSchema.nullable(),
  ongoingAsOf: z.string().date().nullable(),
  contextBefore: historicalDateSchema.nullable(),
  contextAfter: historicalDateSchema.nullable(),
  precursorRule: boundedText(5, 800),
  aftermathRule: boundedText(5, 800),
  spatialScope: z.object({ included: stringList(1, 30, 240), excluded: stringList(0, 30, 240), boundaryRule: boundedText(5, 800) }).strict(),
  centralEntities: z.array(entityRefSchema).min(1).max(40),
  requiredDimensions: stringList(1, 20, 120),
  expectedPhases: stringList(1, 24, 160),
  granularity: z.enum(["OVERVIEW", "STANDARD", "DETAILED"]),
  explicitExclusions: stringList(1, 40),
  uncertainties: stringList(0, 30),
  researchBudget: researchBudgetSchema,
  approvedByPolicy: boundedText(3, 160)
}).strict().superRefine((scope, context) => {
  if (scope.topicClass === "ONGOING_SUBJECT" && scope.ongoingAsOf === null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["ongoingAsOf"], message: "Ongoing subjects require ongoingAsOf." });
  if (scope.topicClass !== "ONGOING_SUBJECT" && scope.ongoingAsOf !== null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["ongoingAsOf"], message: "Only ongoing subjects may set ongoingAsOf." });
  if (scope.topicClass === "CLOSED_EPISODE" && scope.chronologyEnd === null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["chronologyEnd"], message: "Closed episodes require an end boundary." });
});

export const scopeAmendmentProposalSchema = z.object({
  ...immutableEnvelopeFields,
  scopeAmendmentProposalId: idSchema,
  scopeContractId: idSchema,
  state: z.literal("SCOPE_AMENDMENT_REQUIRED"),
  material: z.boolean(),
  affectedFields: stringList(1, 20, 120),
  reason: boundedText(20, 2000),
  evidenceSegmentIds: z.array(idSchema).min(1).max(50).refine(unique),
  proposedPatch: z.record(z.unknown()).refine((value) => JSON.stringify(value).length <= 16_384, "Amendment patch is too large."),
  automaticApprovalAllowed: z.literal(false)
}).strict();

const researchQuestionSchema = z.object({
  questionId: idSchema,
  text: boundedText(10, 700),
  phaseIds: z.array(idSchema).min(1).max(8).refine(unique),
  dimensionIds: z.array(idSchema).min(1).max(8).refine(unique),
  claimTypesExpected: z.array(claimTypeSchema).min(1).max(12).refine(unique),
  likelySourceClasses: z.array(sourceClassSchema).min(1).max(8).refine(unique),
  expectedAuthorities: stringList(1, 12, 240),
  languages: z.array(languageSchema).min(1).max(8).refine(unique),
  geography: stringList(1, 12, 240),
  contested: z.boolean(),
  dateCritical: z.boolean(),
  priority: z.enum(["CRITICAL", "IMPORTANT", "SUPPORTING"]),
  state: z.enum(["UNRESEARCHED", "PARTIAL", "SATISFIED", "BLOCKED"])
}).strict();

export const researchMapSchema = z.object({
  ...immutableEnvelopeFields,
  researchMapId: idSchema,
  scopeContractId: idSchema,
  scopePayloadHash: hashSchema,
  version: z.number().int().positive(),
  phases: z.array(z.object({ phaseId: idSchema, label: boundedText(2, 160), temporalRule: boundedText(5, 600), required: z.boolean(), rationale: boundedText(10, 600) }).strict()).min(1).max(24),
  dimensions: z.array(z.object({ dimensionId: idSchema, label: boundedText(2, 120), required: z.boolean(), rationale: boundedText(10, 600) }).strict()).min(1).max(20),
  entities: z.array(z.object({ entityRef: entityRefSchema.nullable(), unresolvedName: boundedText(1, 240).nullable(), role: boundedText(2, 240), aliases: stringList(0, 20, 240), languages: z.array(languageSchema).min(1).max(8) }).strict()).max(60),
  questions: z.array(researchQuestionSchema).min(1).max(120),
  terminology: z.array(z.object({ term: boundedText(1, 200), aliases: stringList(0, 20, 200), language: languageSchema, ambiguousWith: stringList(0, 20, 200) }).strict()).max(80),
  knownUncertainty: stringList(0, 30)
}).strict().superRefine((map, context) => {
  const phases = new Set(map.phases.map((phase) => phase.phaseId));
  const dimensions = new Set(map.dimensions.map((dimension) => dimension.dimensionId));
  for (const [index, question] of map.questions.entries()) {
    if (question.phaseIds.some((id) => !phases.has(id))) context.addIssue({ code: z.ZodIssueCode.custom, path: ["questions", index, "phaseIds"], message: "Question references an unknown phase." });
    if (question.dimensionIds.some((id) => !dimensions.has(id))) context.addIssue({ code: z.ZodIssueCode.custom, path: ["questions", index, "dimensionIds"], message: "Question references an unknown dimension." });
  }
  for (const phase of map.phases.filter((item) => item.required)) if (!map.questions.some((question) => question.phaseIds.includes(phase.phaseId) && question.priority !== "SUPPORTING")) context.addIssue({ code: z.ZodIssueCode.custom, path: ["phases"], message: `Required phase ${phase.phaseId} is not exercised by a critical or important question.` });
  for (const dimension of map.dimensions.filter((item) => item.required)) if (!map.questions.some((question) => question.dimensionIds.includes(dimension.dimensionId))) context.addIssue({ code: z.ZodIssueCode.custom, path: ["dimensions"], message: `Required dimension ${dimension.dimensionId} is not exercised by a question.` });
});

export const researchQuerySchema = z.object({
  queryId: idSchema,
  researchQuestionIds: z.array(idSchema).min(1).max(20).refine(unique),
  role: z.enum(["ORIENTATION", "PHASE_DIMENSION", "AUTHORITY_TARGETED", "SOURCE_RETRIEVAL"]),
  intendedSourceClass: sourceClassSchema,
  aliasesAndTerms: stringList(1, 30, 200),
  language: languageSchema,
  geography: stringList(1, 8, 160),
  providerQuery: boundedText(3, 500),
  providerReportedQueries: stringList(0, 40, 500),
  budgetUnits: z.number().int().min(1).max(40),
  resultArtifactIds: z.array(idSchema).max(60).refine(unique)
}).strict();

export const queryPlanSchema = z.object({
  ...immutableEnvelopeFields,
  queryPlanId: idSchema,
  researchMapId: idSchema,
  scopeContractId: idSchema,
  queries: z.array(researchQuerySchema).min(1).max(40),
  budget: researchBudgetSchema
}).strict().superRefine((plan, context) => {
  const normalized = plan.queries.map((query) => query.providerQuery.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US"));
  if (!unique(normalized)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["queries"], message: "Provider queries must be deterministically deduplicated." });
  const roleCounts = new Map<string, number>();
  for (const query of plan.queries) roleCounts.set(query.role, (roleCounts.get(query.role) || 0) + 1);
  if ((roleCounts.get("ORIENTATION") || 0) > 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ["queries"], message: "Only one orientation query is allowed." });
  if ((roleCounts.get("PHASE_DIMENSION") || 0) > 3) context.addIssue({ code: z.ZodIssueCode.custom, path: ["queries"], message: "At most three phase/dimension queries are allowed." });
  if ((roleCounts.get("AUTHORITY_TARGETED") || 0) > 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ["queries"], message: "At most one authority-targeted query is allowed in V2-A." });
});

export const publisherAuthorityVersionSchema = z.object({
  ...immutableEnvelopeFields,
  publisherVersionId: idSchema,
  publisherId: z.string().uuid(),
  version: z.number().int().positive(),
  effectiveAt: z.string().datetime().nullable().optional(),
  canonicalName: boundedText(2, 300),
  aliases: stringList(0, 30, 300),
  parentPublisherId: z.string().uuid().nullable(),
  institutionType: z.enum(["ARCHIVE", "GOVERNMENT", "MUSEUM", "UNIVERSITY", "SCHOLARLY_PUBLISHER", "STANDARDS_BODY", "NEWSROOM", "EDITED_REFERENCE", "SPECIALIST", "OTHER"]),
  authorityDomains: stringList(1, 20, 160),
  geographicScope: stringList(1, 20, 160),
  languages: z.array(languageSchema).min(1).max(20).refine(unique),
  primarySecondaryTendency: z.enum(["PRIMARY", "SECONDARY", "MIXED"]),
  knownDomains: z.array(boundedText(3, 253).regex(/^[a-z0-9.-]+$/u)).min(1).max(30).refine(unique),
  externalIdentifiers: z.array(z.object({ scheme: boundedText(2, 40), value: boundedText(1, 240) }).strict()).max(20),
  independenceGroupId: idSchema,
  accessLimitations: stringList(0, 20),
  state: z.enum(["PROVISIONAL", "VERIFIED", "DISPUTED", "RETIRED"]),
  classificationEvidenceSegmentIds: z.array(idSchema).max(30).refine(unique),
  admittedBy: z.enum(["POLICY", "HUMAN"])
}).strict().refine((publisher) => publisher.state !== "VERIFIED" || publisher.classificationEvidenceSegmentIds.length > 0 || publisher.admittedBy === "POLICY", { path: ["state"], message: "Verified publishers require policy or evidence-backed human admission." });

export const publisherAuthorityRecordSchema = z.object({
  publisherId: z.string().uuid(),
  corpusId: immutableEnvelopeFields.corpusId,
  canonicalNameKey: boundedText(2, 300),
  currentVersionId: idSchema,
  currentVersion: z.number().int().positive(),
  state: z.enum(["PROVISIONAL", "VERIFIED", "DISPUTED", "RETIRED"]),
  updatedAt: z.string().datetime()
}).strict();

export const sourceDocumentSchema = z.object({
  sourceId: idSchema,
  corpusId: immutableEnvelopeFields.corpusId,
  canonicalUrl: httpsUrlSchema,
  canonicalUrlHash: hashSchema,
  publisherId: z.string().uuid().nullable(),
  title: boundedText(1, 500),
  authors: z.array(entityRefSchema).max(20),
  publicationDate: historicalDateSchema.nullable(),
  sourceClass: sourceClassSchema,
  language: languageSchema,
  primarySecondaryRole: z.enum(["PRIMARY", "SECONDARY", "MIXED", "UNKNOWN"]),
  authorityDomains: stringList(0, 20, 160),
  access: z.enum(["OPEN", "LIMITED", "PAYWALLED", "UNAVAILABLE"]),
  currentSnapshotId: idSchema.nullable(),
  supersedesSourceId: idSchema.nullable(),
  identityHash: hashSchema,
  updatedAt: z.string().datetime()
}).strict();

export const sourceSnapshotSchema = z.object({
  ...executionEnvelopeFields,
  sourceSnapshotId: idSchema,
  sourceId: idSchema,
  retrievalUrl: httpsUrlSchema,
  resolvedUrl: httpsUrlSchema,
  redirectChain: z.array(httpsUrlSchema).max(5),
  retrievedAt: z.string().datetime(),
  retrievalMethod: z.enum(["HTTP", "URL_CONTEXT", "GROUNDING_EXCERPT", "ARCHIVE_IMPORT"]),
  retrievalDisposition: z.enum(["NEWLY_RETRIEVED", "CACHE_REUSED", "REVALIDATED", "ACCESS_LIMITED", "UNAVAILABLE"]),
  mediaType: boundedText(3, 160),
  language: languageSchema,
  publicationDateObserved: historicalDateSchema.nullable(),
  rawObjectRef: boundedText(3, 1024).nullable(),
  extractedTextObjectRef: boundedText(3, 1024).nullable(),
  boundedExtractedText: z.string().max(131072),
  contentHash: hashSchema,
  extractionHash: hashSchema.nullable(),
  groundingMetadataRef: idSchema.nullable(),
  etag: boundedText(1, 500).nullable(),
  lastModified: boundedText(1, 500).nullable(),
  license: boundedText(1, 500).nullable(),
  contentBytes: z.number().int().nonnegative().max(26_214_400),
  accessLimitations: stringList(0, 20),
  partial: z.boolean(),
  supersedesSnapshotId: idSchema.nullable()
}).strict().superRefine((snapshot, context) => {
  if (snapshot.retrievalMethod === "GROUNDING_EXCERPT" && !snapshot.partial) context.addIssue({ code: z.ZodIssueCode.custom, path: ["partial"], message: "Grounding excerpts must be represented as partial." });
  if (snapshot.contentBytes > 262144 && snapshot.rawObjectRef === null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["rawObjectRef"], message: "Large source bodies require private object storage." });
});

export const evidenceSegmentSchema = z.object({
  ...immutableEnvelopeFields,
  evidenceSegmentId: idSchema,
  sourceSnapshotId: idSchema,
  exactText: boundedText(1, 12_000),
  segmentType: z.enum(["TEXT", "TABLE_CELL", "CAPTION", "METADATA", "MEDIA_TRANSCRIPT"]),
  startOffset: z.number().int().nonnegative().nullable(),
  endOffset: z.number().int().nonnegative().nullable(),
  page: boundedText(1, 80).nullable(),
  section: boundedText(1, 500).nullable(),
  selector: boundedText(1, 1000).nullable(),
  segmentHash: hashSchema,
  extractionMethod: boundedText(2, 120),
  sourceCompleteness: z.enum(["FULL_SNAPSHOT", "PARTIAL_GROUNDING_EXCERPT"])
}).strict().superRefine((segment, context) => {
  if ((segment.startOffset === null) !== (segment.endOffset === null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["startOffset"], message: "Offsets must both be present or absent." });
  if (segment.startOffset !== null && segment.endOffset !== null && segment.startOffset >= segment.endOffset) context.addIssue({ code: z.ZodIssueCode.custom, path: ["startOffset"], message: "Evidence offsets must define a non-empty range." });
});

export const atomicClaimVersionSchema = z.object({
  ...immutableEnvelopeFields,
  claimVersionId: idSchema,
  claimId: z.string().uuid(),
  scopeContractId: idSchema,
  subject: z.object({ kind: z.enum(["ENTITY", "EVENT", "LITERAL"]), id: idSchema.nullable(), label: boundedText(1, 300) }).strict(),
  predicate: claimTypeSchema,
  object: z.object({ kind: z.enum(["ENTITY", "EVENT", "TEXT", "NUMBER", "DATE"]), id: idSchema.nullable(), value: z.union([z.string().max(2000), z.number(), historicalDateSchema]) }).strict(),
  normalizedAssertion: boundedText(3, 2000),
  claimType: claimTypeSchema,
  risk: claimRiskSchema,
  temporal: z.object({ start: historicalDateSchema, end: historicalDateSchema.nullable() }).strict().nullable(),
  candidateEventClusterId: idSchema.nullable(),
  locationEntityIds: z.array(idSchema).max(20).refine(unique),
  qualifiers: z.array(z.object({ key: boundedText(1, 80), value: boundedText(1, 500) }).strict()).max(20),
  extractedFromSnapshotId: idSchema,
  extractedFromSegmentIds: z.array(idSchema).min(1).max(20).refine(unique),
  conflictState: z.enum(["NONE", "RESOLVED", "QUALIFIED", "HISTORICALLY_CONTESTED", "UNRESOLVED", "SUSPECTED_SOURCE_ERROR"]),
  validationState: z.enum(["EXTRACTED", "STRUCTURALLY_VALID", "AUTHORITY_PENDING", "SUPPORTED", "QUALIFIED", "REJECTED", "REVIEW_REQUIRED"]),
  evidenceVerdictId: idSchema.nullable(),
  supersedesClaimVersionId: idSchema.nullable()
}).strict().superRefine((claim, context) => {
  if (claim.predicate !== claim.claimType) context.addIssue({ code: z.ZodIssueCode.custom, path: ["predicate"], message: "Predicate and claim type must agree in V2-A." });
  if (claim.claimType === "QUOTATION" && claim.object.kind !== "TEXT") context.addIssue({ code: z.ZodIssueCode.custom, path: ["object"], message: "Quotation claims require exact text objects." });
  if (claim.claimType === "QUANTITY" && claim.object.kind !== "NUMBER") context.addIssue({ code: z.ZodIssueCode.custom, path: ["object"], message: "Quantity claims require numeric objects." });
  if (claim.claimType === "DATE" && claim.object.kind !== "DATE") context.addIssue({ code: z.ZodIssueCode.custom, path: ["object"], message: "Date claims require historical-date objects." });
});

export const atomicClaimRecordSchema = z.object({
  claimId: z.string().uuid(), corpusId: immutableEnvelopeFields.corpusId, subjectKey: boundedText(1, 500), predicate: claimTypeSchema,
  currentVersionId: idSchema, currentVersion: z.number().int().positive(), state: z.enum(["CANDIDATE", "ADMITTED", "SUPERSEDED", "RETIRED"]), updatedAt: z.string().datetime()
}).strict();

export const claimEvidenceEdgeSchema = z.object({
  ...immutableEnvelopeFields,
  claimEvidenceId: idSchema,
  claimVersionId: idSchema,
  evidenceSegmentId: idSchema,
  relationship: z.enum(["SUPPORTS", "CONTRADICTS", "QUALIFIES", "MENTIONS"]),
  relevance: z.enum(["DIRECT", "INDIRECT", "BACKGROUND"]),
  authorityFinding: z.enum(["STRONG", "MODERATE", "WEAK", "PROHIBITED", "UNCLASSIFIED"]),
  publisherVersionId: idSchema.nullable(),
  independenceGroupId: idSchema,
  dependenceBasis: stringList(0, 12, 300),
  evaluator: z.union([modelExecutionRefSchema, z.literal("DETERMINISTIC")])
}).strict();

export const claimAuthorityVerdictSchema = z.object({
  ...immutableEnvelopeFields,
  claimAuthorityVerdictId: idSchema,
  claimVersionId: idSchema,
  evidenceSetHash: hashSchema,
  risk: claimRiskSchema,
  verdict: z.enum(["SUPPORTED", "QUALIFIED", "INSUFFICIENT", "REVIEW_REQUIRED", "REJECTED"]),
  reasonCodes: z.array(z.enum(["DIRECT_STRONG_SOURCE", "DEFINITIVE_PRIMARY", "INDEPENDENT_CORROBORATION", "INTERPRETIVE_SECONDARY_BURDEN", "WIKIPEDIA_EXCLUDED", "MENTION_ONLY", "WEAK_AUTHORITY", "DEPENDENT_DUPLICATE", "UNRESOLVED_CONFLICT", "SENSITIVE_HUMAN_REVIEW", "MISSING_EVIDENCE"])).min(1).max(20),
  qualifyingText: boundedText(3, 1000).nullable(),
  acceptedEvidenceEdgeIds: z.array(idSchema).max(50).refine(unique),
  rejectedEvidenceEdgeIds: z.array(idSchema).max(50).refine(unique),
  independenceGroupCount: z.number().int().nonnegative().max(50),
  definitivePrimary: z.boolean(),
  deterministicEvaluator: z.literal(true)
}).strict();

export const claimConflictSetSchema = z.object({
  ...immutableEnvelopeFields,
  conflictSetId: idSchema,
  conflictKey: hashSchema,
  claimVersionIds: z.array(idSchema).min(2).max(50).refine(unique),
  evidenceEdgeIds: z.array(idSchema).min(2).max(100).refine(unique),
  state: z.enum(["NONE", "RESOLVED", "QUALIFIED", "HISTORICALLY_CONTESTED", "UNRESOLVED", "SUSPECTED_SOURCE_ERROR"]),
  material: z.boolean(),
  resolutionReason: boundedText(5, 2000).nullable(),
  resolutionEvidenceSegmentIds: z.array(idSchema).max(50).refine(unique),
  blocksPass: z.boolean()
}).strict().refine((set) => set.blocksPass === (set.material && set.state === "UNRESOLVED"), { path: ["blocksPass"], message: "Unresolved material conflicts must block PASS." });

export const canonicalEntityVersionSchema = z.object({
  ...immutableEnvelopeFields,
  entityVersionId: idSchema,
  entityId: z.string().uuid(),
  version: z.number().int().positive(),
  entityType: entityTypeSchema,
  canonicalName: boundedText(1, 300),
  language: languageSchema,
  externalIdentifiers: z.array(z.object({ scheme: boundedText(2, 40), value: boundedText(1, 240) }).strict()).max(30),
  activeTemporal: z.object({ start: historicalDateSchema.nullable(), end: historicalDateSchema.nullable() }).strict().nullable(),
  geographyKeys: stringList(0, 20, 240),
  state: z.enum(["FACTORY_CANDIDATE", "ADMITTED", "SUPERSEDED", "RETIRED"]),
  resolutionState: z.enum(["PROPOSED", "RESOLVED", "REVIEW_REQUIRED"]),
  identityEvidenceSegmentIds: z.array(idSchema).min(1).max(50).refine(unique),
  supersedesEntityVersionId: idSchema.nullable()
}).strict();

export const canonicalEntityRecordSchema = z.object({ entityId: z.string().uuid(), corpusId: immutableEnvelopeFields.corpusId, entityType: entityTypeSchema, canonicalNameKey: boundedText(1, 300), currentVersionId: idSchema, currentVersion: z.number().int().positive(), state: z.enum(["FACTORY_CANDIDATE", "ADMITTED", "SUPERSEDED", "RETIRED"]), updatedAt: z.string().datetime() }).strict();

export const entityAliasSchema = z.object({
  ...immutableEnvelopeFields,
  entityAliasId: idSchema,
  entityId: z.string().uuid(),
  entityVersionId: idSchema,
  entityType: entityTypeSchema,
  alias: boundedText(1, 300),
  aliasKey: boundedText(1, 300),
  language: languageSchema,
  script: boundedText(2, 80).nullable(),
  aliasType: z.enum(["CANONICAL", "ALTERNATE", "FORMER", "TRANSLITERATION", "ACRONYM"])
}).strict();

export const canonicalEventVersionSchema = z.object({
  ...immutableEnvelopeFields,
  eventVersionId: idSchema,
  canonicalEventId: z.string().uuid().nullable(),
  candidateEventId: z.string().uuid(),
  version: z.number().int().positive(),
  scopeContractId: idSchema,
  canonicalTitle: boundedText(3, 300),
  semanticClass: semanticClassSchema,
  eventSubtype: z.enum(["OCCURRENCE", "STATE_CHANGE", "PROCESS_BOUNDARY"]).nullable(),
  temporal: z.object({ start: historicalDateSchema, end: historicalDateSchema.nullable(), uncertainty: boundedText(3, 800).nullable() }).strict(),
  actionKey: boundedText(2, 300),
  primaryEntityKeys: z.array(idSchema).min(1).max(20).refine(unique),
  locationKeys: z.array(idSchema).max(20).refine(unique),
  coreClaimVersionIds: z.array(idSchema).min(1).max(20).refine(unique),
  supportingClaimVersionIds: z.array(idSchema).max(40).refine(unique),
  authorityState: z.enum(["FACTORY_CANDIDATE", "ADMITTED", "SUPERSEDED", "RETIRED"]),
  canonicalizationState: z.enum(["PROPOSED", "RESOLVED", "REVIEW_REQUIRED", "INELIGIBLE"]),
  eventIdentityKey: hashSchema,
  parentEventId: z.string().uuid().nullable(),
  supersedesEventVersionId: idSchema.nullable()
}).strict().superRefine((event, context) => {
  if (event.semanticClass !== "EVENT" && event.canonicalizationState !== "INELIGIBLE") context.addIssue({ code: z.ZodIssueCode.custom, path: ["canonicalizationState"], message: "Non-event knowledge cannot become a canonical event candidate." });
  if (event.semanticClass === "EVENT" && event.eventSubtype === null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["eventSubtype"], message: "EVENT candidates require a subtype." });
  if (event.semanticClass !== "EVENT" && event.canonicalEventId !== null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["canonicalEventId"], message: "Non-event knowledge cannot receive a canonical event identity." });
});

export const canonicalEventRecordSchema = z.object({ canonicalEventId: z.string().uuid(), corpusId: immutableEnvelopeFields.corpusId, eventIdentityKey: hashSchema, currentVersionId: idSchema, currentVersion: z.number().int().positive(), state: z.enum(["FACTORY_CANDIDATE", "ADMITTED", "SUPERSEDED", "RETIRED"]), updatedAt: z.string().datetime() }).strict();

const eventEdgeBase = { ...immutableEnvelopeFields, eventVersionId: idSchema } as const;
export const eventClaimEdgeSchema = z.object({ ...eventEdgeBase, eventClaimId: idSchema, claimVersionId: idSchema, role: z.enum(["CORE", "SUPPORTING", "CONTEXT"]) }).strict();
export const eventEntityEdgeSchema = z.object({ ...eventEdgeBase, eventEntityId: idSchema, entityVersionId: idSchema, role: boundedText(2, 160), meaning: boundedText(5, 800), temporal: z.object({ start: historicalDateSchema.nullable(), end: historicalDateSchema.nullable() }).strict().nullable() }).strict();
export const eventRelationSchema = z.object({ ...eventEdgeBase, eventRelationId: idSchema, fromEventVersionId: idSchema, toEventVersionId: idSchema, predicate: z.enum(["PRECEDES", "CAUSES", "ENABLES", "RESPONDS_TO", "PART_OF", "SUPERSEDES", "RELATED_TO"]), evidenceSegmentIds: z.array(idSchema).min(1).max(30).refine(unique) }).strict();

export const modelExecutionSchema = z.object({
  ...executionEnvelopeFields,
  executionId: idSchema,
  stage: z.enum(["SCOPE", "RESEARCH_MAP", "QUERY_PLAN", "GROUNDING", "SOURCE_RETRIEVAL", "CLAIM_EXTRACTION", "CLAIM_ASSESSMENT", "ENTITY_RESOLUTION", "EVENT_RESOLUTION"]),
  model: boundedText(2, 160), location: boundedText(2, 80), inputArtifactIds: z.array(idSchema).max(100).refine(unique), inputHash: hashSchema,
  promptHash: hashSchema, responseHash: hashSchema, validationState: z.enum(["VALID", "INVALID", "REPAIRED", "FAILED"]),
  boundedResponse: z.string().max(60_000), responseTruncated: z.boolean(),
  repairAttempt: z.number().int().min(0).max(2), transportAttempts: z.number().int().min(1).max(3), providerReportedQueries: stringList(0, 40, 500),
  groundingChunkCount: z.number().int().nonnegative().max(100), groundingSupportCount: z.number().int().nonnegative().max(500),
  usage: z.object({ inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable(), totalTokens: z.number().int().nonnegative().nullable(), monetaryCost: z.number().nonnegative().nullable(), costMeasurement: z.enum(["ACTUAL", "ESTIMATED", "NOT_MEASURABLE"]) }).strict(),
  startedAt: z.string().datetime(), completedAt: z.string().datetime(), latencyMs: z.number().int().nonnegative().max(1_200_000)
}).strict();

export const v2FailureRecordSchema = z.object({
  ...executionEnvelopeFields,
  failureRecordId: idSchema,
  stage: boundedText(2, 120),
  failureClass: z.enum(["SCOPE_AMENDMENT_REQUIRED", "RESEARCH_MAP_INCOMPLETE", "ACQUISITION_BUDGET_EXHAUSTED", "SOURCE_IDENTITY_UNRESOLVED", "SOURCE_AUTHORITY_INSUFFICIENT", "CLAIM_UNSUPPORTED", "CLAIM_CONFLICT_UNRESOLVED", "ENTITY_IDENTITY_REVIEW_REQUIRED", "EVENT_IDENTITY_REVIEW_REQUIRED", "SECURITY_RETRIEVAL_REJECTED", "PROVIDER_FAILURE", "WHOLE_RUN_DEADLINE_EXCEEDED", "FAILED_UNCLASSIFIED"]),
  severity: z.enum(["INFO", "WARNING", "HIGH", "CRITICAL"]),
  retryable: z.boolean(),
  message: boundedText(3, 2000),
  blockingArtifactIds: z.array(idSchema).max(50).refine(unique),
  attemptsConsumed: z.number().int().nonnegative().max(100),
  budgetConsumed: z.record(z.number().nonnegative()).refine((value) => Object.keys(value).length <= 20)
}).strict();

export type ScopeContract = z.infer<typeof scopeContractSchema>;
export type ResearchMap = z.infer<typeof researchMapSchema>;
export type QueryPlan = z.infer<typeof queryPlanSchema>;
export type PublisherAuthorityVersion = z.infer<typeof publisherAuthorityVersionSchema>;
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
export type EvidenceSegment = z.infer<typeof evidenceSegmentSchema>;
export type AtomicClaimVersion = z.infer<typeof atomicClaimVersionSchema>;
export type ClaimEvidenceEdge = z.infer<typeof claimEvidenceEdgeSchema>;
export type ClaimAuthorityVerdict = z.infer<typeof claimAuthorityVerdictSchema>;
export type ClaimConflictSet = z.infer<typeof claimConflictSetSchema>;
export type CanonicalEntityVersion = z.infer<typeof canonicalEntityVersionSchema>;
export type EntityAlias = z.infer<typeof entityAliasSchema>;
export type CanonicalEventVersion = z.infer<typeof canonicalEventVersionSchema>;
