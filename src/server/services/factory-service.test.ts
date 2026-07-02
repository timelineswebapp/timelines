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
  milestonePayloadGroundingFailures,
  pipelineStepsComplete,
  setFactoryPipelineEvidenceVerifierForTests
} from "@/src/server/services/factory-service";
import {
  compactExtractionWorkerOutputContractSchema,
  factoryWorkerOutputContractSchema,
  specializeExtractionSchemaForEvidence,
  validateCompactExtractionWorkerOutput,
  validateFactoryWorkerOutput
} from "@/src/server/factory/output-schemas";
import { canonicalFactoryWorkers } from "@/src/server/factory/worker-registry";
import { getFactoryWorkerPromptTemplate, renderObjectExtractionCompilerPrompt } from "@/src/server/factory/worker-prompts";
import { getFactoryRuntimeProvider, resolveFactoryQwenTimeoutMs } from "@/src/server/factory/runtime-providers";
import { factoryRepository } from "@/src/server/repositories/factory-repository";
import { evidenceValidationRepository } from "@/src/server/repositories/evidence-validation-repository";
import { sourceDiscoveryService } from "@/src/server/services/source-discovery-service";
import { sourceRetrievalService } from "@/src/server/services/source-retrieval-service";
import { sourceAuthorityRepository } from "@/src/server/repositories/source-authority-repository";
import { corpusGenerationService } from "@/src/server/services/corpus-generation-service";
import { evidenceExtractionService } from "@/src/server/services/evidence-extraction-service";
import { evidenceValidationService } from "@/src/server/services/evidence-validation-service";

