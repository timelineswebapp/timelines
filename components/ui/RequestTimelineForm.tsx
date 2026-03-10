"use client";

import { useState } from "react";

export function RequestTimelineForm({
  collapsible = false,
  triggerLabel = "MISSING A TOPIC?"
}: {
  collapsible?: boolean;
  triggerLabel?: string;
}) {
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(!collapsible);

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

      const payload = (await response.json()) as { ok: boolean; error?: { message?: string } };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message || "Unable to submit request.");
      }

      setMessage("Request captured. Editorial review will pick it up from the admin queue.");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="request-inline-shell">
      {collapsible ? (
        <button
          type="button"
          className="request-toggle-button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
        >
          {triggerLabel}
        </button>
      ) : null}

      {isOpen ? (
        <form action={onSubmit} className="request-form-compact">
          <input type="hidden" name="language" value="en" />
          <input
            className="input"
            name="query"
            placeholder="Request a timeline or event"
            minLength={3}
            maxLength={120}
            required
          />
          <button className="button secondary request-inline-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Request"}
          </button>
          {message ? <p className="small request-form-message request-form-success">{message}</p> : null}
          {error ? <p className="small request-form-message request-form-error">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
