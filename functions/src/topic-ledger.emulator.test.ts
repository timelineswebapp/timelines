import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase-admin/firestore";
import { corpusCollection } from "./corpus";
import { retryDeferredEnqueuesWithDependencies } from "./topic-ledger";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

test("Firestore retry queue isolates a failed enqueue and drains later ready work", { skip: !enabled }, async () => {
  const suffix = Date.now().toString(36);
  const failedTopicId = `a${"0".repeat(38)}${suffix.slice(-1)}`;
  const successfulTopicId = `b${"0".repeat(38)}${suffix.slice(-1)}`;
  const failedJobId = "4af86d2f-1596-4b8c-a927-42e9e25b646d";
  const successfulJobId = "5af86d2f-1596-4b8c-a927-42e9e25b646d";
  const dueAt = Timestamp.fromMillis(Date.now() - 1_000);
  const ledger = corpusCollection("topicLedgers");
  const jobs = corpusCollection("generationJobs");
  await Promise.all([
    ledger.doc(failedTopicId).set({ corpusId: process.env.ACTIVE_CORPUS_ID, state: "RETRY_SCHEDULED", activeJobId: failedJobId, generation: 1, origin: "user", nextRetryAt: dueAt, lastError: "prior failure", updatedAt: dueAt }),
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
  assert.ok((failed.data()?.nextRetryAt as Timestamp).toMillis() >= beforeRetry + 59_000);
  assert.equal(successful.data()?.state, "QUEUED");
  assert.equal(successful.data()?.nextRetryAt, null);
  assert.equal(failedJob.data()?.state, "RETRY_SCHEDULED");
  assert.equal(successfulJob.data()?.state, "QUEUED");
});
