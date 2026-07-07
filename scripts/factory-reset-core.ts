import type { Sql } from "postgres";

export const RESET_CONFIRMATION = "TIMELINES";

export const resetTableGroups = {
  "Founder Inbox": [
    "timeline_requests",
    "factory_operational_notifications"
  ],
  Runtime: [
    "factory_topic_execution_history",
    "factory_institutional_events",
    "factory_publication_verifications",
    "operational_replay_requests",
    "operational_alert_history",
    "operational_alerts",
    "operational_scheduled_runs",
    "operational_health_assessments",
    "operational_metric_measurements",
    "provider_execution_leases",
    "provider_rate_limit_events",
    "provider_execution_metrics",
    "provider_runtime_state",
    "factory_runtime_audit_records",
    "factory_runtime_executions",
    "factory_runtime_jobs",
    "factory_runtime_prompts",
    "factory_runtime_workers",
    "factory_topic_work_items"
  ],
  Factory: [
    "factory_editorial_narrative_citation_evidence",
    "factory_editorial_narrative_citation_sentences",
    "factory_editorial_narrative_citations",
    "factory_editorial_narrative_sentence_milestones",
    "factory_editorial_narrative_sentence_claims",
    "factory_editorial_narrative_sentences",
    "factory_editorial_narrative_paragraph_milestones",
    "factory_editorial_narrative_paragraphs",
    "factory_editorial_narrative_sections",
    "factory_editorial_narrative_provenance",
    "factory_editorial_narrative_prompt_refs",
    "factory_editorial_narrative_revisions",
    "factory_editorial_narratives",
    "factory_editorial_composition_arc_milestones",
    "factory_editorial_composition_arc_phases",
    "factory_editorial_composition_arcs",
    "factory_editorial_composition_continuity",
    "factory_editorial_composition_transitions",
    "factory_editorial_composition_turning_points",
    "factory_editorial_composition_boundaries",
    "factory_editorial_composition_phase_milestones",
    "factory_editorial_composition_phases",
    "factory_editorial_compositions",
    "factory_editorial_timeline_candidate_evidence",
    "factory_editorial_timeline_candidate_exclusions",
    "factory_editorial_timeline_candidate_milestones",
    "factory_editorial_timeline_candidates",
    "factory_editorial_generation_units",
    "factory_editorial_certification_invariant_results",
    "factory_editorial_certification_case_results",
    "factory_editorial_certification_runs",
    "factory_editorial_evidence_set_inputs",
    "factory_editorial_evidence_sets",
    "factory_feedback_consumptions",
    "factory_revision_plans",
    "factory_governance_submissions",
    "factory_submission_lineage",
    "factory_submission_audit_records",
    "factory_governance_handoffs",
    "factory_pipeline_steps",
    "factory_pipeline_runs",
    "factory_authority_preparations",
    "factory_editorial_decisions",
    "factory_confidence_assessments",
    "factory_editorial_reviews",
    "factory_package_versions",
    "factory_package_drafts",
    "factory_artifacts",
    "factory_objects",
    "factory_audit_records"
  ],
  Governance: [
    "governance_approvals",
    "governance_disputes",
    "governance_queues",
    "governance_audit_records",
    "governance_feedback_packages",
    "governance_publication_packages",
    "governance_decisions"
  ],
  "Historical Library": [
    "historical_library_certification_invariant_results",
    "historical_library_certification_failure_results",
    "historical_library_certification_lifecycle_results",
    "historical_library_certification_case_results",
    "historical_library_certification_stage_results",
    "historical_library_certification_runs",
    "historical_library_lifecycle_audit",
    "historical_library_continuity_edges",
    "historical_library_split_children",
    "historical_library_supersessions",
    "historical_library_splits",
    "historical_library_withdrawals",
    "historical_library_feedback_links",
    "historical_library_published_revisions",
    "historical_library_retirements",
    "historical_library_merges",
    "historical_library_preservations",
    "historical_library_published_snapshots",
    "historical_library_admissions"
  ],
  "Published Memory": [
    "published_memory_certification_invariant_results",
    "published_memory_certification_failure_results",
    "published_memory_certification_lifecycle_results",
    "published_memory_certification_case_results",
    "published_memory_certification_stage_results",
    "published_memory_certification_runs",
    "published_memory_projection_lineage",
    "published_memory_continuity_projections",
    "published_memory_projections",
    "published_memory_projection_rebuild_reports"
  ],
  "Historical Authority": [
    "milestone_participation_disputes",
    "milestone_participation_revisions",
    "milestone_participations",
    "historical_relationship_disputes",
    "historical_relationship_merges",
    "historical_relationship_retirements",
    "historical_relationship_revisions",
    "historical_relationships",
    "historical_object_merges",
    "historical_object_retirements",
    "historical_object_revisions",
    "historical_object_aliases",
    "historical_objects"
  ],
  Research: [
    "evidence_validation_records",
    "evidence_records",
    "corpus_documents",
    "source_relevance_diagnostics",
    "source_authority_snapshots"
  ],
  Platform: [
    "platform_certification_invariant_results",
    "platform_certification_failure_results",
    "platform_certification_case_results",
    "platform_certification_stage_results",
    "platform_certification_runs",
    "search_certification_invariant_results",
    "search_certification_failure_results",
    "search_certification_search_results",
    "search_certification_case_results",
    "search_certification_stage_results",
    "search_certification_runs",
    "projection_engine_certification_invariant_results",
    "projection_engine_certification_failure_results",
    "projection_engine_certification_projection_results",
    "projection_engine_certification_case_results",
    "projection_engine_certification_stage_results",
    "projection_engine_certification_runs",
    "relationship_recovery_reports",
    "analytics_events",
    "timeline_slug_history",
    "event_tags",
    "event_sources",
    "timeline_events",
    "events",
    "timelines"
  ]
} as const;

