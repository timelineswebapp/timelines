import test from "node:test";
import assert from "node:assert/strict";
import { sourceAuthorityRepository } from "@/src/server/repositories/source-authority-repository";
import {
  assessSourceRelevance,
  buildHistoricalDiscoveryQueries,
  sourceDiscoveryService
} from "@/src/server/services/source-discovery-service";
import { sourceRetrievalService } from "@/src/server/services/source-retrieval-service";
import { resetSourceProviderHealth, setSourceProviderRuntimeStoreForTests } from "@/src/server/source-authority/resilience";
import type { SourceAuthorityRegistryRecord } from "@/src/server/source-authority/contracts";

const originalFetch = globalThis.fetch;
const originalRegister = sourceAuthorityRepository.registerDiscoveredSource;
const originalRecordRelevanceRejection = sourceAuthorityRepository.recordRelevanceRejection;
const originalRequire = sourceAuthorityRepository.requireSourceRecord;
const originalCreateSnapshot = sourceAuthorityRepository.createSnapshot;
const originalLatestSnapshot = sourceAuthorityRepository.getLatestSnapshot;

test("historical discovery queries are deterministic, bounded, and subject-preserving", () => {
  assert.deepEqual(buildHistoricalDiscoveryQueries("The History of Pandemics"), [
    "The History of Pandemics",
    "Pandemics",
    "Pandemic",
    "Pandemic history",
    "list of Pandemics",
    "Pandemic timeline",
    "Pandemic chronology"
  ]);
});

test("Source Relevance Authority rejects audited ontology drift and accepts Topic-aligned authority", () => {
  const unrelated = assessSourceRelevance("The History of Pandemics", {
    provider: "dbpedia",
    providerRecordId: "United_States_National_Security_Council",
    canonicalUrl: "https://dbpedia.org/data/United_States_National_Security_Council.json",
    title: "United States National Security Council",
    description: "The principal forum for United States national security and foreign policy.",
    sourceType: "knowledge_base_entity",
    originUrl: "https://dbpedia.org/resource/United_States_National_Security_Council",
    raw: {}
  });
  const relevant = assessSourceRelevance("The History of Pandemics", {
    provider: "library_of_congress",
    providerRecordId: "pandemic-history",
    canonicalUrl: "https://www.loc.gov/item/pandemic-history/",
    title: "A history of pandemics and public health",
    description: "Historical records documenting pandemic disease and public-health responses.",
    sourceType: "library_record",
    originUrl: "https://www.loc.gov/item/pandemic-history/",
    raw: {}
  });

  assert.equal(unrelated.accepted, false);
  assert.equal(unrelated.topicalRelevance, 0);
  assert.match(unrelated.semanticMismatch || "", /pandemics/);
  assert.equal(relevant.accepted, true);
  assert.equal(relevant.relevanceScore, 1);
});

test("Source Relevance Authority rejects incidental Topic terms found only in an unrelated description", () => {
  const result = assessSourceRelevance("The History of Pandemics", {
    provider: "dbpedia",
    providerRecordId: "Category:1947_establishments_in_the_United_States",
    canonicalUrl: "https://dbpedia.org/data/Category:1947_establishments_in_the_United_States.json",
    title: "1947 establishments in the United States",
    description: "A category containing an organisation whose long description incidentally mentions pandemics.",
    sourceType: "knowledge_base_entity",
    originUrl: "https://dbpedia.org/resource/Category:1947_establishments_in_the_United_States",
    raw: {}
  });

  assert.equal(result.topicalRelevance, 1);
  assert.equal(result.semanticRelevance, 0);
  assert.equal(result.accepted, false);
});

test("Source Relevance Authority accepts broad-topic member entities grounded by description", () => {
  const result = assessSourceRelevance("The History of Pandemics", {
    provider: "dbpedia",
    providerRecordId: "Black_Death",
    canonicalUrl: "https://dbpedia.org/data/Black_Death.json",
    title: "Black Death",
    description: "The Black Death was a bubonic plague pandemic that occurred in Europe from 1346 to 1353.",
    sourceType: "knowledge_base_entity",
    originUrl: "https://dbpedia.org/resource/Black_Death",
    raw: {}
  });

  assert.equal(result.topicalRelevance, 1);
  assert.equal(result.semanticRelevance, 1);
  assert.equal(result.accepted, true);
});

