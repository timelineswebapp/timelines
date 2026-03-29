"use client";

import { CopyShareButton } from "@/components/ui/CopyShareButton";
import { buildCanonicalEventUrl } from "@/src/lib/share";

export function EventShareButton({
  timelineSlug,
  eventId,
  eventTitle
}: {
  timelineSlug: string;
  eventId: number;
  eventTitle: string;
}) {
  return (
    <CopyShareButton
      value={buildCanonicalEventUrl(timelineSlug, eventId)}
      ariaLabel={`Copy link for ${eventTitle}`}
      buttonClassName="event-row-share"
      iconClassName="event-row-share-icon"
      feedbackClassName="event-row-share-feedback"
      copiedLogContext={{
        shareTarget: "event",
        timelineSlug,
        eventId
      }}
    />
  );
}
