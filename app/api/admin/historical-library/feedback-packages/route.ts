import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { historicalLibraryFeedbackGenerationSchema } from "@/src/server/validation/schemas";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";

export const POST = withAdminAuth(async (request: Request, _context, identity) => {
  const input = historicalLibraryFeedbackGenerationSchema.omit({ actor: true }).parse(await request.json());
  return ok(await adminService.generateHistoricalLibraryFeedbackPackage({ ...input, actor: await resolveInstitutionalActor(identity, "historical_library.feedback.generate", ["historical_library"]) }), { status: 201 });
}, { roles: ["library_operator"] });
