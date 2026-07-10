import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";
import type { OperationalNotification, OperationsControl, OperationsSnapshot, TopicHistoryRecord, TopicOperationsDetail, TopicSource, TopicWorkItem, WorkflowStage } from "@/src/server/factory-operations/contracts";

const topicColumns = `
  id::text AS "id", title, source, source_reference AS "sourceReference", status, priority,
  current_stage AS "currentStage", last_certified_stage AS "lastCertifiedStage",
  retry_count AS "retryCount", max_retries AS "maxRetries", workflow_id::text AS "workflowId",
  execution_generation AS "executionGeneration",
  lease_owner AS "leaseOwner", lease_expires_at::text AS "leaseExpiresAt",
  heartbeat_at::text AS "heartbeatAt", next_attempt_at::text AS "nextAttemptAt",
  last_error AS "lastError", stage_context AS "stageContext", created_at::text AS "createdAt", updated_at::text AS "updatedAt",
  started_at::text AS "startedAt", completed_at::text AS "completedAt"
`;

type LeasedTopic = TopicWorkItem & {
  leasedPreviousStatus: TopicWorkItem["status"];
  leasedPreviousStage: WorkflowStage;
};

const activeLineageKeysByReplayBoundary: Record<WorkflowStage, string[]> = {
  queued: [
    "researchPipelineRunId",
    "extractionPipelineRunId",
    "publicationPipelineRunId",
    "factoryPackageDraftId",
    "editorialReviewOutcome",
    "editorialReviewReasons",
    "governanceHandoffId",
    "governancePublicationPackageId",
    "historicalLibraryAdmissionId"
  ],
  research: [
    "researchPipelineRunId",
    "extractionPipelineRunId",
    "publicationPipelineRunId",
    "factoryPackageDraftId",
    "editorialReviewOutcome",
    "editorialReviewReasons",
    "governanceHandoffId",
    "governancePublicationPackageId",
    "historicalLibraryAdmissionId"
  ],
  extraction: [
    "extractionPipelineRunId",
    "publicationPipelineRunId",
    "factoryPackageDraftId",
    "editorialReviewOutcome",
    "editorialReviewReasons",
    "governanceHandoffId",
    "governancePublicationPackageId",
    "historicalLibraryAdmissionId"
  ],
  publication_candidate: [
    "publicationPipelineRunId",
    "factoryPackageDraftId",
    "editorialReviewOutcome",
    "editorialReviewReasons",
    "governanceHandoffId",
    "governancePublicationPackageId",
    "historicalLibraryAdmissionId"
  ],
  founder_review: [
    "governanceHandoffId",
    "governancePublicationPackageId",
    "historicalLibraryAdmissionId"
  ],
  governance: [
    "governancePublicationPackageId",
    "historicalLibraryAdmissionId"
  ],
  library_admission: [
    "historicalLibraryAdmissionId"
  ],
  published: [],
  completed: []
};

