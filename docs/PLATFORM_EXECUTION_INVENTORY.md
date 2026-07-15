# Platform execution inventory

Audit of meaningful operations (Phase 1). Classification key:

1. lightweight interactive  
2. background queued  
3. provider webhook  
4. scheduled enqueue/discovery  
5. realtime status update  
6. expensive database  
7. maintenance  

Status: **queued** = uses `dispatchFeatureJob` / ledger; **in-request** = still blocks HTTP; **void** = fire-and-forget; **cron-side** = Coolify `/api/jobs/process`.

## Platform spine

| Feature | Trigger | Where | Blocks HTTP | Provider | Class | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Cron drain | `POST /api/jobs/process` | cron web | cron | multi | 4,7 | cron-side |
| BullMQ workers | `scripts/workers/run-worker.ts` | worker | n/a | multi | 2 | queued |
| Job status | `GET /api/jobs/[jobId]/status` | request | light | none | 1,5 | in-request |
| Adaptive poller | `useActiveJobStatus` | client | n/a | none | 5 | polling |
| Retention | `maybeRunDataRetentionCleanup` | cron/worker | no | none | 7 | cron-side |

## Maps

| Feature | Trigger | Where | Blocks | Provider | Class | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Create / keyword / parity / rerun | scan APIs → `dispatchScanProcessing` | after/cron/worker | no | Bright Data | 2 | queued |
| Audit reprocess | `POST /api/audits/run` | queue | no | Bright Data | 2 | queued |
| Grid cells | `processScanBatch` | worker | no | Bright Data | 2,6 | queued |
| Enrichment | finalize + enrich route | queue | no | DeepSeek | 2 | queued |
| Early enrichment | during scan | **void** | no | ScrapingDog/DFS | 2 | **void → fixing** |
| DFS webhook | `/api/webhooks/dataforseo` | request | yes | DFS | 3 | webhook |
| Status / SSE / progress | scan GET APIs | request | light | none | 1,5 | in-request |
| Weekly schedules | SQL `process_due_scheduled_scans` | pg_cron (optional) | n/a | none | 4 | legacy SQL + reconcile |
| Maps KD | `POST /api/maps-difficulty/run` | **request** | **yes** | ScrapingDog/DFS | 2 | **in-request → fixing** |
| Keyword check/volume | `/api/keywords/{check,volume}` | **request** | **yes** | BD/DFS | 2 | **in-request → fixing** |
| Single-point rank | `/api/single-point-rank/check` | **request** | **yes** | BD/DFS | 2 | **in-request → fixing** |

## Intelligence product modules

| Feature | Trigger | Class | Status |
| --- | --- | --- | --- |
| Local Trust (+ sponsorships) | `/api/trust/run` | 2 | queued |
| Backlink Gap | `/api/backlink-gap/run` | 2 | queued |
| AI Visibility | `/api/ai-visibility/run` | 2 | queued |
| Citations | `/api/citations/run` | 2 | queued |
| Reputation audit | `/api/reputation/run` | 2 | queued |
| Review momentum | `/api/reviews/momentum/run` | 2 | queued |
| Growth Audit + extended | `/api/growth-audit/run` | 2 | queued |
| GBP audit modules | `/api/audits/modules` | 2 | in-request (borderline) |
| AI prompt / reply generate | prompt & response generate | 2 | in-request (interactive LLM) |

## Reviews / messaging

| Feature | Trigger | Class | Status |
| --- | --- | --- | --- |
| Campaign create | campaigns API | 1 | in-request (schedules rows) |
| Campaign send drain | cron → `campaign_send_batch` | 2,4 | queued |
| Review alerts | cron → `review_alert_scan` | 2,4 | queued |
| Contact import large | contacts/import | 2 | queued |
| Contact import small | contacts/import | 1 | in-request |
| One-off SMS/email | send-sms / send-email | 1 | sync (user waits) |
| Twilio / Brevo webhooks | webhooks | 3 | in-request idempotent |

## Reports

| Feature | Trigger | Class | Status |
| --- | --- | --- | --- |
| HTML/CSV export | `/api/reports/export` | 1/6 | in-request (generator registered for async) |

## Gaps vs platform brief

1. Central job lifecycle columns incomplete vs Part 2 (parent_job_id, lease, units, worker_id, error classes) → migration 045  
2. No `src/lib/cache` / `src/lib/locks` packages → Phase 1 abstractions  
3. Provider calls mostly via `src/lib/providers/*` but messaging + Maps KD bypass → gateway registry  
4. Dashboard polls load full modules every 3s instead of shared job status client  
5. Cost ledger not unified  
6. Admin ops console not built (Phase 7)  
7. Summary read-models incomplete (Phase 4)  

See `docs/PLATFORM_ARCHITECTURE.md` for phased rollout against the 27-part brief.
