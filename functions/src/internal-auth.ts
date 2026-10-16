import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SIGNATURE_AGE_MS = 5 * 60_000;

export function internalRequestSignature(secret: string, timestamp: string, method: string, path: string, serializedBody = ""): string {
  return createHmac("sha256", secret).update(`${timestamp}.${method.toUpperCase()}.${path}.${serializedBody}`).digest("hex");
}

export function validInternalRequest(input: {
  secret: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
  method: string;
  path: string;
  serializedBody?: string;
  now?: number;
}): boolean {
  if (!input.secret || input.secret.length < 32 || !input.timestamp || !input.signature) return false;
  if (!/^\d+$/u.test(input.timestamp)) return false;
  const timestampMs = Number(input.timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs((input.now ?? Date.now()) - timestampMs) > MAX_SIGNATURE_AGE_MS) return false;
  const expected = internalRequestSignature(input.secret, input.timestamp, input.method, input.path, input.serializedBody);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(input.signature, "hex");
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}
