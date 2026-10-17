import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import postgres from "postgres";

const exec = promisify(execFile);
const port = 55433;
const scope = "governance.decision.approve";

type Resolver = (identity: { operatorId: string; displayName: string; roles: ["admin", "governance_operator"]; authMethod: "operator_token"; mfaVerified: true; sessionId: null }, actionScope: string, institutions?: readonly string[]) => Promise<{ actorId: string; institutionId: string; role: string }>;

function identity(operatorId: string) {
  return { operatorId, displayName: operatorId, roles: ["admin", "governance_operator"] as ["admin", "governance_operator"], authMethod: "operator_token" as const, mfaVerified: true as const, sessionId: null };
}

async function expectDenied(operation: () => Promise<unknown>, name: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "INSTITUTIONAL_AUTHORIZATION_REQUIRED") return;
    throw error;
  }
  throw new Error(`${name} was authorized`);
}

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "timelines-institutional-db-"));
  const data = join(root, "data");
  const url = `postgresql://${process.env.USER}@127.0.0.1:${port}/postgres`;
  let sql: postgres.Sql | null = null;
  let closeSql: (() => Promise<void>) | null = null;
  try {
    await exec("initdb", ["-D", data, "--auth=trust", "--no-locale", "--encoding=UTF8"]);
    await exec("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"]);
    sql = postgres(url, { max: 4 });
    const migration = await readFile("db/migrations/20260730_institutional_actor_appointments.sql", "utf8");
    const rollback = await readFile("db/rollbacks/20260730_institutional_actor_appointments.sql", "utf8");
    await sql.unsafe(migration);

    process.env.DATABASE_URL = url;
    const { config } = await import("@/src/lib/config");
    config.databaseUrl = url;
    const { closeSql: closeApplicationSql } = await import("@/src/server/db/client");
    closeSql = closeApplicationSql;
    const { resolveInstitutionalActor } = await import("@/src/server/security/institutional-actor-resolution");
    const resolve = resolveInstitutionalActor as Resolver;

    await sql`INSERT INTO institutional_actor_appointments(id, appointment_key, principal_id, institution_id, constitutional_role, action_scopes, authorization_version, status, valid_from, audit_lineage)
      VALUES ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'fixture-valid', 'governance', 'governance_reviewer', ARRAY[${scope}], 1, 'active', NOW(), '{}')`;
    const activeActor = await resolve(identity("fixture-valid"), scope, ["governance"]);
    if (activeActor.actorId !== "fixture-valid" || activeActor.institutionId !== "governance" || activeActor.role !== "governance_reviewer") throw new Error("active appointment did not resolve to its server-owned actor");

    await expectDenied(() => resolve(identity("fixture-valid"), "governance.decision.submit", ["governance"]), "wrong action scope");
    await expectDenied(() => resolve(identity("fixture-missing"), scope, ["governance"]), "missing appointment");

    await sql`INSERT INTO institutional_actor_appointments(id, appointment_key, principal_id, institution_id, constitutional_role, action_scopes, authorization_version, status, valid_from, valid_until, audit_lineage)
      VALUES ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'fixture-expired', 'governance', 'governance_reviewer', ARRAY[${scope}], 1, 'active', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', '{}')`;
    await expectDenied(() => resolve(identity("fixture-expired"), scope, ["governance"]), "expired appointment");

    await sql`INSERT INTO institutional_actor_appointments(id, appointment_key, principal_id, institution_id, constitutional_role, action_scopes, authorization_version, status, valid_from, audit_lineage)
      VALUES ('33333333-3333-4333-8333-333333333333', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'fixture-wrong-institution', 'library', 'governance_reviewer', ARRAY[${scope}], 1, 'active', NOW(), '{}')`;
    await expectDenied(() => resolve(identity("fixture-wrong-institution"), scope, ["governance"]), "wrong institution");

    await sql`INSERT INTO institutional_actor_appointments(id, appointment_key, principal_id, institution_id, constitutional_role, action_scopes, authorization_version, status, valid_from, audit_lineage)
      VALUES ('44444444-4444-4444-8444-444444444444', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'fixture-ambiguous', 'governance', 'governance_reviewer', ARRAY[${scope}], 1, 'active', NOW(), '{}'),
             ('55555555-5555-4555-8555-555555555555', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'fixture-ambiguous', 'governance', 'governance_reviewer', ARRAY[${scope}], 2, 'active', NOW(), '{}')`;
    await expectDenied(() => resolve(identity("fixture-ambiguous"), scope, ["governance"]), "ambiguous appointments");

    await sql`INSERT INTO institutional_actor_appointments(id, appointment_key, principal_id, institution_id, constitutional_role, action_scopes, authorization_version, status, valid_from, audit_lineage)
      VALUES ('66666666-6666-4666-8666-666666666666', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'fixture-revoked', 'governance', 'governance_reviewer', ARRAY[${scope}], 1, 'active', NOW(), '{}')`;
    await resolve(identity("fixture-revoked"), scope, ["governance"]);
    await sql`INSERT INTO institutional_actor_appointments(id, appointment_key, principal_id, institution_id, constitutional_role, action_scopes, authorization_version, status, valid_from, revoked_at, audit_lineage)
      VALUES ('77777777-7777-4777-8777-777777777777', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'fixture-revoked', 'governance', 'governance_reviewer', ARRAY[${scope}], 2, 'revoked', NOW(), NOW(), '{}')`;
    await expectDenied(() => resolve(identity("fixture-revoked"), scope, ["governance"]), "revoked appointment");

    await sql`INSERT INTO institutional_actor_appointments(id, appointment_key, principal_id, institution_id, constitutional_role, action_scopes, authorization_version, status, valid_from, audit_lineage)
      VALUES ('88888888-8888-4888-8888-888888888888', '99999999-9999-4999-8999-999999999999', 'fixture-concurrent', 'governance', 'governance_reviewer', ARRAY[${scope}], 1, 'active', NOW(), '{}')`;
    const [concurrentActor] = await Promise.all([
      resolve(identity("fixture-concurrent"), scope, ["governance"]),
      sql`INSERT INTO institutional_actor_appointments(id, appointment_key, principal_id, institution_id, constitutional_role, action_scopes, authorization_version, status, valid_from, revoked_at, audit_lineage)
        VALUES ('99999999-9999-4999-8999-999999999998', '99999999-9999-4999-8999-999999999999', 'fixture-concurrent', 'governance', 'governance_reviewer', ARRAY[${scope}], 2, 'revoked', NOW(), NOW(), '{}')`
    ]);
    if (concurrentActor.actorId !== "fixture-concurrent") throw new Error("concurrent authorization did not return a valid pre-revocation authorization");
    await expectDenied(() => resolve(identity("fixture-concurrent"), scope, ["governance"]), "post-revocation concurrent authorization");

    const { adminService } = await import("@/src/server/services/admin-service");
    const { setAdminSecurityAuditStoreForTests } = await import("@/src/server/security/admin-identity");
    const { resetAdminRateLimitStoreForTests } = await import("@/src/server/api/admin-auth");
    const { POST: approve } = await import("@/app/api/admin/governance/decisions/[id]/approve/route");
    const originalApprove = adminService.approveGovernanceDecision;
    const originalTokens = config.adminOperatorTokens;
    const capturedActors: Array<{ actorId: string; institutionId: string; role: string }> = [];
    config.adminOperatorTokens = "fixture-valid|admin,governance_operator|fixture-valid-token|Fixture Valid|true;fixture-admin-only|admin,governance_operator|fixture-admin-token|Fixture Admin|true";
    setAdminSecurityAuditStoreForTests({ async append() {} });
    resetAdminRateLimitStoreForTests();
    adminService.approveGovernanceDecision = (async (input: { actor: { actorId: string; institutionId: string; role: string } }) => {
      capturedActors.push(input.actor);
      return { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab" };
    }) as unknown as typeof adminService.approveGovernanceDecision;
    try {
      const body = { reason: "Fixture verifies server attribution.", actor: { actorId: "client-forged", institutionId: "registry", role: "governance_chair" } };
      const authorizedResponse = await approve(new Request("http://localhost/api/admin/governance/decisions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab/approve", { method: "POST", headers: { "content-type": "application/json", "x-admin-token": "fixture-valid-token" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab" }) });
      if (authorizedResponse.status !== 200 || capturedActors.length !== 1 || capturedActors[0]?.actorId !== "fixture-valid" || capturedActors[0]?.institutionId !== "governance") throw new Error("client supplied actor overrode server-resolved authority");
      const unauthorizedResponse = await approve(new Request("http://localhost/api/admin/governance/decisions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab/approve", { method: "POST", headers: { "content-type": "application/json", "x-admin-token": "fixture-admin-token" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab" }) });
      if (unauthorizedResponse.status !== 403 || capturedActors.length !== 1) throw new Error("unauthorized governance request mutated institutional state");
    } finally {
      adminService.approveGovernanceDecision = originalApprove;
      config.adminOperatorTokens = originalTokens;
      setAdminSecurityAuditStoreForTests(null);
    }

    await closeSql();
    closeSql = null;
    await sql.end({ timeout: 1 });
    sql = null;
    const rollbackSql = postgres(url);
    await rollbackSql.unsafe(rollback);
    const afterRollback = await rollbackSql`SELECT to_regclass('public.institutional_actor_appointments') AS relation`;
    if (afterRollback[0]?.relation !== null) throw new Error("rollback did not remove appointment table");
    await rollbackSql.unsafe(migration);
    const repeatable = await rollbackSql`SELECT to_regclass('public.institutional_actor_appointments') AS relation`;
    if (!repeatable[0]?.relation) throw new Error("migration was not repeatable");
    await rollbackSql.end({ timeout: 1 });
    console.log(JSON.stringify({ ok: true, scenarios: ["valid", "missing", "expired", "revoked", "wrong_institution", "wrong_scope", "ambiguous", "concurrent_revocation", "server_attribution", "client_actor_ignored", "unauthorized_non_effect", "rollback", "repeatable"] }));
  } finally {
    await closeSql?.().catch(() => undefined);
    await sql?.end({ timeout: 1 }).catch(() => undefined);
    await exec("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
