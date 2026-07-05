import type { FactoryPipelineDefinition } from "@/src/server/factory/contracts";

export const canonicalFactoryPipelines: FactoryPipelineDefinition[] = [
  {
    pipelineId: "historical_research_pipeline",
    pipelineName: "Historical Research Pipeline",
    description: "Creates bounded research and source validation artifacts inside Factory Production Memory.",
    steps: ["source_authority_discovery", "source_authority_retrieval", "research_corpus_generation", "evidence_extraction", "evidence_validation", "editorial_intelligence_foundation", "research_worker"],
    generationTargets: ["candidate_source", "candidate_context_record"]
  },
  {
    pipelineId: "historical_extraction_pipeline",
    pipelineName: "Historical Extraction Pipeline",
    description: "Creates candidate historical object, milestone, participation, relationship, and context records.",
    steps: [
      "object_extraction_worker",
      "milestone_extraction_worker",
      "participation_extraction_worker",
      "relationship_extraction_worker",
      "context_enrichment_worker"
    ],
    generationTargets: [
      "candidate_historical_object",
      "candidate_milestone",
      "candidate_participation",
      "candidate_relationship",
      "candidate_context_record"
    ]
  },
  {
    pipelineId: "publication_candidate_pipeline",
    pipelineName: "Publication Candidate Pipeline",
    description: "Creates validation artifacts and draft package candidates without Governance submission.",
    steps: ["editorial_timeline_compiler", "validation_worker", "package_assembly_worker"],
    generationTargets: []
  }
];

export function getCanonicalFactoryPipeline(pipelineId: string): FactoryPipelineDefinition | null {
  return canonicalFactoryPipelines.find((pipeline) => pipeline.pipelineId === pipelineId) || null;
}
