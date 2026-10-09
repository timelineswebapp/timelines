import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ACTIVE_CORPUS_ID } from "../functions/src/config";
import { shadowConfig } from "../functions/src/factory-v2/config";
import { assertGenerationReleaseParity, type GenerationRelease } from "../functions/src/generation-release";
import type { V2ACertificationMetrics } from "../functions/src/factory-v2/orchestrator";
import { captureProtectedState, protectedStateUnchanged } from "../functions/src/evidence-first/protected-state";
import { readSchedulerState } from "../functions/src/evidence-first/scheduler-state";
import type { ShadowFixtureDescriptor } from "../functions/src/factory-v2/orchestrator";

const PROJECT_ID = "tiimeliines";
const REGION = "us-central1";
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INTER_SUBJECT_COOLDOWN_MS = 60_000;
const SUBJECT_WORKER_GRACE_MS = 5_000;
const SUBJECT_WORKER_KILL_GRACE_MS = 2_000;
// A Completed Knowledge Set can contain the initial acquisition plus one
// sealed gap-directed continuation.  Each acquisition retains its own fixed
// 1,200-second supervisor; this outer process ceiling is not a larger
// acquisition budget and merely prevents a stranded worker after both legal
// runs have either completed or sealed their terminal records.
const MAX_ACQUISITION_RUNS_PER_SUBJECT = 2;
const SUBJECTS = [
  "The 1906 San Francisco Earthquake",
  "The Berlin Blockade and Airlift",
  "Ada Lovelace: Life and Work",
  "The Development of the Printing Press"
] as const;

function stableConfig(config: Record<string, unknown>): Record<string, unknown> {
  const { updatedAt: _updatedAt, ...stable } = config;
  return stable;
}

function loadGenerationRelease(): GenerationRelease {
  const npmCliPath = process.env.npm_execpath;
  if (!npmCliPath) throw new Error("Authority-First canary must be launched through npm so its manifest generator is deterministic.");
  const raw = execFileSync(process.execPath, [npmCliPath, "run", "--silent", "release:manifest"], {
    cwd: resolve(REPOSITORY_ROOT, "functions"),
    encoding: "utf8",
    env: { ...process.env, ALLOW_DIRTY_GENERATION_RELEASE: "true" },
    maxBuffer: 5 * 1024 * 1024
  });
  return JSON.parse(raw) as GenerationRelease;
}

/** Certification must never treat a recorded disposition as a silent waiver. */
function assertTier1SecurityGate(): void {
  const npmCliPath = process.env.npm_execpath;
  if (!npmCliPath) throw new Error("Authority-First canary must be launched through npm so the Tier-1 security gate is deterministic.");
  execFileSync(process.execPath, [npmCliPath, "run", "--silent", "security:gate"], {
    cwd: REPOSITORY_ROOT,
    env: process.env,
    stdio: "pipe",
    maxBuffer: 5 * 1024 * 1024
  });
}

