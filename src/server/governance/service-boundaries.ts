import { ApiError } from "@/src/server/api/responses";
import type { GovernanceQueueAction, GovernanceServiceBoundary } from "@/src/server/governance/contracts";

const forbiddenActions: Record<GovernanceServiceBoundary, readonly GovernanceQueueAction[]> = {
  factory: ["accept", "certify_ready"],
  governance: [],
  historical_library: ["certify_ready"],
  registry: ["accept", "certify_ready"],
  platform: ["submit", "validate", "request_revision", "approve", "reject", "escalate", "certify_ready", "accept", "return_to_factory", "close", "preserve"]
};

export function assertServiceMayPerformAction(service: GovernanceServiceBoundary, action: GovernanceQueueAction): void {
  if (forbiddenActions[service].includes(action)) {
    throw new ApiError(403, "GOVERNANCE_SERVICE_BOUNDARY_VIOLATION", `${service} may not perform ${action}.`);
  }
}

export function assertPlatformReadOnly(service: GovernanceServiceBoundary): void {
  if (service === "platform") {
    throw new ApiError(403, "PLATFORM_READ_ONLY_AUTHORITY", "Platform is a read-only consumer and cannot mutate authority.");
  }
}

export function assertFactoryCannotPublish(service: GovernanceServiceBoundary, action: GovernanceQueueAction): void {
  if (service === "factory" && (action === "accept" || action === "certify_ready")) {
    throw new ApiError(403, "FACTORY_PUBLICATION_BYPASS_BLOCKED", "Factory cannot publish authority or bypass Governance readiness.");
  }
}
