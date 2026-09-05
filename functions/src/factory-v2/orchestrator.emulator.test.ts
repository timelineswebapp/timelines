import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { shadowConfig } from "./config";
import { runV2AShadowFixture } from "./orchestrator";
import { V2FirestoreRepository } from "./repositories/firestore";
import type { V2ModelProvider } from "./vertex";
import { date } from "./test-fixtures";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

const scope = {
  title: "Apollo 11 Mission", language: "en", topicClass: "CLOSED_EPISODE", subjectDefinition: "The Apollo 11 lunar landing mission from launch through recovery.", includedQuestions: ["What operational events defined the mission?"], excludedQuestions: ["Later cultural depictions"],
  chronologyStart: { ...date(1969, "DAY", 7, 16), label: "July 16, 1969" }, chronologyEnd: { ...date(1969, "DAY", 7, 24), label: "July 24, 1969" }, ongoingAsOf: null, contextBefore: date(1961), contextAfter: date(1970),
  precursorRule: "Only readiness context is permitted.", aftermathRule: "Only immediate recovery context is permitted.", spatialScope: { included: ["Earth", "Moon"], excluded: [], boundaryRule: "Include operational mission locations." },
  centralEntities: [{ entityId: null, name: "Apollo 11", type: "Technology", language: "en" }], requiredDimensions: ["operational"], expectedPhases: ["launch"], granularity: "DETAILED", explicitExclusions: ["Fictional portrayals"], uncertainties: [],
  researchBudget: { maximumGroundingCalls: 7, maximumProviderQueries: 40, maximumSourceDocuments: 60, maximumAtomicClaims: 300, maximumSemanticRepairs: 2, maximumTransportAttemptsPerCall: 3, maximumConcurrency: 3, maximumWorkerSeconds: 1200 }
};

const map = { version: 1, phases: [{ phaseId: "launch", label: "Launch", temporalRule: "Launch day operations", required: true, rationale: "Launch opens the bounded mission." }], dimensions: [{ dimensionId: "operational", label: "Operational", required: true, rationale: "Operations define mission chronology." }], entities: [], questions: [{ questionId: "q-launch", text: "When and how did Apollo 11 launch?", phaseIds: ["launch"], dimensionIds: ["operational"], claimTypesExpected: ["DATE", "OCCURRENCE"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["NASA"], languages: ["en"], geography: ["United States"], contested: false, dateCritical: true, priority: "CRITICAL", state: "UNRESEARCHED" }], terminology: [], knownUncertainty: [] };
const query = { queries: [{ queryId: "query-launch", researchQuestionIds: ["q-launch"], role: "ORIENTATION", intendedSourceClass: "PRIMARY_INSTITUTIONAL", aliasesAndTerms: ["Apollo 11"], language: "en", geography: ["United States"], providerQuery: "Apollo 11 launch NASA", providerReportedQueries: [], budgetUnits: 1, resultArtifactIds: [] }] };

test("Full V2-A shadow orchestration creates verified candidate knowledge without publication paths", { skip: !enabled }, async () => {
  const provider: V2ModelProvider = {
    async generateContent(request) {
      if (request.contents.includes("narrow V2 scope-proposal")) return { text: JSON.stringify(scope), usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 100, totalTokenCount: 200 } };
      if (request.contents.includes("V2 Research Map stage")) return { text: JSON.stringify(map), usageMetadata: { totalTokenCount: 200 } };
      if (request.contents.includes("bounded V2 query-plan")) return { text: JSON.stringify(query), usageMetadata: { totalTokenCount: 100 } };
      if (request.contents.includes("Use Google Search only")) return { text: "Apollo 11 launched on July 16, 1969.", candidates: [{ groundingMetadata: { webSearchQueries: ["Apollo 11 launch NASA"], groundingChunks: [{ web: { uri: "https://www.nasa.gov/apollo-11-fixture", title: "Apollo 11", domain: "nasa.gov" } }], groundingSupports: [{ segment: { text: "Apollo 11 launched on July 16, 1969.", startIndex: 0, endIndex: 39 }, groundingChunkIndices: [0] }], searchEntryPoint: {} } }], usageMetadata: { totalTokenCount: 200 } };
      if (request.contents.includes("atomic-claim extraction stage")) {
        const segmentId = request.contents.match(/segment-[a-f0-9]{64}/u)?.[0];
        assert.ok(segmentId);
        return { text: JSON.stringify({ claims: [{ subject: { kind: "EVENT", id: null, label: "Apollo 11 launch" }, predicate: "DATE", object: { kind: "DATE", id: null, value: { ...date(1969, "DAY", 7, 16), label: "July 16, 1969" } }, normalizedAssertion: "Apollo 11 launch date was July 16, 1969", claimType: "DATE", risk: "MATERIAL", temporal: { start: { ...date(1969, "DAY", 7, 16), label: "July 16, 1969" }, end: null }, candidateEventClusterId: "apollo-11-launch", qualifiers: [], evidenceSegmentIds: [segmentId], semanticClass: "EVENT" }] }), usageMetadata: { totalTokenCount: 200 } };
      }
      throw new Error("Unexpected model stage");
    }
  };
  const fetch = async (url: string) => {
    const body = url.endsWith("/robots.txt") ? "User-agent: *\nAllow: /" : "<html lang='en'><title>NASA Apollo 11</title><body><p>Apollo 11 launched on July 16, 1969.</p></body></html>";
    return { status: 200, headers: { get: (name: string) => name.toLocaleLowerCase("en-US") === "content-type" ? (url.endsWith("/robots.txt") ? "text/plain" : "text/html") : null }, body: Readable.from([new TextEncoder().encode(body)]) as unknown as AsyncIterable<Uint8Array> };
  };
  const app = getApps()[0] || initializeApp({ projectId: "tiimeliines" });
  const repository = new V2FirestoreRepository({ firestore: getFirestore(app), corpusId: "test-clean-corpus" });
  const result = await runV2AShadowFixture({ title: "Apollo 11 Mission", language: "en", ongoingAsOf: "2026-09-06" }, shadowConfig(), { repository, provider, retrieval: { fetch, dnsLookup: (async () => [{ address: "93.184.216.34", family: 4 }]) as never, archive: { async save(path) { return { objectRef: `gs://private/${path}#1`, generation: "1" }; } } } });
  assert.equal(result.metrics.finalV2AVerdict, "PASS");
  assert.equal(result.metrics.claimsSupported, 1);
  assert.equal(result.metrics.resolvedCanonicalEventCandidates, 1);
  assert.equal(result.blockingReasons.length, 0);
  const published = await getFirestore(app).collection("corpora").doc("test-clean-corpus").collection("publishedMemory").get();
  assert.equal(published.empty, true);
  const projection = await getFirestore(app).collection("corpora").doc("test-clean-corpus").collection("platformReadModels").get();
  assert.equal(projection.empty, true);
});