test("Source Relevance Authority rejects bibliographic works for broad historical topics", () => {
  const article = assessSourceRelevance("History of Pandemics", {
    provider: "wikidata",
    providerRecordId: "Q118130757",
    canonicalUrl: "https://www.wikidata.org/wiki/Special:EntityData/Q118130757.json",
    title: "History of Pandemics and COVID-19: What We are Learning from this Pandemic to Be Prepared for the Next One",
    description: "scientific article published in 2020",
    sourceType: "knowledge_base_entity",
    originUrl: "https://www.wikidata.org/wiki/Q118130757",
    raw: {}
  });
  const book = assessSourceRelevance("History of Pandemics", {
    provider: "wikidata",
    providerRecordId: "Q101421738",
    canonicalUrl: "https://www.wikidata.org/wiki/Special:EntityData/Q101421738.json",
    title: "Pandemics: A Very Short Introduction",
    description: "Christian W. McMillen | Dec 2016 | 9780190625214",
    sourceType: "knowledge_base_entity",
    originUrl: "https://www.wikidata.org/wiki/Q101421738",
    raw: {}
  });

  assert.equal(article.accepted, false);
  assert.match(article.semanticMismatch || "", /bibliographic work/);
  assert.equal(book.accepted, false);
  assert.match(book.semanticMismatch || "", /bibliographic work/);
});

test("Source Relevance Authority rejects entertainment works for broad historical topics", () => {
  const result = assessSourceRelevance("History of Pandemics", {
    provider: "wikidata",
    providerRecordId: "Q114944723",
    canonicalUrl: "https://www.wikidata.org/wiki/Special:EntityData/Q114944723.json",
    title: "Pandemic: The Board Game",
    description: "2018 video game",
    sourceType: "knowledge_base_entity",
    originUrl: "https://www.wikidata.org/wiki/Q114944723",
    raw: {}
  });

  assert.equal(result.accepted, false);
  assert.match(result.semanticMismatch || "", /creative work type/);
});

function restore() {
  globalThis.fetch = originalFetch;
  (sourceAuthorityRepository as any).registerDiscoveredSource = originalRegister;
  (sourceAuthorityRepository as any).recordRelevanceRejection = originalRecordRelevanceRejection;
  (sourceAuthorityRepository as any).requireSourceRecord = originalRequire;
  (sourceAuthorityRepository as any).createSnapshot = originalCreateSnapshot;
  (sourceAuthorityRepository as any).getLatestSnapshot = originalLatestSnapshot;
  setSourceProviderRuntimeStoreForTests(null);
  resetSourceProviderHealth();
}

function stubRegister() {
  (sourceAuthorityRepository as any).registerDiscoveredSource = async (input: any) => ({
    sourceRecordId: `${input.discovery.provider}-${input.discovery.providerRecordId}`,
    provider: input.discovery.provider,
    providerRecordId: input.discovery.providerRecordId,
    canonicalUrl: input.discovery.canonicalUrl,
    title: input.discovery.title,
    description: input.discovery.description,
    sourceType: input.discovery.sourceType,
    origin: {
      provider: input.discovery.provider,
      providerRecordId: input.discovery.providerRecordId,
      providerUrl: input.discovery.originUrl,
      discoveredFromQuery: input.query,
      discoveredAt: new Date().toISOString()
    },
    provenance: input.discovery.raw,
    createdBy: input.actor
  });
  (sourceAuthorityRepository as any).recordRelevanceRejection = async (input: any) => ({
    provider: input.discovery.provider,
    providerRecordId: input.discovery.providerRecordId,
    accepted: false,
    rejectionReasons: input.assessment.rejectionReasons
  });
}

async function retrieveWithSourceRecord(sourceRecord: SourceAuthorityRegistryRecord) {
  let requestedUrl = "";
  (sourceAuthorityRepository as any).requireSourceRecord = async () => sourceRecord;
  (sourceAuthorityRepository as any).getLatestSnapshot = async () => null;
  (sourceAuthorityRepository as any).createSnapshot = async (input: any) => ({
    snapshotId: "snapshot-1",
    sourceRecordId: sourceRecord.sourceRecordId,
    version: 1,
    retrievalUrl: input.retrievalUrl,
    contentType: input.contentType,
    contentHash: "hash",
    contentText: input.contentText,
    rawMetadata: input.rawMetadata,
    provenance: input.provenance,
    retrievedBy: input.actor
  });
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ title: sourceRecord.title, sourceRecordId: sourceRecord.sourceRecordId }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  const result = await sourceRetrievalService.retrieve({ sourceRecordId: sourceRecord.sourceRecordId, actor: "provider-adapter-test" });
  return { requestedUrl, result };
}

