# Production-readiness audit

**Date:** 2026-07-14  
**Scope:** Multi-tenant Local SEO / Maps Growth SaaS (`/workspace`)  
**Standard:** Remain correct, secure, understandable, and affordable when requests overlap, providers fail, users refresh, and many customers run heavy jobs at once.

This audit follows the requested priority order. Findings are ranked **CRITICAL / HIGH / MEDIUM**. File paths are repo-relative.

---

## Executive summary

| Area | Status |
|------|--------|
| App-layer business access (`requireBusinessAccess`) | Mostly present on APIs |
| RLS as tenancy backstop | **Not production-ready** — widespread `USING (true)` |
| Mid-scan crash recovery (49-cell) | **No resume** — stuck in `provider_running` |
| Cell upsert + soft-ready finalize claims | Solid foundation |
| External timeouts / circuit breakers | Incomplete |
| Billing / usage atomics | Race-prone; SMS/email caps unused |
| Observability | Console logs only; no Sentry / correlation IDs |
| Frontend polling | Poll cleanup mixed; grid-scan can storm |
| Backups / retention / load tests | Not evidenced in repo |

**Answer to “What happens if the server dies halfway through a 49-cell scan?”**

- Completed cells remain (per-cell upsert + unique index, migration `030`).
- Batch stays `dispatching` / `provider_running`.
- `kickQueuedScanIfNeeded` only restarts **`queued`** batches (`src/lib/jobs/schedule-scan.ts`) — it does **not** reclaim in-flight work.
- Soft-ready / finalize never run → map may never become `rank_ready`.
- Credits were already charged at create time for the full grid.
- No lease/heartbeat — restart alone does not finish the scan.

---

## 1. Authorization and tenant isolation

### What’s solid

- Central helpers: `requireBusinessAccess` / `requireScanAccess` (`src/lib/auth/api-auth.ts`) used on most tenant APIs.
- Many mutations re-scope with `.eq("business_id", …)`.
- SSR pages that load data often use `getBusiness(id, auth.organizationId)`.
- Admin gated by `ADMIN_EMAILS` (`src/lib/auth/admin.ts`).
- Dev bypass gated to development (`src/lib/auth/dev.ts`).

### CRITICAL

| ID | Finding | Evidence |
|----|---------|----------|
| A1 | RLS policies named `service_role_all` use `USING (true)` **without** `TO service_role` — effectively open to any role that hits PostgREST if anon/authenticated keys are usable | Migrations `001`, `016`, `021`, `022`, `025`, `028`, etc. |
| A2 | `/api/jobs/process` fails open when `CRON_SECRET` unset — anyone can drain `job_queue` / campaign sends | `src/app/api/jobs/process/route.ts` |
| A3 | Unauthenticated DataForSEO webhook can call `processProviderTaskResult` and write scan results | `src/app/api/webhooks/dataforseo/route.ts`; middleware public `/api/webhooks/` |
| A4 | IDOR: `toggleActionItem(itemId)` and `updateBusinessSettings(businessId)` only `requireAuth()` then service-role update by id | `src/lib/actions/mutations.ts` |
| A5 | `/dev/**` is public in middleware; some preview pages use service role against live DB without production guard | `src/middleware.ts`, `src/app/dev/**` |

### HIGH

| ID | Finding | Evidence |
|----|---------|----------|
| A6 | Child-resource IDOR after business check: opportunity update by id without proving opportunity belongs to that business | `api/backlink-gap/opportunity/update` → `updateOpportunityStatus(id)` |
| A7 | Report export checks business access but report generator loads scan by id without asserting `scan_batches.business_id === businessId` | `lib/reporting/generate-report.ts` |
| A8 | Core product tables (`scan_batches`, `scan_results`, reviews, reports, jobs) lack member-scoped RLS; `029` only tightened org/business/usage | `029_auth_plans_multitenant.sql` |
| A9 | `merge_scan_confidence_summary` granted to `authenticated` with no ownership check inside | `032_scan_confidence_merge.sql` |
| A10 | Brevo inbound verify fails open if secret unset; Twilio SMS webhook lacks signature validation | `api/webhooks/brevo/inbound`, `api/webhooks/twilio/sms` |

### MEDIUM

