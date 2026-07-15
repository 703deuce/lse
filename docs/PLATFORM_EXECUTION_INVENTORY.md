# Platform execution inventory

Audit of meaningful operations. Classification key:

1. lightweight interactive  
2. background queued  
3. provider webhook  
4. scheduled enqueue/discovery  
5. realtime status update  
6. expensive database  
7. maintenance  

Status: **queued** = uses `dispatchFeatureJob` / ledger; **in-request** = still blocks HTTP; **webhook** = provider callback; **cron-side** = Coolify `/api/jobs/process`.

## Platform spine

| Feature | Trigger | Where | Blocks HTTP | Provider | Class | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Cron drain | `POST /api/jobs/process` | cron web | cron | multi | 4,7 | cron-side (recover + drains; no claim under BullMQ) |
| BullMQ workers | `scripts/workers/run-worker.ts` | worker | n/a | multi | 2 | queued |
| Job status | `GET /api/jobs/[jobId]/status` | request | light | none | 1,5 | in-request |
| Adaptive poller | `useActiveJobStatus` / `useModuleJobRunner` | client | n/a | none | 5 | polling |
| Retention | `maybeRunDataRetentionCleanup` | cron/worker | no | none | 7 | cron-side |
| Admin ops | `/admin/ops` | request | light | none | 1,7 | in-request |
| Usage / cost ledger | `usage_ledger` + `/api/admin/ops/usage` | request/worker | no | multi | 7 | append on provider success |

## Maps

| Feature | Trigger | Status |
| --- | --- | --- |
| Create / keyword / parity / rerun | scan APIs → `dispatchScanProcessing` | queued |
| Grid cells | `processScanBatch` | queued |
| Enrichment | finalize → `scan_enrichment` | queued |
| Early enrichment | progress ≥ 17 cells → `early_enrichment` | queued |
| Maps KD | `POST /api/maps-difficulty/run` | queued (+ UI job poll) |
| Keyword check/volume | `/api/keywords/{check,volume}` | queued (+ UI job poll) |
| Single-point rank | `/api/single-point-rank/check` | queued (handler registered) |
| Status / SSE / progress | scan GET APIs | in-request light |
| Fairness | active + queued org caps | HTTP 429 when over cap |

## Intelligence product modules

| Feature | Status |
| --- | --- |
| Local Trust, Backlink Gap, AI Visibility, Citations, Reputation, Review momentum, Growth Audit | queued + `useModuleJobRunner` |
| GBP audit modules (`/api/audits/modules`) | still in-request (borderline; follow-up) |
| Tiny interactive LLM generates | in-request by design |

## Reviews / messaging

| Feature | Status |
| --- | --- |
| Campaign send drain / review alerts | queued (cron enqueue) |
| Contact import large | queued |
| One-off SMS/email | sync (user waits); usage ledger on success |
| Twilio / Brevo | `fetchWithTimeout` + optional `trackProviderUsage` |

## Reports

| Feature | Status |
| --- | --- |
| HTML/CSV export | primarily in-request; async generator registered |

## Closed vs brief gaps

1. ~~Lifecycle columns~~ — migration 045 + lease reclaim + dead_letter  
2. ~~Cache / locks~~ — `src/lib/cache`, `src/lib/locks`  
3. ~~Provider gateway for messaging / KD~~ — timeout + usage hooks wired  
4. ~~Dashboard 3s full reload~~ — shared job runner on module tools  
5. ~~Cost ledger~~ — append API + admin cost-by-org view  
6. ~~Admin ops~~ — `/admin/ops`  
7. ~~Summaries~~ — migration 046 + rebuild on complete  

Remaining ops: Coolify `QUEUE_DRIVER=bullmq` flip + workers; full soak load against prod-like Redis/Postgres; optional GBP module queue migration.

See `docs/PLATFORM_ARCHITECTURE.md` and `docs/QUEUE_ARCHITECTURE.md`.
