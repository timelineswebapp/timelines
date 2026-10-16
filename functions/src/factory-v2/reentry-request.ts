import { sourceDocumentSchema, sourceSnapshotSchema, v2FailureRecordSchema } from "./contracts/knowledge";
import { topicOperationSchema } from "./contracts/operations";
import { deferredReentryRequestSchema, type DeferredReentryRequest } from "./contracts/reentry";
import { parseSealedArtifact } from "./contracts/builders";
import { contentAddressedId } from "./hashing";

export type DeferredReentryCreationInput = {
  operation: unknown;
  failure: unknown;
  trigger: "RELEVANT_EVIDENCE_CHANGE" | "AUTHORIZED_RETRY";
  relevantChangeArtifactId?: string | null;
  authorizedBy?: string | null;
  authorizationReason?: string | null;
  relevantSourceDocument?: unknown;
  relevantSourceSnapshot?: unknown;
  now: string;
};

/**
 * Creates a re-entry request only from terminal records already persisted by
 * the Factory. Callers provide a trigger, never origin lineage, release
 * identity, generation, or next-run identity.
 */
export function deriveDeferredReentryRequest(input: DeferredReentryCreationInput): DeferredReentryRequest {
  const operation = topicOperationSchema.parse(input.operation);
  const failure = v2FailureRecordSchema.parse(input.failure);
  if (operation.state !== "DEFERRED" || operation.terminalFailureRecordId === null) {
    throw new Error("Only a persisted deferred operation may request re-entry.");
  }
  if (operation.terminalFailureRecordId !== failure.failureRecordId || operation.topicId !== failure.topicId || operation.runId !== failure.runId || operation.generation !== failure.generation) {
    throw new Error("Deferred operation and immutable failure lineage do not match.");
  }
  const outcome = failure.autonomousOutcome;
  if (outcome === null || outcome.disposition !== "DEFERRED" || JSON.stringify(operation.autonomousOutcome) !== JSON.stringify(outcome)) {
    throw new Error("Deferred operation is missing its matching immutable autonomous outcome.");
  }

  const relevantChangeArtifactId = input.relevantChangeArtifactId ?? null;
  const authorizedBy = input.authorizedBy ?? null;
  const authorizationReason = input.authorizationReason ?? null;
  if (outcome.reentryState === "REQUIRES_RELEVANT_CHANGE") {
    if (input.trigger !== "RELEVANT_EVIDENCE_CHANGE" || relevantChangeArtifactId === null || authorizedBy !== null || authorizationReason !== null) {
      throw new Error("Public-evidence limitations require one governed relevant-source change.");
    }
    const source = sourceDocumentSchema.parse(input.relevantSourceDocument);
    const snapshot = sourceSnapshotSchema.parse(input.relevantSourceSnapshot);
    if (snapshot.sourceSnapshotId !== relevantChangeArtifactId || snapshot.corpusId !== operation.corpusId || snapshot.topicId !== operation.topicId || source.corpusId !== operation.corpusId || source.sourceId !== snapshot.sourceId || source.currentSnapshotId !== snapshot.sourceSnapshotId || source.access !== "OPEN" || source.publisherId === null || snapshot.partial || !["NEWLY_RETRIEVED", "REVALIDATED"].includes(snapshot.retrievalDisposition)) {
      throw new Error("Relevant change must be a newly available, open, complete source snapshot in the deferred topic lineage.");
    }
    if (Date.parse(snapshot.retrievedAt) <= Date.parse(failure.createdAt)) {
      throw new Error("Relevant source change must postdate the terminal deferred failure.");
    }
  } else if (outcome.reentryState === "REQUIRES_AUTHORIZED_RETRY") {
    if (input.trigger !== "AUTHORIZED_RETRY" || relevantChangeArtifactId !== null || authorizedBy === null || authorizationReason === null) {
      throw new Error("Research-budget exhaustion requires an attributable retry authorization.");
    }
  } else {
    throw new Error("This autonomous outcome is not eligible for deferred re-entry.");
  }

  const identity = {
    corpusId: operation.corpusId,
    topicId: operation.topicId,
    originalFailureRecordId: failure.failureRecordId,
    originalOperationId: operation.operationId,
    originalRunId: operation.runId,
    originalGeneration: operation.generation,
    trigger: input.trigger,
    relevantChangeArtifactId,
    authorizedBy,
    authorizationReason
  };
  const deferredReentryRequestId = contentAddressedId("reentry-request", identity);
  const nextGeneration = operation.generation + 1;
  const nextRunId = contentAddressedId("reentry-run", { deferredReentryRequestId, originalRunId: operation.runId, nextGeneration });
  return parseSealedArtifact(deferredReentryRequestSchema, {
    artifactId: deferredReentryRequestId,
    schemaVersion: failure.schemaVersion,
    policyVersion: failure.policyVersion,
    promptVersion: failure.promptVersion,
    modelExecutionRef: null,
    parentArtifactId: failure.failureRecordId,
    createdAt: input.now,
    corpusId: operation.corpusId,
    topicId: operation.topicId,
    runId: nextRunId,
    generation: nextGeneration,
    executionMode: "SHADOW",
    publicationEligible: false,
    governanceSubmissionAllowed: false,
    immutable: true,
    deferredReentryRequestId,
    originalFailureRecordId: failure.failureRecordId,
    originalOperationId: operation.operationId,
    originalRunId: operation.runId,
    originalGeneration: operation.generation,
    nextRunId,
    nextGeneration,
    originalRelease: {
      pipelineVersion: operation.pipelineVersion,
      schemaVersion: failure.schemaVersion,
      policyVersion: failure.policyVersion,
      promptVersion: failure.promptVersion
    },
    outcome,
    trigger: input.trigger,
    relevantChangeArtifactId,
    authorizedBy,
    authorizationReason,
    state: "REQUESTED"
  });
}
