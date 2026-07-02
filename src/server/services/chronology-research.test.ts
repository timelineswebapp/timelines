import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessSourceRelevance,
  buildHistoricalDiscoveryQueries
} from "@/src/server/services/source-discovery-service";
import { normalizeStructuredSourceText } from "@/src/server/services/corpus-generation-service";

describe("chronology research quality", () => {
  it("rejects an exact-title creative-work homonym generically", () => {
    const result = assessSourceRelevance("Telephone", {
      provider: "wikidata",
      providerRecordId: "Q188770",
      canonicalUrl: "https://www.wikidata.org/wiki/Q188770",
      title: "Telephone",
      description: "2010 single by Lady Gaga featuring Beyoncé",
      sourceType: "knowledge_base_entity",
      originUrl: "https://www.wikidata.org/wiki/Q188770",
      raw: {}
    });
    assert.equal(result.accepted, false);
    assert.match(result.semanticMismatch || "", /creative work type/);
  });

  it("keeps the correct device entity eligible and includes a bounded history query", () => {
    const result = assessSourceRelevance("Telephone", {
      provider: "wikidata",
      providerRecordId: "Q11035",
      canonicalUrl: "https://www.wikidata.org/wiki/Q11035",
      title: "telephone",
      description: "telecommunications device that permits users to conduct a conversation",
      sourceType: "knowledge_base_entity",
      originUrl: "https://www.wikidata.org/wiki/Q11035",
      raw: {}
    });
    assert.equal(result.accepted, true);
    const queries = buildHistoricalDiscoveryQueries("Telephone");
    assert.deepEqual(queries, ["Telephone", "Telephone history"]);
    assert.ok(queries.length <= 4);
  });

  it("normalizes Wikidata claims without treating revision metadata as history", () => {
    const normalized = normalizeStructuredSourceText(JSON.stringify({
      entities: {
        Q1: {
          modified: "2026-06-24T16:35:22Z",
          labels: { en: { value: "telephone" } },
          descriptions: { en: { value: "telecommunications device" } },
          claims: {
            P571: [{
              mainsnak: { datavalue: { value: { time: "+1876-03-10T00:00:00Z" } } }
            }]
          }
        }
      }
    }), "application/json", "wikidata");
    assert.match(normalized, /Label: telephone/);
    assert.match(normalized, /telephone inception: 1876-03-10/);
    assert.doesNotMatch(normalized, /2026-06-24/);
    assert.doesNotMatch(normalized, /"entities"/);
  });

  it("normalizes DBpedia abstracts and chronological properties into claims", () => {
    const normalized = normalizeStructuredSourceText(JSON.stringify({
      "http://dbpedia.org/resource/Telephone": {
        "http://dbpedia.org/ontology/abstract": [{ lang: "en", value: "The telephone is a telecommunications device." }],
        "http://dbpedia.org/property/introduced": [{ value: "1876" }],
        "http://dbpedia.org/ontology/wikiPageRevisionID": [{ value: "12345" }]
      }
    }), "application/json", "dbpedia");
    assert.match(normalized, /Description of Telephone/);
    assert.match(normalized, /introduced: 1876/);
    assert.doesNotMatch(normalized, /RevisionID|12345|dbpedia\\.org/);
  });

  it("does not return serialized structured payloads when no historical claim exists", () => {
    const normalized = normalizeStructuredSourceText(JSON.stringify({
      "http://dbpedia.org/resource/Unrelated": {
        "http://dbpedia.org/ontology/wikiPageWikiLink": [{
          type: "uri",
          value: "http://dbpedia.org/resource/Telephone"
        }]
      }
    }), "application/json", "dbpedia");
    assert.equal(normalized, "Structured dbpedia record contains no extractable historical claims.");
  });
});
