import type {
  FactoryObjectType,
  FactoryWorkerContract,
  FactoryWorkerForbiddenOperation,
  FactoryWorkerOperation,
  FactoryWorkerProviderPolicy
} from "@/src/server/factory/contracts";
import { factoryWorkerOutputContractSchema } from "@/src/server/factory/output-schemas";

const providerPolicy: FactoryWorkerProviderPolicy = {
  providerId: "qwen14_local",
  providerType: "local_llm",
  status: "active",
  allowedProviderTypes: ["local_llm"],
  providerAgnostic: true
};

export const factoryWorkerForbiddenOperations: FactoryWorkerForbiddenOperation[] = [
  "create_governance_decisions",
  "approve_packages",
  "reject_packages",
  "certify_readiness",
  "admit_published_memory",
  "modify_historical_library",
  "modify_projections",
  "publish_content",
  "mutate_public_platform_read_models"
];

const productionMemoryRead: FactoryWorkerOperation[] = ["read_factory_production_memory", "read_factory_artifacts"];

function worker(input: Omit<FactoryWorkerContract, "output_schema" | "provider_policy" | "retry_policy" | "audit_requirements" | "forbidden_operations">): FactoryWorkerContract {
  return {
    ...input,
    output_schema: factoryWorkerOutputContractSchema(input.worker_id),
    provider_policy: providerPolicy,
    retry_policy: {
      maxAttempts: 2,
      backoffMs: 750
    },
    audit_requirements: {
      auditInput: true,
      auditOutput: true,
      auditProvider: true,
      auditPolicy: true
    },
    forbidden_operations: factoryWorkerForbiddenOperations
  };
}

