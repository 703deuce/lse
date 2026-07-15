# Platform-wide production architecture

This is the consolidation plan for treating Maps, Reviews, Backlink Gap, Local Trust, AI Visibility, Growth Audit, reports, notifications, and maintenance as **one execution system**.

Inventory: [`PLATFORM_EXECUTION_INVENTORY.md`](./PLATFORM_EXECUTION_INVENTORY.md)  
Queue ops: [`QUEUE_ARCHITECTURE.md`](./QUEUE_ARCHITECTURE.md)

## Non-negotiables

1. Postgres is the durable job + result source of truth.  
2. Feature code calls shared platform APIs only (`dispatchFeatureJob`, provider gateways, cache, locks).  
3. `QUEUE_DRIVER` / `CACHE_DRIVER` / `LOCK_DRIVER` / `REALTIME_TRANSPORT` are **explicit** — never inferred from a Redis ping.  
4. Expensive work never blocks interactive HTTP once migrated.  
5. Tenant ownership is re-verified in workers from Postgres, not trusted from queue payloads alone.  
6. Processors are idempotent (at-least-once delivery).  

## Drivers

| Env | Values | Default |
| --- | --- | --- |
| `QUEUE_DRIVER` | `database` \| `bullmq` | `database` |
| `CACHE_DRIVER` | `none` \| `memory` \| `redis` | `none` |
| `LOCK_DRIVER` | `memory` \| `redis` | `memory` (uses Redis when `REDIS_URL` + driver=redis) |
| `REALTIME_TRANSPORT` | `auto` \| `supabase` \| `sse` \| `polling` | `auto` |
| `REDIS_URL` | private Coolify Redis URL | unset |

## Logical queues (worker profiles)

Physical queue names in code map to worker start commands:

| Logical (brief) | Code queue | Worker |
| --- | --- | --- |
| maps.manual / maps.scheduled | `maps-scan` | `worker:maps` |
| maps.retry | `maps-cell-retry` | `worker:maps` |
| reviews.campaign.* | `review-campaign` | `worker:messaging` |
| contacts.import | `review-import` | `worker:messaging` |
| reviews.monitor | `review-monitor` | `worker:intelligence` |
| backlinks.analysis | `backlink-gap` | `worker:intelligence` |
| local-trust.discovery | `local-trust` | `worker:intelligence` |
| ai-visibility | `ai-visibility` | `worker:intelligence` |
| growth-audit | `maintenance` (growth job types) | `worker:intelligence` |
| reports.* | `report-generation` | `worker:reports` |
| notifications.* | `notifications` | `worker:messaging` |
| maintenance | `maintenance` | `worker:intelligence` |

Fine-grained priority is carried on the job (`priority` + `job_type`), not by spawning dozens of Redis queues on day one.

## Shared modules

| Module | Path | Role |
| --- | --- | --- |
| Queue API | `src/lib/queue/*` | enqueue, dispatch, ledger, drivers |
| Job lifecycle | `src/lib/platform/job-lifecycle.ts` | status vocabulary + transitions |
| Provider gateway | `src/lib/providers/gateway.ts` | single entry + health/cost hooks |
| Cache | `src/lib/cache/*` | none / memory / redis |
| Locks | `src/lib/locks/*` | lease-based semaphores |
| Realtime | `src/lib/realtime/*` | transport selection |
| Active job UI | `src/components/jobs/use-active-job-status.ts` + `use-module-job-runner.ts` | deduped adaptive polling |
| Usage ledger | `src/lib/platform/usage-ledger.ts` | cost/usage append API |
| Feature summaries | `src/lib/platform/summaries.ts` | compact post-job snapshots + cache |
| DB op limiter | `src/lib/platform/db-limiter.ts` | caps concurrent hot DB writes |
| Admin ops | `/admin/ops` + `/api/admin/ops/*` | queue/provider console |

## Rollout phases (brief Part 27)

| Phase | Scope | Status in this PR |
| --- | --- | --- |
| 1 | Inventory + shared interfaces | **Done** |
| 2 | Harden database driver (leases, DLQ, org limits) | **Done** (scan + job leases, dead_letter, active/queued fairness 429, enqueue recovery) |
| 3 | All heavy features behind abstraction | **Done** for heavy work; tiny interactive LLM still sync by design |
| 4 | DB efficiency / summaries / indexes | **Done** (migration 046 + summary rebuild); deep EXPLAIN audit optional |
| 5 | Frontend shared status everywhere | **Done** (module runners + Maps KD + keyword check/volume) |
| 6 | Redis/BullMQ + cache/lock redis drivers | Drivers present; Coolify flip is ops (see QUEUE_ARCHITECTURE) |
| 7 | Admin console + mixed load tests | **Done** (ops + cost-by-org + CI mixed-load invariants); prod soak = ops checklist |

## Coolify services

Same repo, different start commands (see `package.json`):

- Web: `npm run start`  
- Maps: `npm run worker:maps`  
- Messaging: `npm run worker:messaging`  
- Intelligence: `npm run worker:intelligence`  
- Reports: `npm run worker:reports`  

Scheduler remains Coolify cron → `/api/jobs/process` (discover + recover + enqueue drains — not heavy work).

## Definition of complete (tracking)

Track against Part 27 of the brief. Do not mark architecture complete until mixed-load tests pass with no lost jobs, duplicate sends, tenant leaks, or provider-limit violations.
