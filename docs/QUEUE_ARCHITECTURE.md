# Production queue and realtime architecture

Postgres remains the durable job ledger. Redis/BullMQ is an optional execution backend enabled only by explicit configuration.

## Drivers

| `QUEUE_DRIVER` | Behavior |
| --- | --- |
| `database` (default) | Jobs land in `job_queue`; Coolify cron `POST /api/jobs/process` + Next.js `after()` for interactive Maps |
| `bullmq` | Requires `REDIS_URL`. App enqueues to BullMQ after writing the ledger row. Dedicated workers process queues |

Never infer the driver from a successful Redis ping. Misconfiguration with `QUEUE_DRIVER=bullmq` and a missing `REDIS_URL` keeps the ledger row in `enqueue_state=enqueue_failed` for recovery.

### Enqueue contract

1. Insert Postgres `job_queue` row (tenant ids, idempotency key, priority, payload).
2. Hand off to the configured driver.
3. Mark `enqueue_state` (`enqueued` / `enqueue_failed`).
4. Return the durable job id to the API client.

## Queues

| Queue | Purpose |
| --- | --- |
| `maps-scan` | Parent grid scans |
| `maps-cell-retry` | Failed-cell retry bursts |
| `review-campaign` | Campaign sends |
| `review-import` | Contact / review imports |
| `review-monitor` | New-review monitoring |
| `backlink-gap` | Backlink Gap audits |
| `local-trust` | Local Trust audits |
| `ai-visibility` | AI Visibility runs |
| `report-generation` | Report / PDF exports |
| `notifications` | Transactional notifications |
| `maintenance` | Retention, reconciliation |

Each queue has concurrency, limiter, retry, and timeout settings in `src/lib/queue/config.ts` (overridable by env).

## Coolify services

Deploy the same image/repo with different start commands:

| Service | Start command |
| --- | --- |
| Web | `npm run start` |
| Maps worker | `npm run worker:maps` |
| Messaging worker | `npm run worker:messaging` |
| Intelligence worker | `npm run worker:intelligence` |
| Report worker | `npm run worker:reports` |
| Redis | Coolify managed Redis → set private `REDIS_URL` |

Flip production with:

```bash
QUEUE_DRIVER=bullmq
REDIS_URL=redis://...
# optional but recommended with Redis available:
CACHE_DRIVER=redis
LOCK_DRIVER=redis
```

Then restart web + all worker services. Existing database-driver jobs continue via recovery/`job_queue`; new work uses BullMQ.

### BullMQ cutover checklist

1. Deploy Redis and set private `REDIS_URL` on web + every worker.  
2. Deploy worker services (`worker:maps`, `worker:messaging`, `worker:intelligence`, `worker:reports`) before flipping the driver.  
3. Set `QUEUE_DRIVER=bullmq` on web + workers; leave Coolify cron on `/api/jobs/process` (recovery + drains only).  
4. Smoke: create a Maps scan, Local Trust run, and campaign drip; confirm `/admin/ops` shows pending→running→completed and Redis ping ok.  
5. Confirm no web process monopolizes Bright Data (workers hold in-flight).  
6. Rollback: set `QUEUE_DRIVER=database`, restart web; workers become idle; cron resumes claiming.

## Bright Data global limits

Cross-tenant limits (Redis-backed when `REDIS_URL` is set):

- `BRIGHTDATA_GLOBAL_START_RATE_PER_SEC` (default `80`)
- `BRIGHTDATA_GLOBAL_MAX_IN_FLIGHT` (default `250`)
- `BRIGHTDATA_FAIR_CHUNK_SIZE` (default `25`) — fair bursts so one 225-cell scan cannot monopolize capacity

## Per-tenant Maps fairness

- `MAX_ACTIVE_MAPS_SCANS_PER_ORG` (default `3`)
- `MAX_QUEUED_MAPS_SCANS_PER_ORG` (default `10`)
- Duplicate equivalent scans (same business / keyword / grid / radius) return HTTP `409`

## Frontend updates

- Shared adaptive poller: `useActiveJobStatus` → `GET /api/jobs/[jobId]/status`
- Scan SSE (authz via `requireScanAccess`): `GET /api/scans/[scanId]/events`
- Prefer Supabase Realtime for postgres_changes when channels are RLS-safe (`REALTIME_TRANSPORT`)
- Dashboards should refresh on focus/navigation, not forever-poll every widget

## Recovery

Cron (`/api/jobs/process`) always:

- Recovers `enqueue_failed` ledger rows when BullMQ is configured
- Reclaims stale scan leases / running job rows
- Drains campaign/alert side work until those queues are fully migrated

Under `QUEUE_DRIVER=bullmq`, cron does **not** claim `job_queue` rows for execution (workers own them).

## Feature coverage

All heavy product work is dispatched through `dispatchFeatureJob` / `@/lib/queue`:

| Product surface | Job type | Queue |
| --- | --- | --- |
| Maps scans (+ enrich, difficulty cells via scan) | `process_scan`, `scan_enrichment` | `maps-scan` |
| Review contact import | `import_contacts` | `review-import` |
| Review campaign sends | `campaign_send_batch` (cron drain) | `review-campaign` |
| New-review alerts | `review_alert_scan` (cron drain) | `review-monitor` |
| Review momentum | `review_momentum_run` | `review-monitor` |
| Reputation audit | `reputation_audit` | `review-monitor` |
| Local Trust (+ sponsorships) | `local_trust_run` | `local-trust` |
| Backlink Gap | `backlink_gap_run` | `backlink-gap` |
| AI Visibility | `ai_visibility_run` | `ai-visibility` |
| Citations | `citation_audit` | `maintenance` |
| Growth Audit (+ extended modules) | `growth_audit_run`, `growth_audit_extended` | `maintenance` |
| Reports (optional async) | `generate_report` | `report-generation` |

Interactive one-off SMS/email review sends and CSV report downloads stay synchronous (user is waiting on the response). Provider webhooks remain request handlers that update Postgres idempotently.

## Feature code rule

Call `@/lib/queue` (`dispatchFeatureJob`, `enqueueJob`, …). Do not import BullMQ or insert into `job_queue` from feature routes.
