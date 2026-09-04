export const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "tiimeliines";
export const COMPUTE_REGION = process.env.FUNCTION_REGION || "us-central1";
export const VERTEX_LOCATION = process.env.VERTEX_LOCATION || "global";
export const VERTEX_MODEL = process.env.VERTEX_MODEL || "gemini-2.5-flash";
export const FIRESTORE_DATABASE = "(default)";
export const PIPELINE_VERSION = "serverless-pipeline-v1";
export const PROMPT_VERSION = "historical-research-v2";
export const SCHEMA_VERSION = "generated-timeline-v2";
export const GOVERNANCE_POLICY_VERSION = "routine-governance-v1";
export const PUBLIC_API_VERSION = "serverless-public-api-v1";

export const QUEUES = {
  priority: "priority-topic-generation",
  autonomous: "autonomous-topic-generation",
  institutional: "institutional-transitions"
} as const;

export const FUNCTION_NAMES = {
  publicApi: "timelines-public-api",
  priorityWorker: "priority-topic-generation",
  autonomousWorker: "autonomous-topic-generation",
  institutionalWorker: "institutional-transitions",
  discovery: "topic-discovery"
} as const;

export const TASK_INVOKER_EMAIL =
  process.env.TASK_INVOKER_EMAIL || `timelines-tasks-invoker@${PROJECT_ID}.iam.gserviceaccount.com`;

export const MAX_TOPIC_ATTEMPTS = 5;
export const LEASE_DURATION_MS = 15 * 60 * 1000;
export const MAX_DISCOVERY_CANDIDATES = 10;
export const MAX_DISCOVERY_PROMOTIONS = 3;
export const MAX_REQUESTS_PER_IP_PER_DAY = 3;

if (PROJECT_ID !== "tiimeliines") {
  throw new Error(`Refusing to initialize TiMELiNES functions for unexpected project ${PROJECT_ID}.`);
}