| ID | Finding |
|----|---------|
| A11 | Middleware skips **all** `/api/*` — new routes can ship without auth by mistake |
| A12 | Share report URLs are permanent capability tokens (strong entropy, no expiry/revoke) |
| A13 | `/api/maps/config` returns Maps key unauthenticated (OK only with strict HTTP-referrer restrictions) |
| A14 | Admin is email allowlist only (no DB role / MFA) |

### Remediation priority (auth)

1. Drop open `USING (true)` policies; add org/member policies for scans, results, reviews, reports, jobs; keep service role for workers only.
2. Fail-closed secrets for cron + all webhooks; verify Twilio / DataForSEO.
3. Close IDORs: scope every mutation by `(organizationId, businessId, resourceId)`.
4. Default-deny API wrapper; allowlist only webhooks/cron/maps.
5. Gate `/dev/**` in production; add share-token expiry/revocation.

---

## 2. Background-job reliability

### What’s solid

- Atomic claims for scan start, finalize, enrichment, campaign send (`process-scan`, `finalize-scan`, `031`, `032`).
- Per-cell upsert idempotency (`030_scan_results_unique.sql`).
- Soft-ready + finalize claim avoid double-finalize.
- Campaign stale `sending` reclaim exists (`031` + campaign processor) — **pattern to copy for scans**.

### CRITICAL

| ID | Finding | Evidence |
|----|---------|----------|
| J1 | No stuck recovery / heartbeat for `provider_running` scans | `kickQueuedScanIfNeeded` only `queued`; no lease columns |
| J2 | `job_queue` retry can mark scan `failed` while requeueing the job; `processScanBatch` only claims `queued` → retry is a no-op | `src/lib/jobs/queue.ts`, `process-scan.ts` |

### HIGH

| ID | Finding |
|----|---------|
| J3 | No DLQ beyond `failed`; no stale `job_queue.running` reclaim; no jittered `scheduled_at` backoff |
| J4 | Interactive scans depend on Next.js `after()` — not a durable worker with leases across deploys |
| J5 | Mid-failure with some saved cells but below soft-ready threshold → stuck, not “partial ready” |

### Target lifecycle answers

| Question | Today |
|----------|--------|
| Stuck jobs detected? | Campaigns: yes. Scans: **no** |
| Attempt counts / max retries? | `job_queue` yes; cell rounds yes; batch resume **no** |
| Exponential backoff + jitter? | Cell delays fixed / limited; queue requeue weak |
| Dead-letter? | Status `failed` only |
| Heartbeats? | **No** |
| Restart-safe queue? | Cells persisted; batch not resumed |
| Explicit timeouts? | Per-cell wall clock; many `fetch` lack AbortSignal |
| Idempotent jobs? | Cell upsert: **yes**. Batch claim: **yes**. Queue retries: **broken** |

### Remediation priority (jobs)

1. Add `lease_expires_at` / `heartbeat_at` on `scan_batches`; reclaim stale `provider_running` and **resume missing cells** (skip upserted pairs).
2. Fix `queue.ts` so intermediate retries reset batch to `queued` (or resume), and only terminal-fail when attempts exhausted.
3. Mirror campaign stale reclaim for enrichment + grid runs.
4. Run long scans on a durable worker (or guarantee reclaim after `after()` death).

---

## 3. External API failure handling

### What’s solid

- Cell-level primary + retry rounds + integrity pass (`run-grid-cells.ts`).
- Soft-ready tolerates sparse missing cells.
- `provider_runs` audit logging across many providers.

### HIGH / MEDIUM

| ID | Finding |
|----|---------|
| P1 | Bright Data / ScrapingDog / most LLM / Twilio `fetch` lack AbortController; cell timeout rejects without cancelling the HTTP call |
| P2 | No provider circuit breaker / Retry-After budget |
| P3 | 429 handling is mostly string-matching on error messages for grid cells |
| P4 | `costEstimate` on `logProviderRun` rarely populated — weak spend control |
| P5 | Provider schema / empty payload handling uneven across Bright Data / DFS / ScrapingDog / AI |

### Remediation

- Abort every provider fetch; cancel on cell timeout.
- Shared circuit breaker + concurrency budget (especially Bright Data).
- Populate cost estimates; alert on spend spikes.
- Retry **failed cells only** (already the direction — keep it; never re-run completed upserts).

