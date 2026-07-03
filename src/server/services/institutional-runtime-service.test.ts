import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { InstitutionalRuntimeOrchestrator } from "@/src/server/services/institutional-runtime-service";

test("local institutional runtime executes Factory, Governance, and certified continuation in order", async () => {
  const calls: string[] = [];
  const runtime = new InstitutionalRuntimeOrchestrator({
    executeFactory: async () => {
      calls.push("factory");
      return { advanced: 1 };
    },
    executeGovernance: async () => {
      calls.push("governance");
      return { processed: 1 };
    },
    executeContinuation: async () => {
      calls.push("continuation");
      return { advanced: 1 };
    },
    revalidatePlatform: async () => {
      calls.push("revalidation");
      return { executed: true };
    }
  });

  const result = await runtime.runCycle();
  assert.deepEqual(calls, ["factory", "governance", "continuation", "revalidation"]);
  assert.deepEqual(result, {
    factory: { advanced: 1 },
    governance: { processed: 1 },
    continuation: { advanced: 1 },
    revalidation: { executed: true }
  });
});

test("institutions with no work are skipped safely and later institutions still execute", async () => {
  const calls: string[] = [];
  const runtime = new InstitutionalRuntimeOrchestrator({
    executeFactory: async () => {
      calls.push("factory");
      return { leased: 0 };
    },
    executeGovernance: async () => {
      calls.push("governance");
      return { pending: 0, processed: 0 };
    },
    executeContinuation: async () => {
      calls.push("continuation");
      return { leased: 0 };
    },
    revalidatePlatform: async () => {
      calls.push("revalidation");
      return { executed: false };
    }
  });

  await runtime.runCycle();
  assert.deepEqual(calls, ["factory", "governance", "continuation", "revalidation"]);
});

test("re-running institutional orchestration remains delegated to idempotent execution services", async () => {
  const counts = { factory: 0, governance: 0, continuation: 0 };
  const runtime = new InstitutionalRuntimeOrchestrator({
    executeFactory: async () => ({ cycle: ++counts.factory }),
    executeGovernance: async () => ({ cycle: ++counts.governance }),
    executeContinuation: async () => ({ cycle: ++counts.continuation })
    ,
    revalidatePlatform: async () => ({ executed: false })
  });

  await runtime.runCycle();
  await runtime.runCycle();
  assert.deepEqual(counts, { factory: 2, governance: 2, continuation: 2 });
});

test("runtime composition preserves existing authority and lease boundaries", async () => {
  const [orchestrator, operations, governance, library, runtimeEntry] = await Promise.all([
    readFile("src/server/services/institutional-runtime-service.ts", "utf8"),
    readFile("src/server/services/factory-operations-service.ts", "utf8"),
    readFile("src/server/services/governance-execution-service.ts", "utf8"),
    readFile("src/server/services/historical-library-service.ts", "utf8"),
    readFile("scripts/run-factory-runtime.ts", "utf8")
  ]);

  assert.match(orchestrator, /FactoryDispatcher/);
  assert.match(orchestrator, /governanceExecutionService\.runCycle/);
  assert.match(orchestrator, /factoryOperationsService\.runCycle/);
  assert.match(orchestrator, /platformRevalidationService\.revalidateAfterContinuation/);
  assert.doesNotMatch(orchestrator, /acceptPackage|admitPublicationPackage|generateForAdmission|verify\(/);
  assert.match(operations, /historicalLibraryService\.admitPublicationPackage/);
  assert.match(operations, /publicationVerificationService\.verify/);
  assert.match(governance, /governanceService\.acceptPackage/);
  assert.match(library, /publishedMemoryProjectionService\.generateForAdmission/);
  assert.match(operations, /startLeaseHeartbeat/);
  assert.match(runtimeEntry, /institutionalRuntimeService\.runCycle/);
  assert.doesNotMatch(runtimeEntry, /governanceExecutionService|historicalLibraryService|publishedMemoryProjectionService/);
});
