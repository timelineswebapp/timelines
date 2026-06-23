import { getWriteSql } from "@/src/server/db/client";
import type { AdminAuthMethod, AdminOperatorRole, AdminSecurityEvent } from "@/src/server/security/admin-identity";

export type AdminSecurityAuditRecord = {
  eventType: AdminSecurityEvent;
  operatorId: string | null;
  authMethod: AdminAuthMethod | null;
  roles: AdminOperatorRole[];
  mfaVerified: boolean;
  method: string;
  pathname: string;
  details: Record<string, unknown>;
};

export const adminSecurityAuditRepository = {
  async append(record: AdminSecurityAuditRecord): Promise<void> {
    const sql = getWriteSql("appending admin security audit event");
    await sql`
      INSERT INTO admin_security_audit_events (
        event_type,
        operator_id,
        auth_method,
        roles,
        mfa_verified,
        method,
        pathname,
        details
      )
      VALUES (
        ${record.eventType},
        ${record.operatorId},
        ${record.authMethod},
        ${record.roles},
        ${record.mfaVerified},
        ${record.method},
        ${record.pathname},
        ${JSON.stringify(record.details)}::jsonb
      )
    `;
  }
};
