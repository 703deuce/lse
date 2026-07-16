# Platform completion audit

Launch readiness is not “every sidebar page opens.” It is every feature following:

**User action → authz → entitlement → durable job → safe execution → saved result → summary → UI → usage/cost → report/history → recovery**

Stripe/billing checkout is out of scope for this pass.

## Inventory (lifecycle)

| Feature | Starts | Sync / Queue | Worker | Provider | Idempotency | Progress | Result storage | Summary | Usage ledger | Cancel/retry | Report | Crash recovery | Entitlement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Manual Maps scans | `POST /api/scans/create` → `dispatchScanProcessing` | Queue `process_scan` → `maps-scan` | `worker:maps` | Bright Data | `maps-scan:{scanBatchId}` | Poll + Realtime | `scan_batches`, `scan_points`, `scan_results` | `feature_business_summaries` (maps) | Yes after cell upsert (org required) | Admin cancel/retry; rerun | single_scan / competitor | Lease reclaim + mismatch requeue | Plan credits `map_credits_used` |
| Scheduled Maps tracking | `scheduled_scans` + pg_cron SQL | **PARTIAL** — SQL inserts bare `job_queue` | Intended maps | Bright Data | **MISSING** on SQL path | Same as scan | `scheduled_scans` + scan tables | Report reads schedule | Often **missing org** → $0 ledger | Enable/disable only | maps_campaign | Job reclaim | None dedicated |
| Scan history | `GET /api/scans/history` | Sync read | n/a | none | n/a | none | scan tables | Overview recent | no | n/a | Feeds trend | n/a | none |
| Competitor grids | Compare UI / APIs | Sync (derived) | n/a | none | n/a | none | `top_competitors_json` | Overlay | no | n/a | competitor | n/a | none |
| Trend comparisons | Grid + reports | Sync | n/a | none | n/a | none | Historical scans | Trend report | no | n/a | trend | n/a | none |
| Maps “campaigns” | Report card only | Report sync | n/a | none | n/a | none | schedule metadata | Report only | no | n/a | maps_campaign | n/a | none |
| Reports / exports | `POST /api/reports/export` | **Sync** (queue type registered but unused) | `worker:reports` idle | none | none | HTTP wait | `reports` | none | no | Admin if queued | HTML/CSV | n/a | none |
| Reviews feed | `/reviews` | Sync read; refresh via momentum | messaging | ScrapingDog (via momentum) | momentum key | Module poller | `business_reviews` | Overview cards | Partial | Admin job | reviews | Momentum reclaim | none on read |
| Review Momentum | `POST /api/reviews/momentum/run` | `review_momentum_run` → `review-monitor` | `worker:messaging` | ScrapingDog + DeepSeek | `review-momentum:{biz}:{30s}` | Job status poll | momentum tables + reviews | `review_momentum` | Partial | Admin | reviews report | Job reclaim | Plan feature **not checked** on run |
| Review Requests (Quick Send) | send-email / send-sms | **Sync** | n/a | Brevo / Twilio | none | none | `review_request_sends` | KPI stats | Yes when org passed | Resend | no | n/a | `review_campaigns` |
| Review Campaigns | campaigns APIs + enroll | Drain → `email-send` / `sms-send` | `worker:messaging` | Brevo / Twilio | `campaign-msg-send:{msgId}` | Campaign poll | campaign/recipient/message tables | `reviews_campaign` | Plan + provider ledger | Pause/cancel | review_campaign | Drain + claim | `review_campaigns` |
| Contacts / imports | contacts + import | ≤200 sync; else `review-import` | `worker:messaging` | none | `review-import:{uploadId}` | Upload/job poll | contacts + uploads | none | no | Admin cancel | error CSV | Job reclaim | `review_campaigns` |
| Incoming webhooks | ingest + manage APIs | Queue `integration_webhook_process` | `worker:messaging` | Customer CRM | event unique + `webhook_event:{id}` | 202 accept | webhook tables | none | Plan webhook limits | Revoke | no | Job retry | `review_campaigns` |
| AI Visibility | `POST /api/ai-visibility/run` | `ai_visibility_run` | `worker:intelligence` | ScrapingDog / LLMs | `ai-visibility:{biz}:{30s}` | Module poller | AI visibility tables | `ai_visibility` | Plan + provider | Admin | no | Job reclaim | `hasFeature(ai_visibility)` |
| Backlink Gap | `POST /api/backlink-gap/run` | `backlink_gap_run` | `worker:intelligence` | DataForSEO + DeepSeek | `backlink-gap:{biz}:…` | Module poller | backlink tables | `backlink_gap` | Plan; DFS ledger partial | Admin | no | Job reclaim | Feature **not checked** |
| Local Trust | `POST /api/trust/run` | `local_trust_run` | `worker:intelligence` | DeepSeek + search | `local-trust:{biz}:…` | Module poller | trust tables | `local_trust` | Plan | Admin | no | Job reclaim | Feature **not checked** |
| Growth Audit | `POST /api/growth-audit/run` | `growth_audit_run` → maintenance | `worker:intelligence` | Multi | `growth-audit:{biz}:{30s}` | Module poller | growth tables | `growth_audit` | Plan | Admin | no | Job reclaim | Feature **not checked** |
| Notifications | settings + alert drain | `review_alert_scan`; `send_notification` **noop** | messaging | Brevo | drain minute key | none | notification tables | none | Partial | Settings | no | Drain | `review_campaigns` |
| Dashboard summaries | `/overview` | Sync SSR | n/a | none | n/a | none | Live tables | Summaries **written** but overview mostly live | no | n/a | Featured cards | n/a | none |
| Billing / usage | account + admin ops | Sync | n/a | none (Stripe later) | n/a | none | org plan + `usage_ledger` | Admin cost panel | Dual counters vs ledger | n/a | n/a | n/a | Plan / addons |

