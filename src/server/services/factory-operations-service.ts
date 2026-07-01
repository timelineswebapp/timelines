import { randomUUID } from "node:crypto";
import { ApiError } from "@/src/server/api/responses";
import { workflowStages, type TopicWorkItem, type WorkflowStage } from "@/src/server/factory-operations/contracts";
import { factoryOperationsRepository as repository } from "@/src/server/repositories/factory-operations-repository";
import { factoryService } from "@/src/server/services/factory-service";
import { governanceService } from "@/src/server/services/governance-service";
import { historicalLibraryService } from "@/src/server/services/historical-library-service";
import { publicationVerificationService } from "@/src/server/services/publication-verification-service";

const nextStage: Record<WorkflowStage, WorkflowStage> = {
  queued: "research", research: "extraction", extraction: "publication_candidate",
  publication_candidate: "founder_review", founder_review: "governance",
  governance: "library_admission", library_admission: "published",
  published: "completed", completed: "completed"
};
const waitingStages = new Set<WorkflowStage>(["founder_review", "governance"]);
const WORKER_LEASE_SECONDS = 180;

type TopicExecutionOutcome = {
  topicId: string;
  leasedType: "factory_topic_work_item";
  outcome: "advanced" | "requeued" | "failed" | "skipped";
  previousState: { status: TopicWorkItem["status"]; stage: WorkflowStage };
  nextState: { status: TopicWorkItem["status"]; stage: WorkflowStage };
  reason: string;
};

function assertReplayBoundary(stage: WorkflowStage, topic: TopicWorkItem) {
  if (workflowStages.indexOf(stage) > workflowStages.indexOf(topic.lastCertifiedStage)) {
    throw new ApiError(409, "INVALID_REPLAY_BOUNDARY", "Replay cannot skip beyond the last certified boundary.");
  }
}

