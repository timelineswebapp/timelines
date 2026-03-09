"use client";

import { useState } from "react";

export function RequestTimelineForm() {
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <form
      action={onSubmit}
      className="stack"
    >
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 160px" }}>
        <input className="input" name="query" placeholder="Request a missing timeline" minLength={3} maxLength={120} required />
        <input className="input" name="language" defaultValue="en" maxLength={20} />
      </div>
      <button className="button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit request"}
      </button>
      {message ? <p className="small" style={{ color: "var(--success)", margin: 0 }}>{message}</p> : null}
      {error ? <p className="small" style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
    </form>
  );
}