---

## 4. Database migrations and rollback safety

### What’s solid

- Recent discipline: dedupe before unique (`030`), claim columns for concurrency (`031`–`032`).
- Additive migrations dominate recent history.

### Gaps

| ID | Finding |
|----|---------|
| M1 | No documented rollback / expand-contract runbook in repo |
| M2 | No evidence of lock-duration review for large tables (`scan_results`, `business_reviews`) |
| M3 | `USING (true)` RLS “fixes” historically increased exposure — future RLS rewrites need careful dual-policy rollout |

### Remediation

- Standard: nullable → backfill → constrain; short `CREATE INDEX CONCURRENTLY` where hosted Postgres allows; backup before destructive DDL; dual-read deploy windows.

---

## 5. Indexes and query plans

### What’s solid

- Unique indexes and claim filters added for hot job paths.
- Lean selects on scan grid (`SCAN_RESULT_GRID_COLUMNS`) and many review lists.

### Gaps

| ID | Finding |
|----|---------|
| Q1 | No checked-in `EXPLAIN ANALYZE` artifacts for dashboard / reviews / jobs / opportunities |
| Q2 | Some modules still `select("*")` or include `raw_json` in lists (reputation, local-trust aggregates, some backlink fields) |
| Q3 | Job polling / multi-tenant concurrent scans not validated under realistic row counts |

### Remediation

- Capture `EXPLAIN (ANALYZE, BUFFERS)` for the named hot queries; add covering indexes only when plans prove need; drop unused indexes after monitoring.

---

## 6. Caching and invalidation

### What’s solid

- In-process grid memory cache with invalidate on write (`scan-queries`).
- `scan_workspace_cache` table for heavy workspace payloads.

### Gaps

| ID | Finding |
|----|---------|
| C1 | Workspace DB cache has get/set but **no** app-level invalidate / TTL on re-enrich or rerun |
| C2 | Classic “scan finished but numbers stale” risk for anything reading workspace cache without version bump |

### Remediation

- Version keys in `cache_key`; invalidate on finalize / enrichment / rerun; short TTL fallback.

---

## 7. Connection pool and concurrency

### What’s solid

- `p-limit` + env knobs for Bright Data batch/burst (`run-grid-cells.ts`).
- Early enrichment concurrency capped.

### Gaps

| ID | Finding |
|----|---------|
| X1 | New Supabase service client per call — fine for small load; unclear pool headroom under 20 simultaneous 7×7 scans |
| X2 | No global multi-tenant scan concurrency limit (per-org + global) |
| X3 | In-memory grid cache not shared across serverless instances |

### Remediation

- Document / enforce max concurrent scans per org and globally; watch Postgres connection saturation; consider Redis for shared progress if multi-node.

---

## 8. Memory and payload size

### What’s solid

- Grid list selects drop `provider_request_json`.
- Review list lean columns with optional raw.

### Gaps

| ID | Finding |
|----|---------|
| Z1 | `provider_runs` stores full request/response JSON — growth + memory if queried carelessly |
| Z2 | Local Trust aggregate `pageSize` can be very large |
| Z3 | No documented API body size limits |

### Remediation

- Keep raw provider blobs out of browser paths; paginate hard; retain raw only server-side with TTL.

---

## 9. Observability

### Gaps (HIGH)

| ID | Finding |
|----|---------|
| O1 | No Sentry / OpenTelemetry / structured logger in `package.json` |
| O2 | Correlation = ad-hoc `console.*` with scan ids; no request ID middleware |
| O3 | No dashboards/alerts for fail rate, P95 duration, queue depth, stuck jobs, 429s, cost |
| O4 | Cost fields unused |

### Minimum telemetry per job

Should include: correlation/scan id, org id, business id, provider, attempt, duration, DB vs API time, success/failure reason, retry count, estimated cost — **without** API keys or sensitive review PII.

---

## 10. Frontend request behavior

### What’s solid

- AI Visibility / Local Trust / Growth / Backlink polls generally clear intervals on unmount.
- Overview is largely SSR (avoids client poll loops).
- Compare view uses a request-id race guard.

### HIGH / MEDIUM

