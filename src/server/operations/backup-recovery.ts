export type BackupManifest = {
  generatedAt: string;
  databaseDumpPath: string;
  schemaPath: string;
  artifactPaths: string[];
  sha256: Record<string, string>;
};

export type BackupVerificationResult = {
  ok: boolean;
  missingPaths: string[];
  invalidHashes: string[];
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function validateBackupManifest(manifest: BackupManifest): BackupVerificationResult {
  const paths = [manifest.databaseDumpPath, manifest.schemaPath, ...manifest.artifactPaths];
  const missingPaths = paths.filter((path) => !manifest.sha256[path]);
  const invalidHashes = Object.entries(manifest.sha256)
    .filter(([, hash]) => !SHA256_PATTERN.test(hash))
    .map(([path]) => path);

  return {
    ok: missingPaths.length === 0 && invalidHashes.length === 0,
    missingPaths,
    invalidHashes
  };
}

export function requiredRecoveryValidationQueries(): string[] {
  return [
    "SELECT COUNT(*)::int AS count FROM timelines;",
    "SELECT COUNT(*)::int AS count FROM events;",
    "SELECT COUNT(*)::int AS count FROM event_sources;",
    "SELECT COUNT(*)::int AS count FROM event_tags;",
    "SELECT COUNT(*)::int AS count FROM source_authority_records;",
    "SELECT COUNT(*)::int AS count FROM source_authority_snapshots;",
    "SELECT COUNT(*)::int AS count FROM historical_library_published_snapshots;",
    "SELECT COUNT(*)::int AS count FROM published_memory_projections;",
    "SELECT COUNT(*)::int AS count FROM provider_runtime_state;"
  ];
}
