"use client";

import { useEffect, useRef, useState } from "react";
import type { EventRecord } from "@/src/lib/types";
import { formatDisplayDate } from "@/src/lib/utils";

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
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !event) {
    return null;
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        aria-modal="true"
        aria-label={event.title}
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
          <span className="eyebrow sheet-date">{formatDisplayDate(event.date, event.datePrecision)}</span>
          <button type="button" className="sheet-icon-button" onClick={onClose} aria-label="Close event details">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M5.25 5.25 14.75 14.75M14.75 5.25 5.25 14.75"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <div className="stack" style={{ gap: 10 }}>
            <h2 className="sheet-title">{event.title}</h2>
            <p className="sheet-description">{event.description}</p>
          </div>

          <section className="stack" style={{ gap: 10 }}>
            <strong>Sources</strong>
            <div className="sheet-link-list">
              {event.sources.length > 0 ? (
                event.sources.map((source) => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="sheet-link"
                  >
                    <span>{source.publisher}</span>
                    <span>{Math.round(source.credibilityScore * 100)}%</span>
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
