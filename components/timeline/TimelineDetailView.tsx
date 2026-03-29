"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseEventIdParam } from "@/src/lib/share";
import type { AdSlotAssignment, TimelineDetail } from "@/src/lib/types";
import { formatHistoricalYearLabel } from "@/src/lib/historical-date";
import { AdSlot } from "@/components/timeline/AdSlot";
import { EventDetailSheet } from "@/components/timeline/EventDetailSheet";
import { EventRow } from "@/components/timeline/EventRow";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
import { ArrowLeftIcon } from "@/components/ui/Icons";

const SHOW_BACK_TO_TOP_SCROLL_FACTOR = 1.5;
const SHOW_BACK_TO_TOP_MIN_SCROLL = 960;
const STICKY_IDENTITY_TOP_THRESHOLD = 18;
const EVENT_SCROLL_TOP_OFFSET = 96;
const TIMELINE_SCROLL_STORAGE_KEY_PREFIX = "timeline-scroll:";

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

function getTimelineScrollStorageKey(slug: string) {
  return `${TIMELINE_SCROLL_STORAGE_KEY_PREFIX}${slug}`;
}

function readSavedTimelineScroll(slug: string): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(getTimelineScrollStorageKey(slug));
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function saveTimelineScroll(slug: string, scrollY: number): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(getTimelineScrollStorageKey(slug), String(Math.max(0, Math.round(scrollY))));
}

