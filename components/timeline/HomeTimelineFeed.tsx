"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AdSlot } from "@/components/timeline/AdSlot";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
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
  const fetchInFlightRef = useRef(false);

  const visibleItems = useMemo(() => items, [items]);
  const sentinelIndex = visibleItems.length >= 3 ? visibleItems.length - 3 : visibleItems.length - 1;

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

  return (
    <section className="timeline-summary-list" aria-label="Featured timelines">
      {visibleItems.map((timeline, index) => (
        <Fragment key={timeline.id}>
          {index === sentinelIndex ? <div ref={setSentinelNode} aria-hidden="true" style={{ height: 1 }} /> : null}
          <TimelineSummaryCard timeline={timeline} />
          {index === 1 && homeFeedAd?.activeCampaign ? <AdSlot assignment={homeFeedAd} className="home-feed-ad" /> : null}
        </Fragment>
      ))}
    </section>
  );
}
