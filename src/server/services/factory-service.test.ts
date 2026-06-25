import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ApiError } from "@/src/server/api/responses";
import {
  assertFactoryCannotAdmitToHistoricalLibrary,
  assertFactoryCannotApprovePackage,
  assertFactoryCannotCertifyReadiness,
  assertFactoryCannotPublish,
  assertFactoryCannotRejectPackage,
  buildGovernancePublicationPackage,
  factoryService,
  setFactoryPipelineEvidenceVerifierForTests
} from "@/src/server/services/factory-service";
import { validateFactoryWorkerOutput } from "@/src/server/factory/output-schemas";
import { getFactoryRuntimeProvider, resolveFactoryQwenTimeoutMs } from "@/src/server/factory/runtime-providers";
import { factoryRepository } from "@/src/server/repositories/factory-repository";
import { sourceDiscoveryService } from "@/src/server/services/source-discovery-service";
import { sourceRetrievalService } from "@/src/server/services/source-retrieval-service";
import { corpusGenerationService } from "@/src/server/services/corpus-generation-service";
import { evidenceExtractionService } from "@/src/server/services/evidence-extraction-service";
import { evidenceValidationService } from "@/src/server/services/evidence-validation-service";

function factoryOutputForPrompt(prompt: string, override: Record<string, unknown> = {}) {
  if (prompt.includes("research_worker")) {
    return {
      summary: "Factory output grounded in validated evidence.",
      confidence: 0.9,
      boundary: { factoryOwned: true, publicationAllowed: false, governanceSubmissionAllowed: false },
      claims: [{
        claim: "The telephone evidence is source-grounded.",
        evidenceRecordIds: ["evidence-1"]
      }],
      candidates: [
        {
          title: "Telephone Source",
          objectType: "candidate_source",
          payload: { relevance: "Authority-grounded telephone source." },
          evidenceRecordIds: ["evidence-1"]
        },
        {
          title: "Telephone Context",
          objectType: "candidate_context_record",
          payload: { topic: "Telephone", scope: "Authority-grounded research context." },
          evidenceRecordIds: ["evidence-1"]
        }
      ],
      ...override
    };
  }
  const source = { sourceId: "source-record-1", evidenceRecordId: "evidence-1", title: "Authoritative Telephone Evidence", url: "https://www.wikidata.org/wiki/Special:EntityData/Q11035.json" };
  const evidence = { claim: "The telephone evidence is source-grounded.", citations: [source] };
  const candidateBase = { title: "Telephone Source", objectType: "candidate_source", payload: { sourceId: "source-record-1", title: "Authoritative Telephone Evidence", url: source.url, publisher: "Wikidata", credibility: "authoritative", citationNote: "Retrieved Source Authority snapshot.", evidenceSourceRefs: ["evidence-1"] }, evidence: [evidence], sources: [source] };
  let candidate: any = candidateBase;
  if (prompt.includes("object_extraction_worker")) {
    candidate = { ...candidateBase, title: "Telephone", objectType: "candidate_historical_object", payload: { name: "Telephone", type: "technology", summary: "A communications technology.", sourceRefs: ["evidence-1"] } };
  } else if (prompt.includes("milestone_extraction_worker")) {
    candidate = { ...candidateBase, title: "Telephone milestone", objectType: "candidate_milestone", payload: { title: "Telephone milestone", date: "1876", datePrecision: "year", summary: "A milestone.", sourceRefs: ["evidence-1"] } };
  } else if (prompt.includes("participation_extraction_worker")) {
    candidate = { ...candidateBase, title: "Telephone participation", objectType: "candidate_participation", payload: { historicalObjectRef: "telephone", milestoneRef: "milestone", role: "subject", summary: "Participation.", sourceRefs: ["evidence-1"] } };
  } else if (prompt.includes("relationship_extraction_worker")) {
    candidate = { ...candidateBase, title: "Telephone relationship", objectType: "candidate_relationship", payload: { sourceAuthorityRef: "telephone", targetAuthorityRef: "telegraph", relationshipType: "related_to", summary: "Relationship.", sourceRefs: ["evidence-1"] } };
  } else if (prompt.includes("context_enrichment_worker")) {
    candidate = { ...candidateBase, title: "Telephone context", objectType: "candidate_context_record", payload: { contextType: "summary", summary: "Context.", chronologyScope: "telephone", relatedCandidateRefs: ["telephone"], sourceRefs: ["evidence-1"] } };
  } else if (prompt.includes("package_assembly_worker")) {
    candidate = null;
  }
  return {
    summary: "Factory output grounded in validated evidence.",
    confidence: 0.9,
    boundary: { factoryOwned: true, publicationAllowed: false, governanceSubmissionAllowed: false },
    sources: [source],
    evidence: [evidence],
    candidates: candidate ? [candidate] : [],
    ...override
  };
}

