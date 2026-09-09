# TL-EDITORIAL-EXCELLENCE-001D — Final Live Certification

Date: 2026-09-09

Verdict: **EDITORIAL EXCELLENCE: NOT_CERTIFIED**

## Authorization and safety

Exactly three authorized, previously unpublished topics entered genuine public production intake once each after the UTC intake quota reset:

1. The 1906 San Francisco Earthquake — bounded historical episode;
2. Ada Lovelace: Life and Work — medium-duration biography;
3. The History of the Olympic Games — long-duration historical subject.

Autonomous discovery remained `PAUSED`. No topic was substituted or resubmitted, no manual historical repair or Governance advancement occurred, no threshold changed, and no protected certification artifact or institutional authority boundary was modified.

## Production results

| Topic | Ledger ID | Job ID | Attempts | Candidate | Timeline Quality | Source Authority | Publication |
|---|---|---|---:|---|---|---|---|
| The 1906 San Francisco Earthquake | `a49f43bb5dad83e3cdd0fb8a45c3e5cb350f8080` | `e7f1a8fd71567c0e7eb2e4dc3d821760832dc2c4` | 5 | 16 events persisted | Failed: material omission and date precision | Failed: 16 unresolved issues | None |
| Ada Lovelace: Life and Work | `48c67d96d6f8470c52a39395283041088013379e` | `d132854ea2f3517fe49e2e7e371805633c0ae6c8` | 5 | 6 events persisted | Failed: material omission | Failed: 5 unresolved issues | None |
| The History of the Olympic Games | `aa5c94d2874d78b04c5b6c363ffbff6864967ce3` | `a5c942111e24a942dbb99e8a8d805c462cdf3f10` | 5 | No valid candidate | Planning failed | Not reached | None |

Earthquake attempts comprised one reader failure against the stale priority artifact, one malformed precision/non-event plan, and three further stale reader failures. Ada Lovelace comprised three stale reader failures, one non-event plan, and one coarse-precision plan. Olympic Games comprised scope drift, non-event selection, 22-event over-selection, another non-event plan, and a final plan selecting two non-events.

No topic reached Governance, Historical Library, Published Memory, projection/search, or the public platform. The minimum requirement of two independently publication-worthy public timelines was not met.

## Deployment evidence

The public intake path used `priority-topic-generation-00012-pav`. The final semantic reader interface existed on `autonomous-topic-generation-00018-sum`, with `institutional-transitions-00016-nit`. Both generation exports use the same repository `generationWorker`; the divergence resulted from partial service deployment, not an intentional code-path split.

## Capability conclusion

Fail-closed controls operated correctly, but the run exposed material generation weaknesses:

- selection preceded adequate evidence completion;
- material omissions survived into persisted candidates;
- unsupported selected events produced large Source Authority failure sets;
- the planner repeatedly drifted scope, selected non-events, or treated the schema maximum as an event-count target.

The subsequent read-only architecture audit selected Strategy C: selectively adopt Factory V2 evidence-first knowledge completion and comparative selection inside the deployed generation path while preserving the certified institutional architecture. Strategy C has not been implemented.

No further live Editorial Excellence certification is authorized before Evidence-First Generation completes its required shadow certification. Autonomous discovery remains `PAUSED`.
