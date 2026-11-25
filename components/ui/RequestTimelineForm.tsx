"use client";

import { useState } from "react";
import { CloseIcon, SendIcon } from "@/components/ui/Icons";
import { readPublicRequestResponse } from "@/src/lib/public-request-client";

export function RequestTimelineForm({
  triggerLabel = "MISSING A TOPIC?",
  variant = "inline"
}: {
  triggerLabel?: string;
  variant?: "inline" | "modal";
}) {
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(variant !== "modal");

  async function onSubmit(formData: FormData) {
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/timeline-requests", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          query: String(formData.get("query") || ""),
          language: String(formData.get("language") || "en")
        })
      });

      const payload = await readPublicRequestResponse<{ status?: "AVAILABLE" | "QUEUED" | "PROCESSING" | "FAILED"; route?: string }>(response);

      if (payload.status === "AVAILABLE" && payload.route) {
        window.location.assign(payload.route);
        return;
      }
      const statusMessages = {
        AVAILABLE: "This topic is already available.",
        QUEUED: "Your request has been recorded for editorial consideration.",
        PROCESSING: "This request is currently under editorial review.",
        FAILED: "This request could not be recorded. Please try again later."
      } as const;
      setMessage(payload.status ? statusMessages[payload.status] : "Topic queued for research.");
      if (variant === "modal") {
        window.setTimeout(() => {
          setIsOpen(false);
          setMessage("");
        }, 1200);
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="request-inline-shell">
      {variant === "modal" ? (
        <button
          type="button"
          className="eyebrow request-toggle-button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
        >
          {triggerLabel}
        </button>
      ) : null}

      {isOpen ? (
        variant === "modal" ? (
          <div className="request-modal-backdrop" onClick={() => setIsOpen(false)}>
            <section className="request-modal glass" role="dialog" aria-modal="true" aria-labelledby="request-timeline-title" onClick={(event) => event.stopPropagation()}>
              <div className="request-modal-header">
                <strong id="request-timeline-title">Suggest a topic</strong>
                <button type="button" className="sheet-icon-button" onClick={() => setIsOpen(false)} aria-label="Close request form">
                  <CloseIcon />
                </button>
              </div>
              <form action={onSubmit} className="request-form-compact">
                <input type="hidden" name="language" value="en" />
                <div className="request-input-shell">
                  <input
                    className="input request-input"
                    name="query"
                    placeholder="Request a timeline or event"
                    minLength={3}
                    maxLength={120}
                    required
                  />
                  <button className="request-send-button" type="submit" disabled={isSubmitting} aria-label="Send request">
                    {isSubmitting ? (
                      <span className="request-send-text">...</span>
                    ) : (
                      <SendIcon />
                    )}
                  </button>
                </div>
                {message ? <p className="small request-form-message request-form-success">{message}</p> : null}
                {error ? <p className="small request-form-message request-form-error">{error}</p> : null}
              </form>
            </section>
          </div>
        ) : (
          <form action={onSubmit} className="request-form-compact">
            <input type="hidden" name="language" value="en" />
            <div className="request-input-shell">
              <input
                className="input request-input"
                name="query"
                placeholder="Request a timeline or event"
                minLength={3}
                maxLength={120}
                required
              />
              <button className="request-send-button" type="submit" disabled={isSubmitting} aria-label="Send request">
                {isSubmitting ? (
                  <span className="request-send-text">...</span>
                ) : (
                  <SendIcon />
                )}
              </button>
            </div>
            {message ? <p className="small request-form-message request-form-success">{message}</p> : null}
            {error ? <p className="small request-form-message request-form-error">{error}</p> : null}
          </form>
        )
      ) : null}
    </div>
  );
}
