import "@/src/server/operations/environment";
import { closeSql, getSql } from "@/src/server/db/client";
import { getFactoryRuntimeProvider } from "@/src/server/factory/runtime-providers";
import { seedEditorialWriterConfiguration } from "./seed-editorial-writer-configuration-core";

async function main(): Promise<void> {
  if (!getSql()) throw new Error("DATABASE_URL must be configured for Editorial Writer configuration seed.");
  const provider = getFactoryRuntimeProvider("qwen14");
  const result = await seedEditorialWriterConfiguration({
    modelName: provider.modelName,
    actor: "editorial-writer-configuration-seed"
  });
  console.log(JSON.stringify({
    ok: true,
    component: "editorial_writer_configuration_seed",
    reused: result.reused,
    promptVersionIds: result.prompts.map((item) => item.promptVersionId),
    policyVersionId: result.policy.policyVersionId,
    providerConfigurationId: result.provider.providerConfigurationId,
    bindingId: result.binding.bindingId,
    bindingFingerprint: result.binding.bindingFingerprint
  }));
}

main()
  .catch((error: unknown) => {
    console.error(JSON.stringify({
      ok: false,
      component: "editorial_writer_configuration_seed",
      error: error instanceof Error ? error.message : String(error)
    }));
    process.exitCode = 1;
  })
  .finally(closeSql);
