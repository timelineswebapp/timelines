import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ACTIVE_CORPUS_ID } from "../functions/src/config";
import { shadowConfig } from "../functions/src/factory-v2/config";
import { assertGenerationReleaseParity, type GenerationRelease } from "../functions/src/generation-release";
import type { V2ACertificationMetrics } from "../functions/src/factory-v2/orchestrator";
import { V2FirestoreRepository } from "../functions/src/factory-v2/repositories/firestore";
import { buildCompletedKnowledge, KnowledgeConstructionError } from "../functions/src/evidence-first/knowledge";
import { captureProtectedState, protectedStateUnchanged } from "../functions/src/evidence-first/protected-state";
import { readSchedulerState } from "../functions/src/evidence-first/scheduler-state";

const PROJECT_ID = "tiimeliines";
const REGION = "us-central1";
const INTER_SUBJECT_COOLDOWN_MS = 60_000;
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
  const raw = execFileSync("npm", ["run", "--silent", "release:manifest"], {
    cwd: resolve(process.cwd(), "functions"),
    encoding: "utf8",
    env: { ...process.env, ALLOW_DIRTY_GENERATION_RELEASE: "true" },
    maxBuffer: 5 * 1024 * 1024
  });
  return JSON.parse(raw) as GenerationRelease;
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

async function main() {
  if (process.env.EVIDENCE_FIRST_MODE !== "SHADOW") throw new Error("Authority-First canaries require EVIDENCE_FIRST_MODE=SHADOW.");
  if ((process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || PROJECT_ID) !== PROJECT_ID) throw new Error("Refusing canaries outside the TiMELiNES project.");
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
  const outputDirectory = resolve(process.cwd(), "artifacts", "authority-first-acquisition-canary", runId);
  await mkdir(outputDirectory, { recursive: true });
  const config = shadowConfig(new Date().toISOString());
  const generationRelease = loadGenerationRelease();
  const repository = new V2FirestoreRepository({ firestore, corpusId: ACTIVE_CORPUS_ID });
  const results: Array<Record<string, unknown>> = [];
  let resumedFromReport: { path: string; sha256: string } | null = null;
  const resumeInput = process.env.AUTHORITY_FIRST_CANARY_RESUME_REPORT;
  if (resumeInput) {
    const artifactRoot = resolve(process.cwd(), "artifacts", "authority-first-acquisition-canary");
    const resumePath = resolve(process.cwd(), resumeInput);
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
      const knowledge = await buildCompletedKnowledge({ descriptor: { title, language: "en", ongoingAsOf: "2026-09-22" }, config, repository });
      const after = await captureProtectedState(firestore, ACTIVE_CORPUS_ID);
      const parity = protectedStateUnchanged(before, after);
      const outcome = { title, status: parity ? "VALID_CKS" : "PROTECTED_STATE_CHANGED", completedKnowledgeSetId: knowledge.completedKnowledgeSet.completedKnowledgeSetId, completedKnowledgeSetHash: knowledge.completedKnowledgeSet.payloadHash, finalCoverageVerdict: knowledge.completedKnowledgeSet.finalVerdict, authorityAcquisitionRounds: knowledge.completedKnowledgeSet.authorityAcquisitionRounds, telemetry: summarize(knowledge.acquisitionMetrics), protectedState: { before, after, exactParity: parity } };
      results.push(outcome);
      halted = !parity;
    } catch (error) {
      const after = await captureProtectedState(firestore, ACTIVE_CORPUS_ID);
      const parity = protectedStateUnchanged(before, after);
      const details = error instanceof KnowledgeConstructionError ? { stage: error.stage, metrics: summarize(error.acquisitionMetrics) } : { stage: "UNHANDLED", metrics: null };
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