export const resetTables = [...new Set(Object.values(resetTableGroups).flat())];

export function hasResetConfirmation(argv: string[]): boolean {
  if (argv.length === 0) return false;
  if (argv.length === 2 && argv[0] === "--confirm" && argv[1] === RESET_CONFIRMATION) return true;
  throw new Error("Invalid Factory Reset confirmation. Use exactly: --confirm TIMELINES");
}

export function resolveOperationsEnvironment(
  env: Record<string, string | undefined>
): "development" | "preview" | "unknown" {
  if (env.VERCEL_ENV === "preview") return "preview";
  if (env.NODE_ENV === "development" || env.VERCEL_ENV === "development") return "development";
  return "unknown";
}

export function assertNonProductionEnvironment(
  env: Record<string, string | undefined>,
  databaseUrl: string
): URL {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error("Factory Reset is disabled in production environments.");
  }
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be configured for Factory Reset.");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("Factory Reset requires a PostgreSQL DATABASE_URL.");
  }

  const databaseIdentity = [
    parsed.hostname,
    parsed.username,
    parsed.pathname,
    parsed.searchParams.get("options") || "",
    env.DATABASE_ENV || "",
    env.APP_ENV || ""
  ].join(" ").toLowerCase();
  if (/(^|[._/\-\s])(prod|production|main)([._/\-\s]|$)/u.test(databaseIdentity)) {
    throw new Error("Factory Reset refused a database identified as production.");
  }
  return parsed;
}

type ExistingTableRow = { table_name: string };
type ForeignKeyRow = { source_table: string; target_table: string; constraint_name: string };

export async function runFactoryReset(sql: Sql): Promise<Record<string, number>> {
  const existingRows = await sql<ExistingTableRow[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY(${resetTables})
  `;
  const existing = new Set(existingRows.map((row) => row.table_name));
  const selectedTables = resetTables.filter((table) => existing.has(table));
  if (selectedTables.length === 0) {
    throw new Error("No Factory Reset tables exist in the configured database.");
  }

  const externalReferences = await sql<ForeignKeyRow[]>`
    SELECT source.relname AS source_table, target.relname AS target_table, fk_constraint.conname AS constraint_name
    FROM pg_constraint fk_constraint
    JOIN pg_class source ON source.oid = fk_constraint.conrelid
    JOIN pg_class target ON target.oid = fk_constraint.confrelid
    JOIN pg_namespace namespace ON namespace.oid = source.relnamespace
    WHERE fk_constraint.contype = 'f'
      AND namespace.nspname = 'public'
      AND target.relname = ANY(${selectedTables})
      AND NOT (source.relname = ANY(${selectedTables}))
  `;
  if (externalReferences.length > 0) {
    const details = externalReferences
      .map((row) => `${row.source_table}.${row.constraint_name} -> ${row.target_table}`)
      .join(", ");
    throw new Error(`Factory Reset refused due to preserved-table foreign keys: ${details}`);
  }

  return sql.begin(async (transaction) => {
    const quotedTables = selectedTables.map((table) => `"${table}"`).join(", ");
    await transaction.unsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY`);

    // Tags have no generation marker. Only unreferenced, ungoverned tags with no
    // permanent alias/redirect/merge configuration can be proven generated.
    const deletedTags = existing.has("event_tags")
      ? await transaction.unsafe(`
          DELETE FROM tags tag
          WHERE NOT EXISTS (SELECT 1 FROM event_tags link WHERE link.tag_id = tag.id)
            AND NOT EXISTS (SELECT 1 FROM tag_governance governance WHERE governance.tag_id = tag.id)
            AND NOT EXISTS (SELECT 1 FROM tag_aliases alias WHERE alias.tag_id = tag.id)
            AND NOT EXISTS (SELECT 1 FROM tag_redirects redirect WHERE redirect.target_tag_id = tag.id)
            AND NOT EXISTS (
              SELECT 1 FROM tag_merges merge
              WHERE merge.source_tag_id = tag.id OR merge.target_tag_id = tag.id
            )
        `)
      : { count: 0 };

    await transaction.unsafe("SET CONSTRAINTS ALL IMMEDIATE");
    const remaining = await transaction.unsafe<{ table_name: string; row_count: number }[]>(`
      SELECT table_name, (
        xpath('/row/count/text()', query_to_xml(
          format('SELECT count(*) AS count FROM %I', table_name), false, true, ''
        ))
      )[1]::text::int AS row_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
    `, [selectedTables]);
    const nonEmpty = remaining.filter((row) => row.row_count !== 0);
    if (nonEmpty.length > 0) {
      throw new Error(`Integrity validation failed: ${nonEmpty.map((row) => row.table_name).join(", ")}`);
    }

    return Object.fromEntries([
      ...Object.entries(resetTableGroups).map(([group, tables]) => [
        group,
        tables.filter((table) => existing.has(table)).length
      ]),
      ["Generated Tags", deletedTags.count]
    ]);
  }) as Promise<Record<string, number>>;
}
