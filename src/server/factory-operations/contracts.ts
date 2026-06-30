export const workflowStages = [
  "queued", "research", "extraction", "publication_candidate", "founder_review",
  "governance", "library_admission", "published", "completed"
] as const;
export type WorkflowStage = (typeof workflowStages)[number];
export type TopicSource = "founder" | "public_request" | "automatic_discovery";
export type TopicStatus = "queued" | "running" | "waiting" | "paused" | "failed" | "dead_letter" | "cancelled" | "completed";
export type AutomationMode = "stopped" | "running" | "pause_after_current" | "paused";

export type TopicWorkItem = {
  id: string;
  title: string;
  source: TopicSource;
  sourceReference: string | null;
  status: TopicStatus;
  priority: number;
  currentStage: WorkflowStage;
  lastCertifiedStage: WorkflowStage;
  retryCount: number;
  maxRetries: number;
  workflowId: string;
  executionGeneration: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
  nextAttemptAt: string;
  lastError: string | null;
  stageContext: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type OperationsControl = {
  mode: AutomationMode;
  concurrency: number;
  pollIntervalMs: number;
  updatedAt: string;
  updatedBy: string;
};

export type TopicHistoryRecord = {
  id: string;
  topicId: string;
  action: string;
  fromStage: WorkflowStage | null;
  toStage: WorkflowStage | null;
  outcome: "started" | "succeeded" | "failed" | "waiting" | "control";
  attempt: number;
  details: Record<string, unknown>;
  createdAt: string;
};

export type OperationsSnapshot = {
  control: OperationsControl;
  queue: TopicWorkItem[];
  activeWorkers: TopicWorkItem[];
  failures: TopicWorkItem[];
  deadLetters: TopicWorkItem[];
  metrics: {
    queueDepth: number;
    activeCount: number;
    completedLastHour: number;
    failedLastHour: number;
    throughputPerHour: number;
  };
};

export type OperationalNotification = {
  id: string; topicId: string; category: string; severity: "info" | "warning" | "critical";
  title: string; message: string; status: "open" | "resolved"; details: Record<string, unknown>; createdAt: string;
};

export type TopicOperationsDetail = {
  topic: TopicWorkItem;
  history: TopicHistoryRecord[];
  events: Array<{ id: string; institution: string; eventType: string; boundaryStage: string; authorityRefs: unknown[]; payload: Record<string, unknown>; createdAt: string }>;
  notifications: OperationalNotification[];
  verifications: Array<{ id: string; status: "passed" | "failed"; checks: Record<string, boolean>; failureDetails: unknown[]; createdAt: string }>;
};
