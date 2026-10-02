import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { shadowConfig } from "../../functions/src/factory-v2/config";

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "tiimeliines";
if (projectId !== "tiimeliines") throw new Error(`Refusing to configure unexpected project ${projectId}.`);
const apply = process.argv.includes("--apply");
const inspectCurrent = process.argv.includes("--inspect-current");
function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}
const expectedCurrent = {
  pipelineVersion: argument("--expected-current-pipeline-version"),
  schemaVersion: argument("--expected-current-schema-version"),
  policyVersion: argument("--expected-current-policy-version"),
  promptVersion: argument("--expected-current-prompt-version")
};
const config = shadowConfig();
console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", projectId, path: "factoryV2/config", expectedCurrent, config }, null, 2));
async function main() {
if (apply || inspectCurrent) {
  const app = getApps()[0] || initializeApp({ projectId });
  const firestore = getFirestore(app);
  const reference = firestore.collection("factoryV2").doc("config");
  if (inspectCurrent) {
    const current = await reference.get();
    console.log(JSON.stringify({ status: current.exists ? "CURRENT_SHADOW_CONFIG" : "SHADOW_CONFIG_ABSENT", current: current.exists ? current.data() : null }, null, 2));
  }
  if (!apply) return;
  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(reference);
    if (current.exists) {
      const existing = current.data() || {};
      if (existing.publicationEnabled !== false || existing.governanceSubmissionEnabled !== false || existing.autonomousDiscoveryEnabled !== false || existing.operatingMode !== "SHADOW") throw new Error("Existing V2 config contains forbidden V2-A capabilities.");
      if (Object.values(expectedCurrent).some((value) => value === null)) throw new Error("Updating an existing V2 config requires the complete expected pipeline/schema/policy/prompt version tuple.");
      const actualCurrent = {
        pipelineVersion: existing.pipelineVersion,
        schemaVersion: (existing.artifactPolicyBundle as Record<string, unknown> | undefined)?.schemaVersion,
        policyVersion: (existing.artifactPolicyBundle as Record<string, unknown> | undefined)?.policyVersion,
        promptVersion: (existing.artifactPolicyBundle as Record<string, unknown> | undefined)?.promptVersion
      };
      for (const key of Object.keys(expectedCurrent) as Array<keyof typeof expectedCurrent>) {
        if (actualCurrent[key] !== expectedCurrent[key]) throw new Error(`V2 config compare-and-set failed for ${key}: expected ${String(expectedCurrent[key])}, found ${String(actualCurrent[key])}.`);
      }
    }
    transaction.set(reference, config);
  });
  console.log(JSON.stringify({ status: "SHADOW_CONFIG_APPLIED", publicationEnabled: false, governanceSubmissionEnabled: false, autonomousDiscoveryEnabled: false }));
}
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
