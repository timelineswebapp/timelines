import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { auditRecordSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request) => {
  const body = await request.json();
  const input = auditRecordSchema.parse(body);
  return ok(await adminService.createGovernanceAuditRecord(input), { status: 201 });
}, { roles: ["auditor"] });
