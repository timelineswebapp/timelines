import { randomUUID } from "node:crypto";
import { executeNonPublicQualityFixture, recordNonPublicQualityFixtureFailure } from "./pipeline";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const topic = argument("--topic");
const fixtureClass = argument("--class");
if (!topic || topic.length < 3 || topic.length > 160) throw new Error("--topic must contain 3-160 characters.");
if (!fixtureClass || !/^[a-z][a-z0-9_-]{2,63}$/u.test(fixtureClass)) throw new Error("--class must be a bounded lowercase identifier.");

const jobId = randomUUID();
executeNonPublicQualityFixture(topic, fixtureClass, jobId)
  .then((result) => console.log(JSON.stringify({ ok: true, result }, null, 2)))
  .catch(async (error) => {
    await recordNonPublicQualityFixtureFailure(jobId, fixtureClass, error);
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  });