export function stageContextForReplay(input: {
  stageContext: Record<string, unknown>;
  boundary: WorkflowStage;
  previousGeneration: number;
  nextGeneration: number;
  replayRequestId: string;
  actor: string;
}): Record<string, unknown> {
  const keysToInvalidate = activeLineageKeysByReplayBoundary[input.boundary];
  const activeContext: Record<string, unknown> = { ...input.stageContext };
  const invalidatedActiveLineage: Record<string, unknown> = {};
  for (const key of keysToInvalidate) {
    if (key in activeContext) {
      invalidatedActiveLineage[key] = activeContext[key];
      delete activeContext[key];
    }
  }
  const priorHistory = Array.isArray(activeContext.executionLineageHistory)
    ? activeContext.executionLineageHistory
    : [];
  return {
    ...activeContext,
    executionGeneration: input.nextGeneration,
    executionLineageHistory: [
      ...priorHistory,
      {
        replayRequestId: input.replayRequestId,
        boundary: input.boundary,
        previousGeneration: input.previousGeneration,
        nextGeneration: input.nextGeneration,
        invalidatedActiveLineage,
        requestedBy: input.actor
      }
    ]
  };
}

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

  async getTopicBySourceReference(source: TopicSource, sourceReference: string) {
    const sql = getWriteSql("reading Topic origin lineage");
    const [row] = await sql.unsafe<TopicWorkItem[]>(
      `SELECT ${topicColumns} FROM factory_topic_work_items WHERE source=$1 AND source_reference=$2 LIMIT 1`,
      [source, sourceReference]
    );
    return row || null;
  },

  async listTopics(limit = 200) {
    const sql = getWriteSql("listing Factory topics");
    return sql.unsafe<TopicWorkItem[]>(`SELECT ${topicColumns} FROM factory_topic_work_items ORDER BY priority DESC, created_at LIMIT $1`, [limit]);
  },

  async listActionableWaitingTopics(limit: number) {
    const sql = getWriteSql("listing actionable waiting workflows");
    return sql.unsafe<TopicWorkItem[]>(
      `SELECT ${topicColumns.replace(/^  id::text/m, "  t.id::text")}
       FROM factory_topic_work_items t
       WHERE t.status='waiting' AND (
         (
           t.current_stage='founder_review' AND EXISTS (
             SELECT 1 FROM factory_editorial_reviews r
             WHERE r.factory_package_draft_id=(t.stage_context->>'factoryPackageDraftId')::uuid
               AND r.lifecycle='governance_ready'
           )
         ) OR (
           t.current_stage='governance' AND EXISTS (
             SELECT 1 FROM governance_publication_packages p
             WHERE p.id=(t.stage_context->>'governancePublicationPackageId')::uuid
               AND p.lifecycle IN ('accepted','published')
               AND p.readiness_certification IS NOT NULL
           )
         )
       )
       ORDER BY t.updated_at,t.id LIMIT $1`,
      [Math.max(1, Math.min(100, limit))]
    );
  },

  async setControl(mode: OperationsControl["mode"], actor: string) {
    const sql = getWriteSql("updating Factory automation control");
    const [row] = await sql<OperationsControl[]>`
      UPDATE factory_operations_control SET mode=${mode}, updated_by=${actor}, updated_at=NOW() WHERE singleton=TRUE
      RETURNING mode, concurrency, poll_interval_ms AS "pollIntervalMs", updated_at::text AS "updatedAt", updated_by AS "updatedBy"`;
    return row;
  },

  async configureControl(input: { concurrency: number; pollIntervalMs: number; actor: string }) {
    const sql = getWriteSql("configuring Factory operations concurrency");
    const [row] = await sql<OperationsControl[]>`
      UPDATE factory_operations_control SET concurrency=${input.concurrency},poll_interval_ms=${input.pollIntervalMs},
        updated_by=${input.actor},updated_at=NOW() WHERE singleton=TRUE
      RETURNING mode,concurrency,poll_interval_ms AS "pollIntervalMs",updated_at::text AS "updatedAt",updated_by AS "updatedBy"`;
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
      const rows = await tx.unsafe<LeasedTopic[]>(
        `WITH candidate AS (
           SELECT id, status AS previous_status, current_stage AS previous_stage
           FROM factory_topic_work_items
           WHERE ((status IN ('queued','failed') AND next_attempt_at <= NOW())
             OR (status='running' AND lease_expires_at < NOW()))
           ORDER BY
             (priority + LEAST(1000, FLOOR(EXTRACT(EPOCH FROM (NOW()-created_at))/60))) DESC,
             created_at
           FOR UPDATE SKIP LOCKED LIMIT 1
         )
         UPDATE factory_topic_work_items t SET status='running', lease_owner=$1,
           lease_expires_at=NOW()+($2 * INTERVAL '1 second'), heartbeat_at=NOW(),
           started_at=COALESCE(started_at,NOW()), updated_at=NOW()
         FROM candidate WHERE t.id=candidate.id RETURNING ${topicColumns.replace(/^  id::text/m, "  t.id::text")},
           candidate.previous_status AS "leasedPreviousStatus",
           candidate.previous_stage AS "leasedPreviousStage"`,
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
    const result = await sql`
      UPDATE factory_topic_work_items SET current_stage=${to}, last_certified_stage=${to}, status=${status},
        stage_context=(CASE WHEN jsonb_typeof(stage_context)='object' THEN stage_context ELSE '{}'::jsonb END)
          || ${sql.json(context as never)},
        lease_owner=NULL, lease_expires_at=NULL, heartbeat_at=NULL,
        completed_at=CASE WHEN ${to}='completed' THEN NOW() ELSE completed_at END, updated_at=NOW()
      WHERE id=${topicId} AND lease_owner=${workerId} AND current_stage=${from}
        AND status='running' AND lease_expires_at >= NOW()`;
    if (result.count !== 1) throw new ApiError(409, "WORKFLOW_STATE_CONFLICT", "Workflow state changed while the stage was executing.");
    return this.getTopic(topicId);
  },

  async fail(topic: TopicWorkItem, workerId: string, message: string) {
    const sql = getWriteSql("recording Factory topic failure");
    const retry = topic.retryCount + 1;
    const status = retry > topic.maxRetries ? "dead_letter" : "failed";
    const result = await sql`UPDATE factory_topic_work_items SET status=${status}, retry_count=${retry}, last_error=${message.slice(0, 4000)},
      next_attempt_at=NOW()+(LEAST(300, POWER(2, ${retry})) * INTERVAL '1 second'),
      lease_owner=NULL, lease_expires_at=NULL, heartbeat_at=NULL, updated_at=NOW()
      WHERE id=${topic.id} AND lease_owner=${workerId} AND status='running' AND current_stage=${topic.currentStage}`;
    if (result.count !== 1) throw new ApiError(409, "LEASE_LOST", "Failed stage cannot mutate a workflow it no longer owns.");
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

  async mergeTopicContext(id: string, context: Record<string, unknown>) {
    const sql = getWriteSql("persisting topic institutional lineage");
    await sql`UPDATE factory_topic_work_items
      SET stage_context=(CASE WHEN jsonb_typeof(stage_context)='object' THEN stage_context ELSE '{}'::jsonb END)
        || ${sql.json(context as never)}, updated_at=NOW() WHERE id=${id}`;
  },

  async appendInstitutionalEvent(input: { topic: TopicWorkItem; institution: string; eventType: string; boundaryStage: WorkflowStage; authorityRefs?: unknown[]; payload?: Record<string, unknown>; idempotencyKey: string }) {
    const sql = getWriteSql("appending institutional event");
    await sql`INSERT INTO factory_institutional_events
      (topic_id,workflow_id,institution,event_type,boundary_stage,authority_refs,payload,idempotency_key)
      VALUES (${input.topic.id},${input.topic.workflowId},${input.institution},${input.eventType},${input.boundaryStage},
        ${sql.json((input.authorityRefs || []) as never)},${sql.json((input.payload || {}) as never)},${input.idempotencyKey})
      ON CONFLICT (idempotency_key) DO NOTHING`;
  },

  async notify(input: { topicId: string; category: string; severity: OperationalNotification["severity"]; title: string; message: string; deduplicationKey: string; details?: Record<string, unknown> }) {
    const sql = getWriteSql("creating operational notification");
    await sql`INSERT INTO factory_operational_notifications
      (topic_id,category,severity,title,message,deduplication_key,details)
      VALUES (${input.topicId},${input.category},${input.severity},${input.title},${input.message},${input.deduplicationKey},${sql.json((input.details || {}) as never)})
      ON CONFLICT (deduplication_key,status) DO NOTHING`;
  },

  async resolveNotifications(topicId: string, category: string) {
    const sql = getWriteSql("resolving operational notifications");
    await sql`UPDATE factory_operational_notifications SET status='resolved', resolved_at=NOW()
      WHERE topic_id=${topicId} AND category=${category} AND status='open'`;
  },

  async resolveNotification(id: string) {
    const sql = getWriteSql("resolving Founder Inbox item");
    const result = await sql`UPDATE factory_operational_notifications SET status='resolved', resolved_at=NOW()
      WHERE id=${id} AND status='open'`;
    if (result.count !== 1) throw new ApiError(409, "INBOX_ITEM_NOT_ACTIONABLE", "This review item has already been completed.");
  },

  async listRecentPublications(limit = 20) {
    const sql = getWriteSql("listing recent publications");
    return sql<{ topic: string; publishedAt: string; verification: "Passed" | "Failed" | "Pending"; publicPath: string | null }[]>`
      SELECT t.title AS topic, t.completed_at::text AS "publishedAt",
        CASE v.status WHEN 'passed' THEN 'Passed' WHEN 'failed' THEN 'Failed' ELSE 'Pending' END AS verification,
        CASE WHEN p.slug IS NOT NULL THEN '/timeline/' || p.slug ELSE NULL END AS "publicPath"
      FROM factory_topic_work_items t
      LEFT JOIN LATERAL (
        SELECT status FROM factory_publication_verifications WHERE topic_id=t.id ORDER BY created_at DESC LIMIT 1
      ) v ON TRUE
      LEFT JOIN LATERAL (
        SELECT p.slug FROM historical_library_admissions a
        JOIN historical_library_published_snapshots s ON s.admission_id=a.id
        JOIN published_memory_projections p ON p.published_snapshot_id=s.id
          AND p.projection_type='timeline' AND p.lifecycle='active'
        WHERE a.publication_package_id=(t.stage_context->>'governancePublicationPackageId')::uuid
        ORDER BY p.created_at DESC LIMIT 1
      ) p ON TRUE
      WHERE t.status='completed' AND t.completed_at IS NOT NULL
      ORDER BY t.completed_at DESC LIMIT ${Math.max(1, Math.min(50, limit))}`;
  },

  async listGlobalActivity(limit = 50) {
    const sql = getWriteSql("listing Founder activity");
    return sql<Array<{ id: string; topic: string; eventType: string; stage: string; category?: string; occurredAt: string; severity: "info" | "warning" | "critical" }>>`
      SELECT * FROM (
        SELECT e.id::text AS id,t.title AS topic,e.event_type AS "eventType",e.boundary_stage AS stage,
          NULL::text AS category,e.created_at::text AS "occurredAt",'info'::text AS severity
        FROM factory_institutional_events e JOIN factory_topic_work_items t ON t.id=e.topic_id
        UNION ALL
        SELECT n.id::text,t.title,'notification',t.current_stage,n.category,n.created_at::text,n.severity
        FROM factory_operational_notifications n JOIN factory_topic_work_items t ON t.id=n.topic_id
        UNION ALL
        SELECT h.id::text,t.title,h.action,COALESCE(h.to_stage,h.from_stage,'queued'),NULL::text,h.created_at::text,
          CASE WHEN h.outcome='failed' THEN 'warning' ELSE 'info' END
        FROM factory_topic_execution_history h JOIN factory_topic_work_items t ON t.id=h.topic_id
        WHERE h.action IN ('topic_added','retry','replay')
      ) activity ORDER BY "occurredAt" DESC LIMIT ${Math.max(1, Math.min(50, limit))}`;
  },

  async listInbox(limit = 200) {
    const sql = getWriteSql("listing Founder Inbox");
    return sql<OperationalNotification[]>`SELECT id::text AS id, topic_id::text AS "topicId", category, severity, title, message,
      status, details, created_at::text AS "createdAt" FROM factory_operational_notifications
      WHERE status='open' ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at LIMIT ${limit}`;
  },

  async recordVerification(input: { topicId: string; packageId: string; checks: Record<string, boolean>; failures: string[] }) {
    const sql = getWriteSql("recording publication verification");
    const [row] = await sql<{ id: string }[]>`INSERT INTO factory_publication_verifications
      (topic_id,publication_package_id,checks,status,failure_details)
      VALUES (${input.topicId},${input.packageId},${sql.json(input.checks as never)},${input.failures.length ? "failed" : "passed"},${sql.json(input.failures as never)})
      RETURNING id::text AS id`;
    return row;
  },

  async getTopicDetail(id: string): Promise<TopicOperationsDetail> {
    const topic = await this.getTopic(id);
    const sql = getWriteSql("reading topic operations detail");
    const [history, events, notifications, verifications] = await Promise.all([
      sql<TopicHistoryRecord[]>`SELECT id::text AS id,topic_id::text AS "topicId",action,from_stage AS "fromStage",to_stage AS "toStage",
        outcome,attempt,details,created_at::text AS "createdAt" FROM factory_topic_execution_history WHERE topic_id=${id} ORDER BY created_at DESC LIMIT 500`,
      sql<TopicOperationsDetail["events"]>`SELECT id::text AS id,institution,event_type AS "eventType",boundary_stage AS "boundaryStage",
        authority_refs AS "authorityRefs",payload,created_at::text AS "createdAt" FROM factory_institutional_events WHERE topic_id=${id} ORDER BY created_at DESC LIMIT 500`,
      sql<OperationalNotification[]>`SELECT id::text AS id,topic_id::text AS "topicId",category,severity,title,message,status,details,
        created_at::text AS "createdAt" FROM factory_operational_notifications WHERE topic_id=${id} ORDER BY created_at DESC LIMIT 200`,
      sql<TopicOperationsDetail["verifications"]>`SELECT id::text AS id,status,checks,failure_details AS "failureDetails",created_at::text AS "createdAt"
        FROM factory_publication_verifications WHERE topic_id=${id} ORDER BY created_at DESC LIMIT 100`
    ]);
    return { topic, history, events, notifications, verifications };
  },

  async appendHistory(topicId: string, action: string, fromStage: WorkflowStage | null, toStage: WorkflowStage | null, outcome: TopicHistoryRecord["outcome"], attempt: number, details: Record<string, unknown>) {
    const sql = getWriteSql("appending Factory topic history");
    await sql`INSERT INTO factory_topic_execution_history (topic_id,action,from_stage,to_stage,outcome,attempt,details)
      VALUES (${topicId},${action},${fromStage},${toStage},${outcome},${attempt},${sql.json(details as never)})`;
  },

  async requestReplay(input: { topic: TopicWorkItem; boundary: WorkflowStage; actor: string }) {
    const sql = getWriteSql("persisting replay request");
    const institution = input.boundary === "governance" ? "governance" :
      ["library_admission", "published", "completed"].includes(input.boundary) ? "historical_library" : "factory";
    const key = `${input.topic.workflowId}:${institution}:${input.boundary}:${input.topic.lastCertifiedStage}`;
    const [row] = await sql<{ id: string; status: string }[]>`
      INSERT INTO operational_replay_requests (topic_id,workflow_id,institution,certified_boundary,status,requested_by,idempotency_key)
      VALUES (${input.topic.id},${input.topic.workflowId},${institution},${input.boundary},'requested',${input.actor},${key})
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id::text AS id,status`;
    if (!row) throw new ApiError(409, "DUPLICATE_REPLAY", "This certified boundary replay was already requested.");
    return row;
  },

  async scheduleReplay(input: { topicId: string; boundary: WorkflowStage; actor: string }) {
    const sql = getWriteSql("atomically scheduling workflow replay");
    return sql.begin(async (tx) => {
      const [topic] = await tx.unsafe<TopicWorkItem[]>(
        `SELECT ${topicColumns} FROM factory_topic_work_items WHERE id=$1 FOR UPDATE`,
        [input.topicId]
      );
      if (!topic) throw new ApiError(404, "TOPIC_NOT_FOUND", "Topic was not found.");
      if (topic.status === "running" || (topic.leaseOwner && topic.leaseExpiresAt && new Date(topic.leaseExpiresAt) >= new Date())) {
        throw new ApiError(409, "REPLAY_STAGE_ACTIVE", "Replay cannot replace an actively leased workflow stage.");
      }
      const institution = input.boundary === "governance" ? "governance" :
        ["library_admission", "published", "completed"].includes(input.boundary) ? "historical_library" : "factory";
      const nextGeneration = topic.executionGeneration + 1;
      const key = `${topic.workflowId}:${institution}:${input.boundary}:${nextGeneration}`;
      const replay = await tx.unsafe<{ id: string }[]>(
        `INSERT INTO operational_replay_requests
          (topic_id,workflow_id,institution,certified_boundary,status,requested_by,idempotency_key)
         VALUES ($1,$2,$3,$4,'requested',$5,$6)
         ON CONFLICT (idempotency_key) DO NOTHING RETURNING id::text AS id`,
        [topic.id, topic.workflowId, institution, input.boundary, input.actor, key]
      );
      if (!replay[0]) throw new ApiError(409, "DUPLICATE_REPLAY", "This certified boundary replay was already requested.");
      const stageContext = stageContextForReplay({
        stageContext: topic.stageContext,
        boundary: input.boundary,
        previousGeneration: topic.executionGeneration,
        nextGeneration,
        replayRequestId: replay[0].id,
        actor: input.actor
      });
      const [updated] = await tx.unsafe<TopicWorkItem[]>(
        `UPDATE factory_topic_work_items SET status='queued',current_stage=$1,retry_count=0,execution_generation=$2,stage_context=$3::jsonb,
          lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,next_attempt_at=NOW(),updated_at=NOW()
         WHERE id=$4 AND status <> 'running' AND execution_generation=$5 RETURNING ${topicColumns}`,
        [input.boundary, nextGeneration, JSON.stringify(stageContext), topic.id, topic.executionGeneration]
      );
      if (!updated) throw new ApiError(409, "REPLAY_STAGE_ACTIVE", "Replay lost workflow ownership before scheduling.");
      return updated;
    });
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
