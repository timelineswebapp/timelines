import type {
  CategoryGovernanceRecord,
  TagGovernanceRecord,
  TaxonomyDuplicateCandidate,
  TaxonomyGovernanceSnapshot
} from "@/src/lib/types";
import { slugify } from "@/src/lib/utils";
import { getSql } from "@/src/server/db/client";
import { getMemoryCategoryEntries, memoryStore } from "@/src/server/dev/memory-store";

async function tableExists(tableName: string): Promise<boolean> {
  const sql = getSql();
  if (!sql) {
    return false;
  }

  const [row] = await sql<{ exists: boolean }[]>`
    SELECT to_regclass(${tableName}) IS NOT NULL AS exists
  `;
  return Boolean(row?.exists);
}

function buildDuplicateCandidates(kind: "category" | "tag", values: string[]): TaxonomyDuplicateCandidate[] {
  const buckets = new Map<string, string[]>();
  for (const value of values) {
    const normalized = slugify(value);
    if (!normalized) {
      continue;
    }
    const bucket = buckets.get(normalized) || [];
    bucket.push(value);
    buckets.set(normalized, bucket);
  }

  return Array.from(buckets.entries())
    .filter(([, names]) => new Set(names).size > 1)
    .map(([slug, names]) => ({
      kind,
      slug,
      names: Array.from(new Set(names)).sort((left, right) => left.localeCompare(right)),
      count: names.length
    }));
}

function buildSummary(
  categories: CategoryGovernanceRecord[],
  tags: TagGovernanceRecord[],
  duplicateCandidates: TaxonomyDuplicateCandidate[]
): TaxonomyGovernanceSnapshot["summary"] {
  return {
    governedCategories: categories.filter((category) => category.isGoverned).length,
    ungovernedCategories: categories.filter((category) => !category.isGoverned).length,
    governedTags: tags.filter((tag) => tag.isGoverned).length,
    unreviewedTags: tags.filter((tag) => tag.moderationStatus === "unreviewed").length,
    orphanedTags: tags.filter((tag) => tag.usageCount === 0).length,
    duplicateCandidates: duplicateCandidates.length
  };
}

function memorySnapshot(): TaxonomyGovernanceSnapshot {
  const categories = getMemoryCategoryEntries().map<CategoryGovernanceRecord>((category) => ({
    id: null,
    canonicalName: category.name,
    canonicalSlug: category.slug,
    description: "",
    displayOrder: 1000,
    status: "active",
    timelineCount: category.count,
    aliasCount: 0,
    redirectCount: 0,
    mergeCount: 0,
    isGoverned: false,
    rawNames: [category.name],
    updatedAt: category.updatedAt
  }));
  const tags = memoryStore.getTags().map<TagGovernanceRecord>((tag) => {
    const usageCount = memoryStore
      .getTimelines()
      .flatMap((timeline) => timeline.events)
      .filter((event) => event.tags.some((eventTag) => eventTag.id === tag.id)).length;
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      moderationStatus: "unreviewed",
      usageCount,
      aliasCount: 0,
      redirectCount: 0,
      mergeCount: 0,
      duplicateCandidateOf: null,
      promotionCandidate: false,
      governanceNotes: null,
      isGoverned: false,
      updatedAt: null
    };
  });
  const duplicateCandidates = [
    ...buildDuplicateCandidates("category", categories.flatMap((category) => category.rawNames)),
    ...buildDuplicateCandidates("tag", tags.map((tag) => tag.name))
  ];

  return {
    categories,
    tags,
    duplicateCandidates,
    orphanedCategories: categories.filter((category) => category.timelineCount === 0),
    orphanedTags: tags.filter((tag) => tag.usageCount === 0),
    summary: buildSummary(categories, tags, duplicateCandidates)
  };
}