| ID | Finding | Evidence |
|----|---------|----------|
| F1 | Grid scan poll can storm: timer + realtime both call `poll`; effect deps include self-mutated `keywordId`; competitors refetch on every results length change; little AbortController use | `grid-scan-view.tsx` |
| F2 | Client tree has essentially no shared abort/debounce helpers | grep empty |

### Remediation

- AbortController per effect; clearTimeout on cleanup; stabilize poll deps; debounce competitors until settled; pause polling when document hidden.

---

## 11. Security basics

Covered heavily in §1. Additional notes:

- Treat AI text / reviews / business names as untrusted (share page uses `dangerouslySetInnerHTML` with generator escaping — keep sanitization on read).
- Rate-limit login, scan creation, review requests, AI endpoints (not evidenced).
- Dependency audit / `npm audit` not part of CI story in repo.
- Secrets must stay server-only; Maps browser key must be referrer-restricted.

---

## 12. Billing and usage correctness

### What’s solid

- Plan definitions and UI usage card (`plans.ts`).
- Several expensive routes assert + increment (map credits, growth, trust, backlink, AI, bulk).

### CRITICAL / HIGH

| ID | Finding | Evidence |
|----|---------|----------|
| B1 | `incrementUsage` is read → add → update (not atomic) | `plans.ts` |
| B2 | Check-then-act: `assertWithinLimit` then later increment — parallel requests can overshoot | same |
| B3 | Map credits charged at create for full grid **before** success; stuck/failed scans keep the charge; **rerun** path may skip re-charge | scan create + rerun routes |
| B4 | `sms_month` / email review limits defined but send paths don’t consistently assert + increment | plans vs Twilio/Brevo sends |
| B5 | No Stripe webhook / subscription lifecycle in app (manual `billing_status`) | README / missing stripe webhook |

### Remediation

- Atomic `UPDATE … SET x = x + n WHERE x + n <= limit` (or reserve/commit RPC).
- Charge on soft-ready/finalize **or** reserve + settle/refund.
- Enforce SMS/email caps on every successful send.
- When Stripe lands: signature-verified, idempotent webhooks.

---

## 13. Data retention and cleanup

| ID | Finding |
|----|---------|
| R1 | No scheduled retention for `provider_runs`, `scan_cell_telemetry`, workspace cache, failed job logs |
| R2 | Soft-deleted businesses / report availability after delete not clearly defined |
| R3 | Keep long-term summaries; expire raw payloads that add no customer value |

---

## 14. Backup and recovery

| ID | Finding |
|----|---------|
| K1 | No restore-tested runbook in repo (rely on hosting defaults if any) |
| K2 | No documented PITR / customer data export procedure |

**Rule:** backups count only after a restore drill.

---

## 15. Load and failure testing

No checked-in load harness for:

- 1 / 10 / 50 concurrent 7×7 scans  
- 20% 429s  
- worker death mid-scan  
- duplicate delivery  
- double-submit refresh  
- 10k reviews / heavy opportunities  

Measure: completion, connections, memory, retries, correctness.

---

## Recommended work sequence

| Order | Workstream | First deliverable |
|------:|------------|-------------------|
| 1 | Auth / RLS / IDOR | Drop open policies; fix mutations & webhooks; fail-closed cron |
| 2 | Job recovery | Lease + resume missing cells; fix queue retry/fail coupling |
| 3 | Providers | Abort timeouts, breaker, cost fields |
| 4 | Frontend | Grid poll abort/coalesce |
| 5 | Query plans | `EXPLAIN ANALYZE` pack for hot paths |
| 6 | Observability | Logger + Sentry + stuck-job alert |
| 7 | Billing | Atomic reserve/commit + SMS/email + success-time settle |
| 8 | Ops | Retention jobs, backup restore drill, load suite |

---

## Immediate patches included with this audit branch

Small fail-closed / IDOR fixes shipped alongside this document (see PR diff):

1. Require `CRON_SECRET` in production for `/api/jobs/process`.
2. Require webhook secret for DataForSEO inbound.
3. Scope `updateBusinessSettings` / `toggleActionItem` through org/business ownership.

Larger items (RLS rewrite, scan resume, atomic usage) remain tracked above — do not treat this branch as “production ready.”