describe("factory production memory foundation", () => {
  it("defines Factory-owned Production Memory schema with preservation and immutability", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260621_factory_production_memory.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_objects/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_artifacts/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_package_drafts/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_package_versions/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_audit_records/);
      assert.match(source, /prevent_factory_history_delete/);
      assert.match(source, /prevent_submitted_factory_package_version_update/);
      assert.match(source, /Submitted Factory package versions are immutable/);
    }
  });

  it("defines Factory feedback consumption and revision planning schema with preservation", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260621_factory_feedback_consumption.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_feedback_consumptions/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_revision_plans/);
      assert.match(source, /feedback_package_id UUID NOT NULL/);
      assert.match(source, /governance_publication_package_id UUID/);
      assert.match(source, /factory_package_version_id UUID/);
      assert.match(source, /factory_package_draft_id UUID/);
      assert.match(source, /factory_lineage_root_id UUID/);
      assert.match(source, /affected_factory_object_ids JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
      assert.match(source, /revision_plan_id UUID/);
      assert.match(source, /resolution_record_id UUID/);
      assert.match(source, /audit_record_id UUID NOT NULL REFERENCES factory_audit_records/);
      assert.match(source, /prevent_factory_feedback_consumptions_delete/);
      assert.match(source, /prevent_factory_revision_plans_delete/);
    }
  });

  it("defines Factory resubmission workflow linkage with deterministic lineage and supersession", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260621_factory_resubmission_workflow.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /revision_plan_id UUID REFERENCES factory_revision_plans/);
      assert.match(source, /source_feedback_package_id UUID REFERENCES governance_feedback_packages/);
      assert.match(source, /resubmission_audit_record_id UUID REFERENCES factory_audit_records/);
      assert.match(source, /superseded_package_version_id UUID REFERENCES factory_package_versions/);
      assert.match(source, /new_package_version_id UUID UNIQUE REFERENCES factory_package_versions/);
      assert.match(source, /governance_publication_package_id UUID REFERENCES governance_publication_packages/);
      assert.match(source, /submission_audit_record_id UUID REFERENCES factory_audit_records/);
      assert.match(source, /revision_completion_record_id UUID REFERENCES factory_audit_records/);
      assert.match(source, /CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_package_versions_revision_plan/);
    }
  });

  it("keeps Factory database access isolated to the repository layer", () => {
    const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const route = readFileSync("app/api/admin/factory/objects/route.ts", "utf8");

    assert.match(repository, /getWriteSql\("creating factory object"\)/);
    assert.match(repository, /INSERT INTO factory_objects/);
    assert.match(repository, /INSERT INTO factory_artifacts/);
    assert.match(repository, /INSERT INTO factory_package_drafts/);
    assert.match(repository, /INSERT INTO factory_package_versions/);
    assert.match(repository, /INSERT INTO factory_feedback_consumptions/);
    assert.match(repository, /INSERT INTO factory_revision_plans/);
    assert.doesNotMatch(service, /INSERT INTO|UPDATE factory_|DELETE FROM factory_|getWriteSql/);
    assert.doesNotMatch(route, /factoryRepository|getWriteSql|INSERT INTO|UPDATE|DELETE FROM/);
  });

  it("blocks Factory from Governance certification and approval responsibilities", () => {
    assert.throws(() => assertFactoryCannotCertifyReadiness(), ApiError);
    assert.throws(() => assertFactoryCannotApprovePackage(), ApiError);
    assert.throws(() => assertFactoryCannotRejectPackage(), ApiError);
  });

  it("blocks Factory from Historical Library admission and public publication", () => {
    assert.throws(() => assertFactoryCannotAdmitToHistoricalLibrary(), ApiError);
    assert.throws(() => assertFactoryCannotPublish(), ApiError);
  });

  it("exposes only admin-authenticated Factory routes through adminService", () => {
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const routes = [
      "app/api/admin/factory/objects/route.ts",
      "app/api/admin/factory/objects/[id]/transition/route.ts",
      "app/api/admin/factory/artifacts/route.ts",
      "app/api/admin/factory/package-drafts/route.ts",
      "app/api/admin/factory/package-drafts/[id]/transition/route.ts",
      "app/api/admin/factory/package-drafts/[id]/versions/route.ts",
      "app/api/admin/factory/package-versions/[id]/submit/route.ts",
      "app/api/admin/factory/feedback/intake/route.ts",
      "app/api/admin/factory/feedback/[id]/transition/route.ts",
      "app/api/admin/factory/feedback/[id]/revision-plan/route.ts",
      "app/api/admin/factory/revision-plans/[id]/prepare-resubmission/route.ts",
      "app/api/admin/factory/revision-plans/[id]/complete-resubmission/route.ts"
    ];

    for (const routePath of routes) {
      const route = readFileSync(routePath, "utf8");
      assert.match(route, /withAdminAuth/);
      assert.match(route, /adminService\./);
      assert.doesNotMatch(route, /factoryRepository|governanceRepository|historicalLibraryRepository/);
    }

    for (const method of [
      "createFactoryObject",
      "transitionFactoryObject",
      "createFactoryArtifact",
      "createFactoryPackageDraft",
      "transitionFactoryPackageDraft",
      "createFactoryPackageVersion",
      "markFactoryPackageVersionSubmitted",
      "intakeFactoryFeedback",
      "transitionFactoryFeedback",
      "createFactoryRevisionPlan",
      "prepareFactoryResubmission",
      "completeFactoryResubmission"
    ]) {
      assert.match(adminService, new RegExp(`${method}: factoryService\\.`));
    }
  });

  it("implements Factory feedback intake, revision planning, and resubmission preparation without public publication authority", () => {
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");
    const validation = readFileSync("src/server/validation/schemas.ts", "utf8");

    assert.match(service, /intakeFeedbackPackage/);
    assert.match(service, /getFeedbackPackage/);
    assert.match(service, /getGovernanceSubmissionByGovernancePackage/);
    assert.match(service, /transitionFeedbackConsumption/);
    assert.match(service, /createRevisionPlan/);
    assert.match(service, /prepareResubmission/);
    assert.match(service, /completeResubmission/);
    assert.match(service, /supersedesPackageId: sourceDraft\.packageDraftId/);
    assert.match(service, /supersedesVersionId: supersededVersion\.packageVersionId/);
    assert.match(service, /markPackageVersionSubmitted/);
    assert.match(service, /completeRevisionPlan/);
    assert.match(repository, /getFeedbackConsumptionByFeedbackPackage/);
    assert.match(repository, /createFeedbackConsumption/);
    assert.match(repository, /transitionRevisionPlan/);
    assert.match(repository, /revision_plan_id/);
    assert.match(repository, /source_feedback_package_id/);
    assert.match(repository, /completeRevisionPlan/);
    assert.match(validation, /factoryFeedbackIntakeSchema/);
    assert.match(validation, /factoryFeedbackTransitionSchema/);
    assert.match(validation, /factoryRevisionPlanSchema/);
    assert.match(validation, /factoryResubmissionPreparationSchema/);
    assert.match(validation, /factoryResubmissionCompletionSchema/);
    assert.doesNotMatch(service, /historicalLibraryService|admitPublicationPackage|publishPublicationPackage/);
  });

  it("implements Governance submission bridge without certification or admission", () => {
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");
    const governanceRepository = readFileSync("src/server/repositories/governance-repository.ts", "utf8");
    const route = readFileSync("app/api/admin/factory/package-versions/[id]/submit/route.ts", "utf8");

    assert.match(service, /getGovernanceSubmissionByVersion/);
    assert.match(service, /governanceService\.createPublicationPackage/);
    assert.match(service, /markPackageVersionSubmitted/);
    assert.match(repository, /CREATE TABLE IF NOT EXISTS factory_governance_submissions|factory_governance_submissions/);
    assert.match(governanceRepository, /factory_package_version_id/);
    assert.match(governanceRepository, /factorySubmission/);
    assert.match(route, /factoryGovernanceSubmissionSchema\.parse/);
    assert.doesNotMatch(repository, /historical_library_admissions|historical_library_published_snapshots|governance_publication_packages\s*\(/);
    assert.doesNotMatch(service, /certifyReadiness\(input|approveDecision|rejectDecision|admitPublicationPackage/);
  });

  it("assembles Governance packages with passed validated evidence and supplemental Factory validation", () => {
    const validatedEvidenceRef = {
      evidenceId: "validated-evidence-1",
      evidenceType: "validated_evidence" as const,
      evidenceRecordId: "123e4567-e89b-12d3-a456-426614174001",
      validationRecordId: "123e4567-e89b-12d3-a456-426614174002",
      authoritySafe: true
    };
    const draft = {
      packageDraftId: "123e4567-e89b-12d3-a456-426614174010",
      title: "Validated package",
      description: "Package with source-grounded evidence.",
      packageType: "mixed_authority_publication" as const,
      factoryObjectRefs: ["123e4567-e89b-12d3-a456-426614174011"],
      artifactRefs: ["123e4567-e89b-12d3-a456-426614174012"],
      validatedEvidenceRefs: [validatedEvidenceRef],
      riskSummary: {
        unresolvedAuthorityRisks: [],
        validationWarnings: [],
        publicationBlockers: []
      },
      lifecycle: "ready_for_governance" as const,
      lineageRootId: "123e4567-e89b-12d3-a456-426614174010",
      supersedesPackageId: null,
      createdBy: "factory-editor",
      updatedBy: "factory-editor"
    };
    const version = {
      packageVersionId: "123e4567-e89b-12d3-a456-426614174020",
      draftId: draft.packageDraftId,
      lineageRootId: draft.lineageRootId,
      version: 1,
      supersedesVersionId: null,
      packageSnapshot: {},
      snapshotHash: "sha256",
      validatedEvidenceRefs: [validatedEvidenceRef],
      lifecycle: "draft" as const,
      governancePublicationPackageId: null,
      feedbackPackageRefs: [],
      revisionPlanId: null,
      sourceFeedbackPackageId: null,
      resubmissionAuditRecordId: null,
      createdBy: "factory-editor"
    };

    const publicationPackage = buildGovernancePublicationPackage(
      version,
      draft,
      { actorId: "factory-editor", role: "factory_editor", institutionId: "timelines-governance" },
      "123e4567-e89b-12d3-a456-426614174030"
    );

    assert.equal(publicationPackage.validationArtifacts[0], validatedEvidenceRef);
    const factoryValidationRef = publicationPackage.validationArtifacts[1];
    assert.ok(factoryValidationRef);
    assert.equal(factoryValidationRef.evidenceType, "factory_validation");
    assert.equal(factoryValidationRef.authoritySafe, true);
  });

  it("defines Factory Intelligence runtime schema with workers, prompts, jobs, executions, and audit preservation", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260625_factory_intelligence_foundation.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_runtime_workers/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_runtime_prompts/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_runtime_jobs/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_runtime_executions/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_runtime_audit_records/);
      assert.match(source, /default_provider_key TEXT NOT NULL DEFAULT 'qwen14'/);
      assert.match(source, /model_name TEXT NOT NULL DEFAULT 'Qwen14'/);
      assert.match(source, /status TEXT NOT NULL DEFAULT 'queued' CHECK \(status IN \('queued', 'running', 'completed', 'failed', 'cancelled'\)\)/);
      assert.match(source, /status TEXT NOT NULL DEFAULT 'created' CHECK \(status IN \('created', 'started', 'completed', 'failed', 'cancelled'\)\)/);
      assert.match(source, /prevent_factory_runtime_workers_delete/);
      assert.match(source, /prevent_factory_runtime_prompts_delete/);
      assert.match(source, /prevent_factory_runtime_jobs_delete/);
      assert.match(source, /prevent_factory_runtime_executions_delete/);
      assert.match(source, /prevent_factory_runtime_audit_records_delete/);
    }
  });

  it("implements provider-abstracted Qwen14 runtime with source-grounded generation", () => {
    const contracts = readFileSync("src/server/factory/contracts.ts", "utf8");
    const providers = readFileSync("src/server/factory/runtime-providers.ts", "utf8");
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const outputSchemas = readFileSync("src/server/factory/output-schemas.ts", "utf8");

    assert.match(contracts, /FactoryRuntimeWorker/);
    assert.match(contracts, /FactoryRuntimePrompt/);
    assert.match(contracts, /FactoryRuntimeJob/);
    assert.match(contracts, /FactoryRuntimeExecution/);
    assert.match(contracts, /FactoryRuntimeMetrics/);
    assert.match(providers, /FactoryRuntimeProvider/);
    assert.match(providers, /providerKey: "qwen14"/);
    assert.match(providers, /OLLAMA_BASE_URL/);
    assert.match(providers, /api\/generate/);
    assert.match(providers, /no_think/);
    assert.match(providers, /Qwen14 provider returned an empty JSON object/);
    assert.match(providers, /compactSchemaInstruction/);
    assert.match(providers, /rawResponsePreview/);
    assert.match(providers, /generationEnabled: true/);
    assert.match(providers, /FACTORY_QWEN_TIMEOUT_MS/);
    assert.match(providers, /FactoryRuntimeProviderTimeoutError/);
    assert.match(providers, /provider_timeout_failed/);
    assert.match(providers, /baseUrlHost/);
    assert.match(providers, /fetchReachedResponseParsing/);
    assert.match(providers, /getFactoryRuntimeProvider/);
    assert.match(providers, /listFactoryRuntimeProviders/);
    assert.match(service, /getFactoryRuntimeProvider/);
    assert.match(service, /provider\.execute/);
    assert.match(service, /validateFactoryWorkerOutput/);
    assert.match(service, /Output validation failed/);
    assert.match(service, /withAttemptDiagnostics/);
    assert.match(service, /provider_timeout_failed/);
    assert.match(service, /AbortError/);
    assert.match(service, /aborted/);
    assert.match(service, /workerTimeoutMs/);
    assert.match(outputSchemas, /evidence/);
    assert.match(outputSchemas, /sources/);
    assert.match(outputSchemas, /publicationAllowed: z\.literal\(false\)/);
    assert.doesNotMatch(providers, /historicalRelationshipRepository|historicalAuthorityRepository|historicalLibraryService|governanceService/);
  });

  it("allows local Factory Qwen timeout override while preserving worker timeout defaults", () => {
    const previous = process.env.FACTORY_QWEN_TIMEOUT_MS;
    try {
      delete process.env.FACTORY_QWEN_TIMEOUT_MS;
      assert.equal(resolveFactoryQwenTimeoutMs(120000), 120000);
      process.env.FACTORY_QWEN_TIMEOUT_MS = "300000";
      assert.equal(resolveFactoryQwenTimeoutMs(120000), 300000);
      process.env.FACTORY_QWEN_TIMEOUT_MS = "not-a-number";
      assert.equal(resolveFactoryQwenTimeoutMs(120000), 120000);
    } finally {
      if (previous === undefined) {
        delete process.env.FACTORY_QWEN_TIMEOUT_MS;
      } else {
        process.env.FACTORY_QWEN_TIMEOUT_MS = previous;
      }
    }
  });

  it("raises MODEL_OUTPUT_TRUNCATED before parsing length-stopped Ollama output", async () => {
    const originalFetch = globalThis.fetch;
    const provider = getFactoryRuntimeProvider("qwen14");
    globalThis.fetch = (async () => new Response(JSON.stringify({
      response: "{\"summary\":\"truncated\"",
      done_reason: "length",
      prompt_eval_count: 10,
      eval_count: 2000
    }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

    try {
      await assert.rejects(
        provider.execute({
          prompt: "Return compact JSON.",
          input: {},
          configuration: { maxOutputTokens: 2000 },
          outputSchema: { workerKey: "research_worker_compact" },
          timeoutMs: 120000
        }),
        (error: unknown) => {
          assert.equal(error instanceof Error, true);
          assert.match((error as Error).message, /MODEL_OUTPUT_TRUNCATED/);
          assert.equal((error as any).code, "MODEL_OUTPUT_TRUNCATED");
          assert.equal((error as any).diagnostics.failureClass, "model_output_truncated");
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("normalizes candidate_source publisher from URL host without weakening Factory boundaries", () => {
    const validated = validateFactoryWorkerOutput({
      workerKey: "research_worker",
      allowedObjectTypes: ["candidate_source", "candidate_context_record"],
      output: {
        summary: "Source candidate.",
        confidence: 0.82,
        boundary: {
          factoryOwned: true,
          publicationAllowed: false,
          governanceSubmissionAllowed: false
        },
        sources: [{ sourceId: "source_1", title: "Patent record", url: "https://patents.google.com/patent/US174465A" }],
        evidence: [{ claim: "Patent record exists.", citations: [{ sourceId: "source_1", title: "Patent record", url: "https://patents.google.com/patent/US174465A" }] }],
        candidates: [
          {
            title: "Telephone Patent Source",
            objectType: "candidate_source",
            payload: {
              url: "https://patents.google.com/patent/US174465A",
              credibility: "medium"
            },
            sources: [{ sourceId: "source_1", title: "Patent record", url: "https://patents.google.com/patent/US174465A" }],
            evidence: [{ claim: "Patent record exists.", citations: [{ sourceId: "source_1", title: "Patent record", url: "https://patents.google.com/patent/US174465A" }] }]
          }
        ]
      }
    });

    assert.equal(validated.candidates[0]!.payload.publisher, "patents.google.com");
    assert.deepEqual((validated as typeof validated & { normalizedFields?: string[] }).normalizedFields, ["publisher"]);
    assert.equal(validated.boundary.publicationAllowed, false);
    assert.equal(validated.boundary.governanceSubmissionAllowed, false);
  });

  it("falls back to Unknown publisher for candidate_source without a URL host", () => {
    const validated = validateFactoryWorkerOutput({
      workerKey: "research_worker",
      allowedObjectTypes: ["candidate_source", "candidate_context_record"],
      output: {
        summary: "Source candidate.",
        confidence: 0.74,
        boundary: {
          factoryOwned: true,
          publicationAllowed: false,
          governanceSubmissionAllowed: false
        },
        sources: [{ sourceId: "source_1", title: "Archival note" }],
        evidence: [{ claim: "Archival note exists.", citations: [{ sourceId: "source_1", title: "Archival note" }] }],
        candidates: [
          {
            title: "Archival Source",
            objectType: "candidate_source",
            payload: {
              credibility: "low"
            },
            sources: [{ sourceId: "source_1", title: "Archival note" }],
            evidence: [{ claim: "Archival note exists.", citations: [{ sourceId: "source_1", title: "Archival note" }] }]
          }
        ]
      }
    });

    assert.equal(validated.candidates[0]!.payload.publisher, "Unknown publisher");
    assert.match(String((validated.candidates[0]!.payload.normalizationWarnings as string[])[0]), /Unknown publisher/);
  });

  it("classifies missing credibility and traceability failures as output validation failures", () => {
    assert.throws(
      () => validateFactoryWorkerOutput({
        workerKey: "research_worker",
        allowedObjectTypes: ["candidate_source", "candidate_context_record"],
        output: {
          summary: "Source candidate.",
          confidence: 0.82,
          boundary: {
            factoryOwned: true,
            publicationAllowed: false,
            governanceSubmissionAllowed: false
          },
          sources: [{ sourceId: "source_1", title: "Patent record", url: "https://patents.google.com/patent/US174465A" }],
          evidence: [{ claim: "Patent record exists.", citations: [{ sourceId: "source_1", title: "Patent record", url: "https://patents.google.com/patent/US174465A" }] }],
          candidates: [
            {
              title: "Telephone Patent Source",
              objectType: "candidate_source",
              payload: {
                url: "https://patents.google.com/patent/US174465A"
              },
              sources: [{ sourceId: "source_1", title: "Patent record", url: "https://patents.google.com/patent/US174465A" }],
              evidence: [{ claim: "Patent record exists.", citations: [{ sourceId: "source_1", title: "Patent record", url: "https://patents.google.com/patent/US174465A" }] }]
            }
          ]
        }
      }),
      (error: unknown) => {
        assert.equal((error as { diagnostics?: { failureClass?: string } }).diagnostics?.failureClass, "output_validation_failed");
        assert.deepEqual((error as { diagnostics?: { normalizedFields?: string[] } }).diagnostics?.normalizedFields, ["publisher"]);
        assert.match((error as Error).message, /missing credibility/);
        return true;
      }
    );

    assert.throws(
      () => validateFactoryWorkerOutput({
        workerKey: "research_worker",
        allowedObjectTypes: ["candidate_source", "candidate_context_record"],
        output: {
          summary: "Source candidate.",
          confidence: 0.82,
          boundary: {
            factoryOwned: true,
            publicationAllowed: false,
            governanceSubmissionAllowed: false
          },
          sources: [{ sourceId: "source_1", title: "Patent record" }],
          evidence: [{ claim: "Patent record exists.", citations: [{ sourceId: "source_2", title: "Other record" }] }],
          candidates: [
            {
              title: "Patent Source",
              objectType: "candidate_source",
              payload: {
                publisher: "Patent office",
                credibility: "medium"
              },
              sources: [{ sourceId: "source_1", title: "Patent record" }],
              evidence: [{ claim: "Patent record exists.", citations: [{ sourceId: "source_1", title: "Patent record" }] }]
            }
          ]
        }
      }),
      (error: unknown) => {
        assert.equal((error as { diagnostics?: { failureClass?: string } }).diagnostics?.failureClass, "output_validation_failed");
        assert.match((error as Error).message, /unknown sourceId/);
        return true;
      }
    );
  });

  it("keeps Factory runtime persistence repository-isolated and service-mediated", () => {
    const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const validation = readFileSync("src/server/validation/schemas.ts", "utf8");

    for (const method of [
      "registerRuntimeWorker",
      "registerRuntimePrompt",
      "queueRuntimeJob",
      "createRuntimeExecution",
      "transitionRuntimeJob",
      "transitionRuntimeExecution",
      "createRuntimeAuditRecord",
      "getRuntimeMetrics"
    ]) {
      assert.match(repository, new RegExp(method));
    }
    assert.match(repository, /INSERT INTO factory_runtime_workers/);
    assert.match(repository, /INSERT INTO factory_runtime_prompts/);
    assert.match(repository, /INSERT INTO factory_runtime_jobs/);
    assert.match(repository, /INSERT INTO factory_runtime_executions/);
    assert.match(repository, /INSERT INTO factory_runtime_audit_records/);
    assert.match(service, /runtimeJobTransitions/);
    assert.match(service, /runtimeExecutionTransitions/);
    assert.match(service, /createRuntimeAuditRecord/);
    assert.doesNotMatch(service, /INSERT INTO factory_runtime|UPDATE factory_runtime|DELETE FROM factory_runtime|getWriteSql/);

    for (const method of [
      "registerFactoryRuntimeWorker",
      "listFactoryRuntimeWorkers",
      "registerFactoryRuntimePrompt",
      "listFactoryRuntimePrompts",
      "queueFactoryRuntimeJob",
      "listFactoryRuntimeJobs",
      "transitionFactoryRuntimeJob",
      "executeFactoryRuntimeJob",
      "listFactoryRuntimeExecutions",
      "getFactoryRuntimeMetrics",
      "getFactoryRuntimeHealth"
    ]) {
      assert.match(adminService, new RegExp(`${method}: factoryService\\.`));
    }
    assert.match(validation, /factoryRuntimeWorkerSchema/);
    assert.match(validation, /factoryRuntimePromptSchema/);
    assert.match(validation, /factoryRuntimeJobSchema/);
    assert.match(validation, /factoryRuntimeJobTransitionSchema/);
    assert.match(validation, /factoryRuntimeJobExecutionSchema/);
  });

  it("exposes Factory runtime through admin-only routes without publication authority", () => {
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const routes = [
      "app/api/admin/factory/runtime/workers/route.ts",
      "app/api/admin/factory/runtime/prompts/route.ts",
      "app/api/admin/factory/runtime/jobs/route.ts",
      "app/api/admin/factory/runtime/jobs/[id]/transition/route.ts",
      "app/api/admin/factory/runtime/jobs/[id]/execute/route.ts",
      "app/api/admin/factory/runtime/executions/route.ts",
      "app/api/admin/factory/runtime/metrics/route.ts",
      "app/api/admin/factory/runtime/health/route.ts"
    ];

    for (const routePath of routes) {
      const route = readFileSync(routePath, "utf8");
      assert.match(route, /withAdminAuth/);
      assert.match(route, /adminService\./);
      assert.doesNotMatch(route, /factoryRepository|governanceRepository|historicalLibraryRepository|getWriteSql|INSERT INTO|UPDATE|DELETE FROM/);
    }

    assert.doesNotMatch(service, /admitPublicationPackage|publishPublicationPackage|certifyReadiness\(input|approveDecision|rejectDecision/);
    assert.doesNotMatch(service, /historicalLibraryService/);
  });

  it("defines Source Authority Foundation schema with registry, snapshots, versioning, and preservation", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260622_source_authority_foundation.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS source_authority_records/);
      assert.match(source, /provider TEXT NOT NULL CHECK \(provider IN \('wikidata', 'dbpedia', 'library_of_congress', 'nara'\)\)/);
      assert.match(source, /provider_record_id TEXT NOT NULL/);
      assert.match(source, /origin JSONB NOT NULL/);
      assert.match(source, /provenance JSONB NOT NULL DEFAULT '\{\}'::jsonb/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS source_authority_snapshots/);
      assert.match(source, /source_record_id UUID NOT NULL REFERENCES source_authority_records/);
      assert.match(source, /version INTEGER NOT NULL CHECK \(version > 0\)/);
      assert.match(source, /content_hash TEXT NOT NULL/);
      assert.match(source, /retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
      assert.match(source, /UNIQUE \(source_record_id, version\)/);
      assert.match(source, /prevent_source_authority_snapshot_update/);
      assert.match(source, /Source Authority snapshots are immutable/);
    }
  });

  it("implements Source Authority discovery and retrieval without downstream validation or publication changes", () => {
    const contracts = readFileSync("src/server/source-authority/contracts.ts", "utf8");
    const discovery = readFileSync("src/server/services/source-discovery-service.ts", "utf8");
    const retrieval = readFileSync("src/server/services/source-retrieval-service.ts", "utf8");
    const repository = readFileSync("src/server/repositories/source-authority-repository.ts", "utf8");
    const resilience = readFileSync("src/server/source-authority/resilience.ts", "utf8");
    const factory = readFileSync("src/server/services/factory-service.ts", "utf8");
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");

    for (const provider of ["wikidata", "dbpedia", "library_of_congress", "nara"]) {
      assert.match(contracts, new RegExp(`"${provider}"`));
      assert.match(discovery, new RegExp(provider));
    }

    assert.match(discovery, /approvedProviders/);
    assert.match(discovery, /providerInCooldown/);
    assert.match(discovery, /resilientFetch/);
    assert.match(discovery, /registerDiscoveredSource/);
    assert.match(repository, /INSERT INTO source_authority_records/);
    assert.match(repository, /ON CONFLICT \(provider, provider_record_id\)/);
    assert.match(repository, /canonical_url = EXCLUDED\.canonical_url/);
    assert.match(repository, /INSERT INTO source_authority_snapshots/);
    assert.match(repository, /ORDER BY version DESC/);
    assert.match(repository, /getLatestSnapshot/);
    assert.match(repository, /createHash\("sha256"\)/);
    assert.match(retrieval, /sourceAuthorityRepository\.requireSourceRecord/);
    assert.match(retrieval, /sourceAuthorityRepository\.getLatestSnapshot/);
    assert.match(retrieval, /staleSourceReuse/);
    assert.match(retrieval, /reusedSnapshotId/);
    assert.match(retrieval, /contentLength/);
    assert.match(retrieval, /retrievedAt/);
    assert.match(retrieval, /createSnapshot/);
    assert.match(resilience, /retry-after/i);
    assert.match(resilience, /AbortController/);
    assert.match(resilience, /consecutiveFailures/);
    assert.match(resilience, /cooldownUntil/);
    assert.match(factory, /discoverExternalSources: sourceDiscoveryService\.discover/);
    assert.match(factory, /retrieveExternalSource: sourceRetrievalService\.retrieve/);
    assert.match(adminService, /discoverFactoryExternalSources: factoryService\.discoverExternalSources/);
    assert.match(adminService, /retrieveFactoryExternalSource: factoryService\.retrieveExternalSource/);

    for (const source of [discovery, retrieval, repository, resilience]) {
      assert.doesNotMatch(source, /historicalLibraryService|publishedMemoryProjectionService|governanceService/);
      assert.doesNotMatch(source, /admitPublicationPackage|publishPublicationPackage|certifyReadiness|validateFactoryWorkerOutput/);
      assert.doesNotMatch(source, /historical_library_|published_memory_|governance_/);
    }
  });

  it("defines Research Corpus and Evidence schema with source snapshot lineage and preservation", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260623_research_corpus_evidence_foundation.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS corpus_documents/);
      assert.match(source, /source_snapshot_id UUID NOT NULL UNIQUE REFERENCES source_authority_snapshots/);
      assert.match(source, /source_record_id UUID NOT NULL REFERENCES source_authority_records/);
      assert.match(source, /source_lineage JSONB NOT NULL/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS evidence_records/);
      assert.match(source, /corpus_document_id UUID NOT NULL REFERENCES corpus_documents/);
      assert.match(source, /source_snapshot_id UUID NOT NULL REFERENCES source_authority_snapshots/);
      assert.match(source, /source_record_id UUID NOT NULL REFERENCES source_authority_records/);
      assert.match(source, /retrieval_timestamp TIMESTAMPTZ NOT NULL/);
      assert.match(source, /span_start INTEGER NOT NULL CHECK \(span_start >= 0\)/);
      assert.match(source, /span_end INTEGER NOT NULL CHECK \(span_end > span_start\)/);
      assert.match(source, /provenance JSONB NOT NULL/);
      assert.match(source, /idx_corpus_documents_lineage/);
      assert.match(source, /idx_evidence_records_provenance/);
      assert.match(source, /prevent_research_corpus_delete/);
      assert.match(source, /prevent_research_corpus_update/);
    }
  });

  it("implements corpus generation and evidence extraction without verification or institutional coupling", () => {
    const corpusContracts = readFileSync("src/server/research-corpus/contracts.ts", "utf8");
    const corpusRepository = readFileSync("src/server/repositories/corpus-repository.ts", "utf8");
    const evidenceRepository = readFileSync("src/server/repositories/evidence-repository.ts", "utf8");
    const corpusService = readFileSync("src/server/services/corpus-generation-service.ts", "utf8");
    const evidenceService = readFileSync("src/server/services/evidence-extraction-service.ts", "utf8");
    const factory = readFileSync("src/server/services/factory-service.ts", "utf8");
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");

    for (const symbol of [
      "CorpusDocument",
      "EvidenceRecord",
      "CorpusSourceLineage",
      "EvidenceProvenance",
      "FactoryEvidenceReference"
    ]) {
      assert.match(corpusContracts, new RegExp(`type ${symbol}`));
    }

    assert.match(corpusRepository, /INNER JOIN source_authority_records/);
    assert.match(corpusRepository, /FROM source_authority_snapshots/);
    assert.match(corpusRepository, /INSERT INTO corpus_documents/);
    assert.match(corpusRepository, /ON CONFLICT \(source_snapshot_id\) DO NOTHING/);
    assert.match(corpusRepository, /retrievalProvenance: input\.snapshot\.provenance/);
    assert.match(corpusService, /normalizeSnapshotText/);
    assert.match(corpusService, /generateFromSourceSnapshot/);
    assert.match(evidenceRepository, /INSERT INTO evidence_records/);
    assert.match(evidenceRepository, /ON CONFLICT \(corpus_document_id, span_start, span_end, quote_text\) DO NOTHING/);
    assert.match(evidenceRepository, /retrievalProvenance/);
    assert.match(evidenceService, /extractSentenceSpans/);
    assert.match(evidenceService, /toFactoryEvidenceReferences/);
    assert.match(evidenceService, /retrievalProvenance: corpusDocument\.sourceLineage\.retrievalProvenance/);
    assert.match(factory, /generateCorpusDocument: corpusGenerationService\.generateFromSourceSnapshot/);
    assert.match(factory, /extractEvidenceRecords: evidenceExtractionService\.extractFromCorpusDocument/);
    assert.match(factory, /toFactoryEvidenceReferences: evidenceExtractionService\.toFactoryEvidenceReferences/);
    assert.match(adminService, /generateFactoryCorpusDocument: factoryService\.generateCorpusDocument/);
    assert.match(adminService, /extractFactoryEvidenceRecords: factoryService\.extractEvidenceRecords/);

    for (const source of [corpusRepository, evidenceRepository, corpusService, evidenceService]) {
      assert.doesNotMatch(source, /governanceService|historicalLibraryService|publishedMemoryProjectionService/);
      assert.doesNotMatch(source, /governance_|historical_library_|published_memory_|publishedMemory/);
      assert.doesNotMatch(source, /certifyReadiness|admitPublicationPackage|publishPublicationPackage|validateCitation|citationVerification|credibilityScore/);
    }
  });

  it("defines Evidence Validation schema with immutable validation provenance", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260623_z_evidence_validation_foundation.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS evidence_validation_records/);
      assert.match(source, /evidence_record_id UUID NOT NULL REFERENCES evidence_records/);
      assert.match(source, /status TEXT NOT NULL CHECK \(status IN \('passed', 'failed'\)\)/);
      assert.match(source, /checks JSONB NOT NULL/);
      assert.match(source, /provenance JSONB NOT NULL/);
      assert.match(source, /idx_evidence_validation_records_evidence/);
      assert.match(source, /idx_evidence_validation_records_status/);
      assert.match(source, /idx_evidence_validation_records_provenance/);
      assert.match(source, /prevent_evidence_validation_records_update/);
      assert.match(source, /prevent_evidence_validation_records_delete/);
      assert.match(source, /Evidence validation records are immutable validation history/);
    }
  });

  it("implements structural evidence validation without authority, readiness, or publication decisions", () => {
    const contracts = readFileSync("src/server/evidence-validation/contracts.ts", "utf8");
    const repository = readFileSync("src/server/repositories/evidence-validation-repository.ts", "utf8");
    const service = readFileSync("src/server/services/evidence-validation-service.ts", "utf8");
    const factory = readFileSync("src/server/services/factory-service.ts", "utf8");
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");

    for (const check of [
      "corpus_document_reference",
      "source_snapshot_reference",
      "source_record_reference",
      "provenance_complete",
      "lineage_complete",
      "span_boundaries_valid",
      "content_non_empty"
    ]) {
      assert.match(contracts, new RegExp(check));
      assert.match(service, new RegExp(check));
    }

    assert.match(repository, /FROM evidence_records/);
    assert.match(repository, /LEFT JOIN corpus_documents/);
    assert.match(repository, /LEFT JOIN source_authority_snapshots/);
    assert.match(repository, /LEFT JOIN source_authority_records/);
    assert.match(repository, /INSERT INTO evidence_validation_records/);
    assert.match(service, /structural_evidence_validation/);
    assert.match(service, /authorityDecision: false/);
    assert.match(service, /publicationReadinessDecision: false/);
    assert.match(factory, /validateEvidenceRecord: evidenceValidationService\.validateEvidence/);
    assert.match(adminService, /validateFactoryEvidenceRecord: factoryService\.validateEvidenceRecord/);

    for (const source of [contracts, repository, service]) {
      assert.doesNotMatch(source, /governanceService|historicalLibraryService|publishedMemoryProjectionService/);
      assert.doesNotMatch(source, /governance_|historical_library_|published_memory_|publishedMemory/);
      assert.doesNotMatch(source, /createDecision|certifyReadiness|admitPublicationPackage|publishPublicationPackage|credibilityScore|historicalTruth|publication_ready/);
    }
  });

  it("defines canonical versioned Factory worker registry contracts and policies", () => {
    const registry = readFileSync("src/server/factory/worker-registry.ts", "utf8");
    const contracts = readFileSync("src/server/factory/contracts.ts", "utf8");

    for (const workerId of [
      "research_worker",
      "source_discovery_worker",
      "source_validation_worker",
      "object_extraction_worker",
      "milestone_extraction_worker",
      "participation_extraction_worker",
      "relationship_extraction_worker",
      "context_enrichment_worker",
      "package_assembly_worker",
      "validation_worker"
    ]) {
      assert.match(registry, new RegExp(`worker_id: "${workerId}"`));
    }

    for (const field of [
      "worker_id",
      "worker_name",
      "worker_version",
      "worker_category",
      "allowed_inputs",
      "allowed_outputs",
      "output_schema",
      "allowed_object_types",
      "allowed_relationship_types",
      "provider_policy",
      "max_context_tokens",
      "max_output_tokens",
      "retry_policy",
      "execution_timeout",
      "audit_requirements",
      "forbidden_operations"
    ]) {
      assert.match(contracts, new RegExp(field));
    }

    assert.match(registry, /providerId: "qwen14_local"/);
    assert.match(registry, /providerType: "local_llm"/);
    assert.match(registry, /providerAgnostic: true/);
    assert.match(registry, /factoryWorkerForbiddenOperations/);
    assert.match(registry, /create_governance_decisions/);
    assert.match(registry, /certify_readiness/);
    assert.match(registry, /admit_published_memory/);
    assert.match(registry, /modify_historical_library/);
    assert.match(registry, /modify_projections/);
    assert.match(registry, /publish_content/);
    assert.match(registry, /mutate_public_platform_read_models/);
  });

  it("persists worker capabilities, policies, versions, and permissions without deleting history", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260626_factory_worker_registry.sql", "utf8");
    const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_worker_capabilities/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_worker_policies/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_worker_versions/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_worker_permissions/);
      assert.match(source, /UNIQUE \(worker_key, worker_version\)/);
      assert.match(source, /prevent_factory_worker_capabilities_delete/);
      assert.match(source, /prevent_factory_worker_policies_delete/);
      assert.match(source, /prevent_factory_worker_versions_delete/);
      assert.match(source, /prevent_factory_worker_permissions_delete/);
    }

    assert.match(repository, /upsertWorkerRegistryContract/);
    assert.match(repository, /INSERT INTO factory_worker_capabilities/);
    assert.match(repository, /INSERT INTO factory_worker_policies/);
    assert.match(repository, /INSERT INTO factory_worker_versions/);
    assert.match(repository, /INSERT INTO factory_worker_permissions/);
    assert.match(repository, /listWorkerRegistry/);
  });

  it("service-mediates worker registry sync and blocks forbidden worker operations", () => {
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const validation = readFileSync("src/server/validation/schemas.ts", "utf8");
    const route = readFileSync("app/api/admin/factory/runtime/worker-registry/route.ts", "utf8");

    assert.match(service, /syncCanonicalWorkerRegistry/);
    assert.match(service, /canonicalFactoryWorkers/);
    assert.match(service, /allowedOperationsForWorker/);
    assert.match(service, /assertWorkerExecutionPolicy/);
    assert.match(service, /FACTORY_WORKER_CONTRACT_REQUIRED/);
    assert.match(service, /FACTORY_WORKER_OPERATION_FORBIDDEN/);
    assert.match(service, /forbidden_operations/);
    assert.doesNotMatch(service, /INSERT INTO factory_worker|UPDATE factory_worker|DELETE FROM factory_worker/);

    assert.match(adminService, /syncFactoryWorkerRegistry: factoryService\.syncCanonicalWorkerRegistry/);
    assert.match(adminService, /listFactoryWorkerRegistry: factoryService\.listWorkerRegistry/);
    assert.match(validation, /factoryWorkerRegistrySyncSchema/);
    assert.match(route, /withAdminAuth/);
    assert.match(route, /adminService\.syncFactoryWorkerRegistry/);
    assert.match(route, /adminService\.listFactoryWorkerRegistry/);
    assert.doesNotMatch(route, /factoryRepository|governanceRepository|historicalLibraryRepository|getWriteSql/);
  });

  it("defines controlled Factory production pipelines with ordered worker chains", () => {
    const registry = readFileSync("src/server/factory/pipeline-registry.ts", "utf8");
    const contracts = readFileSync("src/server/factory/contracts.ts", "utf8");

    assert.match(registry, /historical_research_pipeline/);
    assert.match(registry, /research_worker/);
    assert.match(registry, /source_authority_discovery/);
    assert.match(registry, /source_authority_retrieval/);
    assert.match(registry, /research_corpus_generation/);
    assert.match(registry, /evidence_extraction/);
    assert.match(registry, /evidence_validation/);
    assert.match(registry, /historical_extraction_pipeline/);
    assert.match(registry, /object_extraction_worker/);
    assert.match(registry, /milestone_extraction_worker/);
    assert.match(registry, /participation_extraction_worker/);
    assert.match(registry, /relationship_extraction_worker/);
    assert.match(registry, /context_enrichment_worker/);
    assert.match(registry, /publication_candidate_pipeline/);
    assert.match(registry, /validation_worker/);
    assert.match(registry, /package_assembly_worker/);
    assert.match(contracts, /FactoryPipelineDefinition/);
    assert.match(contracts, /FactoryPipelineRun/);
    assert.match(contracts, /FactoryPipelineStep/);
  });

  it("persists pipeline runs and steps with lineage, metrics, and no-delete preservation", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260627_factory_production_pipelines.sql", "utf8");
    const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_pipeline_runs/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_pipeline_steps/);
      assert.match(source, /artifact_refs JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
      assert.match(source, /factory_object_refs JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
      assert.match(source, /package_draft_id UUID REFERENCES factory_package_drafts/);
      assert.match(source, /prevent_factory_pipeline_runs_delete/);
      assert.match(source, /prevent_factory_pipeline_steps_delete/);
    }

    assert.match(repository, /createPipelineRun/);
    assert.match(repository, /createPipelineStep/);
    assert.match(repository, /transitionPipelineRun/);
    assert.match(repository, /transitionPipelineStep/);
    assert.match(repository, /pipelineRunCount/);
  });

  it("orchestrates pipeline candidate generation inside Factory only", () => {
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const validation = readFileSync("src/server/validation/schemas.ts", "utf8");
    const routes = [
      "app/api/admin/factory/runtime/pipelines/route.ts",
      "app/api/admin/factory/runtime/pipelines/runs/route.ts",
      "app/api/admin/factory/runtime/pipelines/runs/[id]/cancel/route.ts"
    ];

    assert.match(service, /startPipeline/);
    assert.match(service, /getCanonicalFactoryPipeline/);
    assert.match(service, /createPipelineRun/);
    assert.match(service, /createPipelineStep/);
    assert.match(service, /factoryRepository\.createObject/);
    assert.match(service, /factoryRepository\.createArtifact/);
    assert.match(service, /factoryRepository\.createPackageDraft/);
    assert.match(service, /cancelPipeline/);
    assert.match(service, /publicationAllowed: false/);
    assert.match(service, /governanceSubmissionAllowed: false/);
    assert.doesNotMatch(service, /certifyReadiness\(input|approveDecision|rejectDecision|admitPublicationPackage|publishPublicationPackage/);
    assert.doesNotMatch(service, /historicalLibraryService|publishedMemoryProjectionService/);
    assert.doesNotMatch(service, /INSERT INTO factory_pipeline|UPDATE factory_pipeline|DELETE FROM factory_pipeline/);

    assert.match(adminService, /listFactoryPipelineDefinitions: factoryService\.listPipelineDefinitions/);
    assert.match(adminService, /startFactoryPipeline: factoryService\.startPipeline/);
    assert.match(adminService, /listFactoryPipelineRuns: factoryService\.listPipelineRuns/);
    assert.match(adminService, /cancelFactoryPipeline: factoryService\.cancelPipeline/);
    assert.match(validation, /factoryPipelineStartSchema/);
    assert.match(validation, /factoryPipelineCancellationSchema/);

    for (const routePath of routes) {
      const route = readFileSync(routePath, "utf8");
      assert.match(route, /withAdminAuth/);
      assert.match(route, /adminService\./);
      assert.doesNotMatch(route, /factoryRepository|governanceRepository|historicalLibraryRepository|getWriteSql/);
    }
  });

  async function withMockedFactoryPipeline<T>(
    outputOverride: Record<string, unknown>,
    run: (state: {
      artifacts: any[];
      objects: any[];
      packageDrafts: any[];
      verifierCalls: any[];
      pipelineStatuses: string[];
      stepStatuses: string[];
      providerPrompts: string[];
      auditRecords: any[];
    }) => Promise<T>,
    options: {
      failRetrieval?: boolean;
      failStepFailureTransition?: boolean;
      failRunFailureTransition?: boolean;
      failFailureAudit?: boolean;
    } = {}
  ): Promise<T> {
    const originals = {
      discover: sourceDiscoveryService.discover,
      retrieve: sourceRetrievalService.retrieve,
      corpus: corpusGenerationService.generateFromSourceSnapshot,
      extract: evidenceExtractionService.extractFromCorpusDocument,
      validate: evidenceValidationService.validateEvidence,
      createPipelineRun: factoryRepository.createPipelineRun,
      transitionPipelineRun: factoryRepository.transitionPipelineRun,
      createPipelineStep: factoryRepository.createPipelineStep,
      transitionPipelineStep: factoryRepository.transitionPipelineStep,
      createRuntimeAuditRecord: factoryRepository.createRuntimeAuditRecord,
      createArtifact: factoryRepository.createArtifact,
      createObject: factoryRepository.createObject,
      createPackageDraft: factoryRepository.createPackageDraft,
      fetch: globalThis.fetch
    };
    const state = {
      artifacts: [] as any[],
      objects: [] as any[],
      packageDrafts: [] as any[],
      verifierCalls: [] as any[],
      pipelineStatuses: [] as string[],
      stepStatuses: [] as string[],
      providerPrompts: [] as string[],
      auditRecords: [] as any[]
    };
    let stepId = 0;
    let artifactId = 0;
    let objectId = 0;
    try {
      (sourceDiscoveryService as any).discover = async () => ({
        query: "Telephone",
        providers: ["wikidata"],
        discovered: [],
        records: [{
          sourceRecordId: "source-record-1",
          provider: "wikidata",
          providerRecordId: "Q11035",
          canonicalUrl: "https://www.wikidata.org/wiki/Special:EntityData/Q11035.json",
          title: "Authoritative Telephone Evidence",
          description: "Telephone source.",
          sourceType: "entity",
          origin: { provider: "wikidata", providerRecordId: "Q11035", providerUrl: "https://www.wikidata.org/wiki/Q11035", discoveredFromQuery: "Telephone", discoveredAt: "2026-06-24T00:00:00.000Z" },
          provenance: {},
          createdBy: "factory-test"
        }]
      });
      (sourceRetrievalService as any).retrieve = async () => {
        if (options.failRetrieval) {
          throw new Error("Source provider URL must use HTTPS.");
        }
        return ({
        sourceRecord: {
          sourceRecordId: "source-record-1",
          provider: "wikidata",
          providerRecordId: "Q11035",
          canonicalUrl: "https://www.wikidata.org/wiki/Special:EntityData/Q11035.json",
          title: "Authoritative Telephone Evidence",
          description: "Telephone source.",
          sourceType: "entity",
          origin: { provider: "wikidata", providerRecordId: "Q11035", providerUrl: "https://www.wikidata.org/wiki/Q11035", discoveredFromQuery: "Telephone", discoveredAt: "2026-06-24T00:00:00.000Z" },
          provenance: {},
          createdBy: "factory-test"
        },
        snapshot: {
          snapshotId: "snapshot-1",
          sourceRecordId: "source-record-1",
          version: 1,
          retrievalUrl: "https://www.wikidata.org/wiki/Special:EntityData/Q11035.json",
          contentType: "application/json",
          contentHash: "hash",
          contentText: "The telephone is a telecommunications device supported by source authority evidence.",
          rawMetadata: {},
          provenance: { provider: "wikidata", sourceRecordId: "source-record-1", retrievalUrl: "https://www.wikidata.org/wiki/Special:EntityData/Q11035.json", retrievedAt: "2026-06-24T00:00:00.000Z", httpStatus: 200, contentType: "application/json", contentLength: 85 },
          retrievedBy: "factory-test"
        }
      });
      };
      (corpusGenerationService as any).generateFromSourceSnapshot = async () => ({
        corpusDocumentId: "corpus-1",
        sourceSnapshotId: "snapshot-1",
        sourceRecordId: "source-record-1",
        provider: "wikidata",
        title: "Authoritative Telephone Evidence",
        contentType: "application/json",
        normalizedText: "The telephone is a telecommunications device supported by source authority evidence.",
        contentHash: "hash",
        sourceLineage: { sourceSnapshotId: "snapshot-1", sourceRecordId: "source-record-1", provider: "wikidata", retrievalTimestamp: "2026-06-24T00:00:00.000Z", snapshotVersion: 1, retrievalUrl: "https://www.wikidata.org/wiki/Special:EntityData/Q11035.json", retrievalProvenance: { provider: "wikidata", sourceRecordId: "source-record-1", retrievalUrl: "https://www.wikidata.org/wiki/Special:EntityData/Q11035.json", retrievedAt: "2026-06-24T00:00:00.000Z", httpStatus: 200, contentType: "application/json", contentLength: 85 } },
        createdBy: "factory-test"
      });
      (evidenceExtractionService as any).extractFromCorpusDocument = async () => [{
        evidenceRecordId: "evidence-1",
        corpusDocumentId: "corpus-1",
        sourceSnapshotId: "snapshot-1",
        sourceRecordId: "source-record-1",
        provider: "wikidata",
        retrievalTimestamp: "2026-06-24T00:00:00.000Z",
        spanStart: 0,
        spanEnd: 80,
        quoteText: "The telephone is a telecommunications device supported by source authority evidence.",
        normalizedClaim: "The telephone is a telecommunications device supported by source authority evidence.",
        provenance: {},
        createdBy: "factory-test"
      }];
      (evidenceValidationService as any).validateEvidence = async () => ({
        validationRecordId: "validation-1",
        evidenceRecordId: "evidence-1",
        status: "passed",
        checks: [],
        provenance: { validationType: "structural_evidence_validation", evidenceRecordId: "evidence-1", corpusDocumentId: "corpus-1", sourceSnapshotId: "snapshot-1", sourceRecordId: "source-record-1", provider: "wikidata", validatedAt: "2026-06-24T00:00:00.000Z", validator: "factory-test", authorityDecision: false, publicationReadinessDecision: false },
        createdBy: "factory-test"
      });
      (factoryRepository as any).createPipelineRun = async (input: any) => ({ pipelineRunId: "run-1", pipelineId: input.pipelineId, status: "queued", input: input.input, artifactRefs: [], factoryObjectRefs: [], packageDraftId: null, startedAt: null, completedAt: null, createdBy: input.actor, updatedBy: input.actor });
      (factoryRepository as any).transitionPipelineRun = async (input: any) => {
        state.pipelineStatuses.push(input.status);
        if (options.failRunFailureTransition && input.status === "failed") {
          throw new Error("run cleanup failed");
        }
        return { pipelineRunId: input.pipelineRunId, pipelineId: "pipeline", status: input.status, input: {}, artifactRefs: input.artifactRefs || [], factoryObjectRefs: input.factoryObjectRefs || [], packageDraftId: input.packageDraftId || null, startedAt: null, completedAt: null, createdBy: input.actor, updatedBy: input.actor };
      };
      (factoryRepository as any).createPipelineStep = async (input: any) => ({ pipelineStepId: `step-${++stepId}`, pipelineRunId: input.pipelineRunId, stepIndex: input.stepIndex, workerKey: input.workerKey, status: "pending", input: input.input, output: null, artifactRefs: [], factoryObjectRefs: [], startedAt: null, completedAt: null });
      (factoryRepository as any).transitionPipelineStep = async (input: any) => {
        state.stepStatuses.push(input.status);
        if (options.failStepFailureTransition && input.status === "failed") {
          throw new Error("step cleanup failed");
        }
        return { pipelineStepId: input.pipelineStepId, pipelineRunId: "run-1", stepIndex: 0, workerKey: "worker", status: input.status, input: {}, output: input.output || null, artifactRefs: input.artifactRefs || [], factoryObjectRefs: input.factoryObjectRefs || [], startedAt: null, completedAt: null };
      };
      (factoryRepository as any).createRuntimeAuditRecord = async (input: any) => {
        state.auditRecords.push(input);
        if (options.failFailureAudit && input.action === "fail_pipeline_step") {
          throw new Error("audit cleanup failed");
        }
        return "audit-1";
      };
      (factoryRepository as any).createArtifact = async (input: any) => {
        const artifact = { artifactId: `artifact-${++artifactId}`, factoryObjectId: null, artifactType: input.artifactType, title: input.title, payload: input.payload, authoritySafe: input.authoritySafe, modelProvider: input.modelProvider || null, modelName: input.modelName || null, createdBy: input.actor };
        state.artifacts.push(artifact);
        return artifact;
      };
      (factoryRepository as any).createObject = async (input: any) => {
        const object = { objectId: `object-${++objectId}`, objectType: input.objectType, title: input.title, payload: input.payload, provenance: input.provenance, lifecycle: "draft", createdBy: input.actor, updatedBy: input.actor };
        state.objects.push(object);
        return object;
      };
      (factoryRepository as any).createPackageDraft = async (input: any) => {
        const draft = { packageDraftId: "draft-1", lifecycle: "draft", lineageRootId: "draft-1", createdBy: input.actor, updatedBy: input.actor, ...input };
        state.packageDrafts.push(draft);
        return draft;
      };
      globalThis.fetch = async (_url: any, init?: any) => {
        const body = JSON.parse(init.body);
        const prompt = body.prompt as string;
        state.providerPrompts.push(prompt);
        return new Response(JSON.stringify({ response: JSON.stringify(factoryOutputForPrompt(prompt, outputOverride)) }), { status: 200, headers: { "content-type": "application/json" } });
      };
      setFactoryPipelineEvidenceVerifierForTests(async (refs, context) => {
        state.verifierCalls.push({ refs, context });
      });
      return await run(state);
    } finally {
      (sourceDiscoveryService as any).discover = originals.discover;
      (sourceRetrievalService as any).retrieve = originals.retrieve;
      (corpusGenerationService as any).generateFromSourceSnapshot = originals.corpus;
      (evidenceExtractionService as any).extractFromCorpusDocument = originals.extract;
      (evidenceValidationService as any).validateEvidence = originals.validate;
      (factoryRepository as any).createPipelineRun = originals.createPipelineRun;
      (factoryRepository as any).transitionPipelineRun = originals.transitionPipelineRun;
      (factoryRepository as any).createPipelineStep = originals.createPipelineStep;
      (factoryRepository as any).transitionPipelineStep = originals.transitionPipelineStep;
      (factoryRepository as any).createRuntimeAuditRecord = originals.createRuntimeAuditRecord;
      (factoryRepository as any).createArtifact = originals.createArtifact;
      (factoryRepository as any).createObject = originals.createObject;
      (factoryRepository as any).createPackageDraft = originals.createPackageDraft;
      globalThis.fetch = originals.fetch;
      setFactoryPipelineEvidenceVerifierForTests(null);
    }
  }

  it("executes historical research through Source Authority, snapshots, corpus, evidence, and validation", async () => {
    await withMockedFactoryPipeline({}, async (state) => {
      await factoryService.startPipeline({
        pipelineId: "historical_research_pipeline",
        input: { subject: "Telephone" },
        actor: "factory-test",
        reason: "Test authority-grounded research."
      });

      assert.ok(state.artifacts.some((artifact) => artifact.payload.generated?.sourceAuthorityRecords?.length === 1));
      assert.ok(state.artifacts.some((artifact) => artifact.payload.generated?.sourceAuthoritySnapshots?.length === 1));
      assert.ok(state.artifacts.some((artifact) => artifact.payload.generated?.corpusDocuments?.length === 1));
      assert.ok(state.artifacts.some((artifact) => artifact.payload.generated?.evidenceRecords?.length === 1));
      assert.ok(state.artifacts.some((artifact) => artifact.payload.generated?.evidenceValidationRecords?.length === 1));
      assert.ok(state.artifacts.some((artifact) => artifact.payload.validatedEvidenceRefs?.[0]?.validationRecordId === "validation-1"));
      const researchPrompt = state.providerPrompts.find((prompt) => prompt.includes("validatedEvidenceContext"));
      assert.ok(researchPrompt);
      assert.match(researchPrompt, /"sourceAuthorityRecordId":"source-record-1"/);
      assert.match(researchPrompt, /"evidenceRecordId":"evidence-1"/);
      assert.doesNotMatch(researchPrompt, /"sourceRecordId":"source-record-1"/);
      assert.match(researchPrompt, /claims, candidates/);
      assert.match(researchPrompt, /Do not emit sources, citations, URLs, quotes, publishers/);
      const researchArtifact = state.artifacts.find((artifact) => artifact.title === "Research Worker output");
      assert.equal(researchArtifact.payload.generated.sources[0].sourceId, "source-record-1");
      assert.equal(researchArtifact.payload.generated.sources[0].evidenceRecordId, "evidence-1");
      assert.equal(researchArtifact.payload.generated.sources[0].title, "Authoritative Telephone Evidence");
      assert.equal(researchArtifact.payload.generated.candidates[0].payload.publisher, "Wikidata");
      assert.equal(state.objects[0].payload.sources[0].sourceId, "source-record-1");
    });
  });

  it("rejects authority-grounded research output with unknown evidence references or emitted source metadata", async () => {
    await assert.rejects(
      withMockedFactoryPipeline({
        claims: [{ claim: "Fabricated evidence claim.", evidenceRecordIds: ["fabricated-evidence"] }],
        candidates: [{
          title: "Fabricated Evidence Candidate",
          objectType: "candidate_context_record",
          payload: { topic: "Telephone" },
          evidenceRecordIds: ["fabricated-evidence"]
        }]
      }, async () => factoryService.startPipeline({
        pipelineId: "historical_research_pipeline",
        input: { subject: "Telephone" },
        actor: "factory-test",
        reason: "Reject fabricated citation."
      })),
      /unknown evidenceRecordId|outside the validated authority context/
    );

    await assert.rejects(
      withMockedFactoryPipeline({
        claims: [{ claim: "Metadata should not be emitted.", evidenceRecordIds: ["evidence-1"] }],
        candidates: [{
          title: "Fabricated source",
          objectType: "candidate_source",
          payload: { url: "https://example.org/fake", publisher: "Fabricated" },
          evidenceRecordIds: ["evidence-1"]
        }]
      }, async () => factoryService.startPipeline({
        pipelineId: "historical_research_pipeline",
        input: { subject: "Telephone" },
        actor: "factory-test",
        reason: "Reject fabricated URL."
      })),
      /may not include/
    );
  });

  it("rejects authority-grounded research output with missing compact evidence lineage", async () => {
    await assert.rejects(
      withMockedFactoryPipeline({
        claims: [{ claim: "Evidence lineage is missing.", evidenceRecordIds: [] }],
        candidates: [{
          title: "Telephone Source",
          objectType: "candidate_source",
          payload: { relevance: "Missing evidence." },
          evidenceRecordIds: ["evidence-1"]
        }]
      }, async () => factoryService.startPipeline({
        pipelineId: "historical_research_pipeline",
        input: { subject: "Telephone" },
        actor: "factory-test",
        reason: "Reject missing evidence lineage."
      })),
      /schema validation/
    );
  });

  it("marks authority orchestration failures as failed pipeline and step states", async () => {
    await withMockedFactoryPipeline({}, async (state) => {
      await assert.rejects(
        factoryService.startPipeline({
          pipelineId: "historical_research_pipeline",
          input: { subject: "Telephone" },
          actor: "factory-test",
          reason: "Fail authority retrieval."
        }),
        /Source provider URL must use HTTPS/
      );
      assert.deepEqual(state.pipelineStatuses, ["running", "failed"]);
      assert.deepEqual(state.stepStatuses, ["running", "failed"]);
      const failureAudit = state.auditRecords.find((record) => record.action === "fail_pipeline_step");
      assert.equal(failureAudit.afterState.failure.originalMessage, "Source provider URL must use HTTPS.");
      assert.match(failureAudit.afterState.failure.originalStack, /Source provider URL must use HTTPS/);
      assert.equal(failureAudit.afterState.failure.stage, "authority_orchestration");
    }, { failRetrieval: true });
  });

  it("preserves original pipeline failure when cleanup persistence fails", async () => {
    await withMockedFactoryPipeline({}, async (state) => {
      await assert.rejects(
        factoryService.startPipeline({
          pipelineId: "historical_research_pipeline",
          input: { subject: "Telephone" },
          actor: "factory-test",
          reason: "Fail authority retrieval with cleanup failures."
        }),
        (error: unknown) => {
          assert.equal(error instanceof ApiError, true);
          const apiError = error as ApiError;
          assert.equal(apiError.code, "FACTORY_PIPELINE_FAILED");
          assert.match(apiError.message, /Source provider URL must use HTTPS/);
          const failure = (apiError.details as any).failure;
          assert.equal(failure.originalMessage, "Source provider URL must use HTTPS.");
          assert.match(failure.originalStack, /Source provider URL must use HTTPS/);
          assert.deepEqual(
            failure.cleanupDiagnostics.map((diagnostic: any) => diagnostic.operation),
            ["transitionPipelineStep", "transitionPipelineRun", "createRuntimeAuditRecord"]
          );
          return true;
        }
      );
      assert.deepEqual(state.stepStatuses, ["running", "failed"]);
      assert.deepEqual(state.pipelineStatuses, ["running", "failed"]);
      assert.equal(state.auditRecords.some((record) => record.action === "fail_pipeline_step"), true);
    }, {
      failRetrieval: true,
      failStepFailureTransition: true,
      failRunFailureTransition: true,
      failFailureAudit: true
    });
  });

  it("preserves worker retry history in structured pipeline failures", async () => {
    await withMockedFactoryPipeline({
      claims: [{ claim: "Fabricated evidence claim.", evidenceRecordIds: ["fabricated-evidence"] }],
      candidates: [{
        title: "Fabricated Evidence Candidate",
        objectType: "candidate_context_record",
        payload: { topic: "Telephone" },
        evidenceRecordIds: ["fabricated-evidence"]
      }]
    }, async () => {
      await assert.rejects(
        factoryService.startPipeline({
          pipelineId: "historical_research_pipeline",
          input: { subject: "Telephone" },
          actor: "factory-test",
          reason: "Preserve retry history."
        }),
        (error: unknown) => {
          assert.equal(error instanceof ApiError, true);
          const failure = ((error as ApiError).details as any).failure;
          assert.equal(failure.stage, "worker_execution");
          assert.equal(failure.retryHistory.length, 2);
          assert.deepEqual(failure.retryHistory.map((attempt: any) => attempt.attempt), [1, 2]);
          assert.match(failure.originalMessage, /unknown evidenceRecordId|outside the validated authority context/);
          return true;
        }
      );
    });
  });

  it("gates historical extraction on passed validated evidence", async () => {
    await assert.rejects(
      factoryService.startPipeline({
        pipelineId: "historical_extraction_pipeline",
        input: { subject: "Telephone" },
        actor: "factory-test",
        reason: "Missing evidence must fail."
      }),
      /validated evidence/
    );

    await withMockedFactoryPipeline({}, async (state) => {
      await factoryService.startPipeline({
        pipelineId: "historical_extraction_pipeline",
        input: {
          subject: "Telephone",
          validatedEvidenceRefs: [{
            evidenceId: "validation-1",
            evidenceType: "validated_evidence",
            evidenceRecordId: "evidence-1",
            validationRecordId: "validation-1",
            authoritySafe: true
          }]
        },
        actor: "factory-test",
        reason: "Evidence-gated extraction may run."
      });
      assert.equal(state.verifierCalls.length, 1);
      assert.ok(state.objects.length >= 1);
    });
  });

  it("completes publication candidate assembly with passed validated evidence", async () => {
    await withMockedFactoryPipeline({}, async (state) => {
      await factoryService.startPipeline({
        pipelineId: "publication_candidate_pipeline",
        input: {
          subject: "Telephone",
          validatedEvidenceRefs: [{
            evidenceId: "validation-1",
            evidenceType: "validated_evidence",
            evidenceRecordId: "evidence-1",
            validationRecordId: "validation-1",
            authoritySafe: true
          }]
        },
        actor: "factory-test",
        reason: "Evidence-backed publication candidate assembly."
      });

      assert.deepEqual(state.pipelineStatuses, ["running", "completed"]);
      assert.equal(state.packageDrafts.length, 1);
      assert.equal(state.packageDrafts[0].validatedEvidenceRefs[0].evidenceRecordId, "evidence-1");
    });
  });

  it("defines Factory editorial gates, confidence assessments, authority preparation, and review metrics", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260629_factory_editorial_gates.sql", "utf8");
    const contracts = readFileSync("src/server/factory/contracts.ts", "utf8");
    const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_editorial_reviews/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_editorial_decisions/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_confidence_assessments/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_authority_preparations/);
      assert.match(source, /'generated'/);
      assert.match(source, /'validated'/);
      assert.match(source, /'under_editorial_review'/);
      assert.match(source, /'revision_required'/);
      assert.match(source, /'editorially_approved'/);
      assert.match(source, /'authority_prepared'/);
      assert.match(source, /'governance_ready'/);
      assert.match(source, /prevent_factory_editorial_reviews_delete/);
      assert.match(source, /prevent_factory_editorial_decisions_delete/);
      assert.match(source, /prevent_factory_confidence_assessments_delete/);
      assert.match(source, /prevent_factory_authority_preparations_delete/);
    }

    assert.match(contracts, /FactoryEditorialReviewLifecycle/);
    assert.match(contracts, /FactoryConfidenceLevel/);
    assert.match(repository, /createEditorialReview/);
    assert.match(repository, /createEditorialDecision/);
    assert.match(repository, /createConfidenceAssessment/);
    assert.match(repository, /createAuthorityPreparation/);
    assert.match(repository, /validationPassRate/);
    assert.match(repository, /editorialApprovalRate/);
    assert.match(repository, /revisionRate/);
    assert.match(repository, /governanceReadinessRate/);
    assert.match(repository, /confidenceDistribution/);
  });

  it("enforces editorial validation before Factory package Governance readiness", () => {
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const validation = readFileSync("src/server/validation/schemas.ts", "utf8");

    assert.match(service, /validateCandidatePackage/);
    assert.match(service, /reviewCandidatePackage/);
    assert.match(service, /approveEditorialReview/);
    assert.match(service, /requireRevision/);
    assert.match(service, /prepareAuthorityRecords/);
    assert.match(service, /assessGovernanceReadiness/);
    assert.match(service, /FACTORY_EDITORIAL_VALIDATION_FAILED/);
    assert.match(service, /FACTORY_CONFIDENCE_INSUFFICIENT/);
    assert.match(service, /FACTORY_EDITORIAL_REVIEW_REQUIRED/);
    assert.match(service, /FACTORY_AUTHORITY_PREPARATION_REQUIRED/);
    assert.match(service, /getLatestEditorialReviewForPackage/);
    assert.match(service, /getLatestAuthorityPreparationForReview/);
    assert.doesNotMatch(service, /historicalLibraryService|publishedMemoryProjectionService/);

    assert.match(validation, /factoryCandidateValidationSchema/);
    assert.match(validation, /factoryCandidateReviewSchema/);
    assert.match(validation, /factoryEditorialDecisionSchema/);
    assert.match(validation, /factoryAuthorityPreparationSchema/);
    assert.match(validation, /factoryGovernanceReadinessAssessmentSchema/);
    assert.match(validation, /minimumSourceCount/);
    assert.match(validation, /minimumEvidenceCount/);
    assert.match(validation, /sourceDiversity/);
    assert.match(validation, /chronologyConsistency/);
  });

  it("exposes Factory editorial workflows through admin-only routes without Governance or publication authority", () => {
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const routes = [
      "app/api/admin/factory/editorial/reviews/route.ts",
      "app/api/admin/factory/editorial/reviews/[id]/route.ts",
      "app/api/admin/factory/editorial/decisions/route.ts",
      "app/api/admin/factory/editorial/authority-preparation/route.ts"
    ];

    for (const method of [
      "validateCandidatePackage",
      "reviewCandidatePackage",
      "approveEditorialReview",
      "requireFactoryEditorialRevision",
      "prepareFactoryAuthorityRecords",
      "assessFactoryGovernanceReadiness",
      "listFactoryEditorialReviews",
      "getFactoryEditorialReview"
    ]) {
      assert.match(adminService, new RegExp(`${method}: factoryService\\.`));
    }

    for (const routePath of routes) {
      const route = readFileSync(routePath, "utf8");
      assert.match(route, /withAdminAuth/);
      assert.match(route, /adminService\./);
      assert.doesNotMatch(route, /factoryRepository|governanceRepository|historicalLibraryRepository|getWriteSql|INSERT INTO|UPDATE|DELETE FROM/);
    }
  });

  it("defines Factory Governance handoff persistence with lineage and audit preservation", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260628_factory_governance_handoff.sql", "utf8");
    const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_governance_handoffs/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_submission_audit_records/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_submission_lineage/);
      assert.match(source, /governance_publication_package_id UUID REFERENCES governance_publication_packages/);
      assert.match(source, /validation_artifact_refs JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
      assert.match(source, /governance_decisions JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
      assert.match(source, /prevent_factory_governance_handoffs_delete/);
      assert.match(source, /prevent_factory_submission_audit_records_delete/);
      assert.match(source, /prevent_factory_submission_lineage_delete/);
    }

    assert.match(repository, /createGovernanceHandoff/);
    assert.match(repository, /markGovernanceHandoffSubmitted/);
    assert.match(repository, /createSubmissionAuditRecord/);
    assert.match(repository, /createSubmissionLineage/);
    assert.match(repository, /listGovernanceHandoffs/);
  });

  it("implements service-mediated Factory handoff to Governance without publication authority", () => {
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const validation = readFileSync("src/server/validation/schemas.ts", "utf8");
    const routes = [
      "app/api/admin/factory/handoffs/route.ts",
      "app/api/admin/factory/handoffs/[id]/route.ts",
      "app/api/admin/factory/handoffs/[id]/submit/route.ts"
    ];

    assert.match(service, /prepareGovernanceHandoff/);
    assert.match(service, /submitToGovernance/);
    assert.match(service, /getHandoffStatus/);
    assert.match(service, /listGovernanceSubmissions/);
    assert.match(service, /createGovernanceHandoff/);
    assert.match(service, /createPackageVersion/);
    assert.match(service, /markPackageVersionSubmitted/);
    assert.match(service, /governancePackage/);
    assert.match(service, /createSubmissionAuditRecord/);
    assert.match(service, /createSubmissionLineage/);
    assert.match(service, /governanceDecisions: \[\]/);
    assert.doesNotMatch(service, /certifyReadiness\(input|approveDecision|rejectDecision|admitPublicationPackage|publishPublicationPackage/);
    assert.doesNotMatch(service, /historicalLibraryService|publishedMemoryProjectionService/);

    assert.match(adminService, /prepareFactoryGovernanceHandoff: factoryService\.prepareGovernanceHandoff/);
    assert.match(adminService, /submitFactoryGovernanceHandoff: factoryService\.submitToGovernance/);
    assert.match(adminService, /getFactoryGovernanceHandoffStatus: factoryService\.getHandoffStatus/);
    assert.match(adminService, /listFactoryGovernanceSubmissions: factoryService\.listGovernanceSubmissions/);
    assert.match(validation, /factoryGovernanceHandoffSchema/);
    assert.match(validation, /factoryGovernanceHandoffSubmissionSchema/);

    for (const routePath of routes) {
      const route = readFileSync(routePath, "utf8");
      assert.match(route, /withAdminAuth/);
      assert.match(route, /adminService\./);
      assert.doesNotMatch(route, /factoryRepository|governanceRepository|historicalLibraryRepository|getWriteSql/);
    }
  });
});
