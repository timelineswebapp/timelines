import type { Request, Response } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./firestore";
import { discoverTopics, researchTopic } from "./vertex";

const PILOT_ID = process.env.NON_PUBLIC_COST_PILOT_ID || "";
const MAX_DISCOVERY_CARDS = 500;
const MAX_DOSSIERS = 50;
const CARDS_PER_INVOCATION = 10;
const PILOT_DURATION_MS = 24 * 60 * 60 * 1000;

type PilotState = {
  pilotId: string;
  mode: "NON_PUBLIC_COST_MEASUREMENT";
  startedAt: Timestamp;
  expiresAt: Timestamp;
  status: "RUNNING" | "COMPLETE";
  discoveryCards: number;
  dossiers: number;
  functionInvocations: number;
  firestoreDocumentWrites: number;
};

function requireScheduler(request: Request, response: Response): boolean {
  const delivery = request.header("x-cloudscheduler") || request.header("x-cloud-scheduler");
  if (!delivery && process.env.FUNCTIONS_EMULATOR !== "true") {
    response.status(403).json({ ok: false, error: { code: "FORBIDDEN", message: "Cloud Scheduler delivery required." } });
    return false;
  }
  return true;
}

function assertPilotConfiguration(): string {
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/u.test(PILOT_ID)) {
    throw new Error("NON_PUBLIC_COST_PILOT_ID must be an explicit lowercase pilot identifier.");
  }
  return PILOT_ID;
}

function pilotReference(pilotId: string) {
  return db.collection("nonPublicFactoryPilots").doc(pilotId);
}

function isExpired(state: PilotState, now: Timestamp): boolean {
  return now.toMillis() >= state.expiresAt.toMillis();
}

type TokenUsage = { promptTokens: number; outputTokens: number; thoughtTokens: number; totalTokens: number };

function tokenUsage(value: unknown): TokenUsage {
  if (!value || typeof value !== "object") return { promptTokens: 0, outputTokens: 0, thoughtTokens: 0, totalTokens: 0 };
  const usage = value as Record<string, unknown>;
  const number = (key: string) => typeof usage[key] === "number" && Number.isFinite(usage[key]) ? usage[key] as number : 0;
  if ("discoveryResearch" in usage || "discoveryStructured" in usage) {
    const research = tokenUsage(usage.discoveryResearch);
    const structured = tokenUsage(usage.discoveryStructured);
    return {
      promptTokens: research.promptTokens + structured.promptTokens,
      outputTokens: research.outputTokens + structured.outputTokens,
      thoughtTokens: research.thoughtTokens + structured.thoughtTokens,
      totalTokens: research.totalTokens + structured.totalTokens
    };
  }
  return {
    promptTokens: number("promptTokenCount"),
    outputTokens: number("candidatesTokenCount"),
    thoughtTokens: number("thoughtsTokenCount"),
    totalTokens: number("totalTokenCount")
  };
}

