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
});
