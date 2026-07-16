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

Canonical names live in `JOB_QUEUES` / `ALL_QUEUE_NAMES` (`src/lib/queue/types.ts`).
**BullMQ queue names must never contain `:`** — BullMQ uses `:` as an internal Redis key separator.

| Queue name (no colon) | Purpose | Worker |
| --- | --- | --- |
| `maps-scan` | Parent grid scans | `worker:maps` |
| `maps-cell-retry` | Failed-cell retry bursts | `worker:maps` |
| `review-campaign` | Campaign drain — enqueue due email/sms jobs | `worker:messaging` |
| `email-send` | Brevo campaign email delivery | `worker:messaging` |
| `sms-send` | Twilio campaign SMS delivery | `worker:messaging` |
| `review-import` | Contact CSV / webhook imports | `worker:messaging` |
| `review-monitor` | New-review monitoring | `worker:messaging` |
| `backlink-gap` | Backlink Gap audits | `worker:intelligence` |
| `local-trust` | Local Trust audits | `worker:intelligence` |
| `ai-visibility` | AI Visibility runs | `worker:intelligence` |
| `report-generation` | Report / PDF exports | `worker:reports` |
| `notifications` | Transactional notifications | `worker:messaging` |
| `maintenance` | Retention, reconciliation | `worker:intelligence` |

### Campaign send path (BullMQ)

```
Cron /api/jobs/process
  → campaign_send_batch (review-campaign)
  → enqueueDueCampaignMessages()
  → send_campaign_email / send_campaign_sms
  → claim → provider throttle → Brevo/Twilio → mark sent → advance sequence
```

Cron must not call providers. The messaging worker owns Twilio/Brevo.

`QUEUE_PREFIX` (default `lse`) is passed as BullMQ's `prefix` option — **not** concatenated into the queue name. Wrong: `new Worker("lse:maps-scan")`. Right: `new Worker("maps-scan", { prefix: "lse" })`.

Helpers: `resolveBullmqQueueIdentity()` / `assertValidBullmqQueueName()` in `src/lib/queue/bullmq-names.ts`.

Each queue has concurrency, limiter, retry, and timeout settings in `src/lib/queue/config.ts` (overridable by env).

### If workers crashed with `Queue name cannot contain :`

That was the old `${QUEUE_PREFIX}:${queueName}` bug. After deploying the fix:

1. Keep web on `QUEUE_DRIVER=database` until a worker stays healthy.
2. Redeploy workers; logs should show `listening on name=maps-scan prefix=lse ...`.
3. Optional Redis cleanup (only if anything was enqueued under the bad names):

```bash
# Inspect (read-only)
redis-cli -u "$REDIS_URL" --scan --pattern 'bull:lse:*'
redis-cli -u "$REDIS_URL" --scan --pattern 'lse:*:*'

# Only if web stayed on database and workers never processed work, it is
# safe to delete orphaned keys from the broken naming attempt:
# redis-cli -u "$REDIS_URL" --scan --pattern 'bull:lse:*' | xargs -r redis-cli -u "$REDIS_URL" DEL
```

With web on `database` and workers crash-looping before this fix, there are normally **no** production BullMQ jobs to migrate — recover via Postgres `job_queue` / cron instead.

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
REDIS_URL=redis://...   # private Coolify hostname, not a public IP
QUEUE_PREFIX=lse
# optional but recommended with Redis available:
CACHE_DRIVER=redis
LOCK_DRIVER=redis
```

Workers use indefinite Redis reconnect + TCP keepalive. A single `ETIMEDOUT`
during deploy is normal; repeated timeouts in steady state mean network/host
misconfiguration.

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

- `BRIGHTDATA_GLOBAL_START_RATE_PER_SEC` (default `100`) — how many SERP calls may *start* per second
- `BRIGHTDATA_GLOBAL_MAX_IN_FLIGHT` (default `250`) — open requests across all workers
- `BRIGHTDATA_FAIR_CHUNK_SIZE` / `BRIGHTDATA_GRID_BATCH_SIZE` (default `100`) — max cells one scan launches per wave / in-scan `pLimit`

## Messaging provider limits

Same Redis pattern for campaign delivery:

- `TWILIO_GLOBAL_START_RATE_PER_SEC` (default `5`)
- `TWILIO_GLOBAL_MAX_IN_FLIGHT` (default `20`)
- `BREVO_GLOBAL_START_RATE_PER_SEC` (default `20`)
- `BREVO_GLOBAL_MAX_IN_FLIGHT` (default `40`)

BullMQ concurrency defaults: `email-send` = 15, `sms-send` = 10 (env-overridable).

A lone 7×7 (49) or 10×10 (100) starts all cells in one wave. Two simultaneous 7×7s both schedule ~49 workers; the Redis global limiter shares starts/in-flight so neither waits for the other job’s whole grid to finish. Grids larger than 100 cells go in waves of 100.

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
| Review campaign drain | `campaign_send_batch` (cron enqueue) | `review-campaign` |
| Review campaign email | `send_campaign_email` | `email-send` |
| Review campaign SMS | `send_campaign_sms` | `sms-send` |
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