test("DBpedia discovery parses XML provider responses", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  stubRegister();
  globalThis.fetch = (async () => new Response(`<?xml version="1.0"?>
    <ArrayOfResult>
      <Result>
        <Label>Printing press</Label>
        <URI>https://dbpedia.org/resource/Printing_press</URI>
        <Description>Mechanical movable type printing technology.</Description>
      </Result>
    </ArrayOfResult>`, {
    status: 200,
    headers: { "content-type": "application/xml" }
  })) as typeof fetch;

  try {
    const result = await sourceDiscoveryService.discover({
      query: "Printing Press",
      providers: ["dbpedia"],
      limit: 1,
      actor: "provider-adapter-test"
    });
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0]?.provider, "dbpedia");
    assert.equal(result.records[0]?.canonicalUrl, "https://dbpedia.org/data/Printing_press.json");
  } finally {
    restore();
  }
});

test("DBpedia collection discovery expands linked resources through the relevance gate", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  stubRegister();
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("lookup.dbpedia.org")) {
      return new Response(`<?xml version="1.0"?>
        <ArrayOfResult>
          <Result>
            <Label>List of epidemics</Label>
            <URI>https://dbpedia.org/resource/List_of_epidemics</URI>
            <Description>A list of major epidemics and pandemics throughout history.</Description>
          </Result>
        </ArrayOfResult>`, {
        status: 200,
        headers: { "content-type": "application/xml" }
      });
    }
    if (url.includes("dbpedia.org/data/List_of_epidemics.json")) {
      return new Response(JSON.stringify({
        "http://dbpedia.org/resource/List_of_epidemics": {
          "http://dbpedia.org/ontology/wikiPageWikiLink": [
            { type: "uri", value: "http://dbpedia.org/resource/Plague_of_Justinian" },
            { type: "uri", value: "http://dbpedia.org/resource/Unrelated_place" }
          ]
        }
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.includes("dbpedia.org/data/Plague_of_Justinian.json")) {
      return new Response(JSON.stringify({
        "http://dbpedia.org/resource/Plague_of_Justinian": {
          "http://www.w3.org/2000/01/rdf-schema#label": [{ lang: "en", value: "Plague of Justinian" }],
          "http://dbpedia.org/ontology/abstract": [{ lang: "en", value: "The Plague of Justinian was an epidemic that afflicted the Byzantine Empire in the sixth century." }]
        }
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.includes("dbpedia.org/data/Unrelated_place.json")) {
      return new Response(JSON.stringify({
        "http://dbpedia.org/resource/Unrelated_place": {
          "http://www.w3.org/2000/01/rdf-schema#label": [{ lang: "en", value: "Unrelated place" }],
          "http://dbpedia.org/ontology/abstract": [{ lang: "en", value: "A settlement with no relation to the requested historical topic." }]
        }
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ search: [] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const result = await sourceDiscoveryService.discover({
      query: "History of Pandemics",
      providers: ["dbpedia"],
      limit: 1,
      actor: "provider-adapter-test"
    });
    assert.equal(result.records.some((record) => record.title === "Plague of Justinian"), true);
    assert.equal(result.records.some((record) => record.title === "Unrelated place"), false);
  } finally {
    restore();
  }
});

test("provider discovery rejects HTML responses without throwing across failover", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  stubRegister();
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("lookup.dbpedia.org")) {
      return new Response("<!doctype html><html><body>not json</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" }
      });
    }
    return new Response(JSON.stringify({ search: [] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const result = await sourceDiscoveryService.discover({
      query: "Printing Press",
      providers: ["dbpedia"],
      limit: 1,
      actor: "provider-adapter-test"
    });
    assert.equal(result.records.length, 0);
  } finally {
    restore();
  }
});

test("Library of Congress discovery prefers HTTPS item.url and normalizes HTTP item.id", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  stubRegister();
  globalThis.fetch = (async () => new Response(JSON.stringify({
    results: [
      {
        id: "http://www.loc.gov/item/2009633130/",
        url: "https://www.loc.gov/item/2009633130/",
        title: "Oldest telephone pioneer with the first telephone"
      },
      {
        id: "http://loc.gov/item/2019678219/",
        title: "Telephones. Man at telephone I"
      }
    ]
  }), {
    status: 200,
    headers: { "content-type": "application/json" }
  })) as typeof fetch;

  try {
    const result = await sourceDiscoveryService.discover({
      query: "Telephone",
      providers: ["library_of_congress"],
      limit: 2,
      actor: "provider-adapter-test"
    });
    assert.equal(result.records[0]?.canonicalUrl, "https://www.loc.gov/item/2009633130/");
    assert.equal(result.records[0]?.origin.providerUrl, "https://www.loc.gov/item/2009633130/");
    assert.equal(result.records[1]?.canonicalUrl, "https://loc.gov/item/2019678219/");
  } finally {
    restore();
  }
});

test("Library of Congress discovery rejects non-normalizable HTTP URLs", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  stubRegister();
  globalThis.fetch = (async () => new Response(JSON.stringify({
    results: [{
      id: "http://example.org/item/1",
      url: "http://example.org/item/1",
      title: "Invalid provider URL"
    }]
  }), {
    status: 200,
    headers: { "content-type": "application/json" }
  })) as typeof fetch;

  try {
    const result = await sourceDiscoveryService.discover({
      query: "Telephone",
      providers: ["library_of_congress"],
      limit: 1,
      actor: "provider-adapter-test"
    });
    assert.equal(result.records.length, 0);
  } finally {
    restore();
  }
});

test("Wikidata retrieval uses EntityData JSON endpoint and rejects HTML persistence", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  const sourceRecord: SourceAuthorityRegistryRecord = {
    sourceRecordId: "source-1",
    provider: "wikidata",
    providerRecordId: "Q1103",
    canonicalUrl: "https://www.wikidata.org/wiki/Q1103",
    title: "Printing press",
    description: null,
    sourceType: "knowledge_base_entity",
    origin: {
      provider: "wikidata",
      providerRecordId: "Q1103",
      providerUrl: "https://www.wikidata.org/wiki/Q1103",
      discoveredFromQuery: "Printing Press",
      discoveredAt: new Date().toISOString()
    },
    provenance: {},
    createdBy: "test"
  };
  let requestedUrl = "";
  (sourceAuthorityRepository as any).requireSourceRecord = async () => sourceRecord;
  (sourceAuthorityRepository as any).getLatestSnapshot = async () => null;
  (sourceAuthorityRepository as any).createSnapshot = async (input: any) => ({
    snapshotId: "snapshot-1",
    sourceRecordId: sourceRecord.sourceRecordId,
    version: 1,
    retrievalUrl: input.retrievalUrl,
    contentType: input.contentType,
    contentHash: "hash",
    contentText: input.contentText,
    rawMetadata: input.rawMetadata,
    provenance: input.provenance,
    retrievedBy: input.actor
  });
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ entities: { Q1103: { id: "Q1103" } } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const result = await sourceRetrievalService.retrieve({ sourceRecordId: "source-1", actor: "provider-adapter-test" });
    assert.equal(requestedUrl, "https://www.wikidata.org/wiki/Special:EntityData/Q1103.json");
    assert.equal(result.snapshot.retrievalUrl, requestedUrl);
  } finally {
    restore();
  }
});

test("Library of Congress retrieval normalizes item canonical URLs to JSON endpoint before fetch", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  const sourceRecord: SourceAuthorityRegistryRecord = {
    sourceRecordId: "source-loc-1",
    provider: "library_of_congress",
    providerRecordId: "https://www.loc.gov/item/2009633130/",
    canonicalUrl: "http://www.loc.gov/item/2009633130/",
    title: "Oldest telephone pioneer with the first telephone",
    description: null,
    sourceType: "library_record",
    origin: {
      provider: "library_of_congress",
      providerRecordId: "https://www.loc.gov/item/2009633130/",
      providerUrl: "http://www.loc.gov/item/2009633130/",
      discoveredFromQuery: "Telephone",
      discoveredAt: new Date().toISOString()
    },
    provenance: {},
    createdBy: "test"
  };

  try {
    const { requestedUrl, result } = await retrieveWithSourceRecord(sourceRecord);
    assert.equal(requestedUrl, "https://www.loc.gov/item/2009633130/?fo=json");
    assert.equal(result.snapshot.retrievalUrl, requestedUrl);
    assert.equal(result.sourceRecord.canonicalUrl, "http://www.loc.gov/item/2009633130/");
  } finally {
    restore();
  }
});

