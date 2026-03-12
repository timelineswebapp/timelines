import type { EventRecord } from "@/src/lib/types";
import { formatDisplayDate, truncate } from "@/src/lib/utils";

export function EventRow({
  event,
  onOpen,
  summaryLines = 1,
  summaryMaxLength = 120
}: {
  event: EventRecord;
  onOpen: (eventId: number) => void;
  summaryLines?: number;
  summaryMaxLength?: number;
}) {
  return (
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
        <strong className="event-row-title">{event.title}</strong>
        <span className="event-row-summary">{truncate(event.description, summaryMaxLength)}</span>
      </span>
    </button>
  );
}
