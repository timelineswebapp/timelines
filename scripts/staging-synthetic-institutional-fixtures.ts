import "@/src/server/operations/environment";
import { randomUUID } from "node:crypto";
import { getWriteSql, closeSql } from "@/src/server/db/client";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";
import type { AdminOperatorIdentity } from "@/src/server/security/admin-identity";

const GOVERNANCE_SCOPES = [
  "governance.decision.create", "governance.decision.submit", "governance.decision.review",
  "governance.approval.create", "governance.approval.approve_step", "governance.decision.approve",
  "governance.publication.submit", "governance.publication.certify_readiness",
  "governance.publication.submit_library_review", "governance.publication.accept", "governance.publication.publish"
];

type Fixture = { principal: string; institution: string; role: string; scopes: string[] };

function requireStagingFixtureContext(): string {
  if (process.env.TIMELINES_ENVIRONMENT !== "staging" || process.env.ALLOW_SYNTHETIC_GOVERNANCE_CERTIFICATION !== "true" || process.env.ALLOW_STAGING_SYNTHETIC_FIXTURES !== "true") {
    throw new Error("Synthetic institutional fixtures require explicit staging-only authorization flags.");
  }
  if (process.env.STAGING_NEON_PROJECT_ID !== "hidden-darkness-27048706" || process.env.STAGING_DATABASE_NAME !== "timelines-staging-primary") {
    throw new Error("Synthetic institutional fixtures require the verified TL-STAGING-003 Neon project and primary database identity.");
  }
  const url = process.env.DATABASE_URL;
  if (!url || new URL(url).pathname.replace(/^\//, "") !== process.env.STAGING_DATABASE_NAME) {
    throw new Error("Synthetic institutional fixtures refuse an unverified database target.");
  }
  const runId = process.env.STAGING_SYNTHETIC_FIXTURE_RUN_ID;
  if (!runId || !/^tl-staging-004-[a-z0-9-]{8,80}$/.test(runId)) {
    throw new Error("STAGING_SYNTHETIC_FIXTURE_RUN_ID must be an explicit TL-STAGING-004 fixture identifier.");
  }
  return runId;
}

function identity(operatorId: string, role: "factory_operator" | "governance_operator" | "library_operator"): AdminOperatorIdentity {
  return { operatorId, displayName: `Synthetic staging fixture ${operatorId}`, roles: ["admin", role], authMethod: "operator_token", mfaVerified: true, sessionId: null };
}

async function provision(runId: string): Promise<void> {
  const fixtures: Fixture[] = [
    { principal: `${runId}-factory`, institution: "factory", role: "factory_editor", scopes: ["factory.publication.submit"] },
    { principal: `${runId}-governance`, institution: "governance", role: "senior_governance_reviewer", scopes: GOVERNANCE_SCOPES },
    { principal: `${runId}-library`, institution: "historical_library", role: "library_editor", scopes: ["historical_library.admission.admit"] }
  ];
  const sql = getWriteSql("provisioning staging-only synthetic institutional fixtures");
  for (const fixture of fixtures) {
    const existing = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM institutional_actor_appointments WHERE principal_id=${fixture.principal}`;
    if (Number(existing[0]?.count ?? "0") !== 0) throw new Error(`Fixture principal already exists: ${fixture.principal}`);
    await sql`INSERT INTO institutional_actor_appointments (
      id, appointment_key, principal_id, institution_id, constitutional_role, action_scopes,
      authorization_version, status, valid_from, audit_lineage
    ) VALUES (
      ${randomUUID()}, ${randomUUID()}, ${fixture.principal}, ${fixture.institution}, ${fixture.role}, ${fixture.scopes},
      1, 'active', NOW(), ${JSON.stringify({ synthetic: true, program: "TL-STAGING-004", runId, disposable: true, authority: "Founder authorization" })}::jsonb
    )`;
  }
  await resolveInstitutionalActor(identity(`${runId}-factory`, "factory_operator"), "factory.publication.submit", ["factory"]);
  await Promise.all(GOVERNANCE_SCOPES.map((scope) => resolveInstitutionalActor(identity(`${runId}-governance`, "governance_operator"), scope, ["governance"])));
  await resolveInstitutionalActor(identity(`${runId}-library`, "library_operator"), "historical_library.admission.admit", ["historical_library"]);
  try {
    await resolveInstitutionalActor(identity(`${runId}-unauthorized`, "governance_operator"), "governance.decision.approve", ["governance"]);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "INSTITUTIONAL_AUTHORIZATION_REQUIRED") {
      console.log(JSON.stringify({ ok: true, action: "provisioned", runId, fixtures: fixtures.map(({ principal, institution, role }) => ({ principal, institution, role })), unauthorizedTransitionRejected: true }));
      return;
    }
    throw error;
  }
  throw new Error("Unauthorized synthetic transition was not rejected.");
}

async function revoke(runId: string): Promise<void> {
  const sql = getWriteSql("revoking staging-only synthetic institutional fixtures");
  const active = await sql<Array<{ appointmentKey: string; principal: string; institution: string; role: string; scopes: string[]; version: number }>>`
    SELECT appointment_key::text AS "appointmentKey", principal_id AS principal, institution_id AS institution,
      constitutional_role AS role, action_scopes AS scopes, authorization_version AS version
    FROM institutional_actor_appointments
    WHERE principal_id IN (${`${runId}-factory`}, ${`${runId}-governance`}, ${`${runId}-library`}) AND status='active'`;
  if (active.length !== 3) throw new Error("Synthetic fixture revocation requires exactly three active fixture appointments.");
  for (const appointment of active) {
    await sql`INSERT INTO institutional_actor_appointments (
      id, appointment_key, principal_id, institution_id, constitutional_role, action_scopes,
      authorization_version, status, valid_from, revoked_at, audit_lineage
    ) VALUES (
      ${randomUUID()}, ${appointment.appointmentKey}, ${appointment.principal}, ${appointment.institution}, ${appointment.role}, ${appointment.scopes},
      ${appointment.version + 1}, 'revoked', NOW(), NOW(), ${JSON.stringify({ synthetic: true, program: "TL-STAGING-004", runId, disposal: "revoked" })}::jsonb
    )`;
  }
  try {
    await resolveInstitutionalActor(identity(`${runId}-governance`, "governance_operator"), "governance.decision.approve", ["governance"]);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "INSTITUTIONAL_AUTHORIZATION_REQUIRED") {
      console.log(JSON.stringify({ ok: true, action: "revoked", runId, immutableAppointmentRecordsRetained: true, postRevocationAuthorizationRejected: true }));
      return;
    }
    throw error;
  }
  throw new Error("Revoked synthetic fixture remained authorized.");
}

async function main(): Promise<void> {
  const runId = requireStagingFixtureContext();
  if (process.argv[2] === "provision") await provision(runId);
  else if (process.argv[2] === "revoke") await revoke(runId);
  else throw new Error("Usage: staging-synthetic-institutional-fixtures.ts <provision|revoke>");
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, component: "staging_synthetic_institutional_fixtures", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}).finally(() => closeSql());
