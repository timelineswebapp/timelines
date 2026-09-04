import type { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./firestore";
import { MAX_DISCOVERY_CANDIDATES, MAX_DISCOVERY_PROMOTIONS } from "./config";
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
    const payload = taskPayloadSchema.parse(request.body);
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
    const payload = institutionalTaskPayloadSchema.parse(request.body);
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
    const requeued = await retryDeferredEnqueues();
    const known = await db.collection("topicLedgers").orderBy("updatedAt", "desc").limit(200).get();
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
    await db.collection("adminOperations").doc(`discovery--${Date.now()}`).create({
      operationType: "autonomous_topic_discovery",
      candidateCount: candidates.length,
      promoted,
      modelProvenance: discovered.execution,
      researchHash: discovered.execution.responseHash,
      createdAt: Timestamp.now()
    });
    response.status(200).json({ ok: true, data: { evaluated: candidates.length, promoted, requeued } });
  } catch (error) {
    console.error(JSON.stringify({ severity: "ERROR", component: "topic_discovery", message: error instanceof Error ? error.message : String(error) }));
    response.status(500).json({ ok: false, error: { code: "DISCOVERY_FAILED", message: "Topic discovery failed." } });
  }
}