test("Library of Congress retrieval preserves safe query params while forcing fo=json", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  const sourceRecord: SourceAuthorityRegistryRecord = {
    sourceRecordId: "source-loc-query-1",
    provider: "library_of_congress",
    providerRecordId: "https://www.loc.gov/item/2009633130/?sp=1",
    canonicalUrl: "https://www.loc.gov/item/2009633130/?sp=1",
    title: "Oldest telephone pioneer with the first telephone",
    description: null,
    sourceType: "library_record",
    origin: {
      provider: "library_of_congress",
      providerRecordId: "https://www.loc.gov/item/2009633130/?sp=1",
      providerUrl: "https://www.loc.gov/item/2009633130/?sp=1",
      discoveredFromQuery: "Telephone",
      discoveredAt: new Date().toISOString()
    },
    provenance: {},
    createdBy: "test"
  };

  try {
    const { requestedUrl } = await retrieveWithSourceRecord(sourceRecord);
    assert.equal(requestedUrl, "https://www.loc.gov/item/2009633130/?sp=1&fo=json");
  } finally {
    restore();
  }
});

test("Library of Congress retrieval does not normalize non-LOC HTTP URLs into LOC", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  const sourceRecord: SourceAuthorityRegistryRecord = {
    sourceRecordId: "source-non-loc-http-1",
    provider: "library_of_congress",
    providerRecordId: "http://example.org/item/2009633130/",
    canonicalUrl: "http://example.org/item/2009633130/",
    title: "Invalid LOC source",
    description: null,
    sourceType: "library_record",
    origin: {
      provider: "library_of_congress",
      providerRecordId: "http://example.org/item/2009633130/",
      providerUrl: "http://example.org/item/2009633130/",
      discoveredFromQuery: "Telephone",
      discoveredAt: new Date().toISOString()
    },
    provenance: {},
    createdBy: "test"
  };
  let requestedUrl = "";
  (sourceAuthorityRepository as any).requireSourceRecord = async () => sourceRecord;
  (sourceAuthorityRepository as any).getLatestSnapshot = async () => null;
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response("unexpected", { status: 200 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      sourceRetrievalService.retrieve({ sourceRecordId: sourceRecord.sourceRecordId, actor: "provider-adapter-test" }),
      /Source provider URL must use HTTPS/
    );
    assert.equal(requestedUrl, "");
  } finally {
    restore();
  }
});

