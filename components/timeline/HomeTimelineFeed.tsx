"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AdSlot } from "@/components/timeline/AdSlot";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import type { AdSlotAssignment, TimelineSummary } from "@/src/lib/types";

type HomepageSnapshotResponse = {
  items: TimelineSummary[];
  nextOffset: number | null;
  hasMore: boolean;
  snapshotDate: string;
};

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiFailure = {
  ok: false;
  error?: {
    message?: string;
  };
};

type HomepageTimelineFeedProps = {
  initialItems: TimelineSummary[];
  initialNextOffset: number | null;
  initialHasMore: boolean;
  snapshotDate: string;
  homeFeedAd: AdSlotAssignment | null;
};

export function HomeTimelineFeed({
  initialItems,
  initialNextOffset,
  initialHasMore,
  snapshotDate,
  homeFeedAd
}: HomepageTimelineFeedProps) {
  const [items, setItems] = useState(initialItems);
  const [nextOffset, setNextOffset] = useState<number | null>(initialNextOffset);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [sentinelNode, setSentinelNode] = useState<Element | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const fetchInFlightRef = useRef(false);

  const visibleItems = useMemo(() => items, [items]);
  const sentinelIndex = visibleItems.length >= 3 ? visibleItems.length - 3 : visibleItems.length - 1;
  const appendedStartIndex = visibleItems.length > initialItems.length ? initialItems.length : null;

  useEffect(() => {
    if (!hasMore || nextOffset === null || !sentinelNode) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || fetchInFlightRef.current) {
          return;
        }

        fetchInFlightRef.current = true;

        void fetch(
          `/api/homepage/timelines?offset=${nextOffset}&limit=12&snapshotDate=${encodeURIComponent(snapshotDate)}`,
          {
            method: "GET",
            cache: "no-store"
          }
        )
          .then(async (response) => {
            const payload = (await response.json()) as ApiSuccess<HomepageSnapshotResponse> | ApiFailure;
            if (!response.ok || !payload.ok) {
              throw new Error(payload.ok ? "Failed to load timelines." : payload.error?.message || "Failed to load timelines.");
            }

            setItems((current) => {
              const seen = new Set(current.map((timeline) => timeline.slug));
              const appended = payload.data.items.filter((timeline) => !seen.has(timeline.slug));
              return appended.length > 0 ? [...current, ...appended] : current;
            });
            setNextOffset(payload.data.nextOffset);
            setHasMore(payload.data.hasMore);
          })
          .catch((error) => {
            console.error(
              JSON.stringify({
                level: "error",
                component: "home_timeline_feed",
                message: error instanceof Error ? error.message : "Failed to load homepage continuation"
              })
            );
          })
          .finally(() => {
            fetchInFlightRef.current = false;
          });
      },
      {
        rootMargin: "0px 0px 240px 0px",
        threshold: 0.01
      }
    );

    observer.observe(sentinelNode);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, nextOffset, sentinelNode, snapshotDate]);

  useEffect(() => {
    let frame = 0;

    const updateVisibility = () => {
      frame = 0;
      const threshold = Math.max(window.innerHeight * 1.5, 960);
      setShowBackToTop(window.scrollY >= threshold);
    };

    const onScroll = () => {
      if (frame !== 0) {
        return;
      }

      frame = window.requestAnimationFrame(updateVisibility);
    };

    updateVisibility();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <>
      <section className="timeline-summary-list" aria-label="Featured timelines">
        {visibleItems.map((timeline, index) => (
          <Fragment key={timeline.id}>
            {appendedStartIndex === index ? (
              <div
                aria-label="Continue exploring timelines"
                style={{
                  display: "grid",
                  placeItems: "center",
                  padding: "14px 0 10px",
                  color: "rgba(19, 34, 54, 0.54)",
                  fontSize: "0.78rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase"
                }}
              >
                <span>Continue exploring timelines</span>
              </div>
            ) : null}
            {index === sentinelIndex ? <div ref={setSentinelNode} aria-hidden="true" style={{ height: 1 }} /> : null}
            <TimelineSummaryCard timeline={timeline} />
            {index === 1 && homeFeedAd?.activeCampaign ? <AdSlot assignment={homeFeedAd} className="home-feed-ad" /> : null}
          </Fragment>
        ))}
      </section>
      <button
        type="button"
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        style={{
          position: "fixed",
          right: "max(20px, calc((100vw - min(1120px, calc(100vw - 24px))) / 2 + 20px))",
          bottom: "24px",
          width: "50px",
          height: "50px",
          display: "grid",
          placeItems: "center",
          borderRadius: "999px",
          border: "1px solid rgba(255, 255, 255, 0.58)",
          background: "linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(246, 250, 255, 0.82))",
          boxShadow: "0 12px 24px rgba(74, 103, 136, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.72)",
          color: "var(--highlight-strong)",
          opacity: showBackToTop ? 1 : 0,
          pointerEvents: showBackToTop ? "auto" : "none",
          transform: `translateY(${showBackToTop ? "0" : "8px"})`,
          zIndex: 20
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            transform: "rotate(90deg) translateX(-1px)",
            width: "20px",
            height: "20px",
            lineHeight: 0
          }}
        >
          <ArrowLeftIcon className="home-back-to-top-icon" />
        </span>
      </button>
    </>
  );
}
