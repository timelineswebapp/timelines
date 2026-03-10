"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdSlotAssignment, TimelineDetail } from "@/src/lib/types";
import { AdSlot } from "@/components/timeline/AdSlot";
import { EventDetailSheet } from "@/components/timeline/EventDetailSheet";
import { EventRow } from "@/components/timeline/EventRow";
import { ArrowLeftIcon } from "@/components/ui/Icons";

function getYearLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "UTC" }).format(parsed);
}

function getTimelineDateRange(timeline: TimelineDetail) {
  const firstEvent = timeline.events[0];
  const lastEvent = timeline.events[timeline.events.length - 1];

  if (!firstEvent || !lastEvent) {
    return "";
  }

  const start = getYearLabel(firstEvent.date);
  const end = getYearLabel(lastEvent.date);
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

  const selectedEvent = timeline.events.find((event) => event.id === selectedEventId) || null;
  const dateRange = getTimelineDateRange(timeline);
  const headerMeta = [dateRange, `${timeline.eventCount} events`].filter(Boolean).join(" · ");
  const timelineInlineOne = assignmentForSlot(adAssignments, "timeline_inline_1");
  const timelineInlineTwo = assignmentForSlot(adAssignments, "timeline_inline_2");
  const timelineBottom = assignmentForSlot(adAssignments, "timeline_bottom");

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
        </section>

        <section className="event-stream" aria-label={`${timeline.title} events`}>
          {timeline.events.map((event, index) => (
            <Fragment key={event.id}>
              <EventRow event={event} onOpen={openEvent} />
              {index === 2 && timelineInlineOne ? <AdSlot assignment={timelineInlineOne} className="timeline-inline-ad" /> : null}
              {index === 7 && timelineInlineTwo ? <AdSlot assignment={timelineInlineTwo} className="timeline-inline-ad" /> : null}
            </Fragment>
          ))}
          {timelineBottom ? <AdSlot assignment={timelineBottom} className="timeline-bottom-ad" /> : null}
        </section>
      </div>

      <EventDetailSheet event={selectedEvent} open={selectedEvent !== null} onClose={closeEvent} />
    </>
  );
}