function resolveSelectedEventIdFromLocation(validEventIds: Set<number>): number | null {
  const url = new URL(window.location.href);
  const fromQuery = parseEventIdParam(url.searchParams.get("event"));
  if (fromQuery !== null && validEventIds.has(fromQuery)) {
    return fromQuery;
  }

  const hashMatch = url.hash.match(/^#event-(\d+)$/);
  const fromHash = parseEventIdParam(hashMatch?.[1] || null);
  return fromHash !== null && validEventIds.has(fromHash) ? fromHash : null;
}

function scrollToEventTarget(eventId: number, behavior: ScrollBehavior): void {
  const target = document.getElementById(`event-${eventId}`);
  if (!target) {
    return;
  }

  const nextTop = Math.max(0, window.scrollY + target.getBoundingClientRect().top - EVENT_SCROLL_TOP_OFFSET);
  window.scrollTo({
    top: nextTop,
    behavior
  });
}

export function TimelineDetailView({
  timeline,
  initialSelectedEventId = null,
  adAssignments = []
}: {
  timeline: TimelineDetail;
  initialSelectedEventId?: number | null;
  adAssignments?: AdSlotAssignment[];
}) {
  const router = useRouter();
  const headerRef = useRef<HTMLElement | null>(null);
  const validEventIdsRef = useRef(new Set(timeline.events.map((event) => event.id)));
  const [selectedEventId, setSelectedEventId] = useState<number | null>(initialSelectedEventId);
  const selectedEventIdRef = useRef<number | null>(null);
  const hasSheetHistoryEntry = useRef(false);
  const trackedTimelineViewKey = useRef<string | null>(null);
  const scrollFrameRef = useRef(0);
  const initialPositionFrameRef = useRef(0);
  const hasInitializedScrollPersistenceRef = useRef(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showStickyIdentity, setShowStickyIdentity] = useState(false);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    let cancelled = false;

    const applyInitialPositioning = () => {
      if (cancelled) {
        return;
      }

      const selectedFromLocation = resolveSelectedEventIdFromLocation(validEventIdsRef.current);
      setSelectedEventId(selectedFromLocation);

      if (selectedFromLocation !== null) {
        const normalizedUrl = new URL(window.location.href);
        normalizedUrl.searchParams.set("event", String(selectedFromLocation));
        normalizedUrl.hash = `event-${selectedFromLocation}`;
        window.history.replaceState(window.history.state, "", normalizedUrl.toString());
        hasInitializedScrollPersistenceRef.current = true;
        requestAnimationFrame(() => {
          if (!cancelled) {
            scrollToEventTarget(selectedFromLocation, "smooth");
          }
        });
        return;
      }

      const savedScrollY = readSavedTimelineScroll(timeline.slug);
      if (savedScrollY !== null && savedScrollY > 0) {
        window.scrollTo({
          top: savedScrollY,
          behavior: "auto"
        });
      }

      hasInitializedScrollPersistenceRef.current = true;
    };

    initialPositionFrameRef.current = window.requestAnimationFrame(() => {
      initialPositionFrameRef.current = window.requestAnimationFrame(applyInitialPositioning);
    });

    return () => {
      cancelled = true;
      if (initialPositionFrameRef.current !== 0) {
        window.cancelAnimationFrame(initialPositionFrameRef.current);
      }
    };
  }, [timeline.slug]);

  useEffect(() => {
    const onPopState = () => {
      hasSheetHistoryEntry.current = false;
      const nextSelectedEventId = resolveSelectedEventIdFromLocation(validEventIdsRef.current);
      setSelectedEventId(nextSelectedEventId);
      if (nextSelectedEventId !== null) {
        window.requestAnimationFrame(() => {
          scrollToEventTarget(nextSelectedEventId, "smooth");
        });
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

  useEffect(() => {
    const updateScrollState = () => {
      scrollFrameRef.current = 0;

      const nextShowBackToTop = window.scrollY >= Math.max(window.innerHeight * SHOW_BACK_TO_TOP_SCROLL_FACTOR, SHOW_BACK_TO_TOP_MIN_SCROLL);
      const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY;
      const nextShowStickyIdentity = headerBottom <= STICKY_IDENTITY_TOP_THRESHOLD;

      setShowBackToTop((current) => (current === nextShowBackToTop ? current : nextShowBackToTop));
      setShowStickyIdentity((current) => (current === nextShowStickyIdentity ? current : nextShowStickyIdentity));
      if (hasInitializedScrollPersistenceRef.current) {
        saveTimelineScroll(timeline.slug, window.scrollY);
      }
    };

    const onScroll = () => {
      if (scrollFrameRef.current !== 0) {
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(updateScrollState);
    };

    updateScrollState();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollFrameRef.current !== 0) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, [timeline.slug]);

  useEffect(() => {
    const persistScrollPosition = () => {
      saveTimelineScroll(timeline.slug, window.scrollY);
    };

    window.addEventListener("pagehide", persistScrollPosition);
    window.addEventListener("beforeunload", persistScrollPosition);

    return () => {
      window.removeEventListener("pagehide", persistScrollPosition);
      window.removeEventListener("beforeunload", persistScrollPosition);
    };
  }, [timeline.slug]);

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
    url.searchParams.set("event", String(eventId));
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

    const url = new URL(window.location.href);
    url.searchParams.delete("event");
    url.hash = "";
    window.history.replaceState(window.history.state, "", url.toString());
    setSelectedEventId(null);
  };

  return (
    <>
      <div className="timeline-page">
        <div
          className="timeline-sticky-identity glass"
          data-visible={showStickyIdentity ? "true" : "false"}
          aria-hidden={showStickyIdentity ? "false" : "true"}
        >
          <span className="timeline-sticky-category">{timeline.category}</span>
          <strong className="timeline-sticky-title">{timeline.title}</strong>
        </div>

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

        <section ref={headerRef} className="timeline-header glass">
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
                timelineSlug={timeline.slug}
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

      <button
        type="button"
        className="timeline-scroll-top"
        aria-label="Scroll to top"
        data-visible={showBackToTop ? "true" : "false"}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <span className="timeline-scroll-top-icon" aria-hidden="true">
          <ArrowLeftIcon />
        </span>
      </button>

      <EventDetailSheet event={selectedEvent} open={selectedEvent !== null} onClose={closeEvent} />
    </>
  );
}
