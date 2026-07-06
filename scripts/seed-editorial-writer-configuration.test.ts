import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { seedEditorialWriterConfiguration, seededEditorialPromptContent } from "./seed-editorial-writer-configuration-core";

function repositories() {
  const prompts = new Map<string, any>();
  let policy: any = null;
  let provider: any = null;
  let binding: any = null;
  return {
    state: { prompts, get policy() { return policy; }, get provider() { return provider; }, get binding() { return binding; } },
    dependencies: {
      prompts: {
        async createPrompt(input: any) {
          const existing = prompts.get(input.promptId);
          if (existing) return existing;
          const value = { ...input, promptVersionId: `version-${input.promptKey}`, lifecycle: "active" };
          prompts.set(input.promptId, value);
          return value;
        }
      },
      policies: {
        async createPolicy(input: any) {
          policy ||= { ...input, policyVersionId: "policy-version-1" };
          return policy;
        }
      },
      providers: {
        async createProviderConfiguration(input: any) {
          provider ||= { ...input, providerConfigurationId: "provider-version-1" };
          return provider;
        }
      },
      bindings: {
        async getActiveWriterConfigurationBinding() { return binding; },
        async createWriterConfigurationBinding(input: any) {
          binding ||= { ...input, bindingId: "binding-1", lifecycle: "active" };
          return binding;
        }
      }
    } as any
  };
}

test("seed creates exact prompts, policy, provider and active binding", async () => {
  const store = repositories();
  const result = await seedEditorialWriterConfiguration({ modelName: "qwen2.5:14b", dependencies: store.dependencies });
  assert.equal(result.prompts.length, 4);
  assert.equal(result.binding.lifecycle, "active");
  assert.equal(result.binding.writingPolicyVersionId, result.policy.policyVersionId);
  assert.equal(result.binding.providerConfigurationId, result.provider.providerConfigurationId);
  assert.deepEqual(
    new Set([
      result.binding.titlePromptVersionId, result.binding.introductionPromptVersionId,
      result.binding.phasePromptVersionId, result.binding.conclusionPromptVersionId
    ]),
    new Set(result.prompts.map((item) => item.promptVersionId))
  );
});

test("seed is idempotent and fingerprints are stable", async () => {
  const store = repositories();
  const first = await seedEditorialWriterConfiguration({ modelName: "qwen2.5:14b", dependencies: store.dependencies });
  const second = await seedEditorialWriterConfiguration({ modelName: "qwen2.5:14b", dependencies: store.dependencies });
  assert.equal(second.reused, true);
  assert.equal(second.binding.bindingId, first.binding.bindingId);
  assert.equal(store.state.prompts.size, 4);
  assert.equal(second.binding.bindingFingerprint, first.binding.bindingFingerprint);
  for (const prompt of first.prompts) {
    assert.equal(prompt.contentFingerprint, createHash("sha256").update(seededEditorialPromptContent[prompt.promptKey as keyof typeof seededEditorialPromptContent]).digest("hex"));
  }
});

test("seed contains no runtime fallback or client lineage", async () => {
  const source = await import("node:fs").then(({ readFileSync }) =>
    readFileSync("scripts/seed-editorial-writer-configuration-core.ts", "utf8")
  );
  assert.doesNotMatch(source, /getActivePrompt|process\.env|client|fallback/i);
  assert.match(source, /createWriterConfigurationBinding/);
  assert.match(source, /createProviderConfiguration/);
});
