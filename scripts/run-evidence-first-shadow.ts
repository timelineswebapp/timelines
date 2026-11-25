import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { ACTIVE_CORPUS_ID } from "../functions/src/config";
import { factoryV2ConfigSchema, type FactoryV2Config } from "../functions/src/factory-v2/config";
import { verifyPayloadHash } from "../functions/src/factory-v2/hashing";
import { V2FirestoreRepository } from "../functions/src/factory-v2/repositories/firestore";
import { eventLockSchema } from "../functions/src/evidence-first/contracts";
import { runEvidenceFirstShadowSubject, type EvidenceFirstShadowResult } from "../functions/src/evidence-first/orchestrator";
import { evaluateAutomatedShadowThresholds } from "../functions/src/evidence-first/shadow-certification";
import { captureProtectedState, protectedStateUnchanged, PROTECTED_COLLECTIONS } from "../functions/src/evidence-first/protected-state";
import { readSchedulerState } from "../functions/src/evidence-first/scheduler-state";

const PROJECT_ID = "tiimeliines";
const corpusSchema = z.object({
  program: z.literal("TL-EVIDENCE-FIRST-GENERATION-001"),
  frozenAt: z.string().datetime(),
  executionMode: z.literal("SHADOW"),
  subjects: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/u), class: z.enum(["bounded_episode", "crisis_conflict", "biography", "institution", "technology", "scientific_development", "cultural_intellectual_movement", "long_duration_subject", "ongoing_subject"]), title: z.string().min(3).max(200), regression001d: z.boolean(), difficulty: z.array(z.string()).min(1) }).strict()).length(30)
}).strict();

type Subject = z.infer<typeof corpusSchema>["subjects"][number];
type FailureResult = { status: "FAILED_CLOSED"; terminalStage: "unhandled_failure"; title: string; failureReasons: string[]; metrics: { totalLatencyMs: number } };
type StoredResult = { subject: Subject; releaseId: string; result: EvidenceFirstShadowResult | FailureResult; recordedAt: string };

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || null : null;
}

function percentile(values: number[], quantile: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)]!;
}

function releaseIdentity(repositoryRoot: string) {
  const raw = execFileSync("npm", ["run", "--silent", "release:manifest"], {
    cwd: resolve(repositoryRoot, "functions"),
    env: { ...process.env, ALLOW_DIRTY_GENERATION_RELEASE: "true", EVIDENCE_FIRST_MODE: "SHADOW" },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });
  return z.object({ generationReleaseId: z.string().regex(/^[a-f0-9]{64}$/u), manifest: z.record(z.string(), z.unknown()) }).parse(JSON.parse(raw));
}

function lineageAndScopeAreValid(record: StoredResult): boolean {
  if (!("completedKnowledgeSetId" in record.result)) return false;
  const result = record.result;
  if (result.lineageVerified !== true || result.scopeImmutable !== true || record.releaseId !== result.generationReleaseId || !/^[a-f0-9]{64}$/u.test(result.completedKnowledgeSetHash) || !/^[a-f0-9]{64}$/u.test(result.scope.payloadHash)) return false;
  if (!result.eventLock) return result.selection.status !== "PASS" && result.eventLockId === null && result.compositionId === null;
  const parsedLock = eventLockSchema.safeParse(result.eventLock);
  if (!parsedLock.success || !verifyPayloadHash(parsedLock.data)) return false;
  const lock = parsedLock.data;
  if (lock.generationReleaseId !== record.releaseId || lock.eventLockId !== result.eventLockId || lock.scopeContractId !== result.scope.scopeContractId || lock.scopePayloadHash !== result.scope.payloadHash || lock.completedKnowledgeSetId !== result.completedKnowledgeSetId || lock.completedKnowledgeSetHash !== result.completedKnowledgeSetHash || lock.selectionArtifactId !== result.selectionArtifactId) return false;
  if (lock.events.length !== result.selectedMilestoneCount || result.product?.events.length !== lock.events.length) return false;
  return lock.events.every((event, index) => {
    const productEvent = result.product?.events[index];
    return productEvent?.title === event.canonicalTitle && productEvent.sortYear === event.temporal.start.year && productEvent.sortMonth === event.temporal.start.month && productEvent.sortDay === event.temporal.start.day;
  });
}

