export type PublicRequestResponse<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

function safeRequestError(status: number) {
  if (status === 429) return "Daily request limit exceeded. Please try again tomorrow.";
  if (status === 502 || status === 503) return "Topic intake is temporarily unavailable. Please try again shortly.";
  if (status >= 400 && status < 500) return "Check your request and try again.";
  return "Unable to submit request. Please try again shortly.";
}

/** Parses only the established API envelope and never exposes transport/parser details to visitors. */
export async function readPublicRequestResponse<T>(response: Response): Promise<T> {
  let payload: PublicRequestResponse<T> | null = null;
  try {
    const candidate: unknown = await response.json();
    if (candidate && typeof candidate === "object" && "ok" in candidate && typeof candidate.ok === "boolean") {
      payload = candidate as PublicRequestResponse<T>;
    }
  } catch {
    // A malformed upstream response is intentionally handled as unavailable below.
  }
  if (!response.ok || payload?.ok !== true || payload.data === undefined) {
    throw new Error(safeRequestError(response.status));
  }
  return payload.data;
}
