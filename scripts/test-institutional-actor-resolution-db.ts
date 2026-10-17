import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import postgres from "postgres";

const exec = promisify(execFile);
const port = 55433;
const principal = "fixture-principal";
const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "timelines-institutional-db-"));
  const data = join(root, "data");
  const url = `postgresql://${process.env.USER}@127.0.0.1:${port}/postgres`;
  try {
    await exec("initdb", ["-D", data, "--auth=trust", "--no-locale", "--encoding=UTF8"]);
    await exec("pg_ctl", ["-D", data, "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"]);
    const sql = postgres(url, { max: 4 });
    const migration = await readFile("db/migrations/20260730_institutional_actor_appointments.sql", "utf8");
    const rollback = await readFile("db/rollbacks/20260730_institutional_actor_appointments.sql", "utf8");
    await sql.unsafe(migration);
    await sql`INSERT INTO institutional_actor_appointments(id,appointment_key,principal_id,institution_id,constitutional_role,action_scopes,authorization_version,status,valid_from,audit_lineage) VALUES ('11111111-1111-4111-8111-111111111111',${key},${principal},'governance','governance_reviewer',ARRAY['governance.decision.approve'],1,'active',NOW(),'{}')`;
    const active = await sql`SELECT count(*)::int AS count FROM institutional_actor_appointments WHERE principal_id=${principal} AND status='active' AND 'governance.decision.approve'=ANY(action_scopes)`;
    if (active[0].count !== 1) throw new Error("active appointment resolution failed");
    const wrongScope = await sql`SELECT count(*)::int AS count FROM institutional_actor_appointments WHERE principal_id=${principal} AND 'governance.decision.submit'=ANY(action_scopes)`;
    if (wrongScope[0].count !== 0) throw new Error("wrong action scope authorized");
    await sql`INSERT INTO institutional_actor_appointments(id,appointment_key,principal_id,institution_id,constitutional_role,action_scopes,authorization_version,status,valid_from,revoked_at,audit_lineage) VALUES ('22222222-2222-4222-8222-222222222222',${key},${principal},'governance','governance_reviewer',ARRAY['governance.decision.approve'],2,'revoked',NOW(),NOW(),'{}')`;
    const revoked = await sql`SELECT count(*)::int AS count FROM institutional_actor_appointments active WHERE principal_id=${principal} AND status='active' AND NOT EXISTS (SELECT 1 FROM institutional_actor_appointments revoked WHERE revoked.appointment_key=active.appointment_key AND revoked.status='revoked' AND revoked.revoked_at<=NOW())`;
    if (revoked[0].count !== 0) throw new Error("revoked appointment remained authorized");
    await sql.unsafe(rollback);
    const afterRollback = await sql`SELECT to_regclass('public.institutional_actor_appointments') AS relation`;
    if (afterRollback[0].relation !== null) throw new Error("rollback did not remove appointment table");
    await sql.unsafe(migration);
    const repeatable = await sql`SELECT to_regclass('public.institutional_actor_appointments') AS relation`;
    if (!repeatable[0].relation) throw new Error("migration was not repeatable");
    await sql.end();
    console.log(JSON.stringify({ ok: true, scenarios: ["active", "wrong_scope", "revoked", "rollback", "repeatable"] }));
  } finally {
    await exec("pg_ctl", ["-D", data, "-m", "immediate", "stop"]).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exit(1); });