function providerUsageIsRecorded(record: StoredResult): boolean {
  if (!("completedKnowledgeSetId" in record.result)) return false;
  const metrics = record.result.metrics;
  return metrics.acquisition.every((item) => Number.isInteger(item.groundingCalls) && Number.isInteger(item.scopeContractModelCalls) && Object.hasOwn(item, "inputTokens") && Object.hasOwn(item, "outputTokens") && item.monetaryCostMeasurement === "NOT_MEASURABLE")
    && Number.isInteger(metrics.selectionProviderCalls)
    && Number.isInteger(metrics.compositionProviderCalls)
    && Number.isInteger(metrics.readerProviderCalls)
    && Object.hasOwn(metrics, "inputTokens")
    && Object.hasOwn(metrics, "outputTokens")
    && metrics.costMeasurement === "NOT_MEASURABLE";
}

function providerBudgetsAreBounded(record: StoredResult, config: FactoryV2Config): boolean {
  if (!("completedKnowledgeSetId" in record.result)) return false;
  return record.result.metrics.totalLatencyMs <= config.budgetBundle.maximumWorkerSeconds * 1000
    && record.result.metrics.acquisition.length <= 2
    && record.result.metrics.acquisition.every((item) => item.groundingCalls <= config.budgetBundle.maximumGroundingCalls
      && item.providerReportedSearchQueries <= config.budgetBundle.maximumProviderQueries
      && item.sourceDocumentsDiscovered <= config.budgetBundle.maximumSourceDocuments
      && item.claimsExtracted <= config.budgetBundle.maximumAtomicClaims
      && item.modelRepairAttempts <= config.budgetBundle.maximumSemanticRepairs
      && item.totalExecutionMs <= config.budgetBundle.maximumWorkerSeconds * 1000);
}