export const canonicalFactoryWorkers: FactoryWorkerContract[] = [
  worker({
    worker_id: "research_worker",
    worker_name: "Research Worker",
    worker_version: 1,
    worker_category: "research",
    description: "Prepares bounded research notes for Factory Production Memory without creating published authority.",
    allowed_inputs: ["research_question", "source_refs", "factory_object_refs"],
    allowed_outputs: ["research_artifact"],
    allowed_object_types: ["candidate_source", "candidate_context_record"],
    allowed_relationship_types: [],
    max_context_tokens: 12000,
    max_output_tokens: 2000,
    execution_timeout: 120
  }),
  worker({
    worker_id: "source_discovery_worker",
    worker_name: "Source Discovery Worker",
    worker_version: 1,
    worker_category: "source",
    description: "Identifies candidate source leads for Factory review without asserting source authority.",
    allowed_inputs: ["research_topic", "source_constraints"],
    allowed_outputs: ["candidate_source_artifact"],
    allowed_object_types: ["candidate_source"],
    allowed_relationship_types: [],
    max_context_tokens: 10000,
    max_output_tokens: 1600,
    execution_timeout: 90
  }),
  worker({
    worker_id: "source_validation_worker",
    worker_name: "Source Validation Worker",
    worker_version: 1,
    worker_category: "validation",
    description: "Evaluates candidate evidence quality for Factory validation artifacts.",
    allowed_inputs: ["candidate_source_refs", "evidence_claims"],
    allowed_outputs: ["validation_artifact"],
    allowed_object_types: ["candidate_source"],
    allowed_relationship_types: [],
    max_context_tokens: 10000,
    max_output_tokens: 1600,
    execution_timeout: 90
  }),
  worker({
    worker_id: "object_extraction_worker",
    worker_name: "Object Extraction Worker",
    worker_version: 1,
    worker_category: "extraction",
    description: "Extracts candidate historical object records into Factory Production Memory drafts only.",
    allowed_inputs: ["research_artifact", "source_refs"],
    allowed_outputs: ["candidate_historical_object"],
    allowed_object_types: ["candidate_historical_object"],
    allowed_relationship_types: [],
    max_context_tokens: 12000,
    max_output_tokens: 4000,
    execution_timeout: 240
  }),
  worker({
    worker_id: "milestone_extraction_worker",
    worker_name: "Milestone Extraction Worker",
    worker_version: 1,
    worker_category: "extraction",
    description: "Extracts candidate milestone drafts without mutating chronology authority.",
    allowed_inputs: ["research_artifact", "source_refs", "chronology_constraints"],
    allowed_outputs: ["candidate_milestone"],
    allowed_object_types: ["candidate_milestone"],
    allowed_relationship_types: [],
    max_context_tokens: 12000,
    max_output_tokens: 2000,
    execution_timeout: 120
  }),
  worker({
    worker_id: "participation_extraction_worker",
    worker_name: "Participation Extraction Worker",
    worker_version: 1,
    worker_category: "extraction",
    description: "Extracts candidate participation records between objects and milestones for Factory review.",
    allowed_inputs: ["candidate_historical_object_refs", "candidate_milestone_refs", "source_refs"],
    allowed_outputs: ["candidate_participation"],
    allowed_object_types: ["candidate_participation"],
    allowed_relationship_types: [],
    max_context_tokens: 12000,
    max_output_tokens: 2000,
    execution_timeout: 120
  }),
  worker({
    worker_id: "relationship_extraction_worker",
    worker_name: "Relationship Extraction Worker",
    worker_version: 1,
    worker_category: "extraction",
    description: "Extracts candidate relationship records for Factory review without publishing graph authority.",
    allowed_inputs: ["authority_refs", "source_refs", "relationship_claims"],
    allowed_outputs: ["candidate_relationship"],
    allowed_object_types: ["candidate_relationship"],
    allowed_relationship_types: ["influences", "influenced_by", "member_of", "contains", "located_in", "succeeds", "preceded_by", "owns", "owned_by", "related_to"],
    max_context_tokens: 12000,
    max_output_tokens: 2000,
    execution_timeout: 120
  }),
  worker({
    worker_id: "context_enrichment_worker",
    worker_name: "Context Enrichment Worker",
    worker_version: 1,
    worker_category: "enrichment",
    description: "Prepares candidate context enrichment artifacts for Factory validation.",
    allowed_inputs: ["candidate_milestone_refs", "candidate_object_refs", "source_refs"],
    allowed_outputs: ["candidate_context_record"],
    allowed_object_types: ["candidate_context_record"],
    allowed_relationship_types: [],
    max_context_tokens: 12000,
    max_output_tokens: 3000,
    execution_timeout: 120
  }),
  worker({
    worker_id: "package_assembly_worker",
    worker_name: "Package Assembly Worker",
    worker_version: 1,
    worker_category: "assembly",
    description: "Assembles Factory package draft inputs without submitting, certifying, approving, or publishing.",
    allowed_inputs: ["factory_object_refs", "artifact_refs", "risk_summary"],
    allowed_outputs: ["package_assembly_artifact"],
    allowed_object_types: [],
    allowed_relationship_types: [],
    max_context_tokens: 10000,
    max_output_tokens: 1800,
    execution_timeout: 90
  }),
  worker({
    worker_id: "validation_worker",
    worker_name: "Validation Worker",
    worker_version: 1,
    worker_category: "validation",
    description: "Prepares validation artifacts for Factory review and Publication Package readiness assessment.",
    allowed_inputs: ["factory_object_refs", "artifact_refs", "validation_policy"],
    allowed_outputs: ["validation_artifact"],
    allowed_object_types: ["candidate_historical_object", "candidate_milestone", "candidate_participation", "candidate_relationship", "candidate_source", "candidate_context_record"],
    allowed_relationship_types: ["influences", "influenced_by", "member_of", "contains", "located_in", "succeeds", "preceded_by", "owns", "owned_by", "related_to"],
    max_context_tokens: 12000,
    max_output_tokens: 2200,
    execution_timeout: 120
  })
];

export function getCanonicalFactoryWorker(workerId: string): FactoryWorkerContract | null {
  return canonicalFactoryWorkers.find((candidate) => candidate.worker_id === workerId) || null;
}

export function allowedOperationsForWorker(contract: FactoryWorkerContract): FactoryWorkerOperation[] {
  const outputPermissions: FactoryWorkerOperation[] = [];
  const allowedObjectTypes = new Set<FactoryObjectType>(contract.allowed_object_types);
  if (allowedObjectTypes.has("candidate_historical_object")) outputPermissions.push("create_candidate_objects");
  if (allowedObjectTypes.has("candidate_milestone")) outputPermissions.push("create_candidate_milestones");
  if (allowedObjectTypes.has("candidate_participation")) outputPermissions.push("create_candidate_participations");
  if (allowedObjectTypes.has("candidate_relationship")) outputPermissions.push("create_candidate_relationships");
  if (contract.allowed_outputs.some((output) => output.includes("validation"))) outputPermissions.push("create_validation_artifacts");
  if (contract.allowed_outputs.some((output) => output.includes("artifact"))) outputPermissions.push("create_candidate_artifacts");
  return Array.from(new Set([...productionMemoryRead, ...outputPermissions]));
}
