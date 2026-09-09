export const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "tiimeliines";
export const COMPUTE_REGION = process.env.FUNCTION_REGION || "us-central1";
export const VERTEX_LOCATION = process.env.VERTEX_LOCATION || "global";
export const VERTEX_MODEL = process.env.VERTEX_MODEL || "gemini-2.5-flash";
export const FIRESTORE_DATABASE = "(default)";
export const PIPELINE_VERSION = "serverless-pipeline-v5-editorial-excellence";
export const PROMPT_VERSION = "historical-research-v5-editorial-excellence";
export const SCHEMA_VERSION = "generated-timeline-v2";
export const QUALITY_POLICY_VERSION = "timeline-quality-v3-event-semantics";
export const GOVERNANCE_POLICY_VERSION = "routine-governance-v5-reader-editorial";
export const PUBLIC_API_VERSION = "serverless-public-api-v2-clean-corpus";

const activeCorpusId = process.env.ACTIVE_CORPUS_ID || "";
if (!/^[a-z0-9][a-z0-9-]{2,62}$/u.test(activeCorpusId)) {
  throw new Error("ACTIVE_CORPUS_ID must be an explicit 3-63 character lowercase corpus identifier.");
}
export const ACTIVE_CORPUS_ID = activeCorpusId;

const publicIdBase = Number(process.env.PUBLIC_ID_BASE);
if (!Number.isSafeInteger(publicIdBase) || publicIdBase < 1_000_000_000 || publicIdBase > Number.MAX_SAFE_INTEGER - 1_000_000) {
  throw new Error("PUBLIC_ID_BASE must be an explicit safe integer with at least one million IDs of headroom.");
}
export const PUBLIC_ID_BASE = publicIdBase;

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
