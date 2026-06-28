import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PE-002 persists immutable institutional continuation records", async () => {
  const migration = await readFile("db/migrations/20260706_institutional_continuation.sql", "utf8");
  for (const table of ["factory_institutional_events", "factory_operational_notifications", "factory_publication_verifications"]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(migration, /prevent_factory_continuation_history_mutation/);
});

test("continuation uses certified service boundaries", async () => {
  const source = await readFile("src/server/services/factory-operations-service.ts", "utf8");
  for (const call of ["factoryService.submitToGovernance", "historicalLibraryService.admitPublicationPackage", "governanceService.publishPackage", "publicationVerificationService.verify"]) assert.match(source, new RegExp(call.replace(".", "\\.")));
  assert.doesNotMatch(source, /governanceRepository|historicalLibraryRepository|publishedMemoryProjectionRepository/);
});

test("verification covers required publication surfaces", async () => {
  const source = await readFile("src/server/services/publication-verification-service.ts", "utf8");
  for (const check of ["publishedMemorySnapshot", "projection", "timelineGeneration", "searchProjection", "sitemapGeneration"]) assert.match(source, new RegExp(check));
});

test("Founder Inbox provides topic-centric audit detail", async () => {
  const source = await readFile("components/admin/AdminFactoryOperations.tsx", "utf8");
  for (const label of ["Founder Inbox", "Topic Operations", "Evidence:", "Publication and replay history", "Failures and audit"]) assert.match(source, new RegExp(label));
});