function aggregate(records: StoredResult[], before: Awaited<ReturnType<typeof captureProtectedState>>, after: Awaited<ReturnType<typeof captureProtectedState>>, config: FactoryV2Config) {
  const complete = records.filter((record): record is StoredResult & { result: EvidenceFirstShadowResult } => "completedKnowledgeSetId" in record.result);
  const passed = complete.filter((record) => record.result.status === "PASSED_ALL_SHADOW_GATES");
  const byClass = Object.fromEntries([...new Set(records.map((record) => record.subject.class))].sort().map((topicClass) => {
    const classRecords = records.filter((record) => record.subject.class === topicClass);
    const classPassed = classRecords.filter((record) => record.result.status === "PASSED_ALL_SHADOW_GATES");
    return [topicClass, { total: classRecords.length, passed: classPassed.length, rate: classPassed.length / classRecords.length }];
  }));
  const latencies = records.map((record) => record.result.metrics.totalLatencyMs);
  const protectedDeltas = Object.fromEntries(PROTECTED_COLLECTIONS.map((name) => [name, after[name].count - before[name].count]));
  const failureSignatures = records.filter((record) => record.result.terminalStage === "unhandled_failure").map((record) => record.result.failureReasons[0]?.replace(/[0-9a-f]{16,}/giu, "<id>").replace(/\d+/gu, "<n>").slice(0, 500) || "UNKNOWN");
  const counts = {
    corpus: records.length,
    completedKnowledgeSets: complete.length,
    evidenceEligible: complete.filter((record) => record.result.eligibleCandidateCount >= 6).length,
    selectionPassed: complete.filter((record) => record.result.selection.status === "PASS").length,
    eventLockAndCompositionPassed: complete.filter((record) => record.result.eventLockId && record.result.compositionId).length,
    timelineQualityPassed: complete.filter((record) => record.result.timelineQuality?.verdict === "passed").length,
    sourceAuthorityPassed: complete.filter((record) => record.result.sourceAuthority?.overallVerdict === "passed").length,
    readerPassed: complete.filter((record) => record.result.reader?.verdict === "passed").length,
    endToEndPassed: passed.length,
    unhandledFailures: records.filter((record) => record.result.terminalStage === "unhandled_failure").length,
    lineageAndScopeVerified: records.filter(lineageAndScopeAreValid).length,
    providerUsageRecorded: records.filter(providerUsageIsRecorded).length,
    providerBudgetsBounded: records.filter((record) => providerBudgetsAreBounded(record, config)).length
  };
  const regressionPass = records.filter((record) => record.subject.regression001d).every((record) => record.result.status === "PASSED_ALL_SHADOW_GATES");
  const automatedThresholds = { ...evaluateAutomatedShadowThresholds({ counts, byClass, protectedDeltas, latencies, medianLatencyMs: percentile(latencies, 0.5), p95LatencyMs: percentile(latencies, 0.95), failureSignatures, releaseIds: records.map((record) => record.releaseId) }), protectedContentHashesUnchanged: protectedStateUnchanged(before, after), regressionsPass: regressionPass };
  return { counts, byClass, latency: { medianMs: percentile(latencies, 0.5), p95Ms: percentile(latencies, 0.95), maximumMs: latencies.length ? Math.max(...latencies) : null }, protectedCollections: { before, after, deltas: protectedDeltas }, automatedThresholds, automatedVerdict: Object.values(automatedThresholds).every(Boolean) ? "AUTOMATED_THRESHOLDS_PASSED_HUMAN_INSPECTION_REQUIRED" : "NOT_SHADOW_CERTIFIED" };
}

