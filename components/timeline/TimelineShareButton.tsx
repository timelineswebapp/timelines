"use client";

import { CopyShareButton } from "@/components/ui/CopyShareButton";
import { buildCanonicalTimelineUrl } from "@/src/lib/share";

export function TimelineShareButton({
  slug,
  title
}: {
  slug: string;
  title: string;
}) {
  return (
    <CopyShareButton
      value={buildCanonicalTimelineUrl(slug)}
      ariaLabel={`Copy link for ${title}`}
      buttonClassName="timeline-summary-share"
      iconClassName="timeline-summary-share-icon"
      feedbackClassName="timeline-summary-share-feedback"
      copiedLogContext={{
        shareTarget: "timeline",
        slug
      }}
    />
  );
}
