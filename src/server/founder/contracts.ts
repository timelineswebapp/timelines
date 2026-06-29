import type { AutomationMode, TopicSource, TopicStatus, WorkflowStage } from "@/src/server/factory-operations/contracts";

export type FounderAction = "approve" | "return_for_revision" | "reject" | "retry" | "dismiss";

export type FounderInboxItem = {
  id: string;
  topicId: string;
  topic: string;
  reason: string;
  priority: number;
  severity: "info" | "warning" | "critical";
  actions: FounderAction[];
  createdAt: string;
};

export type FounderActivity = {
  id: string;
  topic: string;
  message: string;
  occurredAt: string;
  severity: "info" | "warning" | "critical";
};

export type FounderRecentPublication = {
  topic: string;
  publishedAt: string;
  verification: "Passed" | "Failed" | "Pending";
  publicPath: string | null;
};

export type FounderHomeReadModel = {
  generatedAt: string;
  summary: {
    institutionStatus: "Healthy" | "Warning" | "Critical";
    factoryStatus: "Running" | "Paused" | "Stopped";
    factoryMode: "Autonomous" | "Maintenance" | "Conservative";
    publishedToday: number;
    processing: number;
    queueDepth: number;
    inboxCount: number;
    failedTopics: number;
  };
  health: Array<{ name: string; status: "Healthy" | "Warning" | "Critical" }>;
  inbox: FounderInboxItem[];
  recentPublications: FounderRecentPublication[];
  activity: FounderActivity[];
  visitorRequests: Array<{ id: number; topic: string; submittedAt: string }>;
};

export type FounderTopicSummary = {
  id: string;
  title: string;
  source: TopicSource;
  status: TopicStatus;
  stage: WorkflowStage;
  priority: number;
};

export function founderFactoryMode(mode: AutomationMode): FounderHomeReadModel["summary"]["factoryMode"] {
  if (mode === "running") return "Autonomous";
  if (mode === "pause_after_current" || mode === "paused") return "Maintenance";
  return "Conservative";
}
