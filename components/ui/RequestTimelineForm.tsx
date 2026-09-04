"use client";

import { useState } from "react";
import { CloseIcon, SendIcon } from "@/components/ui/Icons";

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

      const payload = (await response.json()) as {
        ok: boolean;
        data?: { status?: "AVAILABLE" | "QUEUED" | "PROCESSING" | "FAILED"; route?: string };
        error?: { message?: string };
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message || "Unable to submit request.");
      }

      if (payload.data?.status === "AVAILABLE" && payload.data.route) {
        window.location.assign(payload.data.route);
        return;
      }
      const statusMessages = {
        AVAILABLE: "This topic is already available.",
        QUEUED: "Topic queued. TiMELiNES is researching it now.",
        PROCESSING: "This topic is already being researched.",
        FAILED: "Research could not be completed. The request is available for editorial review."
      } as const;
      setMessage(payload.data?.status ? statusMessages[payload.data.status as keyof typeof statusMessages] : "Topic queued for research.");
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
            <section className="request-modal glass" onClick={(event) => event.stopPropagation()}>
              <div className="request-modal-header">
                <strong>Request a timeline</strong>
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
