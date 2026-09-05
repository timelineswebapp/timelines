import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { factoryV2ConfigSchema, shadowConfig } from "../../functions/src/factory-v2/config";

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "tiimeliines";
if (projectId !== "tiimeliines") throw new Error(`Refusing to configure unexpected project ${projectId}.`);
const apply = process.argv.includes("--apply");
const config = shadowConfig();
console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", projectId, path: "factoryV2/config", config }, null, 2));
async function main() {
if (apply) {
  const app = getApps()[0] || initializeApp({ projectId });
  const firestore = getFirestore(app);
  const reference = firestore.collection("factoryV2").doc("config");
  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(reference);
    if (current.exists) {
      const parsed = factoryV2ConfigSchema.parse(current.data());
      if (parsed.publicationEnabled || parsed.governanceSubmissionEnabled || parsed.autonomousDiscoveryEnabled) throw new Error("Existing V2 config contains forbidden V2-A capabilities.");
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
