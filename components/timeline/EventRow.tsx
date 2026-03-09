import type { EventRecord } from "@/src/lib/types";
import { formatDisplayDate, truncate } from "@/src/lib/utils";

export function EventRow({
  event,
  onOpen
}: {
  event: EventRecord;
  onOpen: (eventId: number) => void;
}) {
  return (
    <button type="button" className="event-row" onClick={() => onOpen(event.id)}>
      <span className="event-row-date">{formatDisplayDate(event.date, event.datePrecision)}</span>
      <span className="event-row-body">
        <strong className="event-row-title">{event.title}</strong>
        <span className="event-row-summary">{truncate(event.description, 120)}</span>
      </span>
    </button>
  );
}
