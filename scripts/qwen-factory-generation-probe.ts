import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getFactoryRuntimeProvider } from "@/src/server/factory/runtime-providers";
import { getCanonicalFactoryWorker } from "@/src/server/factory/worker-registry";
import { getFactoryWorkerPromptTemplate } from "@/src/server/factory/worker-prompts";
import { validateFactoryWorkerOutput } from "@/src/server/factory/output-schemas";

const workerKeys = [
  "source_discovery_worker",
  "object_extraction_worker",
  "milestone_extraction_worker",
  "relationship_extraction_worker"
];

async function main() {
  const provider = getFactoryRuntimeProvider("qwen14");
  const subject = process.argv.slice(2).join(" ") || "History of the Suez Canal";
  const results = [];

  for (const workerKey of workerKeys) {
    const contract = getCanonicalFactoryWorker(workerKey);
    if (!contract) {
      throw new Error(`Missing worker contract for ${workerKey}.`);
    }
    const prompt = `${getFactoryWorkerPromptTemplate(workerKey)}

Topic: ${subject}
Generate exactly one valid candidate for this worker.
The candidate must be historically stable, source-grounded, and chronology-aware where dates apply.`;
    let lastFailure: unknown = null;
    for (let attempt = 1; attempt <= contract.retry_policy.maxAttempts; attempt += 1) {
      try {
        const result = await provider.execute({
          prompt,
          input: { topic: subject },
          outputSchema: contract.output_schema,
          configuration: { temperature: 0, maxOutputTokens: 1200, attempt },
          timeoutMs: contract.execution_timeout * 1000
        });
        const validated = validateFactoryWorkerOutput({
          workerKey,
          allowedObjectTypes: contract.allowed_object_types,
          output: result.output
        });
        results.push({
          workerKey,
          prompt,
          rawModelOutput: result.diagnostics.rawResponsePreview,
          validation: {
            passed: true,
            attempt,
            candidateCount: validated.candidates.length,
            sourceCount: validated.sources.length,
            evidenceCount: validated.evidence.length
          },
          candidate: validated.candidates[0],
          diagnostics: result.diagnostics
        });
        lastFailure = null;
        break;
      } catch (error) {
        lastFailure = error;
      }
    }
    if (lastFailure) {
      results.push({
        workerKey,
        prompt,
        validation: {
          passed: false,
          attempts: contract.retry_policy.maxAttempts,
          error: lastFailure instanceof Error ? lastFailure.message : String(lastFailure)
        }
      });
    }
  }

  mkdirSync("docs/audits", { recursive: true });
  const reportPath = join("docs/audits", "TL-QWEN14-HISTORICAL-PRODUCTION-001.json");
  writeFileSync(reportPath, JSON.stringify({ subject, results }, null, 2));
  console.log(JSON.stringify({ reportPath, subject, workersPassed: results.length }, null, 2));
  if (results.some((result) => result.validation.passed !== true)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
