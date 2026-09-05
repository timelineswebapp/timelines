import { getApps, initializeApp } from "firebase-admin/app";

const PROJECT_ID = "tiimeliines";
const CORPUS_ID = "timelines-clean-2026-09-v1";
const APOLLO_TOPIC_ID = "84007fa50a977eec8708ab8945f23fb6991b0e7b";
const APOLLO_V2_QUALITY_ARTIFACT_ID = "9424a899086f00c7785c10aa8d401f3e2c684b4c";

if ((process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || PROJECT_ID) !== PROJECT_ID) {
  throw new Error("Refusing Timeline Quality V3 certification outside the TiMELiNES production project.");
}
if (process.env.ACTIVE_CORPUS_ID !== CORPUS_ID) throw new Error("ACTIVE_CORPUS_ID must explicitly select the certified clean corpus.");
if (process.env.PUBLIC_ID_BASE !== "4000000000") throw new Error("PUBLIC_ID_BASE must explicitly match the certified clean-corpus allocation.");
if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });

async function main() {
  const mode = process.argv[2];
  if (mode !== "preview" && mode !== "promote" && mode !== "resume-institutional") throw new Error("Usage: timeline-quality-v3.ts preview|promote|resume-institutional");
  const { executePersistedV3RevisionPreview, promotePersistedV3Revision, resumePersistedV3InstitutionalTransition } = await import("../functions/src/pipeline");
  const result = mode === "preview"
    ? await executePersistedV3RevisionPreview(APOLLO_TOPIC_ID, APOLLO_V2_QUALITY_ARTIFACT_ID)
    : mode === "promote"
      ? await promotePersistedV3Revision(APOLLO_TOPIC_ID, APOLLO_V2_QUALITY_ARTIFACT_ID)
      : await resumePersistedV3InstitutionalTransition(APOLLO_TOPIC_ID);
  console.log(JSON.stringify({ operation: `TL-TIMELINE-QUALITY-003:${mode}`, corpusId: CORPUS_ID, result }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
