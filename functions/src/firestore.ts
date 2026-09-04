import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Firestore, Timestamp, getFirestore } from "firebase-admin/firestore";
import { PROJECT_ID } from "./config";

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID });
}

export const db: Firestore = getFirestore();
db.settings({ ignoreUndefinedProperties: false });

export const now = () => Timestamp.now();
export const serverTimestamp = () => FieldValue.serverTimestamp();

export function timestampFromDate(value: Date) {
  return Timestamp.fromDate(value);
}

export function toIso(value: unknown): string | undefined {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}
