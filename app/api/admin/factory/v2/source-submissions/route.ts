import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { resolveAdminIdentity } from "@/src/server/security/admin-identity";
import { adminService } from "@/src/server/services/admin-service";
import { z } from "zod";

const submissionSchema = z.object({ operationId: z.string().trim().min(3).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u), submittedUrl: z.string().url().max(4096).refine((value) => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }, "A credential-free HTTPS URL is required."), rationale: z.string().trim().min(10).max(1_000) }).strict();

export const GET = withAdminAuth(async (request: Request) => {
  const limit = Number(new URL(request.url).searchParams.get("limit") || "25");
  return ok(await adminService.listFactoryV2SourceSubmissions(Number.isInteger(limit) ? Math.max(1, Math.min(100, limit)) : 25));
}, { roles: ["factory_operator"] });

export const POST = withAdminAuth(async (request: Request) => {
  const input = submissionSchema.parse(await request.json());
  const identity = await resolveAdminIdentity(request);
  if (!identity) throw new Error("Authenticated operator identity was lost before source submission.");
  return ok(await adminService.createFactoryV2SourceSubmission({ ...input, submittedBy: identity.operatorId }));
}, { roles: ["factory_operator"] });
