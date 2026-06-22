import { ApiError } from "@/src/server/api/responses";
import type { PublishedReadModelType } from "@/src/server/platform/read-model-contracts";

export const PROJECTION_DTO_CONTRACT_VERSION = "projection-dto-v1";

type ProjectionContract = {
  type: PublishedReadModelType;
  requiredFields: string[];
};

export const projectionDtoContracts: Record<PublishedReadModelType, ProjectionContract> = {
  timeline: {
    type: "timeline",
    requiredFields: [
      "slug",
      "title",
      "description",
      "category",
      "tags",
      "chronology_metadata",
      "seo_metadata",
      "og_metadata",
      "published_state",
      "continuity_metadata"
    ]
  },
  milestone: {
    type: "milestone",
    requiredFields: [
      "id",
      "slug",
      "title",
      "description",
      "date",
      "date_precision",
      "timeline_context",
      "seo_metadata",
      "og_metadata",
      "published_state"
    ]
  },
  historical_object: {
    type: "historical_object",
    requiredFields: ["id", "slug", "title", "description", "object_type", "relationship_summary", "published_state"]
  },
  relationship: {
    type: "relationship",
    requiredFields: [
      "relationship_id",
      "relationship_type",
      "source_authority_ref",
      "target_authority_ref",
      "summary",
      "evidence_refs",
      "provenance",
      "authority_state",
      "published_state",
      "continuity_metadata"
    ]
  },
  search: {
    type: "search",
    requiredFields: ["entity_type", "entity_id", "slug", "title", "description", "searchable_text", "published_state"]
  },
  sitemap: {
    type: "sitemap",
    requiredFields: ["canonical_url", "last_modified", "entity_type", "published_state"]
  }
};

function hasValue(payload: Record<string, unknown>, field: string) {
  const value = payload[field];
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}

export function validateProjectionDto(type: PublishedReadModelType, payload: Record<string, unknown>) {
  const contract = projectionDtoContracts[type];
  const missingFields = contract.requiredFields.filter((field) => !hasValue(payload, field));
  if (missingFields.length > 0) {
    throw new ApiError(
      422,
      "PROJECTION_DTO_CONTRACT_VIOLATION",
      `Projection payload for ${type} is missing required public DTO fields: ${missingFields.join(", ")}.`
    );
  }
}

export function projectionDtoMetadata(type: PublishedReadModelType) {
  return {
    dto_contract_version: PROJECTION_DTO_CONTRACT_VERSION,
    projection_contract_version: PROJECTION_DTO_CONTRACT_VERSION,
    projection_type: type
  };
}
