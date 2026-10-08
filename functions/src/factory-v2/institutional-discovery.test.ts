import assert from "node:assert/strict";
import test from "node:test";
import { executeInstitutionalDiscovery } from "./institutional-discovery";
import type { SpecialistCollectionProfile, TopicAuthorityBinding } from "./contracts";

const specialistProfile: SpecialistCollectionProfile = {
  profileId: "specialist-profile-nasa", publisherVersionId: "publisher-version-nasa", version: 1,
  policyVersion: "specialist-collection-profile.1" as const, capabilityClass: "SCIENTIFIC_TECHNICAL_ARCHIVES" as const,
  collectionScope: "Official technical archive collection.", endpoint: "https://nasa.gov/collections/technical/",
  discoveryMechanisms: ["DIRECT_URL"], supportedQueryParameters: [], languages: ["en"], geography: ["United States"], historicalPeriods: ["modern"], contentTypes: ["technical records"], accessLimitations: [], verificationProvenance: "Verified official collection endpoint.", effectiveAt: "2026-10-02T00:00:00.000Z"
};

const binding: TopicAuthorityBinding = {
  bindingId: "binding-nasa",
  publisherVersionId: "publisher-version-nasa",
  publisherId: "9eb82f44-6e88-4d44-bef9-4b671ea8fc93",
  researchQuestionIds: ["question-chronology"],
  roles: ["PRIMARY_RECORD"],
  claimTypes: ["OCCURRENCE", "DATE"],
  subjectRelationship: "SUBJECT_SELF",
  perspectiveTags: ["United States"],
  routingObligationIds: [],
  rationale: "NASA is applicable to NASA mission chronology.",
  authorityFamily: "PUBLIC_SCIENTIFIC_INSTITUTION",
  independenceGroupId: "publisher-nasa",
  verifiedDomains: ["nasa.gov"],
  languages: ["en"],
  geography: ["United States", "International"],
  officialEndpoints: ["https://nasa.gov/"],
  discoveryMechanisms: ["DIRECT_URL", "OFFICIAL_API", "INSTITUTIONAL_SITE_SEARCH", "SITEMAP", "REGISTERED_DOMAIN_DISCOVERY"], specialistCollectionProfiles: [],
  validationStatus: "ELIGIBLE"
};

test("institutional discovery rejects unregistered domains and mechanisms before transport", async () => {
  let calls = 0;
  const transport = async () => { calls += 1; return new Response(); };
  await assert.rejects(executeInstitutionalDiscovery({ binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "SITEMAP", endpoint: "https://example.com/sitemap.xml", purpose: "Apollo mission chronology", transport }), /OUTSIDE_REGISTERED_DOMAIN/);
  await assert.rejects(executeInstitutionalDiscovery({ binding: { ...binding, discoveryMechanisms: ["DIRECT_URL"] }, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "SITEMAP", endpoint: "https://nasa.gov/sitemap.xml", purpose: "Apollo mission chronology", transport }), /MECHANISM_NOT_REGISTERED/);
  assert.equal(calls, 0);
});

test("direct registered URLs are auditable operations without external search", async () => {
  const result = await executeInstitutionalDiscovery({ binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "DIRECT_URL", endpoint: "https://www.nasa.gov/history/apollo-11/", purpose: "Retrieve the registered NASA Apollo 11 history entry point." });
  assert.equal(result.status, "SUCCEEDED");
  assert.deepEqual(result.returnedUrls, ["https://www.nasa.gov/history/apollo-11/"]);
  assert.equal(result.providerInternalQueries.length, 0);
});

test("specialist profiles reject authority, endpoint, and mechanism substitution before transport", async () => {
  const secured = { ...binding, specialistCollectionProfiles: [specialistProfile] };
  let calls = 0;
  const transport = async () => { calls += 1; return new Response(); };
  await assert.rejects(executeInstitutionalDiscovery({ binding: secured, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "DIRECT_URL", endpoint: "https://nasa.gov/collections/other/", specialistCollectionProfileId: specialistProfile.profileId, purpose: "Official technical archive records", transport }), /SPECIALIST_COLLECTION_PROFILE_NOT_REGISTERED/);
  await assert.rejects(executeInstitutionalDiscovery({ binding: secured, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "SITEMAP", endpoint: specialistProfile.endpoint, specialistCollectionProfileId: specialistProfile.profileId, purpose: "Official technical archive records", transport }), /SPECIALIST_COLLECTION_PROFILE_NOT_REGISTERED/);
  await assert.rejects(executeInstitutionalDiscovery({ binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "DIRECT_URL", endpoint: specialistProfile.endpoint, specialistCollectionProfileId: specialistProfile.profileId, purpose: "Official technical archive records", transport }), /SPECIALIST_COLLECTION_PROFILE_NOT_REGISTERED/);
  assert.equal(calls, 0);
});

test("generic sitemap discovery remains bounded, relevance ordered, and registered-domain only", async () => {
  const xml = `<?xml version="1.0"?><urlset><url><loc>https://nasa.gov/history/unrelated</loc></url><url><loc>https://nasa.gov/history/apollo-11-mission</loc></url><url><loc>https://evil.example/apollo-11</loc></url></urlset>`;
  const result = await executeInstitutionalDiscovery({ binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "SITEMAP", endpoint: "https://nasa.gov/sitemap.xml", purpose: "Apollo mission chronology", transport: async () => new Response(xml, { status: 200, headers: { "content-type": "application/xml" } }) });
  assert.equal(result.status, "SUCCEEDED");
  assert.deepEqual(result.returnedUrls, ["https://nasa.gov/history/apollo-11-mission"]);
});

