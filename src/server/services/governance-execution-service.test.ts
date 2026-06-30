import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PublicationPackage } from "@/src/server/governance/contracts";
import { evaluateGovernancePolicy } from "@/src/server/services/governance-execution-service";

function publicationPackage(overrides: Partial<PublicationPackage> = {}): PublicationPackage {
  return {
    packageId: "package-1",
    scope: { packageType: "historical_object_publication", description: "Complete package." },
    includedAuthority: [{ authorityType: "historical_object", authorityId: "object-1" }],
    validationArtifacts: [
      { evidenceId: "evidence-1", evidenceType: "validated_evidence", evidenceRecordId: "record-1", validationRecordId: "validation-1", authoritySafe: true },
      { evidenceId: "evidence-2", evidenceType: "validated_evidence", evidenceRecordId: "record-2", validationRecordId: "validation-2", authoritySafe: true }
    ],
    decisionRefs: [],
    riskSummary: { unresolvedAuthorityRisks: [], disputeRefs: [], validationWarnings: [], publicationBlockers: [] },
    lifecycle: "governance_review",
    ...overrides
  };
}

describe("Governance decision policy", () => {
  it("classifies complete, validated, risk-free packages as routine", () => {
    assert.equal(evaluateGovernancePolicy(publicationPackage()).outcome, "routine");
  });

  it("classifies repository-defined exceptional conditions for human review", () => {
    const result = evaluateGovernancePolicy(publicationPackage({
      includedAuthority: [],
      validationArtifacts: [],
      riskSummary: {
        unresolvedAuthorityRisks: ["authority unresolved"],
        disputeRefs: ["dispute-1"],
        validationWarnings: ["chronology unresolved"],
        publicationBlockers: ["evidence incomplete"]
      }
    }));
    assert.equal(result.outcome, "exceptional");
    assert.equal(result.reasons.length, 6);
  });
});
