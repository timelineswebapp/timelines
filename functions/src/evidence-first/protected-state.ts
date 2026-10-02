import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { canonicalJson } from "../factory-v2/hashing";

export const PROTECTED_COLLECTIONS = ["governancePackages", "governanceDecisions", "governanceQueues", "libraryAdmissions", "publishedMemory", "platformReadModels", "searchDocuments", "sitemapDocuments"] as const;
const PAGE_SIZE = 500;
const MAXIMUM_DOCUMENTS_PER_COLLECTION = 100_000;

export type ProtectedCollectionState = { count: number; sha256: string };
export type ProtectedState = Record<(typeof PROTECTED_COLLECTIONS)[number], ProtectedCollectionState>;

export function hashProtectedDocuments(documents: readonly { id: string; data: unknown }[]): string {
  const hash = createHash("sha256");
  for (const document of [...documents].sort((left, right) => left.id.localeCompare(right.id))) {
    hash.update(canonicalJson({ id: document.id, data: document.data }));
    hash.update("\n");
  }
  return hash.digest("hex");
}

async function captureCollection(firestore: Firestore, corpusId: string, collectionName: (typeof PROTECTED_COLLECTIONS)[number]): Promise<ProtectedCollectionState> {
  const collection = firestore.collection("corpora").doc(corpusId).collection(collectionName);
  const hash = createHash("sha256");
  let count = 0;
  let cursor: string | null = null;
  while (count <= MAXIMUM_DOCUMENTS_PER_COLLECTION) {
    let query = collection.orderBy("__name__").limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const document of page.docs) {
      hash.update(canonicalJson({ id: document.id, data: document.data() }));
      hash.update("\n");
      count += 1;
      if (count > MAXIMUM_DOCUMENTS_PER_COLLECTION) throw new Error(`PROTECTED_STATE_HASH_BOUND_EXCEEDED:${collectionName}`);
    }
    if (page.size < PAGE_SIZE) return { count, sha256: hash.digest("hex") };
    cursor = page.docs.at(-1)!.id;
  }
  throw new Error(`PROTECTED_STATE_HASH_BOUND_EXCEEDED:${collectionName}`);
}

export async function captureProtectedState(firestore: Firestore, corpusId: string): Promise<ProtectedState> {
  return Object.fromEntries(await Promise.all(PROTECTED_COLLECTIONS.map(async (collectionName) => [collectionName, await captureCollection(firestore, corpusId, collectionName)] as const))) as ProtectedState;
}

export function protectedStateUnchanged(before: ProtectedState, after: ProtectedState): boolean {
  return PROTECTED_COLLECTIONS.every((collectionName) => before[collectionName].count === after[collectionName].count && before[collectionName].sha256 === after[collectionName].sha256);
}
