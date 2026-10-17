import { ApiError } from "@/src/server/api/responses";
import type { GovernanceActorRef, GovernanceRole } from "@/src/server/governance/contracts";
import type { AdminOperatorIdentity } from "@/src/server/security/admin-identity";
import { getWriteSql } from "@/src/server/db/client";

type AppointmentRow = { appointmentId: string; institutionId: string; role: GovernanceRole; authorizationVersion: number };

export function institutionalActorFromAppointments(principalId: string, rows: AppointmentRow[]): GovernanceActorRef {
  if (rows.length !== 1) throw new ApiError(403, "INSTITUTIONAL_AUTHORIZATION_REQUIRED", "No active institutional appointment authorizes this action.");
  const appointment = rows[0]!;
  return { actorId: principalId, institutionId: appointment.institutionId, role: appointment.role };
}

export async function resolveInstitutionalActor(
  identity: AdminOperatorIdentity,
  actionScope: string,
  permittedInstitutionIds: readonly string[] = []
): Promise<GovernanceActorRef> {
  const sql = getWriteSql("resolving institutional actor appointment");
  const rows = await sql<AppointmentRow[]>`
    SELECT id::text AS "appointmentId", institution_id AS "institutionId", constitutional_role AS role, authorization_version AS "authorizationVersion"
    FROM institutional_actor_appointments
    WHERE principal_id = ${identity.operatorId}
      AND status = 'active'
      AND valid_from <= NOW()
      AND (valid_until IS NULL OR valid_until > NOW())
      AND ${actionScope} = ANY(action_scopes)
      AND NOT EXISTS (
        SELECT 1 FROM institutional_actor_appointments revoked
        WHERE revoked.appointment_key = institutional_actor_appointments.appointment_key
          AND revoked.status = 'revoked'
          AND revoked.revoked_at <= NOW()
      )
    ORDER BY authorization_version DESC, created_at DESC LIMIT 2`;
  const actor = institutionalActorFromAppointments(identity.operatorId, rows);
  if (permittedInstitutionIds.length > 0 && !permittedInstitutionIds.includes(actor.institutionId)) {
    throw new ApiError(403, "INSTITUTIONAL_AUTHORIZATION_REQUIRED", "No active institutional appointment authorizes this institution.");
  }
  return actor;
}
