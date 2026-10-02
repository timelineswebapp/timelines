/**
 * Historical open-web publisher inference retained only for replay and identity
 * regression tests. Authority-First canonical acquisition must never call it.
 */
import type { PublisherAuthorityVersion } from "./contracts";
import { buildPublisherAuthorityVersion } from "./authority";
import { contentAddressedId, deterministicUuid } from "./hashing";
import type { ArtifactContext } from "./contracts/builders";
import { V2_POLICY_VERSION } from "./contracts";

export function provisionalPublisher(context: ArtifactContext, url: string, language: string): PublisherAuthorityVersion {
  void language;
  const hostname = new URL(url).hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "");
  const registryContext: ArtifactContext = { ...context, topicId: "publisher-registry", runId: "provisional-v2-a", generation: 1, createdAt: "2026-09-06T00:00:00.000Z", policyVersion: V2_POLICY_VERSION };
  return buildPublisherAuthorityVersion(registryContext, {
    publisherId: deterministicUuid("timelines.publisher.provisional", hostname), version: 2, effectiveAt: "2026-09-06T00:00:00.000Z", canonicalName: hostname, aliases: [], parentPublisherId: null,
    institutionType: "OTHER", authorityDomains: ["Unclassified"], geographicScope: ["Unclassified"], languages: ["multilingual"], primarySecondaryTendency: "MIXED",
    knownDomains: [hostname], externalIdentifiers: [], independenceGroupId: contentAddressedId("publisher-group", hostname), accessLimitations: [], state: "PROVISIONAL", classificationEvidenceSegmentIds: [], admittedBy: "POLICY"
  });
}

export function namespacePolicyPublisher(context: ArtifactContext, url: string): PublisherAuthorityVersion | undefined {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "");
  const government = hostname.endsWith(".gov") || hostname.endsWith(".gov.uk");
  const university = hostname.endsWith(".edu") || hostname.endsWith(".ac.uk") || /\.(?:edu|ac)\.[a-z]{2}$/u.test(hostname);
  const international = hostname.endsWith(".int");
  if (!government && !university && !international) return undefined;
  const institutionalUnit = /(?:^|\.)(?:archive|archives|history|library|libraries|museum|museums|press|research|records)(?:\.|$)/u.test(hostname)
    || /\/(?:archive|archives|collections?|documents?|history|library|libraries|museum|museums|press|publications?|records|research)(?:\/|$)/u.test(parsed.pathname.toLocaleLowerCase("en-US"));
  if (!institutionalUnit) return undefined;
  const institutionType = government ? "GOVERNMENT" as const : university ? "UNIVERSITY" as const : "OTHER" as const;
  const tendency = government || international ? "PRIMARY" as const : "MIXED" as const;
  const registryContext: ArtifactContext = { ...context, topicId: "publisher-registry", runId: "namespace-policy-v2-a", generation: 1, createdAt: "2026-09-09T00:00:00.000Z", policyVersion: V2_POLICY_VERSION };
  return buildPublisherAuthorityVersion(registryContext, {
    publisherId: deterministicUuid("timelines.publisher.namespace-policy", hostname), version: 1, effectiveAt: "2026-09-09T00:00:00.000Z", canonicalName: hostname, aliases: [], parentPublisherId: null,
    institutionType, authorityDomains: [government ? "Official government records and institutional material" : university ? "University scholarly and institutional material" : "Official intergovernmental records"], geographicScope: ["Subject to claim-level relevance"], languages: ["multilingual"], primarySecondaryTendency: tendency,
    knownDomains: [hostname], externalIdentifiers: [{ scheme: "controlled-domain", value: hostname }], independenceGroupId: contentAddressedId("publisher-group", hostname), accessLimitations: ["Authority is limited to directly relevant content under the controlled namespace"], state: "VERIFIED", classificationEvidenceSegmentIds: [], admittedBy: "POLICY"
  });
}
