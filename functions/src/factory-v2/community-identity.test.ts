import assert from "node:assert/strict";
import test from "node:test";
import { communityIdentitySchema, type CommunityIdentity } from "./contracts";
import { COMMUNITY_IDENTITY_POLICY_VERSION, COMMUNITY_IDENTITY_REGISTRY_VERSION, communityIdentityFingerprint, governedCommunityIdentities, resolveGovernedCommunityIdentity } from "./community-identity";

const base = { scopePeriod: { startYear: 1948, endYear: 1949 }, geography: ["West Berlin"], languages: ["en"], category: "AFFECTED_POPULATION" as const };

test("governed community registry is versioned, immutable, and contract-valid", () => {
  const identities = governedCommunityIdentities();
  assert.equal(COMMUNITY_IDENTITY_REGISTRY_VERSION, "community-identity-registry.1");
  assert.equal(COMMUNITY_IDENTITY_POLICY_VERSION, "community-identity-resolution.1");
  assert.doesNotThrow(() => communityIdentitySchema.parse(identities[0]));
  assert.equal(communityIdentityFingerprint(identities[0]!), communityIdentityFingerprint(governedCommunityIdentities()[0]!));
  identities[0]!.aliases.push("mutated");
  assert.equal(governedCommunityIdentities()[0]!.aliases.includes("mutated"), false);
});

test("exact governed aliases resolve and 32 adversarial labels fail closed", () => {
  const accepted = ["West Berlin Civilians", "West Berlin Residents", "Civilians of West Berlin", "Residents of West Berlin", "West Berlin Population", "  west   berlin civilians ", "WEST BERLIN CIVILIANS"];
  const rejected = ["Berlin civilians", "Civilians Berlin West", "West Berlin citizenry", "West Berlin people", "West Berliners", "Berlin residents", "East Berlin Civilians", "West Berlin refugee population", "West Berlin civilian population 1948", "West Berlin Civilians and Residents", "Residents in West Berlin", "People of West Berlin", "West-Berlin Civilians", "Civilian residents of West Berlin", "1948 West Berlin Civilians", "The West Berlin Civilians", "German West Berlin Civilians", "All Berlin Civilians", "West Berlin residents 1948-1949", "San Francisco residents", "Ada Lovelace's contemporaries", "Printing press workers", "Holocaust survivors", "Indigenous communities", "Women in science"];
  assert.equal(accepted.length + rejected.length, 32);
  for (const label of accepted) assert.equal(resolveGovernedCommunityIdentity({ ...base, rawLabel: label }).communityIdentityId, "community-identity-west-berlin-civilians-1948-1949", label);
  for (const label of rejected) assert.equal(resolveGovernedCommunityIdentity({ ...base, rawLabel: label }).rejectionReason, "UNRESOLVED_AFFECTED_COMMUNITY_IDENTITY", label);
});

test("qualifiers are hard eligibility boundaries", () => {
  const cases = [
    { override: { scopePeriod: { startYear: 1950, endYear: 1950 } }, reason: "COMMUNITY_IDENTITY_PERIOD_MISMATCH" },
    { override: { scopePeriod: { startYear: 1947, endYear: 1948 } }, reason: "COMMUNITY_IDENTITY_PERIOD_MISMATCH" },
    { override: { geography: ["East Berlin"] }, reason: "COMMUNITY_IDENTITY_GEOGRAPHY_MISMATCH" },
    { override: { geography: ["Germany"] }, reason: "COMMUNITY_IDENTITY_GEOGRAPHY_MISMATCH" },
    { override: { languages: ["ru"] }, reason: "COMMUNITY_IDENTITY_LANGUAGE_MISMATCH" },
    { override: { languages: ["fr"] }, reason: "COMMUNITY_IDENTITY_LANGUAGE_MISMATCH" }
  ];
  for (const item of cases) assert.equal(resolveGovernedCommunityIdentity({ ...base, ...item.override, rawLabel: "West Berlin Civilians" }).rejectionReason, item.reason);
});

test("resolver is generic across isolated cross-topic governed fixtures", () => {
  const fixture = (id: string, label: string, alias: string, geography: string, startYear: number, endYear: number): CommunityIdentity => communityIdentitySchema.parse({
    communityIdentityId: id, canonicalLabel: label, aliases: [alias], category: "AFFECTED_POPULATION", geography: [geography], period: { startYear, endYear }, languages: ["en"], provenance: "Fixture proves generic registry-governed resolution without a topic-specific runtime exception.", verificationSources: ["https://example.org/community-fixture"], lifecycle: "VERIFIED", version: 1
  });
  const fixtures = [fixture("community-identity-san-francisco-survivors-1906", "San Francisco earthquake survivors", "1906 San Francisco survivors", "San Francisco", 1906, 1906), fixture("community-identity-computing-women-1843", "Early computing women", "Women computing pioneers", "London", 1843, 1843), fixture("community-identity-mainz-printers-1450", "Mainz printing workers", "Mainz printers", "Mainz", 1450, 1455)];
  for (const identity of fixtures) assert.equal(resolveGovernedCommunityIdentity({ rawLabel: identity.aliases[0]!, scopePeriod: identity.period, geography: identity.geography, languages: ["en"], category: "AFFECTED_POPULATION", identities: fixtures }).communityIdentityId, identity.communityIdentityId);
  assert.equal(resolveGovernedCommunityIdentity({ rawLabel: "San Francisco earthquake survivors", scopePeriod: { startYear: 1906, endYear: 1906 }, geography: ["San Francisco"], languages: ["en"], category: "AFFECTED_POPULATION", identities: fixtures.slice(1) }).rejectionReason, "UNRESOLVED_AFFECTED_COMMUNITY_IDENTITY");
});
