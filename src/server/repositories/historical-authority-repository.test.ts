import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { uuidParamSchema } from "@/src/server/validation/schemas";

const validUuid = "123e4567-e89b-12d3-a456-426614174000";

describe("historical authority hardening", () => {
  it("accepts valid UUID route parameters", () => {
    assert.equal(uuidParamSchema.parse(validUuid), validUuid);
  });

  it("rejects invalid UUID route parameters before repository execution", () => {
    assert.throws(() => uuidParamSchema.parse("not-a-uuid"));
  });

  it("preserves object merge as an explicit participation revision action", () => {
    const migration = readFileSync("db/migrations/20260620_historical_object_participation_authority.sql", "utf8");
    const schema = readFileSync("db/schema.sql", "utf8");

    assert.match(migration, /object_merge/);
    assert.match(schema, /object_merge/);
  });

  it("records complete historical object merge and retirement revision snapshots", () => {
    const repository = readFileSync("src/server/repositories/historical-authority-repository.ts", "utf8");

    assert.match(
      repository,
      /INSERT INTO historical_object_revisions \(object_id, revision, action, before_state, after_state, reason, provenance, created_by\)[\s\S]*'merge'/
    );
    assert.match(
      repository,
      /INSERT INTO historical_object_revisions \(object_id, revision, action, before_state, after_state, reason, provenance, created_by\)[\s\S]*'retire'/
    );
    assert.match(repository, /tx\.json\(source as any\)/);
    assert.match(repository, /tx\.json\(mergedSource as any\)/);
    assert.match(repository, /tx\.json\(object as any\)/);
    assert.match(repository, /tx\.json\(retiredObject as any\)/);
  });

  it("enforces deterministic lifecycle transition guards", () => {
    const repository = readFileSync("src/server/repositories/historical-authority-repository.ts", "utf8");

    assert.match(repository, /function assertObjectTransitionAllowed/);
    assert.match(repository, /function assertParticipationTransitionAllowed/);
    assert.match(repository, /INVALID_HISTORICAL_OBJECT_TRANSITION/);
    assert.match(repository, /INVALID_PARTICIPATION_TRANSITION/);
  });

  it("defines governed relationship authority with lifecycle, continuity, and admin mediation", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260624_relationship_authority_foundation.sql", "utf8");
    const repository = readFileSync("src/server/repositories/historical-relationship-repository.ts", "utf8");
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const validation = readFileSync("src/server/validation/schemas.ts", "utf8");
    const contracts = readFileSync("src/server/governance/contracts.ts", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS historical_relationships/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS historical_relationship_revisions/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS historical_relationship_merges/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS historical_relationship_retirements/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS historical_relationship_disputes/);
      assert.match(source, /relationship_type IN \('influences', 'influenced_by', 'member_of', 'contains', 'located_in', 'succeeds', 'preceded_by', 'owns', 'owned_by', 'related_to'\)/);
      assert.match(source, /prevent_historical_relationships_delete/);
    }

    for (const decisionType of [
      "ADMIT_RELATIONSHIP",
      "REVISE_RELATIONSHIP",
      "RETIRE_RELATIONSHIP",
      "MERGE_RELATIONSHIP",
      "PRESERVE_RELATIONSHIP"
    ]) {
      assert.match(contracts, new RegExp(decisionType));
      assert.match(validation, new RegExp(decisionType));
    }

    assert.match(repository, /verifyApprovedGovernanceDecision/);
    assert.match(repository, /expectedDecisionTypes: \["ADMIT_RELATIONSHIP"\]/);
    assert.match(repository, /expectedDecisionTypes: \["REVISE_RELATIONSHIP"\]/);
    assert.match(repository, /expectedDecisionTypes: \["RETIRE_RELATIONSHIP"\]/);
    assert.match(repository, /expectedDecisionTypes: \["MERGE_RELATIONSHIP"\]/);
    assert.match(repository, /expectedDecisionTypes: \["PRESERVE_RELATIONSHIP"\]/);
    assert.match(repository, /INSERT INTO historical_relationship_revisions/);
    assert.match(repository, /INSERT INTO historical_relationship_merges/);
    assert.match(repository, /INSERT INTO historical_relationship_retirements/);
    assert.match(repository, /INSERT INTO historical_relationship_disputes/);
    assert.match(repository, /INVALID_RELATIONSHIP_TRANSITION/);
    assert.match(adminService, /createHistoricalRelationship: historicalRelationshipRepository\.create/);
    assert.match(adminService, /mergeHistoricalRelationship: historicalRelationshipRepository\.merge/);
    assert.match(adminService, /preserveHistoricalRelationship: historicalRelationshipRepository\.preserve/);

    for (const routePath of [
      "app/api/admin/historical-authority/relationships/route.ts",
      "app/api/admin/historical-authority/relationships/[id]/route.ts",
      "app/api/admin/historical-authority/relationships/[id]/dispute/route.ts",
      "app/api/admin/historical-authority/relationships/[id]/retire/route.ts",
      "app/api/admin/historical-authority/relationships/[id]/merge/route.ts",
      "app/api/admin/historical-authority/relationships/[id]/preserve/route.ts"
    ]) {
      const route = readFileSync(routePath, "utf8");
      assert.match(route, /withAdminAuth/);
      assert.match(route, /adminService\./);
      assert.doesNotMatch(route, /historicalRelationshipRepository|governanceRepository|getWriteSql|INSERT INTO|UPDATE|DELETE FROM/);
    }
  });
});
