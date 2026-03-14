import type { TimelineViewEventInput } from "@/src/lib/types";
import { analyticsEventsRepository } from "@/src/server/repositories/analytics-events-repository";

export const telemetryService = {
  recordTimelineView: (input: TimelineViewEventInput) => analyticsEventsRepository.recordTimelineView(input)
};
