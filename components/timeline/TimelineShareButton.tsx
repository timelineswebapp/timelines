"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { ShareIcon } from "@/components/ui/Icons";
import { buildCanonicalTimelineUrl, copyTextToClipboard } from "@/src/lib/share";

const COPY_FEEDBACK_DURATION_MS = 1600;

export function TimelineShareButton({
  slug,
  title
}: {
  slug: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const feedbackTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const showCopiedFeedback = () => {
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }

    setCopied(true);
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      feedbackTimeoutRef.current = null;
    }, COPY_FEEDBACK_DURATION_MS);
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    void copyTextToClipboard(buildCanonicalTimelineUrl(slug))
      .then(() => {
        showCopiedFeedback();
      })
      .catch((error) => {
        console.error(
          JSON.stringify({
            level: "error",
            component: "timeline_share_button",
            message: error instanceof Error ? error.message : "Failed to copy timeline link",
            slug
          })
        );
      });
  };

  return (
    <>
      <button
        type="button"
        className="timeline-summary-share"
        onClick={handleClick}
        aria-label={`Copy link for ${title}`}
        title={copied ? "Link copied" : "Copy timeline link"}
        data-copied={copied ? "true" : "false"}
      >
        <ShareIcon className="timeline-summary-share-icon" />
      </button>
      {copied ? (
        <span className="timeline-summary-share-feedback" role="status" aria-live="polite">
          Link copied
        </span>
      ) : null}
    </>
  );
}
