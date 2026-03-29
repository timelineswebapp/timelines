import { EventShareButton } from "@/components/timeline/EventShareButton";
import type { EventRecord } from "@/src/lib/types";
import { formatDisplayDate, truncate } from "@/src/lib/utils";

export function EventRow({
  event,
  timelineSlug,
  onOpen,
  summaryLines = 1,
  summaryMaxLength = 120
}: {
  event: EventRecord;
  timelineSlug: string;
  onOpen: (eventId: number) => void;
  summaryLines?: number;
  summaryMaxLength?: number;
}) {
  return (
    <div id={`event-${event.id}`} className="event-row-shell">
      <button
        type="button"
        className={`event-row${summaryLines > 1 ? " event-row-expanded" : ""}`}
        onClick={() => onOpen(event.id)}
        style={{ ["--event-row-summary-lines" as string]: String(summaryLines) }}
      >
        <span className="event-row-date">
          {formatDisplayDate(event.date, event.datePrecision, {
            displayDate: event.displayDate,
            sortYear: event.sortYear,
            sortMonth: event.sortMonth,
            sortDay: event.sortDay
          })}
        </span>
        <span className="event-row-body">
          <span className="event-row-title-line">
            <strong className="event-row-title">{event.title}</strong>
            <span className="event-row-share-slot" aria-hidden="true" />
          </span>
          <span className="event-row-summary">{truncate(event.description, summaryMaxLength)}</span>
        </span>
      </button>
      <EventShareButton timelineSlug={timelineSlug} eventId={event.id} eventTitle={event.title} />
    </div>
  );
}
