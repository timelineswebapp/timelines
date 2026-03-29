"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { ShareIcon } from "@/components/ui/Icons";
import { copyTextToClipboard } from "@/src/lib/share";

const COPY_FEEDBACK_DURATION_MS = 1600;

export function CopyShareButton({
  value,
  ariaLabel,
  buttonClassName,
  iconClassName,
  feedbackClassName,
  copiedLogContext
}: {
  value: string;
  ariaLabel: string;
  buttonClassName: string;
  iconClassName: string;
  feedbackClassName: string;
  copiedLogContext: Record<string, unknown>;
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

    void copyTextToClipboard(value)
      .then(() => {
        showCopiedFeedback();
      })
      .catch((error) => {
        console.error(
          JSON.stringify({
            level: "error",
            component: "copy_share_button",
            message: error instanceof Error ? error.message : "Failed to copy share link",
            ...copiedLogContext
          })
        );
      });
  };

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={handleClick}
        aria-label={ariaLabel}
        title={copied ? "Link copied" : "Copy link"}
        data-copied={copied ? "true" : "false"}
      >
        <ShareIcon className={iconClassName} />
      </button>
      {copied ? (
        <span className={feedbackClassName} role="status" aria-live="polite">
          Link copied
        </span>
      ) : null}
    </>
  );
}
