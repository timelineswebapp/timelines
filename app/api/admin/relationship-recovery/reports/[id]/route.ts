import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { parseCanonicalPositiveIntegerPathParameter, parseOptionalEnumQueryParameter } from "@/src/server/api/query-params";
import { adminService } from "@/src/server/services/admin-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const report = await adminService.getRelationshipRecoveryReport(parseCanonicalPositiveIntegerPathParameter(id, "report id"));
  const format = parseOptionalEnumQueryParameter(new URL(request.url).searchParams, "format", ["csv", "json"] as const);

  if (format === "csv") {
    return new Response(adminService.exportRelationshipRecoveryReportCsv(report), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="relationship-recovery-report-${report.id}.csv"`
      }
    });
  }

  if (format === "json") {
    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="relationship-recovery-report-${report.id}.json"`
      }
    });
  }

  return ok(report);
}, { roles: ["admin"] });
