import type { CategoryDetail, CategoryEntry, SearchResult, TagDetail, TimelineDetail, TimelineSummary } from "@/src/lib/types";
import { normalizeQuery } from "@/src/lib/utils";
import { timelineRepository } from "@/src/server/repositories/timeline-repository";
import { tagRepository } from "@/src/server/repositories/tag-repository";

type WeightedBucket = "recent" | "evergreen" | "diversity" | "discovery";

type WeightedCandidate = {
  timeline: TimelineSummary;
  ageDays: number;
  freshnessScore: number;
  evergreenScore: number;
  discoveryScore: number;
};

type HomepageSnapshotSlice = {
  items: TimelineSummary[];
  nextOffset: number | null;
  hasMore: boolean;
  snapshotDate: string;
};

const HOMEPAGE_ROTATION_WEIGHTS: Array<{ bucket: WeightedBucket; weight: number }> = [
  { bucket: "recent", weight: 0.4 },
  { bucket: "evergreen", weight: 0.3 },
  { bucket: "diversity", weight: 0.2 },
  { bucket: "discovery", weight: 0.1 }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getAgeDays(updatedAt: string, now: number): number {
  const updatedTime = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedTime)) {
    return 365;
  }

  return Math.max(0, Math.floor((now - updatedTime) / 86_400_000));
}

