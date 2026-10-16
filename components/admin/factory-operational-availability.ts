export function factoryOperationalAvailabilityMessage(error: unknown): string | null {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "SERVERLESS_BACKEND_UNAVAILABLE" || code === "SERVERLESS_BACKEND_INVALID_RESPONSE") {
    return "Factory operational data is temporarily unavailable. Existing work has not been changed; retry the operational read when the backend recovers.";
  }
  return null;
}