export const taxonomyRepository = {
  async getGovernanceSnapshot(): Promise<TaxonomyGovernanceSnapshot> {
    const sql = getSql();
    if (!sql) {
      return memorySnapshot();
    }

    const hasCategoryGovernance = await tableExists("taxonomy_categories");
    const hasTagGovernance = await tableExists("tag_governance");

    const rawCategoryRows = await sql<{ category: string; timeline_count: number; updated_at: string }[]>`
      SELECT category, COUNT(*)::int AS timeline_count, MAX(updated_at)::text AS updated_at
      FROM timelines
      GROUP BY category
      ORDER BY category ASC
    `;
    const governedCategoryRows = hasCategoryGovernance
      ? await sql<{
          id: number;
          canonical_name: string;
          canonical_slug: string;
          description: string;
          display_order: number;
          status: CategoryGovernanceRecord["status"];
          updated_at: string;
          alias_count: number;
          redirect_count: number;
          merge_count: number;
        }[]>`
          SELECT
            taxonomy_categories.id,
            taxonomy_categories.canonical_name,
            taxonomy_categories.canonical_slug,
            taxonomy_categories.description,
            taxonomy_categories.display_order,
            taxonomy_categories.status,
            taxonomy_categories.updated_at::text AS updated_at,
            COALESCE(alias_counts.alias_count, 0)::int AS alias_count,
            COALESCE(redirect_counts.redirect_count, 0)::int AS redirect_count,
            COALESCE(merge_counts.merge_count, 0)::int AS merge_count
          FROM taxonomy_categories
          LEFT JOIN (
            SELECT category_id, COUNT(*)::int AS alias_count
            FROM taxonomy_category_aliases
            GROUP BY category_id
          ) alias_counts ON alias_counts.category_id = taxonomy_categories.id
          LEFT JOIN (
            SELECT target_category_id, COUNT(*)::int AS redirect_count
            FROM taxonomy_category_redirects
            GROUP BY target_category_id
          ) redirect_counts ON redirect_counts.target_category_id = taxonomy_categories.id
          LEFT JOIN (
            SELECT target_category_id, COUNT(*)::int AS merge_count
            FROM taxonomy_category_merges
            GROUP BY target_category_id
          ) merge_counts ON merge_counts.target_category_id = taxonomy_categories.id
          ORDER BY taxonomy_categories.display_order ASC, taxonomy_categories.canonical_name ASC
        `
      : [];

    const categoryBuckets = new Map<string, CategoryGovernanceRecord>();
    for (const row of rawCategoryRows) {
      const slug = slugify(row.category);
      if (!slug) {
        continue;
      }
      const existing = categoryBuckets.get(slug);
      if (!existing) {
        categoryBuckets.set(slug, {
          id: null,
          canonicalName: row.category,
          canonicalSlug: slug,
          description: "",
          displayOrder: 1000,
          status: "active",
          timelineCount: row.timeline_count,
          aliasCount: 0,
          redirectCount: 0,
          mergeCount: 0,
          isGoverned: false,
          rawNames: [row.category],
          updatedAt: row.updated_at
        });
        continue;
      }
      existing.timelineCount += row.timeline_count;
      existing.rawNames.push(row.category);
      if (row.updated_at > (existing.updatedAt || "")) {
        existing.updatedAt = row.updated_at;
      }
    }

    for (const governed of governedCategoryRows) {
      const existing = categoryBuckets.get(governed.canonical_slug);
      categoryBuckets.set(governed.canonical_slug, {
        id: governed.id,
        canonicalName: governed.canonical_name,
        canonicalSlug: governed.canonical_slug,
        description: governed.description,
        displayOrder: governed.display_order,
        status: governed.status,
        timelineCount: existing?.timelineCount || 0,
        aliasCount: governed.alias_count,
        redirectCount: governed.redirect_count,
        mergeCount: governed.merge_count,
        isGoverned: true,
        rawNames: existing?.rawNames || [],
        updatedAt: governed.updated_at
      });
    }

    const tags = hasTagGovernance
      ? await sql<TagGovernanceRecord[]>`
          SELECT
            tags.id,
            tags.name,
            tags.slug,
            COALESCE(tag_governance.moderation_status, 'unreviewed') AS "moderationStatus",
            COALESCE(usage_counts.usage_count, 0)::int AS "usageCount",
            COALESCE(alias_counts.alias_count, 0)::int AS "aliasCount",
            COALESCE(redirect_counts.redirect_count, 0)::int AS "redirectCount",
            COALESCE(merge_counts.merge_count, 0)::int AS "mergeCount",
            tag_governance.duplicate_candidate_of AS "duplicateCandidateOf",
            COALESCE(tag_governance.promotion_candidate, FALSE) AS "promotionCandidate",
            tag_governance.governance_notes AS "governanceNotes",
            (tag_governance.tag_id IS NOT NULL) AS "isGoverned",
            tag_governance.updated_at::text AS "updatedAt"
          FROM tags
          LEFT JOIN tag_governance ON tag_governance.tag_id = tags.id
          LEFT JOIN (
            SELECT tag_id, COUNT(*)::int AS usage_count
            FROM event_tags
            GROUP BY tag_id
          ) usage_counts ON usage_counts.tag_id = tags.id
          LEFT JOIN (
            SELECT tag_id, COUNT(*)::int AS alias_count
            FROM tag_aliases
            GROUP BY tag_id
          ) alias_counts ON alias_counts.tag_id = tags.id
          LEFT JOIN (
            SELECT target_tag_id, COUNT(*)::int AS redirect_count
            FROM tag_redirects
            GROUP BY target_tag_id
          ) redirect_counts ON redirect_counts.target_tag_id = tags.id
          LEFT JOIN (
            SELECT target_tag_id, COUNT(*)::int AS merge_count
            FROM tag_merges
            GROUP BY target_tag_id
          ) merge_counts ON merge_counts.target_tag_id = tags.id
          ORDER BY tags.name ASC
        `
      : await sql<TagGovernanceRecord[]>`
          SELECT
            tags.id,
            tags.name,
            tags.slug,
            'unreviewed' AS "moderationStatus",
            COALESCE(usage_counts.usage_count, 0)::int AS "usageCount",
            0 AS "aliasCount",
            0 AS "redirectCount",
            0 AS "mergeCount",
            NULL::bigint AS "duplicateCandidateOf",
            FALSE AS "promotionCandidate",
            NULL::text AS "governanceNotes",
            FALSE AS "isGoverned",
            NULL::text AS "updatedAt"
          FROM tags
          LEFT JOIN (
            SELECT tag_id, COUNT(*)::int AS usage_count
            FROM event_tags
            GROUP BY tag_id
          ) usage_counts ON usage_counts.tag_id = tags.id
          ORDER BY tags.name ASC
        `;

    const categories = Array.from(categoryBuckets.values()).sort(
      (left, right) => left.displayOrder - right.displayOrder || left.canonicalName.localeCompare(right.canonicalName)
    );
    const duplicateCandidates = [
      ...buildDuplicateCandidates("category", rawCategoryRows.map((row) => row.category)),
      ...buildDuplicateCandidates("tag", tags.map((tag) => tag.name))
    ];

    return {
      categories,
      tags,
      duplicateCandidates,
      orphanedCategories: categories.filter((category) => category.timelineCount === 0),
      orphanedTags: tags.filter((tag) => tag.usageCount === 0),
      summary: buildSummary(categories, tags, duplicateCandidates)
    };
  }
};