function getDateSeed(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildWeightedCandidates(timelines: TimelineSummary[], seed: string): WeightedCandidate[] {
  const now = Date.now();

  return timelines.map((timeline) => {
    const ageDays = getAgeDays(timeline.updatedAt, now);
    const recencyWindow = 45;
    const freshnessScore = clamp((recencyWindow - Math.min(ageDays, recencyWindow)) / recencyWindow, 0, 1);
    const evergreenDepth =
      timeline.eventCount * 2 +
      timeline.tags.length * 3 +
      Math.min(6, timeline.highlightedEventTitles.length) * 1.5 +
      Math.min(180, timeline.description.length) / 45;
    const maturityBoost = clamp(ageDays / 120, 0, 1.5);
    const evergreenScore = evergreenDepth + maturityBoost;
    const discoveryScore = hashString(`${seed}:${timeline.slug}`) / 0xffffffff;

    return {
      timeline,
      ageDays,
      freshnessScore,
      evergreenScore,
      discoveryScore
    };
  });
}

function allocateBucketCounts(limit: number) {
  const total = Math.max(1, limit);
  const initial = HOMEPAGE_ROTATION_WEIGHTS.map(({ bucket, weight }) => ({
    bucket,
    exact: total * weight,
    count: Math.floor(total * weight)
  }));
  let assigned = initial.reduce((sum, item) => sum + item.count, 0);

  for (const item of [...initial].sort((left, right) => (right.exact - right.count) - (left.exact - left.count))) {
    if (assigned >= total) {
      break;
    }

    item.count += 1;
    assigned += 1;
  }

  return initial.reduce<Record<WeightedBucket, number>>(
    (accumulator, item) => {
      accumulator[item.bucket] = item.count;
      return accumulator;
    },
    {
      recent: 0,
      evergreen: 0,
      diversity: 0,
      discovery: 0
    }
  );
}

function pickNextCandidate(
  candidates: WeightedCandidate[],
  selectedSlugs: Set<string>,
  previousCategory: string | null
) {
  const available = candidates.filter((candidate) => !selectedSlugs.has(candidate.timeline.slug));
  if (available.length === 0) {
    return null;
  }

  const differentCategory = previousCategory
    ? available.find((candidate) => candidate.timeline.category !== previousCategory)
    : null;

  return differentCategory || available[0];
}

function interleaveByCategory(candidates: WeightedCandidate[]): TimelineSummary[] {
  const remaining = [...candidates];
  const ordered: TimelineSummary[] = [];
  let previousCategory: string | null = null;

  while (remaining.length > 0) {
    const preferredIndex = remaining.findIndex((candidate) => candidate.timeline.category !== previousCategory);
    const nextIndex = preferredIndex >= 0 ? preferredIndex : 0;
    const [next] = remaining.splice(nextIndex, 1);
    if (!next) {
      break;
    }

    ordered.push(next.timeline);
    previousCategory = next.timeline.category;
  }

  return ordered;
}

function rotateArray<T>(items: T[], offset: number) {
  if (items.length < 2) {
    return items;
  }

  const normalizedOffset = ((offset % items.length) + items.length) % items.length;
  if (normalizedOffset === 0) {
    return items;
  }

  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

function stabilizeCategorySpacing(timelines: TimelineSummary[]) {
  const result = [...timelines];

  for (let index = 1; index < result.length; index += 1) {
    if (result[index]?.category !== result[index - 1]?.category) {
      continue;
    }

    const swapIndex = result.findIndex(
      (timeline, candidateIndex) =>
        candidateIndex > index &&
        timeline.category !== result[index - 1]?.category &&
        timeline.category !== result[index + 1]?.category
    );

    if (swapIndex < 0) {
      continue;
    }

    const current = result[index];
    result[index] = result[swapIndex] as TimelineSummary;
    result[swapIndex] = current as TimelineSummary;
  }

  return result;
}

function applyDailyMicroRotation(timelines: TimelineSummary[], seed: string) {
  if (timelines.length <= 1) {
    return timelines;
  }

  const anchoredTop = timelines[0] ? [timelines[0]] : [];
  const topBand = timelines.slice(1, 4);
  const middleBand = timelines.slice(4, 8);
  const tailBand = timelines.slice(8);

  const rotatedTop = rotateArray(topBand, hashString(`${seed}:top`) % Math.max(1, topBand.length));
  const rotatedMiddle = rotateArray(middleBand, hashString(`${seed}:middle`) % Math.max(1, middleBand.length));
  const rotatedTail = [...tailBand].sort(
    (left, right) => hashString(`${seed}:tail:${left.slug}`) - hashString(`${seed}:tail:${right.slug}`)
  );

  return stabilizeCategorySpacing([...anchoredTop, ...rotatedTop, ...rotatedMiddle, ...rotatedTail]);
}

function selectHomepageTimelinesFromCandidates(candidates: WeightedCandidate[], limit: number, seed: string): TimelineSummary[] {
  if (candidates.length <= limit) {
    return candidates.map((candidate) => candidate.timeline);
  }

  const selected: WeightedCandidate[] = [];
  const selectedSlugs = new Set<string>();
  let previousCategory: string | null = null;
  const bucketCounts = allocateBucketCounts(limit);

  const recentPool = [...candidates].sort((left, right) => {
    if (right.freshnessScore !== left.freshnessScore) {
      return right.freshnessScore - left.freshnessScore;
    }

    return right.timeline.updatedAt.localeCompare(left.timeline.updatedAt);
  });

  const evergreenPool = [...candidates]
    .filter((candidate) => candidate.ageDays >= 14)
    .sort((left, right) => {
      if (right.evergreenScore !== left.evergreenScore) {
        return right.evergreenScore - left.evergreenScore;
      }

      return left.discoveryScore - right.discoveryScore;
    });

  const diversityPool = Array.from(
    [...candidates]
      .sort((left, right) => {
        if (right.evergreenScore !== left.evergreenScore) {
          return right.evergreenScore - left.evergreenScore;
        }

        return right.freshnessScore - left.freshnessScore;
      })
      .reduce<Map<string, WeightedCandidate>>((accumulator, candidate) => {
        if (!accumulator.has(candidate.timeline.category)) {
          accumulator.set(candidate.timeline.category, candidate);
        }

        return accumulator;
      }, new Map())
      .values()
  );

  const discoveryPool = [...candidates].sort((left, right) => left.discoveryScore - right.discoveryScore);

  const buckets: Record<WeightedBucket, WeightedCandidate[]> = {
    recent: recentPool,
    evergreen: evergreenPool,
    diversity: diversityPool,
    discovery: discoveryPool
  };

  for (const { bucket } of HOMEPAGE_ROTATION_WEIGHTS) {
    const targetCount = bucketCounts[bucket];
    for (let index = 0; index < targetCount; index += 1) {
      const next = pickNextCandidate(buckets[bucket], selectedSlugs, previousCategory);
      if (!next) {
        break;
      }

      selected.push(next);
      selectedSlugs.add(next.timeline.slug);
      previousCategory = next.timeline.category;
    }
  }

  if (selected.length < limit) {
    for (const next of recentPool) {
      if (selectedSlugs.has(next.timeline.slug)) {
        continue;
      }

      selected.push(next);
      selectedSlugs.add(next.timeline.slug);
      if (selected.length >= limit) {
        break;
      }
    }
  }

  const ordered = interleaveByCategory(selected.slice(0, limit));
  return applyDailyMicroRotation(ordered, seed);
}

async function getHomepageSnapshotSlice(
  offset = 0,
  limit = 12,
  snapshotDate = getDateSeed()
): Promise<HomepageSnapshotSlice> {
  const baseBatchSize = 12;
  const candidateLimit = clamp(Math.max(baseBatchSize * 6, 48), baseBatchSize, 120);
  const candidates = buildWeightedCandidates(await timelineRepository.listSummaries(candidateLimit), snapshotDate);
  const ordered: TimelineSummary[] = [];
  const remaining = [...candidates];

  while (remaining.length > 0) {
    const nextChunk = selectHomepageTimelinesFromCandidates(remaining, Math.min(baseBatchSize, remaining.length), snapshotDate);
    if (nextChunk.length === 0) {
      break;
    }

    const nextSlugs = new Set(nextChunk.map((timeline) => timeline.slug));
    ordered.push(...nextChunk);

    const beforeTrim = remaining.length;
    const filtered = remaining.filter((candidate) => !nextSlugs.has(candidate.timeline.slug));
    remaining.splice(0, remaining.length, ...filtered);

    if (filtered.length === beforeTrim) {
      break;
    }
  }

  const normalizedOffset = Math.max(0, offset);
  const normalizedLimit = clamp(limit, 1, 24);
  const items = ordered.slice(normalizedOffset, normalizedOffset + normalizedLimit);
  const nextOffset = normalizedOffset + items.length;

  return {
    items,
    nextOffset: nextOffset < ordered.length ? nextOffset : null,
    hasMore: nextOffset < ordered.length,
    snapshotDate
  };
}

async function listHomepageTimelines(limit = 12): Promise<TimelineSummary[]> {
  const candidateLimit = clamp(Math.max(limit * 6, 48), limit, 120);
  const seed = getDateSeed();
  const candidates = buildWeightedCandidates(await timelineRepository.listSummaries(candidateLimit), seed);
  return selectHomepageTimelinesFromCandidates(candidates, limit, seed);
}

export const contentService = {
  listFeaturedTimelines(limit = 12): Promise<TimelineSummary[]> {
    return timelineRepository.listSummaries(limit);
  },

  listHomepageTimelines(limit = 12): Promise<TimelineSummary[]> {
    return listHomepageTimelines(limit);
  },

  getHomepageSnapshotSlice(offset = 0, limit = 12, snapshotDate?: string): Promise<HomepageSnapshotSlice> {
    return getHomepageSnapshotSlice(offset, limit, snapshotDate);
  },

  listStaticSlugs(limit = 50): Promise<string[]> {
    return timelineRepository.listStaticSlugs(limit);
  },

  listSitemapEntries(): Promise<Array<{ slug: string; updatedAt: string }>> {
    return timelineRepository.listSitemapEntries();
  },

  listCategoryEntries(): Promise<CategoryEntry[]> {
    return timelineRepository.listCategoryEntries();
  },

  getTimeline(slug: string): Promise<TimelineDetail | null> {
    return timelineRepository.getBySlug(slug);
  },

  resolveTimelineRoute(slug: string): Promise<{ timeline: TimelineDetail | null; redirectSlug: string | null }> {
    return timelineRepository.resolveBySlug(slug);
  },

  async getTagDetail(slug: string): Promise<TagDetail | null> {
    const [tag, timelines] = await Promise.all([tagRepository.getBySlug(slug), timelineRepository.getByTag(slug)]);
    if (!tag) {
      return null;
    }

    return { tag, timelines };
  },

  getCategoryDetail(slug: string): Promise<CategoryDetail | null> {
    return timelineRepository.getByCategorySlug(slug);
  },

  async searchTimelines(query: string, limit = 12): Promise<SearchResult> {
    const normalized = normalizeQuery(query);
    const items = normalized ? await timelineRepository.search(normalized, limit) : [];
    return {
      query: normalized,
      total: items.length,
      items
    };
  }
};
