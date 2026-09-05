"use client";

import { useEffect, useRef, useState } from "react";
import type { EventRecord } from "@/src/lib/types";
import { formatDisplayDate } from "@/src/lib/utils";
import { HistoricalContextSection } from "@/components/timeline/HistoricalContextSection";
import { CloseIcon } from "@/components/ui/Icons";

export function EventDetailSheet({
  event,
  open,
  onClose
}: {
  event: EventRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  const touchStartY = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open || !event) {
    return null;
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        aria-modal="true"
        aria-labelledby={`event-sheet-title-${event.id}`}
        className="event-sheet glass"
        role="dialog"
        style={{ transform: `translateY(${dragOffset}px)` }}
        onClick={(sheetEvent) => sheetEvent.stopPropagation()}
        onTouchStart={(touchEvent) => {
          touchStartY.current = touchEvent.touches.item(0)?.clientY ?? null;
        }}
        onTouchMove={(touchEvent) => {
          if (touchStartY.current === null) {
            return;
          }

          const currentTouch = touchEvent.touches.item(0);
          if (!currentTouch) {
            return;
          }

          const nextOffset = Math.max(0, currentTouch.clientY - touchStartY.current);
          setDragOffset(Math.min(nextOffset, 180));
        }}
        onTouchEnd={() => {
          if (dragOffset > 96) {
            setDragOffset(0);
            onClose();
            touchStartY.current = null;
            return;
          }

          setDragOffset(0);
          touchStartY.current = null;
        }}
      >
        <div className="sheet-handle" />
        <div className="event-sheet-header">
          <span className="eyebrow sheet-date">
            {formatDisplayDate(event.date, event.datePrecision, {
              displayDate: event.displayDate,
              sortYear: event.sortYear,
              sortMonth: event.sortMonth,
              sortDay: event.sortDay
            })}
          </span>
          <button ref={closeButtonRef} type="button" className="sheet-icon-button" onClick={onClose} aria-label="Close event details">
            <CloseIcon />
          </button>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <div className="stack" style={{ gap: 10 }}>
            <h2 id={`event-sheet-title-${event.id}`} className="sheet-title">{event.title}</h2>
            <p className="sheet-description">{event.description}</p>
          </div>

          <HistoricalContextSection context={event.historicalContext} compact />

          <section className="stack" style={{ gap: 10 }}>
            <strong>Sources</strong>
            <div className="sheet-link-list">
              {event.sources.length > 0 ? (
                event.sources.map((source) => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="sheet-link"
                  >
                    <span>{source.publisher}</span>
                  </a>
                ))
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  No source links were attached to this event.
                </p>
              )}
            </div>
          </section>

          <section className="stack" style={{ gap: 10 }}>
            <strong>Tags</strong>
            <div className="sheet-tag-list">
              {event.tags.length > 0 ? (
                event.tags.map((tag) => (
                  <span key={tag.id} className="pill">
                    {tag.name}
                  </span>
                ))
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  No contextual tags were attached to this event.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
