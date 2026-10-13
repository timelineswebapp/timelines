import { communityIdentitySchema, type CommunityIdentity } from "./contracts/knowledge";
import { contentAddressedId } from "./hashing";

export type { CommunityIdentity } from "./contracts/knowledge";

const normalize = (value: string): string => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
const canonicalSet = (items: readonly string[]): string[] => [...new Set(items.map(normalize))].sort((left, right) => left.localeCompare(right));

const WEST_BERLIN_CIVILIANS = communityIdentitySchema.parse({
  communityIdentityId: "community-identity-west-berlin-civilians-1948-1949",
  canonicalLabel: "West Berlin Civilians",
  aliases: ["West Berlin population", "West Berlin residents", "Civilians of West Berlin", "Residents of West Berlin"],
  category: "AFFECTED_POPULATION",
  geography: ["West Berlin", "Berlin"],
  period: { startYear: 1948, endYear: 1949 },
  languages: ["de", "en"],
  provenance: "The official Berlin municipal museum announcement identifies West Berlin residents and contemporary witnesses describing their own blockade and airlift experiences.",
  verificationSources: ["https://www.berlin.de/ba-tempelhof-schoeneberg/aktuelles/pressemitteilungen/2023/pressemitteilung.1361562.php"],
  lifecycle: "VERIFIED",
  version: 1
});

export const COMMUNITY_IDENTITY_REGISTRY_VERSION = "community-identity-registry.1" as const;
export const COMMUNITY_IDENTITY_POLICY_VERSION = "community-identity-resolution.1" as const;

export function governedCommunityIdentities(): CommunityIdentity[] {
  return [WEST_BERLIN_CIVILIANS].map((identity) => ({ ...identity, aliases: [...identity.aliases], geography: [...identity.geography], languages: [...identity.languages], verificationSources: [...identity.verificationSources] }));
}

export type CommunityIdentityResolution = {
  rawLabel: string;
  normalizedLabel: string;
  communityIdentityId: string | null;
  canonicalLabel: string | null;
  aliasOrRule: string | null;
  qualifierComparison: { period: "MATCH" | "OUT_OF_RANGE"; geography: "MATCH" | "MISMATCH"; language: "MATCH" | "MISMATCH"; category: "MATCH" | "MISMATCH" };
  rejectionReason: "UNRESOLVED_AFFECTED_COMMUNITY_IDENTITY" | "COMMUNITY_IDENTITY_PERIOD_MISMATCH" | "COMMUNITY_IDENTITY_GEOGRAPHY_MISMATCH" | "COMMUNITY_IDENTITY_LANGUAGE_MISMATCH" | null;
};

export function resolveGovernedCommunityIdentity(input: { rawLabel: string; scopePeriod: { startYear: number; endYear: number }; geography: readonly string[]; languages: readonly string[]; category: "AFFECTED_POPULATION"; identities?: readonly CommunityIdentity[] }): CommunityIdentityResolution {
  const normalizedLabel = normalize(input.rawLabel);
  const identity = (input.identities || governedCommunityIdentities()).find((item) => [item.canonicalLabel, ...item.aliases].some((label) => normalize(label) === normalizedLabel));
  if (!identity) return { rawLabel: input.rawLabel, normalizedLabel, communityIdentityId: null, canonicalLabel: null, aliasOrRule: null, qualifierComparison: { period: "MATCH", geography: "MATCH", language: "MATCH", category: "MATCH" }, rejectionReason: "UNRESOLVED_AFFECTED_COMMUNITY_IDENTITY" };
  const period = identity.period.startYear <= input.scopePeriod.startYear && identity.period.endYear >= input.scopePeriod.endYear ? "MATCH" : "OUT_OF_RANGE";
  const geography = input.geography.some((value) => canonicalSet(identity.geography).includes(normalize(value))) ? "MATCH" : "MISMATCH";
  const language = input.languages.some((value) => canonicalSet(identity.languages).includes(normalize(value))) ? "MATCH" : "MISMATCH";
  const category = identity.category === input.category ? "MATCH" : "MISMATCH";
  const rejectionReason = period !== "MATCH" ? "COMMUNITY_IDENTITY_PERIOD_MISMATCH" : geography !== "MATCH" ? "COMMUNITY_IDENTITY_GEOGRAPHY_MISMATCH" : language !== "MATCH" ? "COMMUNITY_IDENTITY_LANGUAGE_MISMATCH" : null;
  return { rawLabel: input.rawLabel, normalizedLabel, communityIdentityId: rejectionReason ? null : identity.communityIdentityId, canonicalLabel: identity.canonicalLabel, aliasOrRule: normalize(identity.canonicalLabel) === normalizedLabel ? "CANONICAL_LABEL" : "CONTROLLED_ALIAS", qualifierComparison: { period, geography, language, category }, rejectionReason };
}

export function communityIdentityFingerprint(identity: CommunityIdentity): string {
  return contentAddressedId("community-identity", { ...identity, aliases: canonicalSet(identity.aliases), geography: canonicalSet(identity.geography), languages: canonicalSet(identity.languages) });
}