test("Wikidata and DBpedia retrieval URL normalization remains unchanged", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  const wikidataRecord: SourceAuthorityRegistryRecord = {
    sourceRecordId: "source-wikidata-regression-1",
    provider: "wikidata",
    providerRecordId: "Q1103",
    canonicalUrl: "https://www.wikidata.org/wiki/Q1103",
    title: "Printing press",
    description: null,
    sourceType: "knowledge_base_entity",
    origin: {
      provider: "wikidata",
      providerRecordId: "Q1103",
      providerUrl: "https://www.wikidata.org/wiki/Q1103",
      discoveredFromQuery: "Printing Press",
      discoveredAt: new Date().toISOString()
    },
    provenance: {},
    createdBy: "test"
  };
  const dbpediaRecord: SourceAuthorityRegistryRecord = {
    sourceRecordId: "source-dbpedia-regression-1",
    provider: "dbpedia",
    providerRecordId: "Printing_press",
    canonicalUrl: "https://dbpedia.org/resource/Printing_press",
    title: "Printing press",
    description: null,
    sourceType: "knowledge_base_entity",
    origin: {
      provider: "dbpedia",
      providerRecordId: "Printing_press",
      providerUrl: "https://dbpedia.org/resource/Printing_press",
      discoveredFromQuery: "Printing Press",
      discoveredAt: new Date().toISOString()
    },
    provenance: {},
    createdBy: "test"
  };

  try {
    let retrieval = await retrieveWithSourceRecord(wikidataRecord);
    assert.equal(retrieval.requestedUrl, "https://www.wikidata.org/wiki/Special:EntityData/Q1103.json");
    restore();
    resetSourceProviderHealth();
    setSourceProviderRuntimeStoreForTests(null);
    retrieval = await retrieveWithSourceRecord(dbpediaRecord);
    assert.equal(retrieval.requestedUrl, "https://dbpedia.org/data/Printing_press.json");
  } finally {
    restore();
  }
});
