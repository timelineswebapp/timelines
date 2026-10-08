import { readFile, writeFile } from "node:fs/promises";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ACTIVE_CORPUS_ID } from "../functions/src/config";
import { buildCompletedKnowledge, KnowledgeConstructionError } from "../functions/src/evidence-first/knowledge";
import { type FactoryV2Config } from "../functions/src/factory-v2/config";
import { V2FirestoreRepository } from "../functions/src/factory-v2/repositories/firestore";
import type { ShadowFixtureDescriptor } from "../functions/src/factory-v2/orchestrator";

type WorkerInput = { descriptor: ShadowFixtureDescriptor; config: FactoryV2Config; outputPath: string };

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("AUTHORITY_FIRST_SUBJECT_WORKER_INPUT_REQUIRED");
  const input = JSON.parse(await readFile(inputPath, "utf8")) as WorkerInput;
  if (getApps().length === 0) initializeApp({ projectId: "tiimeliines" });
  const repository = new V2FirestoreRepository({ firestore: getFirestore(), corpusId: ACTIVE_CORPUS_ID });
  try {
    const knowledge = await buildCompletedKnowledge({ descriptor: input.descriptor, config: input.config, repository });
    await writeFile(input.outputPath, `${JSON.stringify({ status: "SUCCESS", completedKnowledgeSet: knowledge.completedKnowledgeSet, acquisitionMetrics: knowledge.acquisitionMetrics }, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  } catch (error) {
    const result = error instanceof KnowledgeConstructionError
      ? { status: "FAILED", reason: error.message, stage: error.stage, metrics: error.acquisitionMetrics }
      : { status: "FAILED", reason: error instanceof Error ? error.message : String(error), stage: "UNHANDLED", metrics: null };
    await writeFile(input.outputPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  }
}

void main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
