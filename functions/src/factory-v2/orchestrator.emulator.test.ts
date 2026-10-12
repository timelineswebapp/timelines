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
  centralEntities: [{ name: "Apollo 11", type: "Technology", language: "en" }], requiredDimensions: ["operational"], expectedPhases: ["launch"], granularity: "DETAILED", explicitExclusions: ["Fictional portrayals"], uncertainties: [],
  researchBudget: { maximumGroundingCalls: 7, maximumProviderQueries: 40, maximumSourceDocuments: 60, maximumAtomicClaims: 300, maximumSemanticRepairs: 2, maximumTransportAttemptsPerCall: 3, maximumConcurrency: 3, maximumWorkerSeconds: 1200 }
};

const map = { questions: [{ text: "When and how did Apollo 11 launch?", phaseLabels: ["launch"], dimensionLabels: ["operational"], expectedAuthorities: ["NASA"], languages: ["en"], geography: ["United States"], historicalPerspectiveRequirements: [{ kind: "STAKEHOLDER", label: "NASA mission operations", rationale: "Mission operations made material operational decisions.", historicalActionBasis: null }], contested: false, dateCritical: true, priority: "CRITICAL" }] };

test("Full V2-A shadow orchestration creates verified candidate knowledge without publication paths", { skip: !enabled }, async () => {
  const provider: V2ModelProvider = {
    async generateContent(request) {
      if (request.contents.includes("narrow V2 scope-proposal")) return { text: JSON.stringify(scope), usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 100, totalTokenCount: 200 } };
      if (request.contents.includes("V2 Research Map stage")) return { text: JSON.stringify(map), usageMetadata: { totalTokenCount: 200 } };
      if (request.contents.includes("Authority-First routing selector")) {
        const routingObligationId = request.contents.match(/routing-obligation-[a-f0-9]{64}/u)?.[0];
        assert.ok(routingObligationId);
        return { text: JSON.stringify({ selections: [{ routingObligationId, publisherNumber: 1, role: "PRIMARY_RECORD", rationale: "NASA is the verified primary records holder for the mission-operations obligation." }] }), usageMetadata: { totalTokenCount: 100 } };
      }
      if (request.contents.includes("Authority-First topic-routing stage")) return { text: JSON.stringify({ authorities: [
        { publisherNumber: 1, researchQuestionNumbers: [1, 2], roles: ["PRIMARY_RECORD"], claimTypes: ["OCCURRENCE", "DATE", "IDENTITY", "LOCATION"], subjectRelationship: "SUBJECT_SELF", perspectiveTags: ["United States"], rationale: "NASA is the registered primary authority for Apollo 11 mission chronology." },
        { publisherNumber: 8, researchQuestionNumbers: [1, 2], roles: ["CORROBORATION"], claimTypes: ["OCCURRENCE", "DATE", "IDENTITY", "LOCATION"], subjectRelationship: "INDEPENDENT", perspectiveTags: ["United States", "International"], rationale: "The Smithsonian independently corroborates Apollo 11 aviation and spaceflight chronology." }
      ] }), usageMetadata: { totalTokenCount: 100 } };
      if (Array.isArray(request.config.tools) && request.config.tools.some((tool) => typeof tool === "object" && tool !== null && "googleSearch" in tool)) {
        const text = "Apollo 11 launched on July 16, 1969.";
        return { text, candidates: [{ groundingMetadata: { webSearchQueries: ["Apollo 11 launch NASA"], groundingChunks: [{ web: { uri: "https://www.nasa.gov/apollo-11-fixture", title: "NASA Apollo 11 launch", domain: "nasa.gov" } }], groundingSupports: [{ segment: { startIndex: 0, endIndex: text.length, text }, groundingChunkIndices: [0] }], searchEntryPoint: {} } }], usageMetadata: { totalTokenCount: 100 } };
      }
      if (request.contents.includes("atomic-claim extraction stage")) {
        const segmentId = request.contents.match(/segment-[a-f0-9]{64}/u)?.[0];
        assert.ok(segmentId);
        const temporal = { start: { ...date(1969, "DAY", 7, 16), label: "July 16, 1969" }, end: null };
        return { text: JSON.stringify({ claims: [
          { subject: { kind: "EVENT", label: "mission launch" }, predicate: "OCCURRENCE", object: { kind: "TEXT", value: "launched" }, normalizedAssertion: "The mission launched on July 16, 1969", claimType: "OCCURRENCE", risk: "MATERIAL", temporal, eventClusterKey: "Apollo 11 launch", qualifiers: [], evidenceSegmentIds: [segmentId], semanticClass: "EVENT" },
          { subject: { kind: "EVENT", label: "mission launch" }, predicate: "DATE", object: { kind: "DATE", value: temporal.start }, normalizedAssertion: "The launch occurred July 16, 1969", claimType: "DATE", risk: "MATERIAL", temporal, eventClusterKey: "Apollo 11 launch", qualifiers: [], evidenceSegmentIds: [segmentId], semanticClass: "EVENT" }
        ] }), usageMetadata: { totalTokenCount: 200 } };
      }
      throw new Error("Unexpected model stage");
    }
  };
  const fetch = async (url: string) => {
    const body = url.endsWith("/robots.txt") ? "User-agent: *\nAllow: /" : `<html lang='en'><title>${url.includes("airandspace.si.edu") ? "Smithsonian" : "NASA"} Apollo 11</title><body><p>Apollo 11 launched on July 16, 1969.</p></body></html>`;
    return { status: 200, headers: { get: (name: string) => name.toLocaleLowerCase("en-US") === "content-type" ? (url.endsWith("/robots.txt") ? "text/plain" : "text/html") : null }, body: Readable.from([new TextEncoder().encode(body)]) as unknown as AsyncIterable<Uint8Array> };
  };
  const app = getApps()[0] || initializeApp({ projectId: "tiimeliines" });
  const repository = new V2FirestoreRepository({ firestore: getFirestore(app), corpusId: "test-clean-corpus" });
  const institutionalDiscoveryTransport = async (url: string) => new Response(url.includes("airandspace.si.edu")
    ? "<urlset><url><loc>https://airandspace.si.edu/apollo-11-launch-fixture</loc></url></urlset>"
    : "<urlset><url><loc>https://www.nasa.gov/apollo-11-launch-fixture</loc></url></urlset>", { status: 200, headers: { "content-type": "application/xml" } });
  const result = await runV2AShadowFixture({ title: "Apollo 11 Mission", language: "en", ongoingAsOf: "2026-09-06" }, shadowConfig(), { repository, provider, institutionalDiscoveryTransport, retrieval: { fetch, dnsLookup: (async () => [{ address: "93.184.216.34", family: 4 }]) as never, archive: { async save(path) { return { objectRef: `gs://private/${path}#1`, generation: "1" }; } } } });
  assert.equal(result.metrics.finalV2AVerdict, "PASS", JSON.stringify({ blockingReasons: result.blockingReasons, confidenceVectorId: result.confidenceVectorId, metrics: result.metrics }));
  assert.equal(result.metrics.claimsSupported, 2);
  assert.equal(result.metrics.resolvedCanonicalEventCandidates, 1);
  assert.equal(result.blockingReasons.length, 0);
  const derivations = await getFirestore(app).collection("corpora").doc("test-clean-corpus").collection("v2AuditRecords").where("action", "==", "SEMANTIC_ARTIFACT_DERIVATION").limit(20).get();
  assert.equal(derivations.empty, false);
  assert.ok(derivations.docs.every((document) => {
    const refs = document.data().artifactRefs as Array<{ collection: string }>;
    return refs.some((ref) => ref.collection === "v2ModelExecutions") && refs.some((ref) => ref.collection !== "v2ModelExecutions");
  }));
  const published = await getFirestore(app).collection("corpora").doc("test-clean-corpus").collection("publishedMemory").get();
  assert.equal(published.empty, true);
  const projection = await getFirestore(app).collection("corpora").doc("test-clean-corpus").collection("platformReadModels").get();
  assert.equal(projection.empty, true);
  const entityVersions = await getFirestore(app).collection("corpora").doc("test-clean-corpus").collection("v2CanonicalEntityVersions").limit(20).get();
  assert.equal(entityVersions.empty, false);
  for (const entity of entityVersions.docs) {
    const ids = entity.data().identityEvidenceSegmentIds as string[];
    assert.equal(new Set(ids).size, ids.length);
  }
  const second = await runV2AShadowFixture({ title: "Apollo 11 Mission", language: "en", ongoingAsOf: "2026-09-06" }, shadowConfig(), { repository, provider, institutionalDiscoveryTransport, retrieval: { fetch, dnsLookup: (async () => [{ address: "93.184.216.34", family: 4 }]) as never, archive: { async save(path) { return { objectRef: `gs://private/${path}#1`, generation: "1" }; } } } });
  assert.equal(second.metrics.cacheHits, 2);
  assert.equal(second.metrics.resolvedCanonicalEventCandidates, 1);
  const entityHeads = await getFirestore(app).collection("corpora").doc("test-clean-corpus").collection("v2CanonicalEntities").limit(20).get();
  const eventHeads = await getFirestore(app).collection("corpora").doc("test-clean-corpus").collection("v2CanonicalEvents").limit(20).get();
  assert.equal(entityHeads.docs.every((head) => head.data().currentVersion === 1), true);
  assert.equal(eventHeads.docs.every((head) => head.data().currentVersion === 1), true);
  assert.deepEqual(second.claimVersionIds, result.claimVersionIds);
  assert.deepEqual(second.eventVersionIds, result.eventVersionIds);
});
