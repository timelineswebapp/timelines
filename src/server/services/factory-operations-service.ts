import { randomUUID } from "node:crypto";
import { ApiError } from "@/src/server/api/responses";
import { workflowStages, type TopicWorkItem, type WorkflowStage } from "@/src/server/factory-operations/contracts";
import { factoryOperationsRepository as repository } from "@/src/server/repositories/factory-operations-repository";
import { factoryService } from "@/src/server/services/factory-service";

const nextStage: Record<WorkflowStage, WorkflowStage> = {
  queued: "research", research: "extraction", extraction: "publication_candidate",
  publication_candidate: "founder_review", founder_review: "governance",
  governance: "library_admission", library_admission: "published",
  published: "completed", completed: "completed"
};
const waitingStages = new Set<WorkflowStage>(["founder_review", "governance"]);

function assertReplayBoundary(stage: WorkflowStage, topic: TopicWorkItem) {
  if (workflowStages.indexOf(stage) > workflowStages.indexOf(topic.lastCertifiedStage)) {
    throw new ApiError(409, "INVALID_REPLAY_BOUNDARY", "Replay cannot skip beyond the last certified boundary.");
  }
}

export const factoryOperationsService = {
  addTopic: repository.addTopic.bind(repository),
  getSnapshot: repository.getSnapshot.bind(repository),

  async control(input: { action: "start" | "stop" | "pause_after_current" | "resume" | "run_one_cycle"; actor: string }) {
    const modes = { start: "running", stop: "stopped", pause_after_current: "pause_after_current", resume: "running" } as const;
    if (input.action === "run_one_cycle") return this.runCycle({ actor: input.actor, force: true });
    return repository.setControl(modes[input.action], input.actor);
  },

  async mutateTopic(input: { topicId: string; action: "remove" | "reprioritize" | "retry" | "cancel" | "pause" | "resume" | "replay"; priority?: number; replayStage?: WorkflowStage; actor: string }) {
    const topic = await repository.getTopic(input.topicId);
    let patch: Parameters<typeof repository.updateTopic>[1];
    if (input.action === "reprioritize") patch = { priority: input.priority, actor: input.actor };
    else if (input.action === "remove" || input.action === "cancel") patch = { status: "cancelled", actor: input.actor };
    else if (input.action === "pause") patch = { status: "paused", actor: input.actor };
    else if (input.action === "resume" || input.action === "retry") {
      if (input.action === "resume" && topic.status === "waiting" && topic.currentStage === "founder_review") {
        const draftId = topic.stageContext.factoryPackageDraftId;
        if (typeof draftId !== "string") throw new ApiError(409, "PACKAGE_LINEAGE_REQUIRED", "Founder review requires persisted package lineage.");
        await factoryService.assertEditorialBoundaryCompleted(draftId);
        patch = { status: "waiting", stage: "governance", actor: input.actor };
      } else {
        patch = { status: "queued", retryCount: input.action === "retry" ? 0 : undefined, actor: input.actor };
      }
    }
    else {
      if (!input.replayStage) throw new ApiError(400, "REPLAY_STAGE_REQUIRED", "A certified replay stage is required.");
      assertReplayBoundary(input.replayStage, topic);
      patch = { status: "queued", stage: input.replayStage, retryCount: 0, actor: input.actor };
    }
    const updated = await repository.updateTopic(input.topicId, patch);
    await repository.appendHistory(topic.id, input.action, topic.currentStage, updated.currentStage, "control", topic.retryCount, { actor: input.actor });
    return updated;
  },

  async executeLeasedTopic(topic: TopicWorkItem, workerId: string) {
    const from = topic.currentStage;
    const to = nextStage[from];
    await repository.appendHistory(topic.id, "stage_execute", from, to, "started", topic.retryCount + 1, { workerId });
    try {
      const context: Record<string, unknown> = {};
      const pipelineInput: Record<string, unknown> = { subject: topic.title, topic: topic.title, workflowId: topic.workflowId };
      if (from === "extraction") {
        const researchRunId = topic.stageContext.researchPipelineRunId;
        if (typeof researchRunId !== "string") throw new ApiError(409, "RESEARCH_LINEAGE_REQUIRED", "Extraction requires the persisted research pipeline lineage.");
        pipelineInput.validatedEvidenceRefs = await factoryService.getPipelineValidatedEvidence(researchRunId);
      }
      if (from === "research" || from === "extraction" || from === "publication_candidate") {
        const pipelineIds = {
          research: "historical_research_pipeline",
          extraction: "historical_extraction_pipeline",
          publication_candidate: "publication_candidate_pipeline"
        } as const;
        const run = await factoryService.startPipeline({
          pipelineId: pipelineIds[from],
          input: pipelineInput,
          actor: "factory-operations",
          reason: `PE-001 workflow ${topic.workflowId}`
        });
        if (!run) throw new ApiError(500, "FACTORY_PIPELINE_NO_RESULT", "Factory pipeline returned no persisted run.");
        context[`${from.replace("_candidate", "")}PipelineRunId`] = run.pipelineRunId;
        if (run.packageDraftId) context.factoryPackageDraftId = run.packageDraftId;
      }
      const status = to === "completed" ? "completed" : waitingStages.has(to) ? "waiting" : "queued";
      const updated = await repository.advance(topic.id, workerId, from, to, status, context);
      await repository.appendHistory(topic.id, "stage_execute", from, to, waitingStages.has(to) ? "waiting" : "succeeded", topic.retryCount + 1, { workerId, ...context });
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown workflow stage failure";
      const status = await repository.fail(topic, workerId, message);
      await repository.appendHistory(topic.id, "stage_execute", from, from, "failed", topic.retryCount + 1, { workerId, status, message });
      console.error(JSON.stringify({ level: "error", component: "factory_operations", event: "topic_stage_failed", topicId: topic.id, workflowId: topic.workflowId, stage: from, message }));
      return null;
    }
  },

  async runCycle(input: { actor: string; force?: boolean }) {
    const control = await repository.getControl();
    if (!input.force && control.mode !== "running" && control.mode !== "pause_after_current") {
      return { leased: 0, completed: 0, mode: control.mode };
    }
    const workerPrefix = `dispatcher-${randomUUID()}`;
    const topics = (await Promise.all(Array.from({ length: control.concurrency }, (_, index) =>
      repository.leaseNext(`${workerPrefix}-${index}`, 60, input.force)))).filter((topic): topic is TopicWorkItem => Boolean(topic));
    await Promise.allSettled(topics.map((topic, index) => this.executeLeasedTopic(topic, `${workerPrefix}-${index}`)));
    if (control.mode === "pause_after_current") await repository.setControl("paused", input.actor);
    return { leased: topics.length, completed: topics.length, mode: control.mode };
  }
};
