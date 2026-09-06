import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { shadowConfig } from "../../functions/src/factory-v2/config";

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "tiimeliines";
if (projectId !== "tiimeliines") throw new Error(`Refusing to configure unexpected project ${projectId}.`);
const apply = process.argv.includes("--apply");
const expectedVersionArgument = process.argv.indexOf("--expected-current-pipeline-version");
const expectedCurrentPipelineVersion = expectedVersionArgument >= 0 ? process.argv[expectedVersionArgument + 1] : null;
if (expectedVersionArgument >= 0 && !expectedCurrentPipelineVersion) throw new Error("--expected-current-pipeline-version requires a value.");
const config = shadowConfig();
console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", projectId, path: "factoryV2/config", expectedCurrentPipelineVersion, config }, null, 2));
async function main() {
if (apply) {
  const app = getApps()[0] || initializeApp({ projectId });
  const firestore = getFirestore(app);
  const reference = firestore.collection("factoryV2").doc("config");
  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(reference);
    if (current.exists) {
      const existing = current.data() || {};
      if (existing.publicationEnabled !== false || existing.governanceSubmissionEnabled !== false || existing.autonomousDiscoveryEnabled !== false || existing.operatingMode !== "SHADOW") throw new Error("Existing V2 config contains forbidden V2-A capabilities.");
      if (!expectedCurrentPipelineVersion) throw new Error("Updating an existing V2 config requires --expected-current-pipeline-version.");
      if (existing.pipelineVersion !== expectedCurrentPipelineVersion) throw new Error(`V2 config compare-and-set failed: expected ${expectedCurrentPipelineVersion}, found ${String(existing.pipelineVersion)}.`);
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