function serviceState(service: string): Record<string, unknown> {
  const raw = execFileSync("gcloud", ["run", "services", "describe", service, `--region=${REGION}`, `--project=${PROJECT_ID}`, "--format=json"], { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
  const value = JSON.parse(raw) as { status?: { latestReadyRevisionName?: string; traffic?: unknown; url?: string; conditions?: unknown } };
  return { service, latestReadyRevisionName: value.status?.latestReadyRevisionName || null, traffic: value.status?.traffic || null, url: value.status?.url || null, conditions: value.status?.conditions || null };
}

function summarize(metrics: V2ACertificationMetrics[]) {
  const sum = (field: keyof V2ACertificationMetrics) => metrics.reduce((total, item) => total + (typeof item[field] === "number" ? item[field] as number : 0), 0);
  return {
    rounds: metrics.length,
    providerCalls: sum("providerCalls"),
    authorityRoutingModelCalls: sum("authorityRoutingModelCalls"),
    controlledResearchOperations: sum("controlledResearchOperations"),
    groundingEscalationCalls: sum("groundingCalls"),
    directRetrievalAttempts: sum("directRetrievalAttempts"),
    retrievalSuccesses: sum("retrievalSuccesses"),
    retrievalFailures: sum("retrievalFailures"),
    sourcesSnapshotted: sum("sourceDocumentsSnapshotted"),
    claimsExtracted: sum("claimsExtracted"),
    claimsSupported: sum("claimsSupported"),
    resolvedEvents: sum("resolvedCanonicalEventCandidates"),
    inputTokens: metrics.every((item) => item.inputTokens === null) ? null : metrics.reduce((total, item) => total + (item.inputTokens || 0), 0),
    outputTokens: metrics.every((item) => item.outputTokens === null) ? null : metrics.reduce((total, item) => total + (item.outputTokens || 0), 0),
    monetaryCost: metrics.every((item) => item.monetaryCost !== null) ? metrics.reduce((total, item) => total + (item.monetaryCost || 0), 0) : null,
    totalLatencyMs: sum("totalExecutionMs"),
    topicAuthoritySetIds: metrics.map((item) => item.topicAuthoritySetId),
    authorityResearchPlanIds: metrics.map((item) => item.authorityResearchPlanId),
    controlledResearchLedgerIds: metrics.map((item) => item.controlledResearchLedgerId),
    perspectiveAuditIds: metrics.map((item) => item.perspectiveAuditId),
    confidenceVectorIds: metrics.map((item) => item.confidenceVectorId)
  };
}

type SubjectWorkerResult =
  | { status: "SUCCESS"; completedKnowledgeSet: { completedKnowledgeSetId: string; payloadHash: string; finalVerdict: string; authorityAcquisitionRounds: number }; acquisitionMetrics: V2ACertificationMetrics[] }
  | { status: "FAILED"; reason: string; stage: string; metrics: V2ACertificationMetrics[] | null };

/**
 * The worker is the only process allowed to own SDK/network work for a
 * subject.  Its supervisor emits the durable timeout records; this parent
 * independently bounds the process so a non-cooperative native handle cannot
 * survive the whole-run deadline or the terminal persistence grace.
 */
async function runIsolatedSubject(input: { outputDirectory: string; ordinal: number; descriptor: ShadowFixtureDescriptor; config: ReturnType<typeof shadowConfig> }): Promise<SubjectWorkerResult> {
  const workerDirectory = resolve(input.outputDirectory, "workers");
  await mkdir(workerDirectory, { recursive: true });
  const inputPath = resolve(workerDirectory, `${input.ordinal}.input.json`);
  const resultPath = resolve(workerDirectory, `${input.ordinal}.result.json`);
  await writeFile(inputPath, `${JSON.stringify({ descriptor: input.descriptor, config: input.config, outputPath: resultPath })}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  const workerEntry = resolve(REPOSITORY_ROOT, "scripts", "run-authority-first-subject-worker.ts");
  const tsxEntry = resolve(REPOSITORY_ROOT, "functions", "node_modules", "tsx", "dist", "cli.mjs");
  const child = spawn(process.execPath, [tsxEntry, workerEntry, inputPath], { cwd: REPOSITORY_ROOT, env: process.env, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => { stderr = `${stderr}${chunk.toString("utf8")}`.slice(-16_384); });
  let forcedTermination = false;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const wholeRunMs = input.config.budgetBundle.maximumWorkerSeconds * 1_000 * MAX_ACQUISITION_RUNS_PER_SUBJECT;
  const deadlineTimer = setTimeout(() => {
    forcedTermination = true;
    child.kill("SIGTERM");
    killTimer = setTimeout(() => child.kill("SIGKILL"), SUBJECT_WORKER_KILL_GRACE_MS);
  }, wholeRunMs + SUBJECT_WORKER_GRACE_MS);
  const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  }).finally(() => {
    clearTimeout(deadlineTimer);
    if (killTimer) clearTimeout(killTimer);
  });
  try {
    return JSON.parse(await readFile(resultPath, "utf8")) as SubjectWorkerResult;
  } catch {
    const diagnostic = stderr.trim().slice(-2_000);
    throw new Error(forcedTermination
      ? `AUTHORITY_FIRST_SUBJECT_WORKER_FORCED_TERMINATION:${outcome.signal || outcome.code || "UNKNOWN"}:${diagnostic}`
      : `AUTHORITY_FIRST_SUBJECT_WORKER_NO_RESULT:${outcome.signal || outcome.code || "UNKNOWN"}:${diagnostic}`);
  }
}

async function main() {
  if (process.env.EVIDENCE_FIRST_MODE !== "SHADOW") throw new Error("Authority-First canaries require EVIDENCE_FIRST_MODE=SHADOW.");
  if ((process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || PROJECT_ID) !== PROJECT_ID) throw new Error("Refusing canaries outside the TiMELiNES project.");
  assertTier1SecurityGate();
  if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
  const firestore = getFirestore();
  const remoteConfigSnapshot = await firestore.collection("factoryV2").doc("config").get();
  if (!remoteConfigSnapshot.exists) throw new Error("Factory V2 configuration is absent.");
  const remoteConfig = remoteConfigSnapshot.data() as Record<string, unknown>;
  if (remoteConfig.operatingMode !== "SHADOW" || remoteConfig.killSwitch === true || remoteConfig.publicationEnabled !== false || remoteConfig.governanceSubmissionEnabled !== false || remoteConfig.autonomousDiscoveryEnabled !== false) throw new Error("Remote Factory configuration is not a safe shadow boundary.");
  const discoveryState = await readSchedulerState(PROJECT_ID, REGION, "topic-discovery-daily");
  if (discoveryState !== "PAUSED") throw new Error(`Autonomous discovery must remain PAUSED; observed ${discoveryState || "UNKNOWN"}.`);
  const deploymentState = [serviceState("priority-topic-generation"), serviceState("autonomous-topic-generation")];
  const runId = new Date().toISOString().replace(/[:.]/gu, "-");
  const outputDirectory = resolve(REPOSITORY_ROOT, "artifacts", "authority-first-acquisition-canary", runId);
  await mkdir(outputDirectory, { recursive: true });
  const config = shadowConfig(new Date().toISOString());
  const generationRelease = loadGenerationRelease();
  const results: Array<Record<string, unknown>> = [];
  let resumedFromReport: { path: string; sha256: string } | null = null;
  const resumeInput = process.env.AUTHORITY_FIRST_CANARY_RESUME_REPORT;
  if (resumeInput) {
    const artifactRoot = resolve(REPOSITORY_ROOT, "artifacts", "authority-first-acquisition-canary");
    const resumePath = resolve(REPOSITORY_ROOT, resumeInput);
    const artifactRelative = relative(artifactRoot, resumePath);
    if (artifactRelative.startsWith("..") || artifactRelative === "" || !artifactRelative.endsWith("report.json")) throw new Error("Resume report must be an existing Authority-First canary report artifact.");
    const bytes = await readFile(resumePath);
    const prior = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
    const priorResults = Array.isArray(prior.results) ? prior.results as Array<Record<string, unknown>> : [];
    if (prior.program !== "TL-AUTHORITY-FIRST-RESEARCH-001" || prior.phase !== "ACQUISITION_CANARY_PHASE_1" || prior.verdict !== "PHASE_1_FAIL_CLOSED") throw new Error("Resume report is not a failed Phase 1 Authority-First canary.");
    if (prior.olympicGamesAuthorized !== false || prior.olympicGamesExecuted !== false || JSON.stringify(prior.subjects) !== JSON.stringify(SUBJECTS)) throw new Error("Resume report crossed the fixed Phase 1 or Olympics boundary.");
    if (JSON.stringify(stableConfig(prior.localCanaryConfig as Record<string, unknown>)) !== JSON.stringify(stableConfig(config as unknown as Record<string, unknown>))) throw new Error("Resume report configuration does not match the current canary bundle.");
    assertGenerationReleaseParity(prior.generationRelease as GenerationRelease, generationRelease);
    for (const [index, priorResult] of priorResults.entries()) {
      if (priorResult.status !== "VALID_CKS") break;
      if (priorResult.title !== SUBJECTS[index] || (priorResult.protectedState as { exactParity?: unknown } | undefined)?.exactParity !== true) throw new Error("Resume report valid prefix failed subject identity or protected-state parity validation.");
      results.push(priorResult);
      await writeFile(resolve(outputDirectory, `${results.length}.json`), `${JSON.stringify(priorResult, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    }
    if (results.length === 0 || results.length >= SUBJECTS.length) throw new Error("Resume report must contain a non-empty, incomplete valid prefix.");
    resumedFromReport = { path: resumePath, sha256: createHash("sha256").update(bytes).digest("hex") };
  }
  let halted = false;
  for (const title of SUBJECTS.slice(results.length)) {
    if (halted) { results.push({ title, status: "NOT_EXECUTED_AFTER_FAILURE" }); continue; }
    const before = await captureProtectedState(firestore, ACTIVE_CORPUS_ID);
    try {
      const workerResult = await runIsolatedSubject({ outputDirectory, ordinal: results.length + 1, descriptor: { title, language: "en", ongoingAsOf: "2026-09-22" }, config });
      if (workerResult.status !== "SUCCESS") throw Object.assign(new Error(workerResult.reason), { stage: workerResult.stage, acquisitionMetrics: workerResult.metrics || [] });
      const after = await captureProtectedState(firestore, ACTIVE_CORPUS_ID);
      const parity = protectedStateUnchanged(before, after);
      const outcome = { title, status: parity ? "VALID_CKS" : "PROTECTED_STATE_CHANGED", completedKnowledgeSetId: workerResult.completedKnowledgeSet.completedKnowledgeSetId, completedKnowledgeSetHash: workerResult.completedKnowledgeSet.payloadHash, finalCoverageVerdict: workerResult.completedKnowledgeSet.finalVerdict, authorityAcquisitionRounds: workerResult.completedKnowledgeSet.authorityAcquisitionRounds, telemetry: summarize(workerResult.acquisitionMetrics), protectedState: { before, after, exactParity: parity } };
      results.push(outcome);
      halted = !parity;
    } catch (error) {
      const after = await captureProtectedState(firestore, ACTIVE_CORPUS_ID);
      const parity = protectedStateUnchanged(before, after);
      const typed = error as Error & { stage?: string; acquisitionMetrics?: V2ACertificationMetrics[] };
      const details = typed.stage ? { stage: typed.stage, metrics: summarize(typed.acquisitionMetrics || []) } : { stage: "UNHANDLED", metrics: null };
      results.push({ title, status: "FAILED_CLOSED", reason: error instanceof Error ? error.message : String(error), ...details, protectedState: { before, after, exactParity: parity } });
      halted = true;
    }
    await writeFile(resolve(outputDirectory, `${results.length}.json`), `${JSON.stringify(results.at(-1), null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    if (!halted && results.length < SUBJECTS.length) await new Promise((done) => setTimeout(done, INTER_SUBJECT_COOLDOWN_MS));
  }
  const valid = results.filter((result) => result.status === "VALID_CKS").length;
  const finalGenerationRelease = loadGenerationRelease();
  assertGenerationReleaseParity(generationRelease, finalGenerationRelease);
  const report = { program: "TL-AUTHORITY-FIRST-RESEARCH-001", phase: "ACQUISITION_CANARY_PHASE_1", olympicGamesAuthorized: false, olympicGamesExecuted: false, subjects: SUBJECTS, resumedFromReport, generationRelease, result: `${valid}/4`, verdict: valid === 4 ? "PHASE_1_PASS_STOP_BEFORE_OLYMPICS" : "PHASE_1_FAIL_CLOSED", remoteConfig, localCanaryConfig: config, discoveryState, deploymentState, results, generatedAt: new Date().toISOString() };
  await writeFile(resolve(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ outputDirectory, result: report.result, verdict: report.verdict }, null, 2)}\n`);
  if (valid !== 4) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.stack || error.message : String(error)); process.exitCode = 1; });
