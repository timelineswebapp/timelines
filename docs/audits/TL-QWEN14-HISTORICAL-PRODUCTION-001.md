# TL-QWEN14-HISTORICAL-PRODUCTION-001

Date: 2026-06-22

## Result

Status: PASS_WITH_GAPS

Qwen14 execution now reliably produced valid Factory historical candidate outputs for the acceptance worker set in this environment, using `QWEN14_MODEL=qwen3:14b`.

The persisted execution transcript is:

- `docs/audits/TL-QWEN14-HISTORICAL-PRODUCTION-001.json`

## Prompt Strategy

The provider now uses compact JSON-only instructions, disables Qwen thinking with `/no_think`, rejects empty JSON objects, and injects a compact schema contract instead of the full JSON schema. Worker-specific prompts now define required historical payloads for source discovery, object extraction, milestone extraction, and relationship extraction.

## Live Validation Summary

Subject: History of the Suez Canal

| Worker | Result | Candidate | Sources | Evidence | Duration |
| --- | --- | --- | ---: | ---: | ---: |
| source_discovery_worker | PASS | International Commission on the Suez Canal Historical Records | 1 | 1 | 40282 ms |
| object_extraction_worker | PASS | Suez Canal Construction (1859-1869) | 2 | 2 | 53109 ms |
| milestone_extraction_worker | PASS | Opening of the Suez Canal | 1 | 1 | 43813 ms |
| relationship_extraction_worker | PASS | Ferdinand_de_Lesseps_influences_Suez_Canal | 1 | 1 | 43114 ms |

## Validation Result

- JSON parsed successfully.
- Empty object output rejected.
- Empty candidate/source/evidence arrays rejected.
- Source candidate payload validation passed.
- Historical object payload validation passed.
- Milestone chronology payload validation passed.
- Relationship endpoint/type payload validation passed.
- Source attribution validation passed.
- Evidence citation validation passed.

## Failure Classifications Addressed

- Empty JSON object: provider now throws before persistence.
- Malformed JSON: runtime and probe retry through worker retry policy.
- Missing evidence citations: schema and prompt now require `evidence[].citations[]`.
- Text confidence where numeric required: prompt now requires numeric top-level confidence.
- Truncated JSON from over-generation: worker prompts now request compact one-candidate outputs by default.

## Successful Candidate Example

```json
{
  "title": "Opening of the Suez Canal",
  "objectType": "candidate_milestone",
  "payload": {
    "date": "1869-11-17",
    "datePrecision": "day",
    "summary": "The Suez Canal was inaugurated on November 17, 1869, marking the first major artificial waterway to connect the Mediterranean and Red Seas.",
    "sourceRefs": ["source_1"]
  },
  "evidence": [
    {
      "claim": "The Suez Canal was officially opened on November 17, 1869.",
      "citations": [
        {
          "sourceId": "source_1",
          "title": "History of the Suez Canal"
        }
      ]
    }
  ]
}
```

## Remaining Weaknesses

1. Local 14B generation latency is high: roughly 40-53 seconds per worker for compact outputs.
2. The available local model is `qwen3:14b`; the provider default remains `qwen2.5:14b`, so production execution must set `QWEN14_MODEL` or install the default model.
3. The probe validates generation quality but does not prove database-backed Factory package persistence because this environment still lacks `DATABASE_URL`.
4. Editorial and governance-ready package creation require a writable database for full lifecycle execution.

## Final Determination

Qwen generation quality is now sufficient for Factory validation testing of one object, one milestone, one source, and one relationship. End-to-end institutional certification should be retried after configuring database persistence.
