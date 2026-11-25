import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { ACTIVE_CORPUS_ID } from "../functions/src/config";
import { factoryV2ConfigSchema } from "../functions/src/factory-v2/config";
import { V2FirestoreRepository } from "../functions/src/factory-v2/repositories/firestore";
import type { V2ACertificationMetrics } from "../functions/src/factory-v2/orchestrator";
import {
  buildCompletedKnowledge,
  KnowledgeConstructionError,
} from "../functions/src/evidence-first/knowledge";
import {
  captureProtectedState,
  protectedStateUnchanged,
} from "../functions/src/evidence-first/protected-state";
import { readSchedulerState } from "../functions/src/evidence-first/scheduler-state";

const PROJECT_ID = "tiimeliines";
const CANARY_SUBJECTS = [
  "The 1906 San Francisco Earthquake",
  "The Berlin Blockade and Airlift",
  "Ada Lovelace: Life and Work",
  "The Development of the Printing Press",
  "The History of the Olympic Games",
] as const;
const TARGETED_CONTINUATION_SUBJECTS = [
  "The Development of the Printing Press",
  "The History of the Olympic Games",
] as const;
const OLYMPICS_ONLY_SUBJECTS = ["The History of the Olympic Games"] as const;

function releaseIdentity(repositoryRoot: string) {
  const raw = execFileSync("npm", ["run", "--silent", "release:manifest"], {
    cwd: resolve(repositoryRoot, "functions"),
    env: {
      ...process.env,
      ALLOW_DIRTY_GENERATION_RELEASE: "true",
      EVIDENCE_FIRST_MODE: "SHADOW",
    },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return z
    .object({
      generationReleaseId: z.string().regex(/^[a-f0-9]{64}$/u),
      manifest: z.record(z.string(), z.unknown()),
    })
    .parse(JSON.parse(raw));
}

function sumRecord(
  records: Array<Record<string, number>>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const record of records)
    for (const [key, value] of Object.entries(record))
      result[key] = (result[key] || 0) + value;
  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function telemetry(metrics: V2ACertificationMetrics[]) {
  const inputTokens = metrics.every((item) => item.inputTokens === null)
    ? null
    : metrics.reduce((total, item) => total + (item.inputTokens || 0), 0);
  const outputTokens = metrics.every((item) => item.outputTokens === null)
    ? null
    : metrics.reduce((total, item) => total + (item.outputTokens || 0), 0);
  return {
    acquisitionRounds: metrics.length,
    providerCalls: metrics.reduce(
      (total, item) => total + item.providerCalls,
      0,
    ),
    candidateQueriesProposed: metrics.reduce(
      (total, item) => total + item.candidateQueriesProposed,
      0,
    ),
    candidateQueriesAuthorized: metrics.reduce(
      (total, item) => total + item.candidateQueriesAuthorized,
      0,
    ),
    candidateQueriesRejected: metrics.reduce(
      (total, item) => total + item.candidateQueriesRejected,
      0,
    ),
    explicitQueriesExecuted: metrics.reduce(
      (total, item) => total + item.explicitQueriesExecuted,
      0,
    ),
    explicitSearchRequests: metrics.reduce(
      (total, item) => total + item.explicitSearchRequests,
      0,
    ),
    explicitSearchResults: metrics.reduce(
      (total, item) => total + item.explicitSearchResults,
      0,
    ),
    explicitSearchLatencyMs: metrics.reduce(
      (total, item) => total + item.explicitSearchLatencyMs,
      0,
    ),
    queryLedgerIds: metrics
      .map((item) => item.queryLedgerId)
      .filter((value): value is string => value !== null),
    retries: metrics.reduce(
      (total, item) => total + item.infrastructureRetries,
      0,
    ),
    repairs: metrics.reduce(
      (total, item) => total + item.modelRepairAttempts,
      0,
    ),
    queries: [...new Set(metrics.flatMap((item) => item.providerQueries))],
    sourcesDiscovered: metrics.reduce(
      (total, item) => total + item.sourceDocumentsDiscovered,
      0,
    ),
    retrievalAttempts: metrics.reduce(
      (total, item) => total + item.directRetrievalAttempts,
      0,
    ),
    retrievalSuccesses: metrics.reduce(
      (total, item) => total + item.retrievalSuccesses,
      0,
    ),
    retrievalFailures: metrics.reduce(
      (total, item) => total + item.retrievalFailures,
      0,
    ),
    retrievalRejectionReasons: sumRecord(
      metrics.map((item) => item.retrievalRejectionReasons),
    ),
    retrievalFailureDetails: metrics.flatMap((item, roundIndex) =>
      item.retrievalFailureDetails.map((detail) => ({
        ...detail,
        acquisitionRound: roundIndex + 1,
      })),
    ),
    sourceRanking: metrics.flatMap((item, roundIndex) =>
      item.sourceRanking.map((entry) => ({
        ...entry,
        acquisitionRound: roundIndex + 1,
      })),
    ),
    evidencePackets: metrics.reduce(
      (total, item) => total + item.evidencePackets,
      0,
    ),
    evidencePacketSegments: metrics.reduce(
      (total, item) => total + item.evidencePacketSegments,
      0,
    ),
    claimsExtracted: metrics.reduce(
      (total, item) => total + item.claimsExtracted,
      0,
    ),
    claimsSupported: metrics.reduce(
      (total, item) => total + item.claimsSupported,
      0,
    ),
    claimsRejected: metrics.reduce(
      (total, item) => total + item.claimsRejected,
      0,
    ),
    claimRejectionReasons: sumRecord(
      metrics.map((item) => item.claimRejectionReasons),
    ),
    authorityDistribution: sumRecord(
      metrics.map((item) => item.authorityVerdictDistribution),
    ),
    conflictsDetected: metrics.reduce(
      (total, item) => total + item.conflictsDetected,
      0,
    ),
    conflictsUnresolved: metrics.reduce(
      (total, item) => total + item.conflictsUnresolved,
      0,
    ),
    eventCandidates: metrics.reduce(
      (total, item) => total + item.eventCandidates,
      0,
    ),
    resolvedEventCandidates: metrics.reduce(
      (total, item) => total + item.resolvedCanonicalEventCandidates,
      0,
    ),
    rejectedNonEvents: metrics.reduce(
      (total, item) => total + item.nonEventKnowledgeItems,
      0,
    ),
    eventDispositionDistribution: sumRecord(
      metrics.map((item) => item.eventDispositionDistribution),
    ),
    eventResolutionDiagnostics: sumRecord(
      metrics.map((item) => item.eventResolutionDiagnostics),
    ),
    stageLatencyMs: sumRecord(metrics.map((item) => item.stageLatencyMs)),
    totalLatencyMs: metrics.reduce(
      (total, item) => total + item.totalExecutionMs,
      0,
    ),
    inputTokens,
    outputTokens,
    monetaryCost: metrics.every((item) => item.monetaryCost !== null)
      ? metrics.reduce((total, item) => total + (item.monetaryCost || 0), 0)
      : null,
    costMeasurement: metrics.every(
      (item) => item.monetaryCostMeasurement === "MEASURED",
    )
      ? ("MEASURED" as const)
      : ("PARTIALLY_MEASURABLE" as const),
  };
}

async function main() {
  if (
    (process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      PROJECT_ID) !== PROJECT_ID
  )
    throw new Error(
      "Refusing acquisition canary outside the TiMELiNES project.",
    );
  if (process.env.EVIDENCE_FIRST_MODE !== "SHADOW")
    throw new Error("Acquisition canary requires EVIDENCE_FIRST_MODE=SHADOW.");
  if (!process.env.BRAVE_SEARCH_API_KEY?.trim())
    throw new Error(
      "Olympics canary requires BRAVE_SEARCH_API_KEY; refusing to perform model or search work without the selected explicit-query provider credential.",
    );
  if (process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED !== "true")
    throw new Error(
      "Olympics canary requires BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED=true for a Brave plan that contractually permits immutable result lineage.",
    );
  if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
  const executionRoot = resolve(process.cwd());
  const repositoryRoot =
    basename(executionRoot) === "functions"
      ? resolve(executionRoot, "..")
      : executionRoot;
  const firestore = getFirestore();
  const configSnapshot = await firestore
    .collection("factoryV2")
    .doc("config")
    .get();
  if (!configSnapshot.exists)
    throw new Error("Factory V2 configuration is absent.");
  const config = factoryV2ConfigSchema.parse(configSnapshot.data());
  if (
    config.operatingMode !== "SHADOW" ||
    config.killSwitch ||
    config.publicationEnabled ||
    config.governanceSubmissionEnabled ||
    config.autonomousDiscoveryEnabled
  )
    throw new Error("Acquisition canary configuration boundary is unsafe.");
  const discoveryState = await readSchedulerState(
    PROJECT_ID,
    "us-central1",
    "topic-discovery-daily",
  );
  if (discoveryState !== "PAUSED")
    throw new Error(
      `Autonomous discovery must remain PAUSED; observed ${discoveryState || "UNKNOWN"}.`,
    );
  const release = releaseIdentity(repositoryRoot);
  const outputDirectory = resolve(
    repositoryRoot,
    "artifacts/evidence-first-acquisition-canary",
    release.generationReleaseId,
  );
  await mkdir(outputDirectory, { recursive: true });
  const before = await captureProtectedState(firestore, ACTIVE_CORPUS_ID);
  const repository = new V2FirestoreRepository({
    firestore,
    corpusId: ACTIVE_CORPUS_ID,
  });
  const results: Array<Record<string, unknown>> = [];
  let failed = false;
  const sequence = process.env.ACQUISITION_CANARY_SEQUENCE;
  const targetedContinuation =
    sequence === "PRINTING_PRESS_THEN_OLYMPICS" || sequence === "OLYMPICS_ONLY";
  const subjects =
    sequence === "PRINTING_PRESS_THEN_OLYMPICS"
      ? TARGETED_CONTINUATION_SUBJECTS
      : sequence === "OLYMPICS_ONLY"
        ? OLYMPICS_ONLY_SUBJECTS
        : CANARY_SUBJECTS;
  for (const title of subjects) {
    if (failed) {
      results.push({ title, status: "NOT_EXECUTED_AFTER_CANARY_FAILURE" });
      continue;
    }
    try {
      const knowledge = await buildCompletedKnowledge({
        descriptor: { title, language: "en", ongoingAsOf: "2026-09-09" },
        config,
        repository,
      });
      const outcome = {
        title,
        status: "COMPLETED_KNOWLEDGE_SET",
        telemetry: telemetry(knowledge.acquisitionMetrics),
        evidenceSegments: knowledge.evidenceSegments.length,
        supportedClaims: knowledge.authorityVerdicts.filter(
          (verdict) =>
            verdict.verdict === "SUPPORTED" || verdict.verdict === "QUALIFIED",
        ).length,
        rejectedClaims: knowledge.authorityVerdicts.filter(
          (verdict) =>
            verdict.verdict === "INSUFFICIENT" ||
            verdict.verdict === "REJECTED",
        ).length,
        authorityDistribution: sumRecord([
          Object.fromEntries(
            [
              ...new Set(
                knowledge.authorityVerdicts.map((verdict) => verdict.verdict),
              ),
            ].map((verdict) => [
              verdict,
              knowledge.authorityVerdicts.filter(
                (item) => item.verdict === verdict,
              ).length,
            ]),
          ),
        ]),
        conflicts: {
          total: knowledge.conflicts.length,
          blocking: knowledge.conflicts.filter(
            (conflict) => conflict.blocksPass,
          ).length,
        },
        resolvedEventCandidates: knowledge.events.filter(
          (event) =>
            event.semanticClass === "EVENT" &&
            event.canonicalizationState === "RESOLVED",
        ).length,
        rejectedNonEvents: knowledge.events.filter(
          (event) =>
            event.semanticClass !== "EVENT" ||
            event.canonicalizationState !== "RESOLVED",
        ).length,
        coverage: {
          finalVerdict: knowledge.completedKnowledgeSet.finalVerdict,
          unresolvedGapIds: knowledge.completedKnowledgeSet.unresolvedGapIds,
        },
        completionRound: knowledge.completionRoundCount,
        controlledResearchLedgerIds: knowledge.controlledResearchLedgerIds,
        completedKnowledgeSetId:
          knowledge.completedKnowledgeSet.completedKnowledgeSetId,
        completedKnowledgeSetHash: knowledge.completedKnowledgeSet.payloadHash,
      };
      results.push(outcome);
      await writeFile(
        resolve(
          outputDirectory,
          `${results.length}-${title
            .toLocaleLowerCase("en-US")
            .replace(/[^a-z0-9]+/gu, "-")
            .replace(/^-|-$/gu, "")}.json`,
        ),
        `${JSON.stringify(outcome, null, 2)}\n`,
        { encoding: "utf8", flag: "wx", mode: 0o600 },
      );
      process.stdout.write(
        `${JSON.stringify({ title, status: outcome.status, completedKnowledgeSetId: outcome.completedKnowledgeSetId })}\n`,
      );
    } catch (error) {
      failed = true;
      const outcome =
        error instanceof KnowledgeConstructionError
          ? {
              title,
              status: "FAILED_CLOSED",
              stage: error.stage,
              reason: error.message,
              telemetry: telemetry(error.acquisitionMetrics),
              coverage: error.coverage,
            }
          : {
              title,
              status: "FAILED_CLOSED",
              stage: "UNHANDLED",
              reason: error instanceof Error ? error.message : String(error),
              telemetry: null,
            };
      results.push(outcome);
      await writeFile(
        resolve(
          outputDirectory,
          `${results.length}-${title
            .toLocaleLowerCase("en-US")
            .replace(/[^a-z0-9]+/gu, "-")
            .replace(/^-|-$/gu, "")}.json`,
        ),
        `${JSON.stringify(outcome, null, 2)}\n`,
        { encoding: "utf8", flag: "wx", mode: 0o600 },
      );
      process.stdout.write(
        `${JSON.stringify({ title, status: outcome.status, stage: outcome.stage, reason: outcome.reason })}\n`,
      );
    }
  }
  const after = await captureProtectedState(firestore, ACTIVE_CORPUS_ID);
  const protectedStateParity = protectedStateUnchanged(before, after);
  const allPassed =
    results.length === subjects.length &&
    results.every((result) => result.status === "COMPLETED_KNOWLEDGE_SET") &&
    protectedStateParity;
  const report = {
    program: "TL-EVIDENCE-FIRST-GENERATION-001",
    executionType: targetedContinuation
      ? "TARGETED_ACQUISITION_CANARY_CONTINUATION"
      : "ACQUISITION_CANARY",
    release,
    subjects,
    results,
    protectedState: { before, after, unchanged: protectedStateParity },
    discoveryState,
    configuration: config,
    verdict: allPassed ? "ACQUISITION_CANARY_PASS" : "NOT_READY_FOR_SHADOW",
    generatedAt: new Date().toISOString(),
  };
  const reportPath = resolve(outputDirectory, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  process.stdout.write(
    `${JSON.stringify({ reportPath, verdict: report.verdict, protectedStateParity }, null, 2)}\n`,
  );
  if (!allPassed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.stack || error.message : String(error),
  );
  process.exitCode = 1;
});
