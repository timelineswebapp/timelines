import { z } from "zod";
import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { resolveAdminIdentity } from "@/src/server/security/admin-identity";
import { adminService } from "@/src/server/services/admin-service";

const commandSchema = z.object({
  operationId: z.string().trim().min(3).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u),
  trigger: z.enum(["RELEVANT_EVIDENCE_CHANGE", "AUTHORIZED_RETRY"]),
  relevantChangeArtifactId: z.string().trim().min(3).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u).nullable().optional(),
  authorizationReason: z.string().trim().min(3).max(1_000).nullable().optional()
}).strict().superRefine((command, context) => {
  if (command.trigger === "RELEVANT_EVIDENCE_CHANGE") {
    if (!command.relevantChangeArtifactId) context.addIssue({ code: "custom", path: ["relevantChangeArtifactId"], message: "A relevant change artifact is required." });
    if (command.authorizationReason) context.addIssue({ code: "custom", path: ["authorizationReason"], message: "An authorization reason is not allowed for evidence-change re-entry." });
    return;
  }

  if (!command.authorizationReason) context.addIssue({ code: "custom", path: ["authorizationReason"], message: "An authorization reason is required." });
  if (command.relevantChangeArtifactId) context.addIssue({ code: "custom", path: ["relevantChangeArtifactId"], message: "A relevant change artifact is not allowed for authorized retry." });
});

/** The authenticated operator is the retry authorizer; it is never accepted from the client body. */
export const POST = withAdminAuth(async (request: Request) => {
  const command = commandSchema.parse(await request.json());
  const identity = await resolveAdminIdentity(request);
  if (!identity) throw new Error("Authenticated operator identity was lost before deferred re-entry request creation.");
  return ok(await adminService.createDeferredFactoryV2Reentry({
    operationId: command.operationId,
    trigger: command.trigger,
    relevantChangeArtifactId: command.relevantChangeArtifactId || null,
    authorizedBy: command.trigger === "AUTHORIZED_RETRY" ? identity.operatorId : null,
    authorizationReason: command.trigger === "AUTHORIZED_RETRY" ? command.authorizationReason || null : null
  }));
}, { roles: ["factory_operator"] });
