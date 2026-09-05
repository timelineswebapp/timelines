import type { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { ACTIVE_CORPUS_ID, MAX_DISCOVERY_CANDIDATES, MAX_DISCOVERY_PROMOTIONS } from "./config";
import { assertActiveCorpus, corpusCollection, corpusRecord, requireTaskCorpus } from "./corpus";
import { handlePublicApi } from "./public-api";
import { executeGeneration, executeInstitutionalTransition } from "./pipeline";
import { institutionalTaskPayloadSchema, taskPayloadSchema } from "./schemas";
import { claimAutonomousTopic, retryDeferredEnqueues } from "./topic-ledger";
import { discoverTopics } from "./vertex";

function taskName(request: Request) {
  return request.header("x-cloudtasks-taskname") || request.header("x-cloud-tasks-taskname") || "";
}

function requireTask(request: Request, response: Response) {
  const name = taskName(request);
  if (!name && process.env.FUNCTIONS_EMULATOR !== "true") {
    response.status(403).json({ ok: false, error: { code: "FORBIDDEN", message: "Cloud Tasks delivery required." } });
    return null;
  }
  return name || `emulator-${Date.now()}`;
}

export async function publicApi(request: Request, response: Response) {
  return handlePublicApi(request, response);
}

async function generationWorker(request: Request, response: Response) {
  const leaseOwner = requireTask(request, response);
  if (!leaseOwner) return;
  try {
    const parsed = taskPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      console.warn(JSON.stringify({ severity: "WARNING", component: "generation_worker", taskName: leaseOwner, action: "discard_unscoped_task" }));
      response.status(200).json({ ok: true, data: { status: "REJECTED_UNSCOPED_TASK" } });
      return;
    }
    const payload = parsed.data;
    if (payload.corpusId !== ACTIVE_CORPUS_ID) {
      response.status(200).json({ ok: true, data: { status: "REJECTED_INACTIVE_CORPUS" } });
      return;
    }
    requireTaskCorpus(payload.corpusId);
    await assertActiveCorpus();
    const result = await executeGeneration(payload, leaseOwner);
    response.status(200).json({ ok: true, data: result });
  } catch (error) {
    console.error(JSON.stringify({ severity: "ERROR", component: "generation_worker", taskName: leaseOwner, message: error instanceof Error ? error.message : String(error) }));
    response.status(500).json({ ok: false, error: { code: "WORKER_FAILED", message: "Generation worker failed." } });
  }
}

export const priorityTopicGeneration = generationWorker;
export const autonomousTopicGeneration = generationWorker;

export async function institutionalTransitions(request: Request, response: Response) {
  const delivery = requireTask(request, response);
  if (!delivery) return;
  try {
    const parsed = institutionalTaskPayloadSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.corpusId !== ACTIVE_CORPUS_ID) {
      console.warn(JSON.stringify({ severity: "WARNING", component: "institutional_worker", taskName: delivery, action: "discard_unscoped_or_inactive_task" }));
      response.status(200).json({ ok: true, data: { status: "REJECTED_INACTIVE_CORPUS" } });
      return;
    }
    const payload = parsed.data;
    requireTaskCorpus(payload.corpusId);
    await assertActiveCorpus();
    const result = await executeInstitutionalTransition(payload);
    response.status(200).json({ ok: true, data: result });
  } catch (error) {
    console.error(JSON.stringify({ severity: "ERROR", component: "institutional_worker", taskName: delivery, message: error instanceof Error ? error.message : String(error) }));
    response.status(500).json({ ok: false, error: { code: "WORKER_FAILED", message: "Institutional transition failed." } });
  }
}

export async function topicDiscovery(request: Request, response: Response) {
  const schedulerDelivery = request.header("x-cloudscheduler") || request.header("x-cloud-scheduler");
  if (!schedulerDelivery && process.env.FUNCTIONS_EMULATOR !== "true") {
    response.status(403).json({ ok: false, error: { code: "FORBIDDEN", message: "Cloud Scheduler delivery required." } });
    return;
  }
  try {
    await assertActiveCorpus();
    const requeued = await retryDeferredEnqueues();
    const known = await corpusCollection("topicLedgers").orderBy("updatedAt", "desc").limit(200).get();
    const knownSummary = known.docs.map((document) => String(document.data().displayTitle || document.data().normalizedTitle)).join(", ");
    const discovered = await discoverTopics(knownSummary);
    const candidates = discovered.candidates
      .slice(0, MAX_DISCOVERY_CANDIDATES)
      .sort((left, right) => right.relevanceScore - left.relevanceScore || left.title.localeCompare(right.title));
    const promoted = [];
    for (const candidate of candidates) {
      if (promoted.length >= MAX_DISCOVERY_PROMOTIONS) break;
      const task = await claimAutonomousTopic(candidate.title, candidate.significance, candidate.relevanceScore);
      if (task) promoted.push({ title: candidate.title, topicId: task.topicId });
    }
    await corpusCollection("adminOperations").doc(`discovery--${Date.now()}`).create(corpusRecord({
      operationType: "autonomous_topic_discovery",
      candidateCount: candidates.length,
      promoted,
      modelProvenance: discovered.execution,
      researchHash: discovered.execution.responseHash,
      createdAt: Timestamp.now()
    }));
    response.status(200).json({ ok: true, data: { evaluated: candidates.length, promoted, requeued } });
  } catch (error) {
    console.error(JSON.stringify({ severity: "ERROR", component: "topic_discovery", message: error instanceof Error ? error.message : String(error) }));
    response.status(500).json({ ok: false, error: { code: "DISCOVERY_FAILED", message: "Topic discovery failed." } });
  }
}
