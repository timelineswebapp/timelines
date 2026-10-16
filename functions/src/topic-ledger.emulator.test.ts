import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase-admin/firestore";
import { corpusCollection } from "./corpus";
import { listGenerationEnqueueFailureSummaries, listGenerationRetryQueueSummaries, retryDeferredEnqueuesWithDependencies } from "./topic-ledger";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

test("Firestore retry queue isolates a failed enqueue and drains later ready work", { skip: !enabled }, async () => {
  const suffix = (Date.now() % 16).toString(16);
  const failedTopicId = `a${"0".repeat(38)}${suffix}`;
  const successfulTopicId = `b${"0".repeat(38)}${suffix}`;
  const failedJobId = "4af86d2f-1596-4b8c-a927-42e9e25b646d";
  const successfulJobId = "5af86d2f-1596-4b8c-a927-42e9e25b646d";
  const dueAt = Timestamp.fromMillis(Date.now() - 1_000);
  const ledger = corpusCollection("topicLedgers");
  const jobs = corpusCollection("generationJobs");
  await Promise.all([
    ledger.doc(failedTopicId).set({ corpusId: process.env.ACTIVE_CORPUS_ID, state: "RETRY_SCHEDULED", activeJobId: failedJobId, generation: 1, origin: "user", enqueueRetryCount: 0, nextRetryAt: dueAt, lastError: "prior failure", updatedAt: dueAt }),
    ledger.doc(successfulTopicId).set({ corpusId: process.env.ACTIVE_CORPUS_ID, state: "RETRY_SCHEDULED", activeJobId: successfulJobId, generation: 1, origin: "user", nextRetryAt: dueAt, lastError: "prior failure", updatedAt: dueAt }),
    jobs.doc(failedJobId).set({ corpusId: process.env.ACTIVE_CORPUS_ID, state: "RETRY_SCHEDULED", nextRetryAt: dueAt }),
    jobs.doc(successfulJobId).set({ corpusId: process.env.ACTIVE_CORPUS_ID, state: "RETRY_SCHEDULED", nextRetryAt: dueAt })
  ]);

  const accepted: string[] = [];
  const beforeRetry = Date.now();
  const requeued = await retryDeferredEnqueuesWithDependencies(2, {
    enqueueGenerationTask: async (payload) => {
      if (payload.topicId === failedTopicId) throw new Error("Cloud Tasks unavailable for this topic.");
      accepted.push(payload.topicId);
      return { created: true, name: `emulator/${payload.jobId}` };
    }
  });

  assert.equal(requeued, 1);
  assert.deepEqual(accepted, [successfulTopicId]);
  const [failed, successful, failedJob, successfulJob] = await Promise.all([
    ledger.doc(failedTopicId).get(),
    ledger.doc(successfulTopicId).get(),
    jobs.doc(failedJobId).get(),
    jobs.doc(successfulJobId).get()
  ]);
  assert.equal(failed.data()?.state, "RETRY_SCHEDULED");
  assert.match(String(failed.data()?.lastError), /Cloud Tasks unavailable/u);
  assert.equal(failed.data()?.enqueueRetryCount, 1);
  assert.ok((failed.data()?.nextRetryAt as Timestamp).toMillis() >= beforeRetry + 59_000);
  assert.equal(successful.data()?.state, "QUEUED");
  assert.equal(successful.data()?.nextRetryAt, null);
  assert.equal(failedJob.data()?.state, "RETRY_SCHEDULED");
  assert.equal(successfulJob.data()?.state, "QUEUED");
  const summary = (await listGenerationRetryQueueSummaries(25)).find((item) => item.topicId === failedTopicId);
  assert.deepEqual(summary && { topicId: summary.topicId, jobId: summary.jobId, generation: summary.generation, origin: summary.origin, state: summary.state, lastErrorPresent: summary.lastErrorPresent, enqueueRetryCount: summary.enqueueRetryCount }, {
    topicId: failedTopicId, jobId: failedJobId, generation: 1, origin: "user", state: "RETRY_SCHEDULED", lastErrorPresent: true, enqueueRetryCount: 1
  });

  await Promise.all([
    ledger.doc(failedTopicId).update({ enqueueRetryCount: 4, nextRetryAt: Timestamp.fromMillis(Date.now() - 1_000) }),
    jobs.doc(failedJobId).update({ enqueueRetryCount: 4, nextRetryAt: Timestamp.fromMillis(Date.now() - 1_000) })
  ]);
  assert.equal(await retryDeferredEnqueuesWithDependencies(2, {
    enqueueGenerationTask: async () => { throw new Error("Cloud Tasks remains unavailable."); }
  }), 0);
  const [exhaustedLedger, exhaustedJob, terminalFailures] = await Promise.all([
    ledger.doc(failedTopicId).get(),
    jobs.doc(failedJobId).get(),
    corpusCollection("failureRecords").where("jobId", "==", failedJobId).get()
  ]);
  assert.equal(exhaustedLedger.data()?.state, "FAILED");
  assert.equal(exhaustedLedger.data()?.nextRetryAt, null);
  assert.equal(exhaustedLedger.data()?.enqueueRetryCount, 5);
  assert.equal(exhaustedJob.data()?.state, "FAILED");
  assert.equal(terminalFailures.docs.some((document) => document.data().stage === "enqueue_retry_exhausted" && document.data().retryable === false), true);
  const failureSummary = (await listGenerationEnqueueFailureSummaries(25)).find((item) => item.topicId === failedTopicId);
  assert.deepEqual(failureSummary && {
    topicId: failureSummary.topicId,
    jobId: failureSummary.jobId,
    generation: failureSummary.generation,
    origin: failureSummary.origin,
    state: failureSummary.state,
    enqueueRetryCount: failureSummary.enqueueRetryCount,
    lastErrorPresent: failureSummary.lastErrorPresent
  }, {
    topicId: failedTopicId,
    jobId: failedJobId,
    generation: 1,
    origin: "user",
    state: "FAILED",
    enqueueRetryCount: 5,
    lastErrorPresent: true
  });
});
