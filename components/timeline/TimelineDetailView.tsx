"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdSlotAssignment, TimelineDetail } from "@/src/lib/types";
import { formatHistoricalYearLabel } from "@/src/lib/historical-date";
import { AdSlot } from "@/components/timeline/AdSlot";
import { EventDetailSheet } from "@/components/timeline/EventDetailSheet";
import { EventRow } from "@/components/timeline/EventRow";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
import { ArrowLeftIcon } from "@/components/ui/Icons";

function getTimelineDateRange(timeline: TimelineDetail) {
  const firstEvent = timeline.events[0];
  const lastEvent = timeline.events[timeline.events.length - 1];

  if (!firstEvent || !lastEvent) {
    return "";
  }

  const start = formatHistoricalYearLabel({
    date: firstEvent.legacyDate || firstEvent.date,
    datePrecision: firstEvent.datePrecision,
    displayDate: firstEvent.displayDate,
    sortYear: firstEvent.sortYear
  });
  const end = formatHistoricalYearLabel({
    date: lastEvent.legacyDate || lastEvent.date,
    datePrecision: lastEvent.datePrecision,
    displayDate: lastEvent.displayDate,
    sortYear: lastEvent.sortYear
  });
  return start === end ? start : `${start}–${end}`;
}

function assignmentForSlot(assignments: AdSlotAssignment[], slot: AdSlotAssignment["slot"]) {
  return assignments.find((assignment) => assignment.slot === slot) || null;
}

export function TimelineDetailView({
  timeline,
  adAssignments = []
}: {
  timeline: TimelineDetail;
  adAssignments?: AdSlotAssignment[];
}) {
  const router = useRouter();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const selectedEventIdRef = useRef<number | null>(null);
  const hasSheetHistoryEntry = useRef(false);
  const trackedTimelineViewKey = useRef<string | null>(null);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    const onPopState = () => {
      if (selectedEventIdRef.current !== null) {
        hasSheetHistoryEntry.current = false;
        setSelectedEventId(null);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const trackingKey = `${timeline.id}:${timeline.slug}`;
    if (trackedTimelineViewKey.current === trackingKey) {
      return;
    }

    trackedTimelineViewKey.current = trackingKey;

    void fetch("/api/telemetry/timeline-view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
      body: JSON.stringify({
        timelineId: timeline.id,
        slug: timeline.slug
      })
    })
      .then(async (response) => {
        if (response.ok) {
          return;
        }

        console.error(
          JSON.stringify({
            level: "error",
            component: "timeline_view_tracking",
            message: "Timeline view tracking request failed",
            slug: timeline.slug,
            status: response.status,
            body: await response.text()
          })
        );
      })
      .catch((error) => {
        console.error(
          JSON.stringify({
            level: "error",
            component: "timeline_view_tracking",
            message: error instanceof Error ? error.message : "Unexpected timeline view tracking failure",
            slug: timeline.slug
          })
        );
      });
  }, [timeline.id, timeline.slug]);

  const selectedEvent = timeline.events.find((event) => event.id === selectedEventId) || null;
  const dateRange = getTimelineDateRange(timeline);
  const headerMeta = [dateRange, `${timeline.eventCount} events`].filter(Boolean).join(" · ");
  const inlineOneAssignment = assignmentForSlot(adAssignments, "timeline_inline_1");
  const inlineTwoAssignment = assignmentForSlot(adAssignments, "timeline_inline_2");
  const bottomAssignment = assignmentForSlot(adAssignments, "timeline_bottom");
  const timelineInlineOne = inlineOneAssignment?.activeCampaign ? inlineOneAssignment : null;
  const timelineInlineTwo = inlineTwoAssignment?.activeCampaign ? inlineTwoAssignment : null;
  const timelineBottom = bottomAssignment?.activeCampaign ? bottomAssignment : null;

  const openEvent = (eventId: number) => {
    const url = new URL(window.location.href);
    url.hash = `event-${eventId}`;
    const href = url.toString();

    if (selectedEventIdRef.current === null) {
      window.history.pushState({ eventSheet: true }, "", href);
      hasSheetHistoryEntry.current = true;
    } else {
      window.history.replaceState({ eventSheet: true }, "", href);
    }

    setSelectedEventId(eventId);
  };

  const closeEvent = () => {
    if (hasSheetHistoryEntry.current) {
      hasSheetHistoryEntry.current = false;
      window.history.back();
      return;
    }

    setSelectedEventId(null);
  };

  return (
    <>
      <div className="timeline-page">
        <button
          type="button"
          className="timeline-back"
          onClick={() => {
            if (selectedEventIdRef.current !== null) {
              closeEvent();
              return;
            }

            router.push("/");
          }}
          aria-label="Go back"
        >
          <ArrowLeftIcon />
        </button>

        <section className="timeline-header glass">
          <span className="timeline-category">{timeline.category}</span>
          <h1 className="timeline-title">{timeline.title}</h1>
          <p className="timeline-header-meta">{headerMeta}</p>
          <p className="timeline-description">{timeline.description}</p>
          {timeline.tags.length > 0 ? (
            <div className="timeline-tag-list" aria-label={`${timeline.title} tags`}>
              {timeline.tags.map((tag) => (
                <Link key={tag.id} href={`/tag/${tag.slug}`} className="pill timeline-tag-link">
                  {tag.name}
                </Link>
              ))}
            </div>
          ) : null}
        </section>

        <section className="event-stream" aria-label={`${timeline.title} events`}>
          {timeline.events.map((event, index) => (
            <Fragment key={event.id}>
              <EventRow
                event={event}
                onOpen={openEvent}
                summaryLines={index < 10 ? 3 : 1}
                summaryMaxLength={index < 10 ? 240 : 120}
              />
              {index === 2 && timelineInlineOne ? <AdSlot assignment={timelineInlineOne} className="timeline-inline-ad" /> : null}
              {index === 7 && timelineInlineTwo ? <AdSlot assignment={timelineInlineTwo} className="timeline-inline-ad" /> : null}
            </Fragment>
          ))}
          {timelineBottom ? <AdSlot assignment={timelineBottom} className="timeline-bottom-ad" /> : null}
        </section>

        {timeline.relatedTimelines.length > 0 ? (
          <section className="timeline-related stack" aria-label="Related timelines">
            <div className="stack" style={{ gap: 6 }}>
              <span className="eyebrow">Related timelines</span>
              <h2 className="timeline-related-title">Continue through connected chronologies</h2>
            </div>
            <div className="timeline-summary-list">
              {timeline.relatedTimelines.map((relatedTimeline) => (
                <TimelineSummaryCard key={relatedTimeline.id} timeline={relatedTimeline} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <EventDetailSheet event={selectedEvent} open={selectedEvent !== null} onClose={closeEvent} />
    </>
  );
}