function factoryOutputForPrompt(prompt: string, override: Record<string, unknown> = {}) {
  const extractionWorkerKey = [
      "object_extraction_worker",
      "milestone_extraction_worker",
      "participation_extraction_worker",
      "relationship_extraction_worker",
      "context_enrichment_worker"
    ].find((key) => prompt.includes(key));
  if (extractionWorkerKey && (
    prompt.includes("compact output required keys") ||
    prompt.includes("Factory Object Extraction Compiler")
  )) {
    const workerKey = extractionWorkerKey;
    const objectTypes: Record<string, string> = {
      object_extraction_worker: "candidate_historical_object",
      milestone_extraction_worker: "candidate_milestone",
      participation_extraction_worker: "candidate_participation",
      relationship_extraction_worker: "candidate_relationship",
      context_enrichment_worker: "candidate_context_record"
    };
    return {
      summary: "Compact Extraction output grounded in supplied evidence.",
      confidence: 0.9,
      boundary: { factoryOwned: true, publicationAllowed: false, governanceSubmissionAllowed: false },
      candidates: [{
        title: "Telephone",
        objectType: objectTypes[workerKey],
        payload: {
          name: "Telephone",
          type: "technology",
          summary: "The telephone was demonstrated in 1876.",
          aliases: [],
          chronologyRole: "communication technology",
          date: "1876",
          datePrecision: "year",
          location: "United States",
          chronologyPosition: "invention",
          historicalObjectRef: "object-1",
          milestoneRef: "milestone-1",
          role: "subject",
          participationPriority: 1,
          sourceAuthorityRef: "object-1",
          targetAuthorityRef: "object-2",
          relationshipType: "related_to",
          directionality: "directed",
          contextType: "historical_significance",
          chronologyScope: "1876",
          relatedCandidateRefs: []
        },
        evidenceRecordIds: ["evidence-1"]
      }],
      ...override
    };
  }
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
  } else if (prompt.includes("validation_worker")) {
    candidate = null;
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

  it("returns persisted Governance linkage for idempotent handoff submission retries", () => {
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    assert.match(service, /handoff\.status === "submitted_to_governance"/);
    assert.match(service, /getGovernanceSubmissionByVersion/);
    assert.match(service, /getPublicationPackage/);
    assert.match(service, /FACTORY_HANDOFF_LINEAGE_INCOMPLETE/);
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
      "123e4567-e89b-12d3-a456-426614174030",
      [{
        objectId: "123e4567-e89b-12d3-a456-426614174040",
        objectType: "candidate_milestone",
        title: "Telephone patented",
        payload: { date: "1876-03-10", summary: "Telephone patent granted." },
        lifecycle: "packaged",
        provenance: { pipelineRunId: "run-1" },
        createdBy: "factory-editor",
        updatedBy: "factory-editor"
      }]
    );

    assert.deepEqual(publicationPackage.includedAuthority, [{
      authorityType: "milestone",
      authorityId: "123e4567-e89b-12d3-a456-426614174040"
    }]);
    assert.equal(publicationPackage.canonicalAuthority?.[0]?.payload.date, "1876-03-10");
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
          assert.equal((error as any).diagnostics.failureClass, "MODEL_OUTPUT_TRUNCATED");
          assert.equal((error as any).diagnostics.requestUrl.endsWith("/api/generate"), true);
          assert.equal((error as any).diagnostics.method, "POST");
          assert.equal(typeof (error as any).diagnostics.bodyBytes, "number");
          assert.equal(typeof (error as any).diagnostics.promptChars, "number");
          assert.equal(typeof (error as any).diagnostics.estimatedPromptTokens, "number");
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("passes the canonical worker schema to Ollama structured output", async () => {
    const originalFetch = globalThis.fetch;
    const provider = getFactoryRuntimeProvider("qwen14");
    const schema = compactExtractionWorkerOutputContractSchema("object_extraction_worker");
    let requestBody: Record<string, any> = {};
    globalThis.fetch = (async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        response: JSON.stringify({
          summary: "Evidence is insufficient.",
          confidence: 0.5,
          candidates: []
        }),
        done_reason: "stop",
        prompt_eval_count: 10,
        eval_count: 12
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    try {
      await provider.execute({
        prompt: "Compiler prompt.",
        input: {},
        configuration: { compilerPrompt: "object_extraction", maxOutputTokens: 4000 },
        outputSchema: schema,
        timeoutMs: 240000
      });
      assert.deepEqual(requestBody.format, schema);
      assert.equal(requestBody.options.num_predict, 4000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("captures Ollama transport diagnostics for Node system failures", async () => {
    const originalFetch = globalThis.fetch;
    const provider = getFactoryRuntimeProvider("qwen14");
    const cases = [
      { code: "ECONNREFUSED", errno: -61, syscall: "connect", address: "127.0.0.1", port: 11434 },
      { code: "ETIMEDOUT", errno: -60, syscall: "connect", hostname: "localhost", port: 11434 },
      { code: "ECONNRESET", errno: -54, syscall: "read", address: "127.0.0.1", port: 11434 }
    ];

    try {
      for (const failure of cases) {
        globalThis.fetch = (async () => {
          const error = new TypeError("fetch failed") as TypeError & { cause: Record<string, unknown> };
          error.cause = { ...failure, message: failure.code };
          throw error;
        }) as typeof fetch;

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
            const diagnostics = (error as any).diagnostics;
            assert.equal(diagnostics.failureClass, "TRANSPORT_FAILURE");
            assert.equal(diagnostics.systemErrorCode, failure.code);
            assert.equal(diagnostics.errno, failure.errno);
            assert.equal(diagnostics.syscall, failure.syscall);
            assert.equal(diagnostics.port, failure.port);
            assert.equal(diagnostics.requestUrl.endsWith("/api/generate"), true);
            assert.equal(diagnostics.method, "POST");
            assert.equal(diagnostics.httpStatus, null);
            assert.equal(diagnostics.transportCause.cause.code, failure.code);
            assert.equal(typeof diagnostics.durationMs, "number");
            assert.equal(typeof diagnostics.bodyBytes, "number");
            assert.equal(typeof diagnostics.promptChars, "number");
            assert.equal(typeof diagnostics.estimatedPromptTokens, "number");
            assert.equal(diagnostics.maxOutputTokens, 2000);
            return true;
          }
        );
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("classifies Ollama HTTP failures with response diagnostics", async () => {
    const originalFetch = globalThis.fetch;
    const provider = getFactoryRuntimeProvider("qwen14");
    const statuses = [500, 404];

    try {
      for (const status of statuses) {
        globalThis.fetch = (async () => new Response(`ollama failure ${status}`, {
          status,
          headers: { "content-type": "text/plain", "x-ollama-test": String(status) }
        })) as typeof fetch;

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
            const diagnostics = (error as any).diagnostics;
            assert.equal(diagnostics.failureClass, "HTTP_FAILURE");
            assert.equal(diagnostics.httpStatus, status);
            assert.equal(diagnostics.contentType, "text/plain");
            assert.equal(diagnostics.responsePreview, `ollama failure ${status}`);
            assert.equal(diagnostics.headers["x-ollama-test"], String(status));
            return true;
          }
        );
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("classifies malformed Ollama response bodies as parse failures", async () => {
    const originalFetch = globalThis.fetch;
    const provider = getFactoryRuntimeProvider("qwen14");
    globalThis.fetch = (async () => new Response("{not json", {
      status: 200,
      headers: { "content-type": "application/json" }
    })) as typeof fetch;

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
          const diagnostics = (error as any).diagnostics;
          assert.equal(diagnostics.failureClass, "PARSE_FAILURE");
          assert.equal(diagnostics.httpStatus, 200);
          assert.equal(diagnostics.contentType, "application/json");
          assert.equal(diagnostics.responsePreview, "{not json");
          assert.match((error as Error).stack || "", /Caused by:/);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps successful Ollama execution output unchanged while adding diagnostics", async () => {
    const originalFetch = globalThis.fetch;
    const provider = getFactoryRuntimeProvider("qwen14");
    const output = {
      summary: "Compact research output.",
      confidence: 0.9,
      boundary: { factoryOwned: true, publicationAllowed: false, governanceSubmissionAllowed: false },
      claims: [{ claim: "Telephone claim.", evidenceRecordIds: ["evidence-1"] }],
      candidates: [{ title: "Telephone context", objectType: "candidate_context_record", payload: {}, evidenceRecordIds: ["evidence-1"] }]
    };
    globalThis.fetch = (async () => new Response(JSON.stringify({
      response: JSON.stringify(output),
      prompt_eval_count: 12,
      eval_count: 24,
      total_duration: 100,
      load_duration: 10,
      prompt_eval_duration: 20,
      eval_duration: 70
    }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

    try {
      const result = await provider.execute({
        prompt: "Return compact JSON.",
        input: {},
        configuration: { maxOutputTokens: 2000 },
        outputSchema: { workerKey: "research_worker_compact" },
        timeoutMs: 120000
      });
      assert.deepEqual(result.output, output);
      assert.equal(result.diagnostics.providerKey, "qwen14");
      assert.equal(result.diagnostics.maxOutputTokens, 2000);
      assert.equal(typeof result.diagnostics.bodyBytes, "number");
      assert.equal(typeof result.diagnostics.estimatedPromptTokens, "number");
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

  it("accepts validation artifacts without candidates and rejects invented validation object types", () => {
    const baseOutput = {
      summary: "Factory candidate validation completed.",
      confidence: 0.9,
      boundary: {
        factoryOwned: true as const,
        publicationAllowed: false as const,
        governanceSubmissionAllowed: false as const
      },
      sources: [{ sourceId: "source_1", title: "Authority source" }],
      evidence: [{
        claim: "Candidate lineage is supported.",
        citations: [{ sourceId: "source_1", title: "Authority source" }]
      }]
    };
    const validated = validateFactoryWorkerOutput({
      workerKey: "validation_worker",
      allowedObjectTypes: ["candidate_historical_object", "candidate_milestone"],
      output: { ...baseOutput, candidates: [] }
    });
    assert.deepEqual(validated.candidates, []);

    for (const objectType of ["validation_candidate", "factory_candidate"]) {
      assert.throws(
        () => validateFactoryWorkerOutput({
          workerKey: "validation_worker",
          allowedObjectTypes: ["candidate_historical_object", "candidate_milestone"],
          output: {
            ...baseOutput,
            candidates: [{
              title: "Invalid validation pseudo-candidate",
              objectType,
              payload: {},
              sources: baseOutput.sources,
              evidence: baseOutput.evidence
            }]
          }
        }),
        /schema validation/
      );
    }
  });

  it("allows object extraction to explicitly produce no authority when canonical identity is unsupported", () => {
    const output = factoryOutputForPrompt("object_extraction_worker", { candidates: [] });
    const validated = validateFactoryWorkerOutput({
      workerKey: "object_extraction_worker",
      allowedObjectTypes: ["candidate_historical_object"],
      output
    });
    assert.deepEqual(validated.candidates, []);
    const schema = factoryWorkerOutputContractSchema("object_extraction_worker");
    assert.doesNotMatch(JSON.stringify(schema), /"candidates":\\{[^}]*"minItems":1/);
    assert.match(getFactoryWorkerPromptTemplate("object_extraction_worker"), /return candidates as exactly \[\]/);
  });

  it("requires compact Extraction evidence references and rejects model-generated provenance", () => {
    const schema = compactExtractionWorkerOutputContractSchema("object_extraction_worker");
    assert.match(JSON.stringify(schema), /evidenceRecordIds/);
    assert.doesNotMatch(JSON.stringify(schema), /canonicalUrl|publisher|sourceRecordId/);
    assert.throws(() => validateCompactExtractionWorkerOutput({
      workerKey: "object_extraction_worker",
      allowedObjectTypes: ["candidate_historical_object"],
      output: {
        summary: "Candidate.",
        confidence: 0.9,
        boundary: { factoryOwned: true, publicationAllowed: false, governanceSubmissionAllowed: false },
        candidates: [{
          title: "Telephone",
          objectType: "candidate_historical_object",
          payload: { name: "Telephone", url: "https://invented.example" },
          evidenceRecordIds: ["evidence-1"]
        }]
      }
    }), /Compact research output may not include output\.url/);
  });

  it("renders the canonical Object Extraction compiler prompt without model-owned boundary constants", () => {
    const schema = compactExtractionWorkerOutputContractSchema("object_extraction_worker");
    const prompt = renderObjectExtractionCompilerPrompt(schema, {
      extractionEvidenceContext: [{
        evidenceRecordId: "00000000-0000-0000-0000-000000000001",
        normalizedClaim: "The telephone is a communication technology."
      }]
    });
    const sections = [
      "You are the TiMELiNES Factory Object Extraction Compiler.",
      "Transform validated historical evidence into structured candidate historical objects.",
      "Rules:",
      "JSON Schema:",
      "Minimal Example:",
      "Input JSON:"
    ];
    for (let index = 1; index < sections.length; index += 1) {
      assert.ok(prompt.indexOf(sections[index - 1]!) < prompt.indexOf(sections[index]!));
    }
    assert.doesNotMatch(JSON.stringify(schema), /factoryOwned|publicationAllowed|governanceSubmissionAllowed/);
    assert.match(JSON.stringify(schema), /"maxItems":1/);
    assert.match(JSON.stringify(schema), /"maxItems":5/);
    assert.doesNotMatch(prompt, /historical intelligence|If a field is uncertain|Factory Runtime only/);
    assert.match(prompt, /<evidenceRecordId-from-input>/);
    assert.match(prompt, /Never invent, modify, shorten, or replace them/);
    assert.doesNotMatch(prompt, /00000000-0000-0000-0000-000000000000/);
  });

  it("derives an invocation-only evidence enum without mutating the canonical Extraction schema", () => {
    const canonical = compactExtractionWorkerOutputContractSchema("object_extraction_worker");
    const canonicalSnapshot = structuredClone(canonical);
    const evidenceRecordIds = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    ];
    const derived = specializeExtractionSchemaForEvidence(canonical, evidenceRecordIds) as any;

    assert.deepEqual(canonical, canonicalSnapshot);
    assert.notEqual(derived, canonical);
    assert.deepEqual(
      derived.properties.candidates.items.properties.evidenceRecordIds.items,
      { enum: evidenceRecordIds }
    );
    assert.deepEqual(
      (canonical as any).properties.candidates.items.properties.evidenceRecordIds.items,
      { type: "string", format: "uuid" }
    );
  });

  it("allows milestone extraction to explicitly produce no milestone when chronology is unsupported", () => {
    const output = factoryOutputForPrompt("milestone_extraction_worker", { candidates: [] });
    const validated = validateFactoryWorkerOutput({
      workerKey: "milestone_extraction_worker",
      allowedObjectTypes: ["candidate_milestone"],
      output
    });
    assert.deepEqual(validated.candidates, []);
    assert.match(getFactoryWorkerPromptTemplate("milestone_extraction_worker"), /return candidates as exactly \[\]/);
  });

  it("evaluates milestone chronology per independently supported event", () => {
    const prompt = getFactoryWorkerPromptTemplate("milestone_extraction_worker");
    assert.match(prompt, /each independently described historical event as a separate milestone candidate/);
    assert.match(prompt, /four-digit year is a complete date.*datePrecision to "year"/);
    assert.match(prompt, /date consistency within each event only/);
    assert.match(prompt, /do not require dates from different events to reconcile/);
    assert.match(prompt, /Later publications, commentary, photographs, preservation records, or retrospective material do not invalidate/);
    assert.match(prompt, /directly support that candidate's event and explicit date/);
    assert.match(prompt, /single validated evidence record.*is sufficient; never require corroboration/);
    assert.match(prompt, /conflicting dates for the same event.*emit no candidate for that event/);
  });

  it("accepts a minimal grounded milestone without location", () => {
    assert.deepEqual(milestonePayloadGroundingFailures({
      title: "Telephone invention",
      payload: { date: "1876", datePrecision: "year" },
      evidenceTexts: ["telephone time of discovery or invention: 1876."]
    }), []);
  });

  it("accepts null location but rejects unsupported location and invented details", () => {
    assert.deepEqual(milestonePayloadGroundingFailures({
      title: "Telephone invention",
      payload: { date: "1876", datePrecision: "year", location: null },
      evidenceTexts: ["telephone time of discovery or invention: 1876."]
    }), []);
    const failures = milestonePayloadGroundingFailures({
      title: "Telephone invention",
      payload: {
        date: "1876",
        datePrecision: "year",
        location: "Boston",
        summary: "Alexander Graham Bell patented and publicly demonstrated the telephone."
      },
      evidenceTexts: ["telephone time of discovery or invention: 1876."]
    });
    assert.deepEqual(failures.map((failure) => failure.unsupportedField), ["summary", "location"]);
  });

  it("rejects unsupported milestone dates", () => {
    const failures = milestonePayloadGroundingFailures({
      title: "Telephone invention",
      payload: { date: "1877", datePrecision: "year" },
      evidenceTexts: ["telephone time of discovery or invention: 1876."]
    });
    assert.equal(failures[0]?.unsupportedField, "date");
  });

  it("completes a single-worker pipeline only after its final step completes", () => {
    assert.equal(pipelineStepsComplete(
      ["object_extraction_worker"],
      [{ workerKey: "object_extraction_worker", status: "completed" }]
    ), true);
    assert.equal(pipelineStepsComplete(
      ["object_extraction_worker"],
      [{ workerKey: "object_extraction_worker", status: "running" }]
    ), false);
  });

  it("does not complete a partial multi-worker pipeline", () => {
    assert.equal(pipelineStepsComplete(
      ["object_extraction_worker", "milestone_extraction_worker"],
      [{ workerKey: "object_extraction_worker", status: "completed" }]
    ), false);
  });

  it("persists recovered pipeline completion for Factory Operations advancement", () => {
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");
    const operations = readFileSync("src/server/services/factory-operations-service.ts", "utf8");
    assert.match(service, /pipelineStepsComplete\(pipeline\.steps, completedSteps\)/);
    assert.match(service, /status: "completed"/);
    assert.match(repository, /completed_at = CASE WHEN \$\{input\.status\} IN \('completed', 'failed', 'cancelled'\) THEN NOW\(\)/);
    assert.match(operations, /if \(run\.status === "running"\) to = from/);
    assert.match(operations, /reason = to === from \? "pipeline_stage_in_progress" : "workflow_stage_advanced"/);
  });

  it("aligns every Factory worker prompt and provider schema with its registered object contract", () => {
    const artifactOnlyWorkers = new Set(["validation_worker", "package_assembly_worker"]);
    for (const worker of canonicalFactoryWorkers) {
      const schema = factoryWorkerOutputContractSchema(worker.worker_id) as any;
      const candidates = schema.properties.candidates;
      const objectType = candidates.items.properties.objectType;
      const prompt = getFactoryWorkerPromptTemplate(worker.worker_id);

      if (artifactOnlyWorkers.has(worker.worker_id)) {
        assert.equal(candidates.maxItems, 0, `${worker.worker_id} must prohibit candidates`);
        assert.match(prompt, /candidates must be exactly \[\]/);
      } else if (["object_extraction_worker", "milestone_extraction_worker"].includes(worker.worker_id)) {
        assert.equal(candidates.minItems, undefined, `${worker.worker_id} must permit explicit no-authority output`);
        assert.match(prompt, /return candidates as exactly \[\]/);
        assert.deepEqual(objectType.enum, worker.allowed_object_types);
      } else {
        assert.equal(candidates.minItems, 1, `${worker.worker_id} must require candidates`);
        assert.deepEqual(objectType.enum, worker.allowed_object_types);
        for (const allowedType of worker.allowed_object_types) {
          assert.match(prompt, new RegExp(allowedType));
        }
      }
    }
  });

  it("rejects object candidates from every artifact-only Factory worker", () => {
    const output = {
      summary: "Artifact output.",
      confidence: 0.9,
      boundary: { factoryOwned: true as const, publicationAllowed: false as const, governanceSubmissionAllowed: false as const },
      sources: [{ sourceId: "source_1", title: "Authority source" }],
      evidence: [{ claim: "Artifact claim.", citations: [{ sourceId: "source_1", title: "Authority source" }] }],
      candidates: [{
        title: "Pseudo object",
        objectType: "candidate_context_record",
        payload: { contextType: "invalid artifact candidate" },
        sources: [{ sourceId: "source_1", title: "Authority source" }],
        evidence: [{ claim: "Artifact claim.", citations: [{ sourceId: "source_1", title: "Authority source" }] }]
      }]
    };
    for (const workerKey of ["validation_worker", "package_assembly_worker"]) {
      assert.throws(
        () => validateFactoryWorkerOutput({ workerKey, allowedObjectTypes: [], output }),
        /Artifact-only worker/
      );
    }
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

  it("implements structural and grounding evidence validation without authority or publication decisions", () => {
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
    assert.match(service, /structural_and_grounding_validation/);
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

    const objectExtractionWorker = canonicalFactoryWorkers.find(
      (worker) => worker.worker_id === "object_extraction_worker"
    );
    assert.equal(objectExtractionWorker?.max_output_tokens, 4000);
    assert.equal(objectExtractionWorker?.execution_timeout, 240);
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
      providerFormats: Array<Record<string, unknown> | undefined>;
      auditRecords: any[];
    }) => Promise<T>,
    options: {
      failRetrieval?: boolean;
      failStepFailureTransition?: boolean;
      failRunFailureTransition?: boolean;
      failFailureAudit?: boolean;
      missingResearchPredecessor?: boolean;
      missingExtractionPredecessor?: boolean;
      missingArtifactEvidence?: boolean;
    } = {}
  ): Promise<T> {
    const originals = {
      discover: sourceDiscoveryService.discover,
      retrieve: sourceRetrievalService.retrieve,
      corpus: corpusGenerationService.generateFromSourceSnapshot,
      extract: evidenceExtractionService.extractFromCorpusDocument,
      validate: evidenceValidationService.validateEvidence,
      requireEvidenceSubject: evidenceValidationRepository.requireEvidenceSubject,
      requireSourceRecord: sourceAuthorityRepository.requireSourceRecord,
      createPipelineRun: factoryRepository.createPipelineRun,
      getLatestCompletedPipelineRun: factoryRepository.getLatestCompletedPipelineRun,
      getArtifactsByIds: factoryRepository.getArtifactsByIds,
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
      providerFormats: [] as Array<Record<string, unknown> | undefined>,
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
      (evidenceValidationRepository as any).requireEvidenceSubject = async () => ({
        evidenceRecordId: "evidence-1",
        corpusDocumentId: "corpus-1",
        sourceSnapshotId: "snapshot-1",
        sourceRecordId: "source-record-1",
        provider: "wikidata",
        retrievalTimestamp: "2026-06-24T00:00:00.000Z",
        spanStart: 0,
        spanEnd: 120,
        quoteText: "The telephone was demonstrated in 1876; telephone milestones, relationships, participation, and context are supported by evidence.",
        normalizedClaim: "The telephone was demonstrated in 1876; telephone milestones, relationships, participation, and context are supported by evidence.",
        provenance: {},
        createdBy: "factory-test",
        corpusDocumentExists: true,
        sourceSnapshotExists: true,
        sourceRecordExists: true,
        corpusTextLength: 150,
        sourceTitle: "Authoritative Telephone Evidence",
        sourceDescription: "Telephone history.",
        sourceProvenance: { relevanceAssessment: { accepted: true, authorityRelevance: 0.8 } }
      });
      (sourceAuthorityRepository as any).requireSourceRecord = async () => ({
        sourceRecordId: "source-record-1",
        provider: "wikidata",
        providerRecordId: "Q11035",
        canonicalUrl: "https://www.wikidata.org/wiki/Special:EntityData/Q11035.json",
        title: "Authoritative Telephone Evidence",
        description: "Telephone source.",
        sourceType: "entity",
        origin: {
          provider: "wikidata",
          providerRecordId: "Q11035",
          providerUrl: "https://www.wikidata.org/wiki/Q11035",
          discoveredFromQuery: "Telephone",
          discoveredAt: "2026-06-24T00:00:00.000Z"
        },
        provenance: { authority: "source_authority" },
        createdBy: "factory-test"
      });
      (factoryRepository as any).getLatestCompletedPipelineRun = async (pipelineId: string) => {
        if (pipelineId === "historical_research_pipeline") {
          if (options.missingResearchPredecessor) return null;
          return {
            pipelineRunId: "research-run-1",
            pipelineId,
            status: "completed",
            input: { subject: "Telephone" },
            artifactRefs: ["research-artifact-1"],
            factoryObjectRefs: ["research-object-1"]
          };
        }
        if (options.missingExtractionPredecessor) return null;
        return {
          pipelineRunId: "extraction-run-1",
          pipelineId,
          status: "completed",
          input: { subject: "Telephone" },
          artifactRefs: ["extraction-artifact-1"],
          factoryObjectRefs: ["extraction-object-1"]
        };
      };
      (factoryRepository as any).getArtifactsByIds = async (artifactIds: string[]) => artifactIds.map((artifactId) => ({
        artifactId,
        factoryObjectId: null,
        artifactType: "generation",
        title: `${artifactId} output`,
        payload: options.missingArtifactEvidence ? {} : {
          validatedEvidenceRefs: artifactId.startsWith("research")
            ? [{
              evidenceId: "validation-1",
              evidenceType: "validated_evidence",
              evidenceRecordId: "evidence-1",
              validationRecordId: "validation-1",
              authoritySafe: true
            }, {
              evidenceId: "validation-1",
              evidenceType: "validated_evidence",
              evidenceRecordId: "evidence-1",
              validationRecordId: "validation-1",
              authoritySafe: true
            }]
            : [{
              evidenceId: "validation-2",
              evidenceType: "validated_evidence",
              evidenceRecordId: "evidence-2",
              validationRecordId: "validation-2",
              authoritySafe: true
            }]
        },
        authoritySafe: false,
        modelProvider: "qwen14_local",
        modelName: "qwen3:14b",
        createdBy: "factory-test"
      }));
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
        state.providerFormats.push(body.format);
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
      (evidenceValidationRepository as any).requireEvidenceSubject = originals.requireEvidenceSubject;
      (sourceAuthorityRepository as any).requireSourceRecord = originals.requireSourceRecord;
      (factoryRepository as any).createPipelineRun = originals.createPipelineRun;
      (factoryRepository as any).getLatestCompletedPipelineRun = originals.getLatestCompletedPipelineRun;
      (factoryRepository as any).getArtifactsByIds = originals.getArtifactsByIds;
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
      const researchPrompt = state.providerPrompts.find((prompt) => prompt.includes("researchReasoningContext"));
      assert.ok(researchPrompt);
      assert.match(researchPrompt, /"researchReasoningContext"/);
      assert.match(researchPrompt, /"evidenceRecordId":"evidence-1"/);
      assert.match(researchPrompt, /"normalizedHistoricalClaim":"The telephone is a telecommunications device supported by source authority evidence."/);
      assert.doesNotMatch(researchPrompt, /validatedEvidenceContext/);
      assert.doesNotMatch(researchPrompt, /artifactRefs/);
      assert.doesNotMatch(researchPrompt, /factoryObjectRefs/);
      assert.doesNotMatch(researchPrompt, /sourceAuthorityRecordId/);
      assert.doesNotMatch(researchPrompt, /sourceSnapshotId/);
      assert.doesNotMatch(researchPrompt, /validationRecordId/);
      assert.doesNotMatch(researchPrompt, /"sourceRecordId":"source-record-1"/);
      assert.doesNotMatch(researchPrompt, /source-record-1/);
      assert.doesNotMatch(researchPrompt, /snapshot-1/);
      assert.doesNotMatch(researchPrompt, /validation-1/);
      assert.doesNotMatch(researchPrompt, /https?:\/\//);
      assert.doesNotMatch(researchPrompt, /publisher/i);
      assert.doesNotMatch(researchPrompt, /provenance/i);
      assert.match(researchPrompt, /claims, candidates/);
      assert.match(researchPrompt, /Do not emit authority metadata/);
      const researchArtifact = state.artifacts.find((artifact) => artifact.title === "Research Worker output");
      assert.equal(researchArtifact.payload.generated.sources[0].sourceId, "source-record-1");
      assert.equal(researchArtifact.payload.generated.sources[0].evidenceRecordId, "evidence-1");
      assert.equal(researchArtifact.payload.generated.sources[0].title, "Authoritative Telephone Evidence");
      assert.equal(researchArtifact.payload.generated.sources[0].url, "https://www.wikidata.org/wiki/Special:EntityData/Q11035.json");
      assert.equal(researchArtifact.payload.validatedEvidenceRefs[0].validationRecordId, "validation-1");
      assert.equal(researchArtifact.payload.generated.candidates[0].payload.publisher, "Wikidata");
      assert.equal(researchArtifact.payload.generated.candidates[0].payload.sourceId, "source-record-1");
      assert.equal(state.objects[0].payload.sources[0].sourceId, "source-record-1");
      assert.equal(state.objects[0].provenance.validatedEvidenceRefs[0].validationRecordId, "validation-1");
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
      assert.deepEqual(
        (state.providerFormats[0] as any).properties.candidates.items.properties.evidenceRecordIds.items,
        { enum: ["evidence-1"] }
      );
    });
  });

  it("reconstructs publication candidate lineage from completed Factory predecessors", async () => {
    await withMockedFactoryPipeline({}, async (state) => {
      await factoryService.startPipeline({
        pipelineId: "publication_candidate_pipeline",
        input: { subject: "Telephone" },
        actor: "factory-test",
        reason: "Evidence-backed publication candidate assembly."
      });

      assert.equal(state.pipelineStatuses.at(0), "running");
      assert.equal(state.pipelineStatuses.at(-1), "completed");
      assert.equal(state.packageDrafts.length, 1);
      assert.equal(state.packageDrafts[0].validatedEvidenceRefs[0].evidenceRecordId, "evidence-1");
      assert.deepEqual(
        state.packageDrafts[0].validatedEvidenceRefs.map((ref: any) => ref.evidenceRecordId),
        ["evidence-1", "evidence-2"]
      );
      assert.deepEqual(state.packageDrafts[0].factoryObjectRefs.slice(0, 2), ["research-object-1", "extraction-object-1"]);
      assert.deepEqual(state.packageDrafts[0].artifactRefs.slice(0, 2), ["research-artifact-1", "extraction-artifact-1"]);
      assert.equal(state.verifierCalls.at(-1).context, "Publication candidate pipeline");
    });
  });

  it("rejects client-supplied publication lineage", async () => {
    await assert.rejects(
      factoryService.startPipeline({
        pipelineId: "publication_candidate_pipeline",
        input: { subject: "Telephone", artifactRefs: ["forged-artifact"] },
        actor: "factory-test",
        reason: "Reject forged publication lineage."
      }),
      (error: unknown) => error instanceof ApiError && error.code === "FACTORY_LINEAGE_INPUT_FORBIDDEN"
    );
  });

  it("fails publication deterministically when a completed predecessor is missing", async () => {
    await withMockedFactoryPipeline({}, async () => {
      await assert.rejects(
        factoryService.startPipeline({
          pipelineId: "publication_candidate_pipeline",
          input: { subject: "Telephone" },
          actor: "factory-test",
          reason: "Require certified predecessors."
        }),
        (error: unknown) => error instanceof ApiError && error.code === "PUBLICATION_RESEARCH_PREDECESSOR_REQUIRED"
      );
    }, { missingResearchPredecessor: true });
  });

  it("fails publication deterministically when persisted artifacts contain no validated evidence", async () => {
    await withMockedFactoryPipeline({}, async () => {
      await assert.rejects(
        factoryService.startPipeline({
          pipelineId: "publication_candidate_pipeline",
          input: { subject: "Telephone" },
          actor: "factory-test",
          reason: "Require persisted artifact evidence."
        }),
        (error: unknown) => error instanceof ApiError && error.code === "PUBLICATION_VALIDATED_EVIDENCE_REQUIRED"
      );
    }, { missingArtifactEvidence: true });
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
