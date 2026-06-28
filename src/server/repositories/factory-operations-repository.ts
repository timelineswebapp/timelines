import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";
import type { OperationsControl, OperationsSnapshot, TopicHistoryRecord, TopicSource, TopicWorkItem, WorkflowStage } from "@/src/server/factory-operations/contracts";

const topicColumns = `
  id::text AS "id", title, source, source_reference AS "sourceReference", status, priority,
  current_stage AS "currentStage", last_certified_stage AS "lastCertifiedStage",
  retry_count AS "retryCount", max_retries AS "maxRetries", workflow_id::text AS "workflowId",
  lease_owner AS "leaseOwner", lease_expires_at::text AS "leaseExpiresAt",
  heartbeat_at::text AS "heartbeatAt", next_attempt_at::text AS "nextAttemptAt",
  last_error AS "lastError", stage_context AS "stageContext", created_at::text AS "createdAt", updated_at::text AS "updatedAt",
  started_at::text AS "startedAt", completed_at::text AS "completedAt"
`;

export const factoryOperationsRepository = {
  async addTopic(input: { title: string; source: TopicSource; sourceReference?: string | null; priority: number; maxRetries: number; actor: string }) {
    const sql = getWriteSql("adding Factory topic");
    try {
      const [topic] = await sql.unsafe<TopicWorkItem[]>(
        `INSERT INTO factory_topic_work_items (title, source, source_reference, status, priority, current_stage, last_certified_stage, max_retries)
         VALUES ($1,$2,$3,'queued',$4,'queued','queued',$5) RETURNING ${topicColumns}`,
        [input.title, input.source, input.sourceReference || null, input.priority, input.maxRetries]
      );
      if (!topic) throw new ApiError(500, "TOPIC_INSERT_FAILED", "Factory topic insert returned no record.");
      await this.appendHistory(topic.id, "topic_added", null, "queued", "control", 0, { actor: input.actor, source: input.source });
      return topic;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ApiError(409, "TOPIC_ALREADY_QUEUED", "This public request is already queued.");
      throw error;
    }
  },

  async getTopic(id: string) {
    const sql = getWriteSql("reading Factory topic");
    const [row] = await sql.unsafe<TopicWorkItem[]>(`SELECT ${topicColumns} FROM factory_topic_work_items WHERE id=$1`, [id]);
    if (!row) throw new ApiError(404, "TOPIC_NOT_FOUND", "Topic was not found.");
    return row;
  },

  async listTopics(limit = 200) {
    const sql = getWriteSql("listing Factory topics");
    return sql.unsafe<TopicWorkItem[]>(`SELECT ${topicColumns} FROM factory_topic_work_items ORDER BY priority DESC, created_at LIMIT $1`, [limit]);
  },

  async setControl(mode: OperationsControl["mode"], actor: string) {
    const sql = getWriteSql("updating Factory automation control");
    const [row] = await sql<OperationsControl[]>`
      UPDATE factory_operations_control SET mode=${mode}, updated_by=${actor}, updated_at=NOW() WHERE singleton=TRUE
      RETURNING mode, concurrency, poll_interval_ms AS "pollIntervalMs", updated_at::text AS "updatedAt", updated_by AS "updatedBy"`;
    return row;
  },

  async getControl() {
    const sql = getWriteSql("reading Factory automation control");
    const [row] = await sql<OperationsControl[]>`
      SELECT mode, concurrency, poll_interval_ms AS "pollIntervalMs", updated_at::text AS "updatedAt", updated_by AS "updatedBy"
      FROM factory_operations_control WHERE singleton=TRUE`;
    if (!row) throw new ApiError(500, "OPERATIONS_CONTROL_MISSING", "Factory operations control is not initialized.");
    return row;
  },

  async leaseNext(workerId: string, leaseSeconds: number, force = false) {
    const sql = getWriteSql("leasing Factory topic");
    return sql.begin(async (tx) => {
      const [control] = await tx.unsafe<{ mode: OperationsControl["mode"]; concurrency: number }[]>(
        "SELECT mode, concurrency FROM factory_operations_control WHERE singleton=TRUE FOR UPDATE");
      if (!control || (!force && !["running", "pause_after_current"].includes(control.mode))) return null;
      const [active] = await tx.unsafe<{ count: number }[]>(
        "SELECT COUNT(*)::int AS count FROM factory_topic_work_items WHERE status='running' AND lease_expires_at >= NOW()");
      if (!active) return null;
      if (active.count >= control.concurrency) return null;
      const rows = await tx.unsafe<TopicWorkItem[]>(
        `WITH candidate AS (
           SELECT id FROM factory_topic_work_items
           WHERE ((status IN ('queued','failed') AND next_attempt_at <= NOW())
             OR (status='running' AND lease_expires_at < NOW()))
           ORDER BY priority DESC, created_at FOR UPDATE SKIP LOCKED LIMIT 1
         )
         UPDATE factory_topic_work_items t SET status='running', lease_owner=$1,
           lease_expires_at=NOW()+($2 * INTERVAL '1 second'), heartbeat_at=NOW(),
           started_at=COALESCE(started_at,NOW()), updated_at=NOW()
         FROM candidate WHERE t.id=candidate.id RETURNING ${topicColumns.replaceAll("id::text", "t.id::text")}`,
        [workerId, leaseSeconds]
      );
      return rows[0] || null;
    });
  },

  async heartbeat(topicId: string, workerId: string, leaseSeconds: number) {
    const sql = getWriteSql("heartbeating Factory topic");
    const result = await sql`
      UPDATE factory_topic_work_items SET heartbeat_at=NOW(), lease_expires_at=NOW()+(${leaseSeconds} * INTERVAL '1 second')
      WHERE id=${topicId} AND lease_owner=${workerId} AND status='running'`;
    if (result.count !== 1) throw new ApiError(409, "LEASE_LOST", "Topic lease is no longer owned by this worker.");
  },

  async advance(topicId: string, workerId: string, from: WorkflowStage, to: WorkflowStage, status: TopicWorkItem["status"], context: Record<string, unknown>) {
    const sql = getWriteSql("advancing Factory topic");
    const [row] = await sql.unsafe<TopicWorkItem[]>(
      `UPDATE factory_topic_work_items SET current_stage=$1, last_certified_stage=$1, status=$2,
       stage_context=stage_context || $3::jsonb, lease_owner=NULL, lease_expires_at=NULL, heartbeat_at=NULL,
       completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END, updated_at=NOW()
       WHERE id=$4 AND lease_owner=$5 AND current_stage=$6 RETURNING ${topicColumns}`,
      [to, status, JSON.stringify(context), topicId, workerId, from]
    );
    if (!row) throw new ApiError(409, "WORKFLOW_STATE_CONFLICT", "Workflow state changed while the stage was executing.");
    return row;
  },

  async fail(topic: TopicWorkItem, workerId: string, message: string) {
    const sql = getWriteSql("recording Factory topic failure");
    const retry = topic.retryCount + 1;
    const status = retry > topic.maxRetries ? "dead_letter" : "failed";
    await sql`UPDATE factory_topic_work_items SET status=${status}, retry_count=${retry}, last_error=${message.slice(0, 4000)},
      next_attempt_at=NOW()+(LEAST(300, POWER(2, ${retry})) * INTERVAL '1 second'),
      lease_owner=NULL, lease_expires_at=NULL, heartbeat_at=NULL, updated_at=NOW()
      WHERE id=${topic.id} AND lease_owner=${workerId}`;
    return status;
  },

  async updateTopic(id: string, patch: { status?: TopicWorkItem["status"]; priority?: number; stage?: WorkflowStage; retryCount?: number; actor: string }) {
    const sql = getWriteSql("updating Factory topic");
    const [row] = await sql.unsafe<TopicWorkItem[]>(
      `UPDATE factory_topic_work_items SET status=COALESCE($1,status), priority=COALESCE($2,priority),
       current_stage=COALESCE($3,current_stage), retry_count=COALESCE($4,retry_count),
       lease_owner=NULL, lease_expires_at=NULL, heartbeat_at=NULL, next_attempt_at=NOW(), updated_at=NOW()
       WHERE id=$5 AND status <> 'running' RETURNING ${topicColumns}`,
      [patch.status || null, patch.priority ?? null, patch.stage || null, patch.retryCount ?? null, id]
    );
    if (!row) throw new ApiError(409, "TOPIC_NOT_MUTABLE", "Running or missing topics cannot be changed.");
    return row;
  },

  async appendHistory(topicId: string, action: string, fromStage: WorkflowStage | null, toStage: WorkflowStage | null, outcome: TopicHistoryRecord["outcome"], attempt: number, details: Record<string, unknown>) {
    const sql = getWriteSql("appending Factory topic history");
    await sql`INSERT INTO factory_topic_execution_history (topic_id,action,from_stage,to_stage,outcome,attempt,details)
      VALUES (${topicId},${action},${fromStage},${toStage},${outcome},${attempt},${sql.json(details as never)})`;
  },

  async getSnapshot(): Promise<OperationsSnapshot> {
    const [control, queue] = await Promise.all([this.getControl(), this.listTopics()]);
    const sql = getWriteSql("reading Factory operations metrics");
    const [metrics] = await sql<{ completedLastHour: number; failedLastHour: number }[]>`
      SELECT COUNT(*) FILTER (WHERE status='completed' AND completed_at >= NOW()-INTERVAL '1 hour')::int AS "completedLastHour",
      COUNT(*) FILTER (WHERE status IN ('failed','dead_letter') AND updated_at >= NOW()-INTERVAL '1 hour')::int AS "failedLastHour"
      FROM factory_topic_work_items`;
    const counts = metrics || { completedLastHour: 0, failedLastHour: 0 };
    return {
      control, queue,
      activeWorkers: queue.filter((item) => item.status === "running"),
      failures: queue.filter((item) => item.status === "failed"),
      deadLetters: queue.filter((item) => item.status === "dead_letter"),
      metrics: {
        queueDepth: queue.filter((item) => ["queued", "failed"].includes(item.status)).length,
        activeCount: queue.filter((item) => item.status === "running").length,
        completedLastHour: counts.completedLastHour,
        failedLastHour: counts.failedLastHour,
        throughputPerHour: counts.completedLastHour
      }
    };
  }
};
