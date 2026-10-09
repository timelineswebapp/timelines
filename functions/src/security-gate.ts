import { z } from "zod";

/**
 * Tier-1 dependency-risk policy. This is deliberately a release input rather
 * than a CI-only convention: changing a disposition changes the release ID.
 */
export const TIER1_SECURITY_GATE_POLICY_VERSION = "tier1-security-gate.1";

const approvedToolingRiskSchema = z.object({
  advisory: z.literal("GHSA-vfj7-8cjw-p6xm"),
  cve: z.literal("CVE-2026-93687"),
  classification: z.literal("ACCEPTED_TOOLING_RISK_PENDING_UPSTREAM_FIX"),
  reachability: z.literal("BUILD_TOOLING_ONLY_NOT_RUNTIME_REACHABLE"),
  affectedScope: z.literal("ROOT_DEVELOPMENT_LINT_TOOLING"),
  dependencyPath: z.tuple([
    z.literal("eslint-config-next@16.4.0"),
    z.literal("@next/eslint-plugin-next@16.4.0"),
    z.literal("fast-glob@3.3.1"),
    z.literal("micromatch@4.0.8"),
    z.literal("braces@3.0.3")
  ]),
  validOnlyWhile: z.array(z.enum([
    "DEVELOPMENT_LINT_TOOLING_ONLY",
    "ABSENT_FROM_NEXT_RUNTIME_REQUEST_PATHS",
    "ABSENT_FROM_FUNCTIONS_RUNTIME_REQUEST_PATHS",
    "NO_USER_CONTROLLED_LINT_GLOBS",
    "REPOSITORY_OWNED_LINT_CONFIGURATION",
    "ROOT_PRODUCTION_AUDIT_ZERO_HIGH_CRITICAL",
    "FUNCTIONS_PRODUCTION_AUDIT_ZERO_HIGH_CRITICAL",
    "NO_RUNTIME_REACHABILITY_TOPOLOGY_CHANGE",
    "NO_MATERIAL_UPSTREAM_ADVISORY_CHANGE"
  ])).min(9),
  reviewTriggers: z.array(z.enum([
    "EVERY_RELEASE",
    "DEPENDENCY_TOPOLOGY_CHANGE",
    "UPSTREAM_FIX_OR_MATERIAL_ADVISORY_UPDATE"
  ])).length(3)
}).strict();

export const tier1SecurityGateBundleSchema = z.object({
  policyVersion: z.literal(TIER1_SECURITY_GATE_POLICY_VERSION),
  rule: z.literal("ZERO_HIGH_CRITICAL_RUNTIME_OR_MATERIALLY_EXPLOITABLE"),
  unknownReachabilityFailsClosed: z.literal(true),
  productionAuditsIndependentlyRequired: z.literal(true),
  approvedToolingRisks: z.tuple([approvedToolingRiskSchema])
}).strict();

export type Tier1SecurityGateBundle = z.infer<typeof tier1SecurityGateBundleSchema>;

const approvedBundle: Tier1SecurityGateBundle = {
  policyVersion: TIER1_SECURITY_GATE_POLICY_VERSION,
  rule: "ZERO_HIGH_CRITICAL_RUNTIME_OR_MATERIALLY_EXPLOITABLE",
  unknownReachabilityFailsClosed: true,
  productionAuditsIndependentlyRequired: true,
  approvedToolingRisks: [{
    advisory: "GHSA-vfj7-8cjw-p6xm",
    cve: "CVE-2026-93687",
    classification: "ACCEPTED_TOOLING_RISK_PENDING_UPSTREAM_FIX",
    reachability: "BUILD_TOOLING_ONLY_NOT_RUNTIME_REACHABLE",
    affectedScope: "ROOT_DEVELOPMENT_LINT_TOOLING",
    dependencyPath: ["eslint-config-next@16.4.0", "@next/eslint-plugin-next@16.4.0", "fast-glob@3.3.1", "micromatch@4.0.8", "braces@3.0.3"],
    validOnlyWhile: [
      "DEVELOPMENT_LINT_TOOLING_ONLY",
      "ABSENT_FROM_NEXT_RUNTIME_REQUEST_PATHS",
      "ABSENT_FROM_FUNCTIONS_RUNTIME_REQUEST_PATHS",
      "NO_USER_CONTROLLED_LINT_GLOBS",
      "REPOSITORY_OWNED_LINT_CONFIGURATION",
      "ROOT_PRODUCTION_AUDIT_ZERO_HIGH_CRITICAL",
      "FUNCTIONS_PRODUCTION_AUDIT_ZERO_HIGH_CRITICAL",
      "NO_RUNTIME_REACHABILITY_TOPOLOGY_CHANGE",
      "NO_MATERIAL_UPSTREAM_ADVISORY_CHANGE"
    ],
    reviewTriggers: ["EVERY_RELEASE", "DEPENDENCY_TOPOLOGY_CHANGE", "UPSTREAM_FIX_OR_MATERIAL_ADVISORY_UPDATE"]
  }]
};

/** Returns a newly parsed value so callers cannot mutate release policy. */
export function tier1SecurityGateBundle(): Tier1SecurityGateBundle {
  return tier1SecurityGateBundleSchema.parse(JSON.parse(JSON.stringify(approvedBundle)) as unknown);
}
