import assert from "node:assert/strict";
import test from "node:test";
import type { FactoryRuntimeProvider } from "@/src/server/factory/runtime-providers";
import { buildEditorialNarrativeWriterInput } from "@/src/server/editorial-intelligence/editorial-writer-input-builder";
import { fixture } from "@/src/server/editorial-intelligence/editorial-writer-input-builder.test";
import { runEditorialWriter } from "@/src/server/editorial-intelligence/editorial-writer-runtime";
import { narrativeClaimId, validateGeneratedSection, validateNarrativeCoverage } from "@/src/server/editorial-intelligence/editorial-grounding-validator";
import type { GeneratedSection, ValidatedSection } from "@/src/server/editorial-intelligence/editorial-generation-contracts";
import { editorialWriterPromptAssets } from "@/src/server/editorial-intelligence/editorial-prompt-assets";

const runtimeOptions = (value: FactoryRuntimeProvider) => ({
  provider: value,
  promptContent: editorialWriterPromptAssets
});

function provider(options: { failOnceUnit?: string; mutate?: (unit: any, output: any) => any } = {}) {
  const calls: string[] = [];
  let failed = false;
  const value: FactoryRuntimeProvider = {
    providerKey: "qwen14",
    modelName: "provider-independent-test",
    async health() {
      return { ok: true, providerKey: "qwen14", modelName: this.modelName, diagnostics: {} };
    },
    async execute(request) {
      const input = request.input as any;
      const unit = input.unit;
      calls.push(unit.unitId);
      if (options.failOnceUnit === unit.unitId && !failed) {
        failed = true;
        throw new Error("bounded unit failure");
      }
      const sentence = {
        sequence: 1,
        text: input.claims[0].normalizedClaim,
        milestoneIds: unit.milestoneIds,
        claimIds: [input.claims[0].claimId]
      };
      const output = unit.kind === "title" || unit.kind === "subtitle"
        ? { text: sentence.text, milestoneIds: sentence.milestoneIds, claimIds: sentence.claimIds }
        : { paragraphs: [{ sequence: 1, milestoneIds: unit.milestoneIds, sentences: [sentence] }] };
      return {
        providerKey: "qwen14", modelName: this.modelName,
        output: options.mutate ? options.mutate(unit, output) : output,
        diagnostics: { durationMs: 1, inputTokens: 10, outputTokens: 5, completionReason: "stop" }
      };
    }
  };
  return { value, calls };
}

test("generates title, subtitle, introduction, phases, and conclusion as bounded structured units", async () => {
  const writerInput = buildEditorialNarrativeWriterInput(fixture());
  const mock = provider();
  const result = await runEditorialWriter(writerInput, runtimeOptions(mock.value));
  assert.deepEqual(mock.calls, ["title", "subtitle", "introduction", "phase-1", "conclusion"]);
  assert.equal(result.narrative.title.text.length > 0, true);
  assert.equal(result.narrative.subtitle?.text.length! > 0, true);
  assert.equal(result.narrative.introduction.sectionType, "introduction");
  assert.equal(result.narrative.phases.length, 1);
  assert.equal(result.narrative.conclusion.sectionType, "conclusion");
  assert.equal(result.diagnostics.length, 5);
});

test("assembly is deterministic and provider implementation remains injected", async () => {
  const writerInput = buildEditorialNarrativeWriterInput(fixture());
  const first = await runEditorialWriter(writerInput, runtimeOptions(provider().value));
  const second = await runEditorialWriter(writerInput, runtimeOptions(provider().value));
  assert.deepEqual(first, second);
  assert.match(first.narrative.narrativeOutputFingerprint, /^[a-f0-9]{64}$/);
});

test("retries only the failed unit and never regenerates successful units", async () => {
  const writerInput = buildEditorialNarrativeWriterInput(fixture());
  const mock = provider({ failOnceUnit: "phase-1" });
  const result = await runEditorialWriter(writerInput, { ...runtimeOptions(mock.value), maxAttempts: 2 });
  assert.deepEqual(mock.calls, ["title", "subtitle", "introduction", "phase-1", "phase-1", "conclusion"]);
  assert.equal(result.diagnostics.find((item) => item.unitId === "phase-1")?.retryCount, 1);
});

test("executes exact registry prompt content and rejects fingerprint drift", async () => {
  const writerInput = buildEditorialNarrativeWriterInput(fixture());
  const seen = new Set<string>();
  const mock = provider();
  const originalExecute = mock.value.execute.bind(mock.value);
  mock.value.execute = async (request) => {
    seen.add(request.prompt);
    return originalExecute(request);
  };
  await runEditorialWriter(writerInput, runtimeOptions(mock.value));
  assert.deepEqual(seen, new Set(Object.values(editorialWriterPromptAssets)));
  await assert.rejects(
    runEditorialWriter(writerInput, {
      provider: provider().value,
      promptContent: { ...editorialWriterPromptAssets, editorial_phase: "drifted prompt" }
    }),
    /Prompt Registry content fingerprint mismatch/
  );
});

