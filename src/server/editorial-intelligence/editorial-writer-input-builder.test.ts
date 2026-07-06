import assert from "node:assert/strict";
import test from "node:test";
import { prepareEditorialEvidenceSet } from "@/src/server/editorial-intelligence/editorial-foundation";
import { planEditorialComposition } from "@/src/server/editorial-intelligence/editorial-composition-planner";
import {
  buildEditorialNarrativeWriterInput,
  fingerprintEditorialPrompt,
  fingerprintEditorialProviderProvenance,
  fingerprintEditorialWritingPolicy
} from "@/src/server/editorial-intelligence/editorial-writer-input-builder";
import type { BuildEditorialNarrativeWriterInput } from "@/src/server/editorial-intelligence/editorial-writer-input";

const id = (value: number) => `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;

export function fixture(): BuildEditorialNarrativeWriterInput {
  const evidence = {
    evidenceRecordId: id(101), corpusDocumentId: id(201), sourceSnapshotId: id(301), sourceRecordId: id(401),
    provider: "wikidata" as const, retrievalTimestamp: "2026-01-01T00:00:00.000Z",
    spanStart: 0, spanEnd: 30, quoteText: "The event occurred in 1455.",
    normalizedClaim: "The event occurred in 1455.",
    provenance: {
      corpusDocumentId: id(201), sourceSnapshotId: id(301), sourceRecordId: id(401),
      provider: "wikidata" as const, retrievalTimestamp: "2026-01-01T00:00:00.000Z",
      retrievalProvenance: {
        provider: "wikidata" as const, sourceRecordId: id(401), retrievalUrl: "https://example.test/source",
        retrievedAt: "2026-01-01T00:00:00.000Z", httpStatus: 200, contentType: "application/json", contentLength: 30
      }
    },
    createdBy: "test"
  };
  const validation = {
    validationRecordId: id(501), evidenceRecordId: evidence.evidenceRecordId, status: "passed" as const,
    checks: [], provenance: {
      validationType: "structural_and_grounding_validation" as const,
      evidenceRecordId: evidence.evidenceRecordId, corpusDocumentId: evidence.corpusDocumentId,
      sourceSnapshotId: evidence.sourceSnapshotId, sourceRecordId: evidence.sourceRecordId,
      provider: evidence.provider, validatedAt: "2026-01-01T00:00:00.000Z", validator: "test",
      authorityDecision: false as const, publicationReadinessDecision: false as const,
      groundingAssessment: {
        topic: "Printing Press", topicRelevance: 1, claimGrounded: true, citationGrounded: true,
        chronologySupported: true, authorityGrounded: true, publicationSuitable: true,
        evidenceQualityScore: 1, unsupportedClaims: [], rejectionReasons: []
      }
    }, createdBy: "test"
  };
  const editorialEvidenceSet = {
    ...prepareEditorialEvidenceSet("Printing Press", [{
      evidence, validationRecordId: validation.validationRecordId, validation: validation.provenance,
      sourceTitle: "Source", sourceAuthorityScore: 1
    }]),
    editorialEvidenceSetId: id(601)
  };
  const timelineCandidate = {
    canonicalSubject: "Printing Press", editorialEvidenceSetId: id(601),
    compilerVersion: "ei-002-compiler-v1" as const, selectionAlgorithmVersion: "ei-002-selection-v1" as const,
    compilerInputFingerprint: "a".repeat(64),
    selectedMilestones: [{
      milestoneId: id(701), sequence: 1,
      chronology: { sortYear: 1455, sortMonth: null, sortDay: null, precision: "year" as const },
      evidenceLineage: [{ evidenceRecordId: evidence.evidenceRecordId, validationRecordId: validation.validationRecordId }],
      selectionReasons: ["unique_grounded_milestone" as const]
    }],
    excludedMilestones: [],
    compilerMetadata: { authorityDecision: false as const, publicationReadinessDecision: false as const, sourceMilestoneCount: 1 }
  };
  const composition = planEditorialComposition({
    editorialTimelineCandidateId: id(801), timelineCandidate,
    identifiedTurningPoints: [], chronologyGaps: []
  });
  const writingPolicy = fingerprintEditorialWritingPolicy({
    policyId: "general-en", version: "1", schemaVersion: "ei-004-writing-policy-v1",
    locale: "en", audience: "general", tone: "neutral_educational", readingLevel: "grade-9",
    targetLength: { minimumWords: 300, maximumWords: 900 },
    quotationPolicy: "source_verbatim_only", chronologyPolicy: "composition_order_locked",
    causalityPolicy: "explicit_grounded_relationship_only", citationPolicy: "sentence_lineage_required",
    narrativeMode: "historical_article"
  });
  const prompts = (["editorial_title", "editorial_introduction", "editorial_phase", "editorial_conclusion"] as const)
    .map((promptKey, index) => fingerprintEditorialPrompt({
      promptId: id(900 + index), promptKey, promptVersion: 1, templateFingerprint: String(index + 1).repeat(64),
      schemaVersion: "ei-004-prompt-schema-v1", policyId: writingPolicy.policyId,
      policyVersion: writingPolicy.version, lifecycle: "active"
    }));
  const providerProvenance = fingerprintEditorialProviderProvenance({
    schemaVersion: "ei-004-provider-provenance-v1", provider: "ollama", providerVersion: "1",
    model: "qwen3:14b", modelVersion: "14b", structuredOutputSchemaVersion: "v1", temperature: 0, seed: 7
  });
  return {
    locale: "en", editorialCompositionId: id(901), composition, timelineCandidate, editorialEvidenceSet,
    validatedEvidence: [{ evidence, validation }],
    sourceSnapshots: [{
      snapshotId: evidence.sourceSnapshotId, sourceRecordId: evidence.sourceRecordId, version: 1,
      retrievalUrl: "https://example.test/source", contentType: "application/json", contentHash: "b".repeat(64),
      contentText: evidence.quoteText, rawMetadata: {}, provenance: evidence.provenance.retrievalProvenance,
      retrievedBy: "test"
    }],
    prompts, writingPolicy, providerProvenance
  };
}

test("builds deterministic canonical writer input without mutation", () => {
  const input = fixture();
  const before = structuredClone(input);
  const first = buildEditorialNarrativeWriterInput(input);
  const second = buildEditorialNarrativeWriterInput(input);
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.match(first.writerInputFingerprint, /^[a-f0-9]{64}$/);
});

test("unordered evidence, snapshots, and prompts do not affect output", () => {
  const input = fixture();
  const reversed = {
    ...input,
    validatedEvidence: [...input.validatedEvidence].reverse(),
    sourceSnapshots: [...input.sourceSnapshots].reverse(),
    prompts: [...input.prompts].reverse()
  };
  assert.deepEqual(buildEditorialNarrativeWriterInput(input), buildEditorialNarrativeWriterInput(reversed));
});

test("policy, prompt, provider, and locale changes modify fingerprints", () => {
  const base = fixture();
  const baseline = buildEditorialNarrativeWriterInput(base).writerInputFingerprint;
  const { fingerprint: _basePolicyFingerprint, ...basePolicyDefinition } = base.writingPolicy;
  const policy = fingerprintEditorialWritingPolicy({ ...basePolicyDefinition, version: "2" });
  const policyPrompts = base.prompts.map(({ promptFingerprint: _fingerprint, ...prompt }) =>
    fingerprintEditorialPrompt({ ...prompt, policyVersion: policy.version })
  );
  assert.notEqual(buildEditorialNarrativeWriterInput({ ...base, writingPolicy: policy, prompts: policyPrompts }).writerInputFingerprint, baseline);
  const prompts = base.prompts.map((prompt, index) => {
    if (index) return prompt;
    const { promptFingerprint: _fingerprint, ...definition } = prompt;
    return fingerprintEditorialPrompt({ ...definition, templateFingerprint: "f".repeat(64) });
  });
  assert.notEqual(buildEditorialNarrativeWriterInput({ ...base, prompts }).writerInputFingerprint, baseline);
  const { runtimeFingerprint: _runtimeFingerprint, ...providerDefinition } = base.providerProvenance;
  const provider = fingerprintEditorialProviderProvenance({ ...providerDefinition, modelVersion: "14b-r2" });
  assert.notEqual(buildEditorialNarrativeWriterInput({ ...base, providerProvenance: provider }).writerInputFingerprint, baseline);
  const { fingerprint: _policyFingerprint, ...policyDefinition } = base.writingPolicy;
  const localePolicy = fingerprintEditorialWritingPolicy({ ...policyDefinition, locale: "ar" });
  const localePrompts = base.prompts.map(({ promptFingerprint: _fingerprint, ...prompt }) =>
    fingerprintEditorialPrompt({ ...prompt, policyId: localePolicy.policyId, policyVersion: localePolicy.version })
  );
  assert.notEqual(buildEditorialNarrativeWriterInput({ ...base, locale: "ar", writingPolicy: localePolicy, prompts: localePrompts }).writerInputFingerprint, baseline);
});

test("preserves exact composition, candidate, evidence, validation, and snapshot lineage", () => {
  const input = fixture();
  const result = buildEditorialNarrativeWriterInput(input);
  assert.deepEqual(result.composition, input.composition);
  assert.deepEqual(result.selectedMilestones[0]!.evidenceRecordIds, [input.validatedEvidence[0]!.evidence.evidenceRecordId]);
  assert.equal(result.validatedEvidence[0]!.validation.validationRecordId, input.validatedEvidence[0]!.validation.validationRecordId);
  assert.equal(result.sourceSnapshots[0]!.snapshotId, input.sourceSnapshots[0]!.snapshotId);
});

test("fails closed for mismatched lineage and invalid provenance", () => {
  const input = fixture();
  assert.throws(() => buildEditorialNarrativeWriterInput({
    ...input, timelineCandidate: { ...input.timelineCandidate, editorialEvidenceSetId: id(999) }
  }), /Evidence Set lineage/);
  assert.throws(() => buildEditorialNarrativeWriterInput({
    ...input, validatedEvidence: [{ ...input.validatedEvidence[0]!, validation: { ...input.validatedEvidence[0]!.validation, status: "failed" } }]
  }), /must be passed/);
  assert.throws(() => buildEditorialNarrativeWriterInput({
    ...input, sourceSnapshots: []
  }), /snapshot lineage/);
});

test("builder has no repository, persistence, runtime, or LLM dependency", async () => {
  const source = await import("node:fs").then(({ readFileSync }) =>
    readFileSync("src/server/editorial-intelligence/editorial-writer-input-builder.ts", "utf8")
  );
  for (const forbidden of ["repositories/", "db/client", "runtime-provider", "factoryRepository", "fetch(", "ollama"]) {
    assert.equal(source.includes(forbidden), false);
  }
});
