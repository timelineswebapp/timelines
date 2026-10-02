import assert from "node:assert/strict";
import test from "node:test";
import { assertGenerationReleaseParity, assertPinnedGenerationRelease, buildGenerationReleaseManifest } from "./generation-release";

const input = {
  sourceRevision: "a".repeat(40),
  sourceTreeSha256: "f".repeat(64),
  rootDependencyLockSha256: "b".repeat(64),
  functionsDependencyLockSha256: "c".repeat(64),
  configurationBundle: { activeCorpusId: "test-clean-corpus", vertexModel: "gemini-2.5-flash", mode: "SHADOW" }
};

test("generation release identity binds source, dependencies, configuration, schemas, policies, and capabilities", () => {
  const release = buildGenerationReleaseManifest(input);
  assert.equal(release.generationReleaseId.length, 64);
  assert.equal(release.manifest.sourceRevision, input.sourceRevision);
  assert.equal(release.manifest.sourceTreeSha256, input.sourceTreeSha256);
  assert.equal(release.manifest.generationCapability, "evidence-first-generation-v1");
  assert.doesNotThrow(() => assertPinnedGenerationRelease(release.generationReleaseId, release));
});

test("generation release parity fails closed on priority/autonomous revision or configuration skew", () => {
  const priority = buildGenerationReleaseManifest(input);
  const autonomousRevisionSkew = buildGenerationReleaseManifest({ ...input, sourceRevision: "d".repeat(40) });
  const autonomousConfigSkew = buildGenerationReleaseManifest({ ...input, configurationBundle: { ...input.configurationBundle, mode: "PRODUCTION" } });
  assert.throws(() => assertGenerationReleaseParity(priority, autonomousRevisionSkew), /PARITY_MISMATCH/);
  assert.throws(() => assertGenerationReleaseParity(priority, autonomousConfigSkew), /PARITY_MISMATCH/);
  assert.throws(() => assertPinnedGenerationRelease("e".repeat(64), priority), /STALE_GENERATION_RELEASE/);
});

test("generation release rejects tampered manifest identity", () => {
  const release = buildGenerationReleaseManifest(input);
  const tampered = { ...release, manifest: { ...release.manifest, sourceRevision: "f".repeat(40) } };
  assert.throws(() => assertGenerationReleaseParity(tampered, tampered), /HASH_INVALID/);
});