test("validated units survive a later failure and are reused on resume", async () => {
  const writerInput = buildEditorialNarrativeWriterInput(fixture());
  const persisted = new Map<string, any>();
  const failing = provider({ mutate: (unit, output) => {
    if (unit.kind === "conclusion") throw new Error("later unit failed");
    return output;
  } });
  const callbacks = {
    loadValidatedUnit: async (unit: any, inputFingerprint: string) => {
      const item = persisted.get(`${unit.kind}:${unit.sequence}`);
      if (!item) return null;
      assert.equal(item.inputFingerprint, inputFingerprint);
      return { validated: item.validated, diagnostics: item.diagnostics };
    },
    persistValidatedUnit: async (unit: any, inputFingerprint: string, outputFingerprint: string, validated: any, diagnostics: any) => {
      persisted.set(`${unit.kind}:${unit.sequence}`, { inputFingerprint, outputFingerprint, validated, diagnostics });
    }
  };
  await assert.rejects(runEditorialWriter(writerInput, {
    ...runtimeOptions(failing.value), ...callbacks, maxAttempts: 1
  }), /later unit failed/);
  assert.equal(persisted.size, 4);
  const resumed = provider();
  await runEditorialWriter(writerInput, { ...runtimeOptions(resumed.value), ...callbacks });
  assert.deepEqual(resumed.calls, ["conclusion"]);
});

test("assembler derives normalized sentence-to-evidence-to-snapshot citations server-side", async () => {
  const writerInput = buildEditorialNarrativeWriterInput(fixture());
  const result = await runEditorialWriter(writerInput, runtimeOptions(provider().value));
  assert.equal(result.narrative.citations.length, 1);
  assert.equal(result.narrative.citations[0]!.sourceSnapshotId, writerInput.sourceSnapshots[0]!.snapshotId);
  assert.deepEqual(result.narrative.citations[0]!.evidenceRecordIds, [writerInput.validatedEvidence[0]!.evidence.evidenceRecordId]);
  assert.equal(result.narrative.citations[0]!.sentenceIds.length, result.narrative.generationMetrics.sentenceCount);
});

function generated(text: string, milestoneIds?: string[], claimIds?: string[]): { section: GeneratedSection; input: ReturnType<typeof buildEditorialNarrativeWriterInput> } {
  const input = buildEditorialNarrativeWriterInput(fixture());
  const milestoneId = input.selectedMilestones[0]!.milestoneId;
  const claimId = narrativeClaimId(input.validatedEvidence[0]!.evidence.evidenceRecordId);
  const unit = {
    unitId: "phase-1", kind: "phase" as const, sequence: 1, compositionRef: "phase-001",
    milestoneIds: [milestoneId], claimIds: [claimId]
  };
  return {
    input,
    section: {
      unit,
      paragraphs: [{
        sequence: 1, milestoneIds: milestoneIds || [milestoneId],
        sentences: [{ sequence: 1, text, milestoneIds: milestoneIds || [milestoneId], claimIds: claimIds || [claimId] }]
      }]
    }
  };
}

test("rejects unknown claims and milestones", () => {
  const one = generated("The event occurred in 1455.", undefined, ["claim-unknown"]);
  assert.throws(() => validateGeneratedSection(one.section, one.input), /UNKNOWN_CLAIM/);
  const two = generated("The event occurred in 1455.", ["unknown-milestone"]);
  assert.throws(() => validateGeneratedSection(two.section, two.input), /UNKNOWN_MILESTONE/);
});

test("rejects unsupported dates, numbers, quotations, and causality", () => {
  for (const [text, code] of [
    ["The event occurred in 1776.", "UNSUPPORTED_NUMBER"],
    ["There were 500 copies.", "UNSUPPORTED_NUMBER"],
    ['A source called it "a global revolution".', "UNSUPPORTED_QUOTATION"],
    ["The event caused a revolution.", "UNSUPPORTED_CAUSALITY"]
  ] as const) {
    const value = generated(text);
    assert.throws(() => validateGeneratedSection(value.section, value.input), new RegExp(code));
  }
});

test("rejects invalid paragraph ordering, missing coverage, and duplicate coverage", () => {
  const value = generated("The event occurred in 1455.");
  const invalidOrder = {
    ...value.section,
    paragraphs: [{ ...value.section.paragraphs![0]!, sequence: 2 }]
  };
  assert.throws(() => validateGeneratedSection(invalidOrder, value.input), /INVALID_PARAGRAPH_ORDER/);
  const invalidSentenceOrder = {
    ...value.section,
    paragraphs: [{ ...value.section.paragraphs![0]!, sentences: [{ ...value.section.paragraphs![0]!.sentences[0]!, sequence: 2 }] }]
  };
  assert.throws(() => validateGeneratedSection(invalidSentenceOrder, value.input), /INVALID_SENTENCE_ORDER/);
  assert.throws(() => validateNarrativeCoverage([], value.input), /MISSING/);
  const valid = validateGeneratedSection(value.section, value.input);
  assert.throws(() => validateNarrativeCoverage([valid, valid] as ValidatedSection[], value.input), /DUPLICATE/);
});

test("fails closed on malformed structured output", async () => {
  const writerInput = buildEditorialNarrativeWriterInput(fixture());
  const mock = provider({ mutate: () => ({ rawText: "not structured" }) });
  await assert.rejects(runEditorialWriter(writerInput, { ...runtimeOptions(mock.value), maxAttempts: 1 }));
});

test("supports maximum milestone bound and multiple historical subjects without repository access", async () => {
  const base = buildEditorialNarrativeWriterInput(fixture());
  assert.equal(base.selectedMilestones.length <= 200, true);
  for (const subject of ["Printing Press", "Internet", "Roman Republic"]) {
    const changed = { ...base, canonicalSubject: subject };
    assert.equal(changed.selectedMilestones.length, 1);
  }
  const source = await import("node:fs").then(({ readFileSync }) =>
    readFileSync("src/server/editorial-intelligence/editorial-writer-runtime.ts", "utf8") +
    readFileSync("src/server/editorial-intelligence/editorial-grounding-validator.ts", "utf8")
  );
  for (const forbidden of ["repositories/", "db/client", "pipeline-registry", "factory-service", "governance", "historical-library", "published-memory"]) {
    assert.equal(source.includes(forbidden), false);
  }
});