## Immediate fixes in this PR

1. **Usage ledger**
   - Resolve `organizationId` from business when job payload omits it (`process-scan`, reclaim).
   - Idempotent Bright Data cell keys (`brightdata:maps_grid_cell:…`).
   - Migration `056_usage_ledger_idempotency.sql`.
2. **Job vs scan status**
   - Do not ACK `already_done` while scan still in `CELLS_IN_FLIGHT_STATUSES` after finalize attempt.
   - Admin Ops labels **Job status** vs **Scan status** and flags mismatches.
3. **Redis reconnect**
   - Already indefinite retry + keepalive in `getBullmqConnectionOptions` / worker error handler (no exit on blip). Single `ETIMEDOUT` during deploy is expected.

## Remaining launch-risk gaps (ranked)

1. **Scheduled Maps SQL enqueue** bypasses platform queue (no `queue_name` / org / idempotency) — fragile under BullMQ; also zero cost ledger.
2. **Reports stay sync** — `generate_report` worker unused; large exports block web.
3. **Feature entitlements not enforced** on Local Trust / Backlink Gap / Growth Audit / Review Momentum run routes.
4. **`send_notification` noop** — general notification fan-out incomplete.
5. **Dashboard summaries unused** on overview (still deep-loads live tables).
6. **Provider DFS ledger** incomplete for most DataForSEO calls.
7. **Mixed-load soak + failure injection** not yet run as a formal gate.
8. Onboarding paths, compliance kill-switch, retention policies, backup restore drills — product/ops follow-ups (not Stripe).

## Verification checklist (ops)

After deploy + migration `056`:

1. Run a manual 3×3 Maps scan → Admin Ops Cost shows Bright Data units/cost.
2. Force a job/scan mismatch (or wait for reclaim) → amber **Mismatch** label; cron requeues.
3. Messaging Worker logs listen on `email-send` / `sms-send`; campaign send completes once.
4. Trigger AI Visibility / Backlink Gap / Local Trust → work appears in intelligence worker logs, not long Next.js requests.