test("sitemap indexes traverse only a bounded registered-domain child set", async () => {
  let calls = 0;
  const result = await executeInstitutionalDiscovery({
    binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "SITEMAP", endpoint: "https://nasa.gov/sitemap.xml", purpose: "Apollo mission chronology",
    transport: async (url) => {
      calls += 1;
      if (url === "https://nasa.gov/sitemap.xml") return new Response(`<sitemapindex><sitemap><loc>https://nasa.gov/history.xml</loc></sitemap><sitemap><loc>https://evil.example/out.xml</loc></sitemap></sitemapindex>`, { status: 200, headers: { "content-type": "application/xml" } });
      return new Response(`<urlset><url><loc>https://nasa.gov/history/apollo-11</loc></url></urlset>`, { status: 200, headers: { "content-type": "application/xml" } });
    }
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.returnedUrls, ["https://nasa.gov/history/apollo-11"]);
});

test("institutional discovery follows only bounded same-authority redirects", async () => {
  let calls = 0;
  const result = await executeInstitutionalDiscovery({ binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "SITEMAP", endpoint: "https://nasa.gov/sitemap.xml", purpose: "Apollo mission chronology", transport: async (url) => {
    calls += 1;
    return url === "https://nasa.gov/sitemap.xml"
      ? new Response(null, { status: 301, headers: { location: "https://www.nasa.gov/sitemap.xml" } })
      : new Response(`<urlset><url><loc>https://www.nasa.gov/history/apollo-11</loc></url></urlset>`, { status: 200, headers: { "content-type": "application/xml" } });
  } });
  assert.equal(calls, 2);
  assert.deepEqual(result.returnedUrls, ["https://www.nasa.gov/history/apollo-11"]);
  const rejected = await executeInstitutionalDiscovery({ binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "SITEMAP", endpoint: "https://nasa.gov/sitemap.xml", purpose: "Apollo mission chronology", transport: async () => new Response(null, { status: 302, headers: { location: "https://evil.example/sitemap.xml" } }) });
  assert.equal(rejected.status, "FAILED");
  assert.match(rejected.failureReason || "", /REDIRECT_OUTSIDE_REGISTERED_DOMAIN/);
});

test("generic official API and site-search discovery parse URLs without trusting snippets", async () => {
  const json = { results: [{ url: "https://api.nasa.gov/history/apollo-11" }, { url: "https://outside.example/result" }] };
  const api = await executeInstitutionalDiscovery({ binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "OFFICIAL_API", endpoint: "https://api.nasa.gov/search?q=apollo", purpose: "Apollo mission chronology", transport: async () => new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } }) });
  assert.deepEqual(api.returnedUrls, ["https://api.nasa.gov/history/apollo-11"]);
  const html = `<a href="https://nasa.gov/history/apollo-11">Apollo</a><p>This snippet is not evidence.</p>`;
  const search = await executeInstitutionalDiscovery({ binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "INSTITUTIONAL_SITE_SEARCH", endpoint: "https://nasa.gov/search/?q=apollo", purpose: "Apollo mission chronology", transport: async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }) });
  assert.deepEqual(search.returnedUrls, ["https://nasa.gov/history/apollo-11"]);
  assert.equal(search.providerInternalQueries.length, 0);
});

test("registered-domain discovery resolves relevant relative links and rejects generic navigation", async () => {
  const relative = `<a href="/history/apollo-11">Apollo history</a><a href="/social">Social</a>`;
  const result = await executeInstitutionalDiscovery({ binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "REGISTERED_DOMAIN_DISCOVERY", endpoint: "https://nasa.gov/", purpose: "Apollo mission chronology", transport: async () => new Response(relative, { status: 200, headers: { "content-type": "text/html" } }) });
  assert.deepEqual(result.returnedUrls, ["https://nasa.gov/history/apollo-11"]);
  const generic = await executeInstitutionalDiscovery({ binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "REGISTERED_DOMAIN_DISCOVERY", endpoint: "https://nasa.gov/", purpose: "Apollo mission chronology", transport: async () => new Response(`<a href="/social">Social</a>`, { status: 200, headers: { "content-type": "text/html" } }) });
  assert.deepEqual(generic.returnedUrls, []);
});

test("institutional discovery fails visibly on inaccessible or oversized endpoints", async () => {
  const inaccessible = await executeInstitutionalDiscovery({ binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "SITEMAP", endpoint: "https://nasa.gov/sitemap.xml", purpose: "Apollo mission chronology", transport: async () => new Response("denied", { status: 403 }) });
  assert.equal(inaccessible.status, "FAILED");
  assert.match(inaccessible.failureReason || "", /HTTP_403/);
  const oversized = await executeInstitutionalDiscovery({ binding, researchQuestionIds: ["question-chronology"], layer: "EVIDENTIARY_CORE", mechanism: "SITEMAP", endpoint: "https://nasa.gov/sitemap.xml", purpose: "Apollo mission chronology", transport: async () => new Response("", { status: 200, headers: { "content-length": "9999999" } }) });
  assert.equal(oversized.status, "FAILED");
  assert.match(oversized.failureReason || "", /TOO_LARGE/);
});