async function main() {
  if ((process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || PROJECT_ID) !== PROJECT_ID) throw new Error("Refusing shadow execution outside the TiMELiNES project.");
  if (process.env.EVIDENCE_FIRST_MODE && process.env.EVIDENCE_FIRST_MODE !== "SHADOW") throw new Error("Evidence-First runner accepts SHADOW mode only.");
  if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
  const executionRoot = resolve(process.cwd());
  const repositoryRoot = basename(executionRoot) === "functions" ? resolve(executionRoot, "..") : executionRoot;
  const corpus = corpusSchema.parse(JSON.parse(await readFile(resolve(repositoryRoot, "docs/programs/TL-EVIDENCE-FIRST-GENERATION-001-SHADOW-CORPUS.json"), "utf8")));
  const requiredClasses = new Set(["bounded_episode", "crisis_conflict", "biography", "institution", "technology", "scientific_development", "cultural_intellectual_movement", "long_duration_subject", "ongoing_subject"]);
  if (new Set(corpus.subjects.map((subject) => subject.class)).size !== requiredClasses.size || [...requiredClasses].some((topicClass) => !corpus.subjects.some((subject) => subject.class === topicClass))) throw new Error("Frozen corpus does not contain every required topic class.");
  const expectedRegressions = new Set(["bounded-earthquake-1906", "biography-ada-lovelace", "long-olympic-games"]);
  if (corpus.subjects.filter((subject) => subject.regression001d).length !== 3 || [...expectedRegressions].some((id) => !corpus.subjects.some((subject) => subject.id === id && subject.regression001d))) throw new Error("Frozen corpus does not contain the exact three 001D regressions.");
  const release = releaseIdentity(repositoryRoot);
  const configSnapshot = await getFirestore().collection("factoryV2").doc("config").get();
  if (!configSnapshot.exists) throw new Error("Factory V2 shadow configuration is absent.");
  const config = factoryV2ConfigSchema.parse(configSnapshot.data());
  if (config.operatingMode !== "SHADOW" || config.killSwitch || config.publicationEnabled || config.governanceSubmissionEnabled || config.autonomousDiscoveryEnabled) throw new Error("Shadow configuration boundary is not safe.");
  const requestedSubject = argument("--subject-id");
  const runAll = process.argv.includes("--all");
  const preflightOnly = process.argv.includes("--preflight-only");
  if (!runAll && !requestedSubject && !preflightOnly) throw new Error("Specify --subject-id <frozen-id>, --all, or --preflight-only.");
  const subjects = requestedSubject ? corpus.subjects.filter((subject) => subject.id === requestedSubject) : corpus.subjects;
  if (subjects.length === 0) throw new Error(`Unknown frozen subject ${requestedSubject}.`);
  const outputDirectory = resolve(repositoryRoot, "artifacts/evidence-first", release.generationReleaseId);
  const before = await captureProtectedState(getFirestore(), ACTIVE_CORPUS_ID);
  const discoveryState = await readSchedulerState(PROJECT_ID, "us-central1", "topic-discovery-daily");
  if (discoveryState !== "PAUSED") throw new Error(`Autonomous discovery must remain PAUSED; observed ${discoveryState || "UNKNOWN"}.`);
  if (preflightOnly) {
    process.stdout.write(`${JSON.stringify({ status: "PREFLIGHT_PASSED_NO_WRITES", release, frozenSubjectCount: corpus.subjects.length, discoveryState, protectedState: before }, null, 2)}\n`);
    return;
  }
  await mkdir(outputDirectory, { recursive: true });
  const repository = new V2FirestoreRepository({ firestore: getFirestore(), corpusId: ACTIVE_CORPUS_ID });
  const records: StoredResult[] = [];
  for (const subject of subjects) {
    const outputPath = resolve(outputDirectory, `${subject.id}.json`);
    if (existsSync(outputPath)) {
      const stored = JSON.parse(await readFile(outputPath, "utf8")) as StoredResult;
      if (stored.releaseId !== release.generationReleaseId || stored.subject.id !== subject.id || stored.subject.title !== subject.title) throw new Error(`Stored shadow result identity mismatch for ${subject.id}.`);
      records.push(stored);
      continue;
    }
    const startedAt = Date.now();
    let result: EvidenceFirstShadowResult | FailureResult;
    try {
      result = await runEvidenceFirstShadowSubject({ descriptor: { title: subject.title, language: "en", ongoingAsOf: "2026-09-09" }, generationReleaseId: release.generationReleaseId, config, repository, deadlineAt: Date.now() + 1_200_000 });
    } catch (error) {
      result = { status: "FAILED_CLOSED", terminalStage: "unhandled_failure", title: subject.title, failureReasons: [(error instanceof Error ? error.message : String(error)).slice(0, 4000)], metrics: { totalLatencyMs: Date.now() - startedAt } };
    }
    const record = { subject, releaseId: release.generationReleaseId, result, recordedAt: new Date().toISOString() };
    await writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    records.push(record);
    process.stdout.write(`${JSON.stringify({ subjectId: subject.id, title: subject.title, status: result.status, terminalStage: result.terminalStage, latencyMs: result.metrics.totalLatencyMs })}\n`);
  }
  const after = await captureProtectedState(getFirestore(), ACTIVE_CORPUS_ID);
  const report = { program: corpus.program, executionMode: "SHADOW", release, frozenCorpus: corpus, completedSubjects: records.length, aggregate: aggregate(records, before, after, config), records, generatedAt: new Date().toISOString() };
  const reportPath = resolve(outputDirectory, subjects.length === 30 ? "aggregate.json" : `partial-${subjects[0]!.id}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ reportPath, completedSubjects: records.length, automatedVerdict: report.aggregate.automatedVerdict, protectedDeltas: report.aggregate.protectedCollections.deltas }, null, 2)}\n`);
  if (report.aggregate.automatedVerdict === "NOT_SHADOW_CERTIFIED") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
