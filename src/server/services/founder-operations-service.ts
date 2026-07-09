import { ApiError } from "@/src/server/api/responses";
import type { FounderAction, FounderActivity, FounderHomeReadModel, FounderInboxItem } from "@/src/server/founder/contracts";
import { founderFactoryMode } from "@/src/server/founder/contracts";
import { factoryOperationsRepository } from "@/src/server/repositories/factory-operations-repository";
import { requestRepository } from "@/src/server/repositories/request-repository";
import { factoryOperationsService } from "@/src/server/services/factory-operations-service";
import { reliabilityService } from "@/src/server/services/reliability-service";

function healthStatus(value: string): "Healthy" | "Warning" | "Critical" {
  const normalized = value.toLowerCase();
  if (normalized.includes("critical") || normalized.includes("failed") || normalized.includes("down")) return "Critical";
  if (normalized.includes("warning") || normalized.includes("degraded")) return "Warning";
  return "Healthy";
}

function actionsFor(category: string): FounderAction[] {
  if (category === "editorial_review_required" || category === "governance_approval_required") {
    return ["approve", "return_for_revision", "reject"];
  }
  if (category === "failed_factory_run" || category === "publication_verification_failure" || category === "evidence_problem") {
    return ["retry", "dismiss"];
  }
  return ["dismiss"];
}

function activityMessage(eventType: string, stage: string, category?: string): string {
  if (category) {
    if (category === "operational_alert") return "Operational alert created";
    if (category.includes("failure")) return "Work requires attention";
    if (category.includes("review") || category.includes("approval")) return "Review required";
    if (category === "evidence_problem") return "Evidence requires review";
  }
  if (eventType === "topic_added") return "Topic queued";
  if (eventType === "retry") return "Work retried";
  if (eventType === "replay") return "Work restarted from its last verified point";
  if (stage === "research") return "Research started";
  if (stage === "extraction") return "Extraction in progress";
  if (stage === "publication_candidate") return "Extraction completed";
  if (stage === "founder_review" || stage === "governance") return "Review required";
  if (stage === "published" || stage === "completed" || eventType === "passed") return "Published";
  return "Work progressed";
}

export const founderOperationsService = {
  async getHome(): Promise<FounderHomeReadModel> {
    const [snapshot, notifications, reliability, recentPublications, activityRows, requests] = await Promise.all([
      factoryOperationsService.getSnapshot(),
      factoryOperationsService.getFounderInbox(),
      reliabilityService.dashboard(),
      factoryOperationsRepository.listRecentPublications(20),
      factoryOperationsRepository.listGlobalActivity(50),
      requestRepository.list()
    ]);
    const topicsById = new Map(snapshot.queue.map((topic) => [topic.id, topic]));
    const health = reliability.health.map((item) => ({ name: item.institution, status: healthStatus(item.status) }));
    const institutionStatus = health.some((item) => item.status === "Critical")
      ? "Critical"
      : health.some((item) => item.status === "Warning") ? "Warning" : "Healthy";
    const inbox: FounderInboxItem[] = notifications.map((item) => {
      const topic = topicsById.get(item.topicId);
      return {
        id: item.id,
        topicId: item.topicId,
        topic: topic?.title || item.title.replace(/^[^:]+:\s*/, ""),
        reason: item.message,
        priority: topic?.priority || 0,
        severity: item.severity,
        actions: actionsFor(item.category),
        createdAt: item.createdAt
      };
    });
    const activity: FounderActivity[] = activityRows.map((row) => ({
      id: row.id,
      topic: row.topic,
      message: activityMessage(row.eventType, row.stage, row.category),
      occurredAt: row.occurredAt,
      severity: row.severity
    }));
    const today = new Date().toISOString().slice(0, 10);
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        institutionStatus,
        factoryStatus: snapshot.control.mode === "running" ? "Running" : snapshot.control.mode === "stopped" ? "Stopped" : "Paused",
        factoryMode: founderFactoryMode(snapshot.control.mode),
        publishedToday: recentPublications.filter((item) => item.publishedAt.slice(0, 10) === today).length,
        processing: snapshot.metrics.activeCount,
        queueDepth: snapshot.metrics.queueDepth,
        inboxCount: inbox.length,
        failedTopics: snapshot.failures.length + snapshot.deadLetters.length
      },
      health,
      inbox,
      recentPublications,
      activity,
      visitorRequests: requests
        .filter((request) => request.status === "pending" && ["timeline_request", "timeline_proposal"].includes(request.requestType))
        .slice(0, 20)
        .map((request) => ({ id: request.id, topic: request.query, submittedAt: request.createdAt }))
    };
  },

  async approveVisitorRequest(requestId: number, actor: string) {
    const request = await requestRepository.getById(requestId);
    if (!request) throw new ApiError(404, "VISITOR_REQUEST_NOT_FOUND", "This Visitor Request is no longer available.");
    if (request.requestType !== "timeline_request" && request.requestType !== "timeline_proposal") {
      throw new ApiError(409, "VISITOR_REQUEST_NOT_A_TOPIC", "Only timeline requests and proposals can become Topics.");
    }
    const sourceReference = String(request.id);
    let topic = await factoryOperationsRepository.getTopicBySourceReference("public_request", sourceReference);
    if (!topic) {
      topic = await factoryOperationsService.addTopic({
        title: request.query, source: "public_request", sourceReference, priority: 100, maxRetries: 3, actor
      });
    }
    if (request.status !== "planned") await requestRepository.updateStatus(request.id, "planned");
    return topic;
  },

  async actOnInbox(input: { notificationId: string; topicId: string; action: FounderAction; actor: string }) {
    if (input.action === "dismiss") {
      await factoryOperationsRepository.resolveNotification(input.notificationId);
      return { outcome: "dismissed" as const };
    }
    if (input.action === "retry") {
      const topic = await factoryOperationsService.mutateTopic({ topicId: input.topicId, action: "retry", actor: input.actor });
      await factoryOperationsRepository.resolveNotification(input.notificationId);
      return { outcome: "retried" as const, topic };
    }
    if (input.action === "reject") {
      const topic = await factoryOperationsService.mutateTopic({ topicId: input.topicId, action: "cancel", actor: input.actor });
      await factoryOperationsRepository.resolveNotification(input.notificationId);
      return { outcome: "rejected" as const, topic };
    }
    if (input.action === "return_for_revision") {
      const detail = await factoryOperationsService.getTopicDetail(input.topicId);
      const topic = await factoryOperationsService.mutateTopic({
        topicId: input.topicId, action: "replay", replayStage: detail.topic.lastCertifiedStage, actor: input.actor
      });
      await factoryOperationsRepository.resolveNotification(input.notificationId);
      return { outcome: "revision_requested" as const, topic };
    }
    const topic = await factoryOperationsService.mutateTopic({ topicId: input.topicId, action: "resume", actor: input.actor });
    await factoryOperationsRepository.resolveNotification(input.notificationId);
    return { outcome: "approved" as const, topic };
  }
};
