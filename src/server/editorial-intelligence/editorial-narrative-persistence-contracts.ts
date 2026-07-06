import type { GenerationDiagnostics } from "@/src/server/editorial-intelligence/editorial-generation-contracts";
import type { EditorialNarrative } from "@/src/server/editorial-intelligence/editorial-narrative-contracts";

export const EDITORIAL_NARRATIVE_PERSISTENCE_VERSION = "ei-004-narrative-persistence-v1" as const;

export type EditorialNarrativeRevisionInput = Readonly<{
  revision: number;
  supersedesNarrativeId: string | null;
  reason: string;
}>;

export type PersistEditorialNarrativeInput = Readonly<{
  narrative: EditorialNarrative;
  executionKey: string;
  writerVersion: string;
  generationAlgorithmVersion: string;
  diagnostics: readonly GenerationDiagnostics[];
  revision: EditorialNarrativeRevisionInput;
  actor: string;
}>;

export type PersistedEditorialNarrative = Readonly<
  Omit<EditorialNarrative, "factoryObjectId"> & {
    factoryObjectId: string;
    executionKey: string;
    writerVersion: string;
    generationAlgorithmVersion: string;
    persistenceVersion: typeof EDITORIAL_NARRATIVE_PERSISTENCE_VERSION;
    diagnostics: readonly GenerationDiagnostics[];
    revision: EditorialNarrativeRevisionInput;
    createdBy: string;
    createdAt?: string;
  }
>;

export type EditorialNarrativePersistence = Readonly<{
  create(input: PersistEditorialNarrativeInput): Promise<PersistedEditorialNarrative>;
  getById(narrativeId: string): Promise<PersistedEditorialNarrative | null>;
  getByExecutionKey(executionKey: string): Promise<PersistedEditorialNarrative | null>;
  getByOutputFingerprint(outputFingerprint: string): Promise<PersistedEditorialNarrative | null>;
}>;
