import { reassessPersistedGeneration } from "./pipeline";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const topicId = argument("--topic-id");
const jobId = argument("--job-id");
const priorQualityArtifactId = argument("--prior-quality-artifact-id");
const generation = Number(argument("--generation"));
if (!topicId || !/^[a-f0-9]{40}$/u.test(topicId)) throw new Error("--topic-id must be a 40-character lowercase hexadecimal identifier.");
if (!jobId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(jobId)) throw new Error("--job-id must be a lowercase UUID.");
if (!priorQualityArtifactId || !/^[a-f0-9]{40}$/u.test(priorQualityArtifactId)) throw new Error("--prior-quality-artifact-id must be a 40-character lowercase hexadecimal identifier.");
if (!Number.isInteger(generation) || generation < 1) throw new Error("--generation must be a positive integer.");

reassessPersistedGeneration({ corpusId: process.env.ACTIVE_CORPUS_ID || "", topicId, jobId, generation, origin: "retry" }, priorQualityArtifactId)
  .then((result) => console.log(JSON.stringify({ ok: true, result }, null, 2)))
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  });