export const factoryOperationsService = {
  addTopic: repository.addTopic.bind(repository),
  getSnapshot: repository.getSnapshot.bind(repository),
  getFounderInbox: repository.listInbox.bind(repository),
  getTopicDetail: repository.getTopicDetail.bind(repository),

  async control(input: { action: "start" | "stop" | "pause_after_current" | "resume" | "run_one_cycle" | "configure"; actor: string; concurrency?: number; pollIntervalMs?: number }) {
    const modes = { start: "running", stop: "stopped", pause_after_current: "pause_after_current", resume: "running" } as const;
    if (input.action === "run_one_cycle") return this.runCycle({ actor: input.actor, force: true });
    if (input.action === "configure") {
      if (!input.concurrency || !input.pollIntervalMs) throw new ApiError(400, "OPERATIONS_CONFIGURATION_REQUIRED", "Concurrency and polling interval are required.");
      return repository.configureControl({ concurrency: input.concurrency, pollIntervalMs: input.pollIntervalMs, actor: input.actor });
    }
    return repository.setControl(modes[input.action], input.actor);
  },

  async mutateTopic(input: { topicId: string; action: "remove" | "reprioritize" | "retry" | "cancel" | "pause" | "resume" | "replay"; priority?: number; replayStage?: WorkflowStage; actor: string }) {
    const topic = await repository.getTopic(input.topicId);
    if (input.action === "reprioritize" && (!Number.isInteger(input.priority) || input.priority! < 0 || input.priority! > 100)) {
      throw new ApiError(400, "INVALID_TOPIC_PRIORITY", "Topic priority must be an integer from 0 through 100.");
    }
    if (input.action === "retry" && !["failed", "dead_letter"].includes(topic.status)) {
      throw new ApiError(409, "RETRY_NOT_FAILED", "Only failed or dead-letter workflow stages may be retried.");
    }
    if (input.action === "replay") {
      if (!input.replayStage) throw new ApiError(400, "REPLAY_STAGE_REQUIRED", "A certified replay stage is required.");
      assertReplayBoundary(input.replayStage, topic);
      const updated = await repository.scheduleReplay({ topicId: topic.id, boundary: input.replayStage, actor: input.actor });
      await repository.appendHistory(topic.id, "replay", topic.currentStage, updated.currentStage, "control", topic.retryCount, { actor: input.actor });
      await repository.notify({ topicId: topic.id, category: "replay_request", severity: "warning", title: `Replay requested: ${topic.title}`, message: `Replay scheduled from ${input.replayStage}.`, deduplicationKey: `${topic.workflowId}:replay:${input.replayStage}:${topic.retryCount}` });
      return updated;
    }
    let patch: Parameters<typeof repository.updateTopic>[1];
    if (input.action === "reprioritize") patch = { priority: input.priority, actor: input.actor };
    else if (input.action === "remove" || input.action === "cancel") patch = { status: "cancelled", actor: input.actor };
    else if (input.action === "pause") patch = { status: "paused", actor: input.actor };
    else if (input.action === "resume" || input.action === "retry") {
      if (input.action === "resume" && topic.status === "waiting" && topic.currentStage === "founder_review") {
        const draftId = topic.stageContext.factoryPackageDraftId;
        if (typeof draftId !== "string") throw new ApiError(409, "PACKAGE_LINEAGE_REQUIRED", "Founder review requires persisted package lineage.");
        await factoryService.assertEditorialBoundaryCompleted(draftId);
        await factoryService.continueEditorialPackageToGovernanceReady(draftId);
        const publicationRunId = topic.stageContext.publicationPipelineRunId;
        const handoff = (await factoryService.getGovernanceHandoffByDraft(draftId)) || await factoryService.prepareGovernanceHandoff({
          factoryPackageDraftId: draftId, pipelineRunId: typeof publicationRunId === "string" ? publicationRunId : null,
          actor: "factory-operations", reason: "PE-002 automatic Governance handoff"
        });
        const submitted = await factoryService.submitToGovernance({
          handoffId: handoff.handoffId,
          actor: { actorId: "factory-operations", role: "factory_editor", institutionId: "factory" },
          reason: "PE-002 automatic package submission"
        });
        await governanceService.submitPackage({
          id: submitted.governancePackage.packageId,
          actor: { actorId: "factory-operations", role: "governance_reviewer", institutionId: "governance" },
          reason: "Certified Factory handoff entered Governance review"
        });
        await repository.mergeTopicContext(topic.id, {
          governanceHandoffId: handoff.handoffId,
          governancePublicationPackageId: submitted.governancePackage.packageId
        });
        await repository.appendInstitutionalEvent({
          topic, institution: "governance", eventType: "package_submitted", boundaryStage: "governance",
          authorityRefs: [{ authorityType: "publication_package", authorityId: submitted.governancePackage.packageId }],
          idempotencyKey: `${topic.workflowId}:governance:submitted`
        });
        await repository.resolveNotifications(topic.id, "editorial_review_required");
        await repository.notify({
          topicId: topic.id, category: "governance_approval_required", severity: "info",
          title: `Governance decision required: ${topic.title}`, message: "The package is submitted and awaits a certified Governance decision.",
          deduplicationKey: `${topic.workflowId}:governance-required`
        });
        patch = { status: "waiting", stage: "governance", actor: input.actor };
      } else if (input.action === "resume" && topic.status === "waiting" && topic.currentStage === "governance") {
        const packageId = topic.stageContext.governancePublicationPackageId;
        if (typeof packageId !== "string") throw new ApiError(409, "GOVERNANCE_LINEAGE_REQUIRED", "Governance continuation requires persisted package lineage.");
        const publicationPackage = await factoryService.getGovernancePublicationPackage(packageId);
        if (!publicationPackage || !["accepted", "published"].includes(publicationPackage.lifecycle) || !publicationPackage.readinessCertification) {
          throw new ApiError(409, "GOVERNANCE_DECISION_INCOMPLETE", "A certified accepted Governance package is required.");
        }
        const decisionId = publicationPackage.decisionRefs.at(-1);
        if (!decisionId) throw new ApiError(409, "GOVERNANCE_DECISION_REQUIRED", "Accepted package has no Governance decision lineage.");
        const admission = await historicalLibraryService.admitPublicationPackage({
          packageId, governanceDecisionId: decisionId,
          actor: { actorId: "factory-operations", role: "library_editor", institutionId: "historical_library" },
          reason: "PE-002 automatic admission", requestedByService: "historical_library"
        });
        if (publicationPackage.lifecycle === "accepted") {
          await governanceService.publishPackage({
            id: packageId, governanceDecisionId: decisionId,
            actor: { actorId: "factory-operations", role: "library_editor", institutionId: "historical_library" },
            reason: "PE-002 publication after admission"
          });
        }
        const verification = await publicationVerificationService.verify(packageId);
        await repository.recordVerification({ topicId: topic.id, packageId, checks: verification.checks, failures: verification.failures });
        if (verification.failures.length) {
          await repository.notify({
            topicId: topic.id, category: "publication_verification_failure", severity: "critical",
            title: `Publication verification failed: ${topic.title}`, message: verification.failures.join(", "),
            deduplicationKey: `${topic.workflowId}:verification-failed`, details: verification
          });
          throw new ApiError(409, "PUBLICATION_VERIFICATION_FAILED", "Automatic publication verification failed.", verification);
        }
        await repository.mergeTopicContext(topic.id, { historicalLibraryAdmissionId: admission.admission.admissionId });
        for (const [institution, eventType] of [["historical_library", "admitted"], ["published_memory", "snapshots_created"], ["projection", "generated"], ["verification", "passed"]] as const) {
          await repository.appendInstitutionalEvent({ topic, institution, eventType, boundaryStage: "completed", idempotencyKey: `${topic.workflowId}:${institution}:${eventType}` });
        }
        await repository.resolveNotifications(topic.id, "governance_approval_required");
        patch = { status: "queued", stage: "published", actor: input.actor };
      } else {
        patch = { status: "queued", retryCount: input.action === "retry" ? 0 : undefined, actor: input.actor };
      }
    }
    else throw new ApiError(400, "INVALID_TOPIC_ACTION", "Unsupported Topic action.");
    const updated = await repository.updateTopic(input.topicId, patch);
    await repository.appendHistory(topic.id, input.action, topic.currentStage, updated.currentStage, "control", topic.retryCount, { actor: input.actor });
    return updated;
  },

  async executeLeasedTopic(topic: TopicWorkItem, workerId: string): Promise<TopicExecutionOutcome> {
    if (topic.status !== "running" || topic.leaseOwner !== workerId) {
      const reason = "authoritative_lease_not_owned";
      await repository.notify({
        topicId: topic.id, category: "factory_execution_skipped", severity: "warning",
        title: `Factory execution skipped: ${topic.title}`,
        message: "The leased Topic was not processed because the dispatcher did not own its authoritative lease.",
        deduplicationKey: `${topic.workflowId}:execution-skipped:${topic.executionGeneration}:${topic.currentStage}`
      });
      console.warn(JSON.stringify({
        level: "warn", component: "factory_operations", event: "topic_execution_skipped",
        leasedId: topic.id, leasedType: "factory_topic_work_item", workerId,
        previousState: { status: topic.status, stage: topic.currentStage },
        nextState: { status: topic.status, stage: topic.currentStage }, reason
      }));
      return {
        topicId: topic.id, leasedType: "factory_topic_work_item", outcome: "skipped",
        previousState: { status: topic.status, stage: topic.currentStage },
        nextState: { status: topic.status, stage: topic.currentStage }, reason
      };
    }
    const from = topic.currentStage;
    let to = nextStage[from];
    await repository.appendHistory(topic.id, "stage_execute", from, from, "started", topic.retryCount + 1, { workerId });
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
          pipelineRunId: typeof topic.stageContext[`${from.replace("_candidate", "")}PipelineRunId`] === "string"
            ? topic.stageContext[`${from.replace("_candidate", "")}PipelineRunId`] as string
            : undefined,
          maxWorkers: from === "research" ? undefined : 1,
          actor: "factory-operations",
          reason: `PE-001 workflow ${topic.workflowId}`
        });
        if (!run) throw new ApiError(500, "FACTORY_PIPELINE_NO_RESULT", "Factory pipeline returned no persisted run.");
        context[`${from.replace("_candidate", "")}PipelineRunId`] = run.pipelineRunId;
        if (run.status === "running") to = from;
        if (run.packageDraftId) context.factoryPackageDraftId = run.packageDraftId;
        if (from === "publication_candidate" && run.packageDraftId) {
          const researchPipelineRunId = topic.stageContext.researchPipelineRunId;
          const extractionPipelineRunId = topic.stageContext.extractionPipelineRunId;
          if (typeof researchPipelineRunId !== "string" || typeof extractionPipelineRunId !== "string") {
            throw new ApiError(409, "EDITORIAL_POLICY_LINEAGE_REQUIRED", "Editorial policy requires certified Research and Extraction lineage.");
          }
          const policy = await factoryService.applyEditorialReviewPolicy({
            factoryPackageDraftId: run.packageDraftId,
            researchPipelineRunId,
            extractionPipelineRunId,
            actor: "factory-operations"
          });
          context.editorialReviewOutcome = policy.outcome;
          context.editorialReviewReasons = policy.reasons;
          if (policy.outcome === "routine") {
            await factoryService.continueEditorialPackageToGovernanceReady(run.packageDraftId);
            const handoff = await factoryService.prepareGovernanceHandoff({
              factoryPackageDraftId: run.packageDraftId, pipelineRunId: run.pipelineRunId,
              actor: "factory-operations", reason: "Routine editorial policy Governance handoff"
            });
            const submitted = await factoryService.submitToGovernance({
              handoffId: handoff.handoffId,
              actor: { actorId: "factory-operations", role: "factory_editor", institutionId: "factory" },
              reason: "Routine editorial policy submission"
            });
            await governanceService.submitPackage({
              id: submitted.governancePackage.packageId,
              actor: { actorId: "factory-operations", role: "governance_reviewer", institutionId: "governance" },
              reason: "Routine editorial policy entered Governance review"
            });
            context.governanceHandoffId = handoff.handoffId;
            context.governancePublicationPackageId = submitted.governancePackage.packageId;
            to = "governance";
          }
        }
      }
      const status = to === "completed" ? "completed" : waitingStages.has(to) ? "waiting" : "queued";
      const updated = await repository.advance(topic.id, workerId, from, to, status, context);
      await repository.appendHistory(topic.id, "stage_execute", from, to, waitingStages.has(to) ? "waiting" : "succeeded", topic.retryCount + 1, { workerId, ...context });
      await repository.appendInstitutionalEvent({
        topic, institution: to === "governance" ? "governance" : "factory", eventType: "stage_completed",
        boundaryStage: to, payload: context, idempotencyKey: `${topic.workflowId}:stage:${to}:${topic.retryCount}`
      });
      if (to === "founder_review") {
        await repository.notify({
          topicId: topic.id, category: "editorial_review_required", severity: "info",
          title: `Editorial review required: ${topic.title}`, message: "Factory candidate generation completed and awaits editorial review.",
          deduplicationKey: `${topic.workflowId}:editorial-required`
        });
      }
      const reason = to === from ? "pipeline_stage_in_progress" : "workflow_stage_advanced";
      const outcome = to === from ? "requeued" : "advanced";
      console.info(JSON.stringify({
        level: "info", component: "factory_operations", event: "topic_execution_completed",
        leasedId: topic.id, leasedType: "factory_topic_work_item", workerId,
        previousState: { status: topic.status, stage: from },
        nextState: { status: updated.status, stage: updated.currentStage }, reason
      }));
      return {
        topicId: topic.id, leasedType: "factory_topic_work_item", outcome,
        previousState: { status: topic.status, stage: from },
        nextState: { status: updated.status, stage: updated.currentStage }, reason
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown workflow stage failure";
      if (error instanceof ApiError && ["LEASE_LOST", "WORKFLOW_STATE_CONFLICT"].includes(error.code)) {
        const reason = error.code.toLowerCase();
        await repository.notify({
          topicId: topic.id, category: "factory_execution_skipped", severity: "warning",
          title: `Factory execution skipped: ${topic.title}`, message,
          deduplicationKey: `${topic.workflowId}:execution-skipped:${topic.executionGeneration}:${from}`
        });
        console.warn(JSON.stringify({
          level: "warn", component: "factory_operations", event: "stale_executor_terminated",
          leasedId: topic.id, leasedType: "factory_topic_work_item", workerId,
          previousState: { status: topic.status, stage: from },
          nextState: { status: topic.status, stage: from }, reason, message
        }));
        return {
          topicId: topic.id, leasedType: "factory_topic_work_item", outcome: "skipped",
          previousState: { status: topic.status, stage: from },
          nextState: { status: topic.status, stage: from }, reason
        };
      }
      const status = await repository.fail(topic, workerId, message);
      await repository.appendHistory(topic.id, "stage_execute", from, from, "failed", topic.retryCount + 1, { workerId, status, message });
      await repository.notify({
        topicId: topic.id, category: from === "research" || from === "extraction" ? "evidence_problem" : "failed_factory_run",
        severity: status === "dead_letter" ? "critical" : "warning", title: `Factory stage failed: ${topic.title}`,
        message, deduplicationKey: `${topic.workflowId}:failure:${from}:${topic.retryCount + 1}`
      });
      console.error(JSON.stringify({ level: "error", component: "factory_operations", event: "topic_stage_failed", topicId: topic.id, workflowId: topic.workflowId, stage: from, message }));
      return {
        topicId: topic.id, leasedType: "factory_topic_work_item", outcome: "failed",
        previousState: { status: topic.status, stage: from },
        nextState: { status, stage: from }, reason: message
      };
    }
  },

  async runCycle(input: { actor: string; force?: boolean }) {
    const control = await repository.getControl();
    if (!input.force && control.mode !== "running" && control.mode !== "pause_after_current") {
      return { leased: 0, completed: 0, mode: control.mode };
    }
    const waiting = await repository.listActionableWaitingTopics(control.concurrency * 4);
    for (const topic of waiting) {
      try {
        await this.mutateTopic({ topicId: topic.id, action: "resume", actor: "factory-operations" });
      } catch (error) {
        if (!(error instanceof ApiError) || !["FOUNDER_REVIEW_INCOMPLETE", "GOVERNANCE_DECISION_INCOMPLETE"].includes(error.code)) throw error;
      }
    }
    const workerPrefix = `dispatcher-${randomUUID()}`;
    const leases = (await Promise.all(Array.from({ length: control.concurrency }, async (_, index) => {
      const workerId = `${workerPrefix}-${index}`;
      const topic = await repository.leaseNext(workerId, WORKER_LEASE_SECONDS, input.force);
      return topic ? { topic, workerId } : null;
    }))).filter((lease): lease is {
      topic: TopicWorkItem & {
        leasedPreviousStatus: TopicWorkItem["status"];
        leasedPreviousStage: WorkflowStage;
      };
      workerId: string;
    } => Boolean(lease));
    for (const { topic, workerId } of leases) {
      console.info(JSON.stringify({
        level: "info", component: "factory_operations", event: "topic_leased",
        leasedId: topic.id, leasedType: "factory_topic_work_item", workerId,
        previousState: { status: topic.leasedPreviousStatus, stage: topic.leasedPreviousStage },
        nextState: { status: topic.status, stage: topic.currentStage }, reason: "scheduler_lease_acquired"
      }));
    }
    const settled = await Promise.allSettled(
      leases.map(({ topic, workerId }) => this.executeLeasedTopic(topic, workerId))
    );
    await Promise.all(settled.map(async (result, index) => {
      if (result.status === "fulfilled") return;
      const { topic } = leases[index]!;
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      await repository.notify({
        topicId: topic.id, category: "factory_execution_skipped", severity: "critical",
        title: `Factory execution blocked: ${topic.title}`, message: reason,
        deduplicationKey: `${topic.workflowId}:execution-blocked:${topic.executionGeneration}:${topic.currentStage}`
      });
    }));
    const outcomes = settled.map((result, index): TopicExecutionOutcome => {
      if (result.status === "fulfilled") return result.value;
      const { topic } = leases[index]!;
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(JSON.stringify({
        level: "error", component: "factory_operations", event: "topic_execution_unhandled",
        leasedId: topic.id, leasedType: "factory_topic_work_item",
        previousState: { status: topic.status, stage: topic.currentStage },
        nextState: { status: topic.status, stage: topic.currentStage }, reason
      }));
      return {
        topicId: topic.id, leasedType: "factory_topic_work_item", outcome: "failed",
        previousState: { status: topic.status, stage: topic.currentStage },
        nextState: { status: topic.status, stage: topic.currentStage }, reason
      };
    });
    if (control.mode === "pause_after_current") await repository.setControl("paused", input.actor);
    return {
      leased: leases.length,
      completed: outcomes.filter((outcome) => outcome.outcome === "advanced").length,
      advanced: outcomes.filter((outcome) => outcome.outcome === "advanced").length,
      requeued: outcomes.filter((outcome) => outcome.outcome === "requeued").length,
      failed: outcomes.filter((outcome) => outcome.outcome === "failed").length,
      skipped: outcomes.filter((outcome) => outcome.outcome === "skipped").length,
      outcomes,
      mode: control.mode
    };
  }
};
