import { createHash } from "node:crypto";

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON cannot contain non-finite numbers.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined) throw new Error(`Canonical JSON cannot contain undefined at ${key}.`);
      result[key] = canonicalize(child);
    }
    return result;
  }
  throw new Error(`Canonical JSON cannot contain ${typeof value}.`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function payloadHash(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const { payloadHash: _ignored, ...payload } = value as Record<string, unknown>;
    return sha256(canonicalJson(payload));
  }
  return sha256(canonicalJson(value));
}

export function contentAddressedId(prefix: string, value: unknown): string {
  if (!/^[a-z][a-z0-9-]{1,30}$/u.test(prefix)) throw new Error("Invalid content-addressed ID prefix.");
  return `${prefix}-${payloadHash(value)}`;
}

export function deterministicUuid(namespace: string, identity: unknown): string {
  const hex = sha256(`${namespace}\n${canonicalJson(identity)}`).slice(0, 32).split("");
  hex[12] = "5";
  const variant = Number.parseInt(hex[16]!, 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function attachPayloadHash<T extends Record<string, unknown>>(value: T): T & { payloadHash: string } {
  return { ...value, payloadHash: payloadHash(value) };
}

export function verifyPayloadHash(value: Record<string, unknown>): boolean {
  return typeof value.payloadHash === "string" && value.payloadHash === payloadHash(value);
}
