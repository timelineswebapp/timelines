import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadFactoryV2Config } from "../../functions/src/factory-v2/config";
import { runV2AShadowFixture, type ShadowFixtureDescriptor, type V2AShadowResult } from "../../functions/src/factory-v2/orchestrator";

const fixtures: ShadowFixtureDescriptor[] = [
  { title: "The History of the World Wide Web", language: "en", ongoingAsOf: "2026-09-06" },
  { title: "The Fall of the Berlin Wall", language: "en", ongoingAsOf: "2026-09-06" },
  { title: "The Apollo 11 Mission", language: "en", ongoingAsOf: "2026-09-06" },
  { title: "The Cuban Missile Crisis", language: "en", ongoingAsOf: "2026-09-06" },
  { title: "The Apollo 13 Mission", language: "en", ongoingAsOf: "2026-09-06" }
];

type FixtureResult = ({ title: string } & V2AShadowResult) | { title: string; error: string; metrics: { finalV2AVerdict: "FAIL" } };
async function main() {
const config = await loadFactoryV2Config();
const results: FixtureResult[] = [];
const onlyIndex = process.argv.indexOf("--only");
const onlyTitle = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;
const selectedFixtures = onlyTitle ? fixtures.filter((fixture) => fixture.title === onlyTitle) : fixtures;
if (selectedFixtures.length === 0) throw new Error(`Unknown fixture title: ${onlyTitle}`);
for (const fixture of selectedFixtures) {
  console.log(JSON.stringify({ status: "FIXTURE_START", title: fixture.title, executionMode: "SHADOW" }));
  try {
    const result = await runV2AShadowFixture(fixture, config);
    results.push({ title: fixture.title, ...result });
    console.log(JSON.stringify({ status: "FIXTURE_COMPLETE", title: fixture.title, verdict: result.metrics.finalV2AVerdict, metrics: result.metrics }));
  } catch (error) {
    const failure = { title: fixture.title, error: error instanceof Error ? error.message : String(error), metrics: { finalV2AVerdict: "FAIL" as const } };
    results.push(failure);
    console.error(JSON.stringify({ status: "FIXTURE_FAILED", ...failure }));
  }
}
const repositoryRoot = resolve(__dirname, "../..");
const outputPath = resolve(repositoryRoot, "artifacts", "factory-v2", "v2-a-shadow-fixtures.json");
await import("node:fs/promises").then(({ mkdir }) => mkdir(resolve(repositoryRoot, "artifacts", "factory-v2"), { recursive: true }));
await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), executionMode: "SHADOW", results }, null, 2)}\n`, { encoding: "utf8", flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
  if (error.code !== "EEXIST") throw error;
  const alternate = outputPath.replace(/\.json$/u, `-${Date.now()}.json`);
  await writeFile(alternate, `${JSON.stringify({ generatedAt: new Date().toISOString(), executionMode: "SHADOW", results }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ status: "RESULT_WRITTEN", path: alternate }));
});
console.log(JSON.stringify({ status: "FIXTURE_SUITE_COMPLETE", passed: results.filter((result) => "metrics" in result && result.metrics.finalV2AVerdict === "PASS").length, total: selectedFixtures.length, outputPath }));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
