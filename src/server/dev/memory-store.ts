import type {
  EventRecord,
  SourceRecord,
  TagRecord,
  TimelineDetail,
  TimelineRequestRecord,
  TimelineSummary
} from "@/src/lib/types";
import { sampleRequests, sampleSources, sampleTags, sampleTimelines } from "@/src/server/dev/sample-data";

interface MemoryState {
  timelines: TimelineDetail[];
  sources: SourceRecord[];
  tags: TagRecord[];
  requests: TimelineRequestRecord[];
  nextTimelineId: number;
  nextEventId: number;
  nextSourceId: number;
  nextTagId: number;
  nextRequestId: number;
}

function cloneTimelines(): TimelineDetail[] {
  return structuredClone(sampleTimelines);
}

function maxEventId(timelines: TimelineDetail[]): number {
  return timelines.flatMap((timeline) => timeline.events).reduce((max, event) => Math.max(max, event.id), 0);
}

const state: MemoryState = {
  timelines: cloneTimelines(),
  sources: structuredClone(sampleSources),
  tags: structuredClone(sampleTags),
  requests: structuredClone(sampleRequests),
  nextTimelineId: sampleTimelines.length + 1,
  nextEventId: maxEventId(sampleTimelines) + 1,
  nextSourceId: sampleSources.length + 1,
  nextTagId: sampleTags.length + 1,
  nextRequestId: sampleRequests.length + 1
};

export const memoryStore = {
  getTimelines(): TimelineDetail[] {
    return state.timelines;
  },
  getTimelineSummaries(): TimelineSummary[] {
    return state.timelines.map(({ events: _events, relatedTimelines: _relatedTimelines, ...summary }) => summary);
  },
  setTimelines(timelines: TimelineDetail[]): void {
    state.timelines = timelines;
  },
  getSources(): SourceRecord[] {
    return state.sources;
  },
  setSources(sources: SourceRecord[]): void {
    state.sources = sources;
  },
  getTags(): TagRecord[] {
    return state.tags;
  },
  setTags(tags: TagRecord[]): void {
    state.tags = tags;
  },
  getRequests(): TimelineRequestRecord[] {
    return state.requests;
  },
  setRequests(requests: TimelineRequestRecord[]): void {
    state.requests = requests;
  },
  nextTimelineId(): number {
    return state.nextTimelineId++;
  },
  nextEventId(): number {
    return state.nextEventId++;
  },
  nextSourceId(): number {
    return state.nextSourceId++;
  },
  nextTagId(): number {
    return state.nextTagId++;
  },
  nextRequestId(): number {
    return state.nextRequestId++;
  }
};

export function touchTimelineSummary(timeline: TimelineDetail): TimelineDetail {
  timeline.updatedAt = new Date().toISOString();
  timeline.eventCount = timeline.events.length;
  timeline.highlightedEventTitles = timeline.events.slice(0, 3).map((event) => event.title);
  return timeline;
}

export function withRelatedTimelines(timeline: TimelineDetail, timelines: TimelineDetail[]): TimelineDetail {
  return {
    ...timeline,
    relatedTimelines: timelines
      .filter((candidate) => candidate.id !== timeline.id && candidate.category === timeline.category)
      .slice(0, 3)
      .map(({ events: _events, relatedTimelines: _relatedTimelines, ...summary }) => summary)
  };
}

export function attachTaxonomyToEvent(
  event: EventRecord,
  sourceIds: number[],
  tagIds: number[],
  sources: SourceRecord[],
  tags: TagRecord[]
): EventRecord {
  return {
    ...event,
    sources: sources.filter((source) => sourceIds.includes(source.id)),
    tags: tags.filter((tag) => tagIds.includes(tag.id))
  };
}