export async function runNonPublicCostPilot(request: Request, response: Response) {
  if (!requireScheduler(request, response)) return;
  const started = Date.now();
  try {
    const pilotId = assertPilotConfiguration();
    const reference = pilotReference(pilotId);
    const now = Timestamp.now();
    const snapshot = await reference.get();
    let state: PilotState;
    if (!snapshot.exists) {
      state = {
        pilotId,
        mode: "NON_PUBLIC_COST_MEASUREMENT",
        startedAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + PILOT_DURATION_MS),
        status: "RUNNING",
        discoveryCards: 0,
        dossiers: 0,
        functionInvocations: 0,
        firestoreDocumentWrites: 0
      };
      await reference.create({
        ...state,
        publicRelease: false,
        governanceSubmission: false,
        publication: false,
        automaticPublicRelease: false,
        storageWrites: 0,
        createdAt: now,
        updatedAt: now
      });
    } else {
      state = snapshot.data() as PilotState;
    }

    if (state.mode !== "NON_PUBLIC_COST_MEASUREMENT" || state.status !== "RUNNING" || isExpired(state, now) || state.discoveryCards >= MAX_DISCOVERY_CARDS || state.dossiers >= MAX_DOSSIERS) {
      await reference.set({ status: "COMPLETE", completedAt: now, completionReason: isExpired(state, now) ? "PILOT_WINDOW_ELAPSED" : "CAP_REACHED", updatedAt: now }, { merge: true });
      response.status(200).json({ ok: true, data: { status: "COMPLETE", discoveryCards: state.discoveryCards, dossiers: state.dossiers } });
      return;
    }

    const cards = await reference.collection("discoveryCards").orderBy("createdAt", "desc").limit(200).get();
    const knownTitles = cards.docs.map((item) => String(item.data().title || "")).filter(Boolean).join(", ");
    const discovery = await discoverTopics(knownTitles);
    const knownNormalized = new Set(cards.docs.map((item) => String(item.data().normalizedTitle || "")));
    const available = MAX_DISCOVERY_CARDS - state.discoveryCards;
    const selected = discovery.candidates
      .filter((candidate) => !knownNormalized.has(candidate.title.trim().toLocaleLowerCase("en-US")))
      .slice(0, Math.min(CARDS_PER_INVOCATION, available));

    const batch = db.batch();
    for (const candidate of selected) {
      const normalizedTitle = candidate.title.trim().toLocaleLowerCase("en-US");
      const card = reference.collection("discoveryCards").doc();
      batch.create(card, {
        title: candidate.title.trim(),
        normalizedTitle,
        significance: candidate.significance,
        relevanceScore: candidate.relevanceScore,
        nonPublic: true,
        governanceSubmission: false,
        publication: false,
        automaticPublicRelease: false,
        discoveryExecution: discovery.execution,
        createdAt: now
      });
    }
    if (selected.length > 0) await batch.commit();

    let dossierWritten = 0;
    let dossierUsage: unknown = null;
    const dossierCandidate = selected[0];
    if (dossierCandidate && state.dossiers < MAX_DOSSIERS) {
      const research = await researchTopic(dossierCandidate.title);
      await reference.collection("dossiers").doc().create({
        title: dossierCandidate.title.trim(),
        significance: dossierCandidate.significance,
        sources: research.sources,
        evidenceSegments: research.evidenceSegments,
        researchBody: research.body,
        execution: research.execution,
        researchMetrics: research.researchMetrics,
        nonPublic: true,
        governanceSubmission: false,
        publication: false,
        automaticPublicRelease: false,
        createdAt: now
      });
      dossierWritten = 1;
      dossierUsage = research.execution.usageMetadata;
    }

    const writes = selected.length + dossierWritten + 1;
    const discoveryUsage = tokenUsage(discovery.execution.usageMetadata);
    const dossierTokens = tokenUsage(dossierUsage);
    const totalUsage: TokenUsage = {
      promptTokens: discoveryUsage.promptTokens + dossierTokens.promptTokens,
      outputTokens: discoveryUsage.outputTokens + dossierTokens.outputTokens,
      thoughtTokens: discoveryUsage.thoughtTokens + dossierTokens.thoughtTokens,
      totalTokens: discoveryUsage.totalTokens + dossierTokens.totalTokens
    };
    await reference.set({
      discoveryCards: FieldValue.increment(selected.length),
      dossiers: FieldValue.increment(dossierWritten),
      functionInvocations: FieldValue.increment(1),
      firestoreDocumentWrites: FieldValue.increment(writes),
      vertexUsage: {
        promptTokens: FieldValue.increment(totalUsage.promptTokens),
        outputTokens: FieldValue.increment(totalUsage.outputTokens),
        thoughtTokens: FieldValue.increment(totalUsage.thoughtTokens),
        totalTokens: FieldValue.increment(totalUsage.totalTokens),
        measuredInvocations: FieldValue.increment(1)
      },
      lastInvocation: {
        at: now,
        latencyMs: Date.now() - started,
        discoveryCardsCreated: selected.length,
        dossiersCreated: dossierWritten,
        vertex: {
          discoveryUsageMetadata: discovery.execution.usageMetadata,
          dossierUsageMetadata: dossierUsage,
          aggregateTokens: totalUsage
        },
        storageWrites: 0
      },
      updatedAt: Timestamp.now()
    }, { merge: true });
    response.status(200).json({ ok: true, data: { status: "RUNNING", discoveryCardsCreated: selected.length, dossiersCreated: dossierWritten } });
  } catch (error) {
    console.error(JSON.stringify({ severity: "ERROR", component: "non_public_cost_pilot", message: error instanceof Error ? error.message : String(error) }));
    response.status(500).json({ ok: false, error: { code: "PILOT_FAILED", message: "Non-public cost pilot invocation failed." } });
  }
}
