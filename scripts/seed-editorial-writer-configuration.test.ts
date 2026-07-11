import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { seedEditorialWriterConfiguration, seededEditorialPromptContent } from "./seed-editorial-writer-configuration-core";

function repositories() {
  const prompts = new Map<string, any[]>();
  let policy: any = null;
  let provider: any = null;
  let binding: any = null;
  const supersededBindings: any[] = [];
  return {
    state: { prompts, supersededBindings, get policy() { return policy; }, get provider() { return provider; }, get binding() { return binding; } },
    dependencies: {
      prompts: {
        async getActivePrompt(promptKey: string) {
          return [...prompts.values()].flat().find((item) => item.promptKey === promptKey && item.lifecycle === "active") || null;
        },
        async createPrompt(input: any) {
          const versions = prompts.get(input.promptId) || [];
          const existing = versions.find((item) => item.version === input.version);
          if (existing) return existing;
          if (input.supersedesPromptVersionId) {
            const superseded = versions.find((item) => item.promptVersionId === input.supersedesPromptVersionId);
            if (superseded) superseded.lifecycle = "superseded";
          }
          const value = { ...input, promptVersionId: `version-${input.promptKey}-${input.version}`, lifecycle: "active" };
          prompts.set(input.promptId, [...versions, value]);
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
          if (binding && input.supersedesBindingId === binding.bindingId) {
            supersededBindings.push({ ...binding, lifecycle: "superseded" });
            binding = null;
          }
          binding ||= { ...input, bindingId: `binding-${supersededBindings.length + 1}`, lifecycle: "active" };
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
  assert.equal([...store.state.prompts.values()].flat().length, 4);
  assert.equal(second.binding.bindingFingerprint, first.binding.bindingFingerprint);
  for (const prompt of first.prompts) {
    assert.equal(prompt.contentFingerprint, createHash("sha256").update(seededEditorialPromptContent[prompt.promptKey as keyof typeof seededEditorialPromptContent]).digest("hex"));
  }
});

test("seed supersedes active prompts and binding when prompt content changes", async () => {
  const store = repositories();
  const first = await seedEditorialWriterConfiguration({ modelName: "qwen2.5:14b", dependencies: store.dependencies });
  const activeTitle = await store.dependencies.prompts.getActivePrompt("editorial_title");
  activeTitle.contentFingerprint = "0".repeat(64);
  const second = await seedEditorialWriterConfiguration({ modelName: "qwen2.5:14b", dependencies: store.dependencies });
  assert.equal(second.reused, false);
  assert.notEqual(second.binding.bindingId, first.binding.bindingId);
  assert.equal((second.binding as any).supersedesBindingId, first.binding.bindingId);
  assert.equal(second.prompts.find((item) => item.promptKey === "editorial_title")?.version, 2);
  assert.equal(store.state.supersededBindings.length, 1);
});

test("seed contains no runtime fallback or client lineage", async () => {
  const source = await import("node:fs").then(({ readFileSync }) =>
    readFileSync("scripts/seed-editorial-writer-configuration-core.ts", "utf8")
  );
  assert.doesNotMatch(source, /process\.env|client|fallback/i);
  assert.match(source, /createWriterConfigurationBinding/);
  assert.match(source, /createProviderConfiguration/);
});
