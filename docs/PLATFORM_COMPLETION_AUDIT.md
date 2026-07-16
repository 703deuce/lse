# Platform completion audit

Launch readiness is not “every sidebar page opens.” It is every feature following:

**User action → authz → entitlement → durable job → safe execution → saved result → summary → UI → usage/cost → report/history → recovery**

Stripe/billing checkout remains **out of scope**.

## Status: complete (code)

All previously open launch-risk gaps in this audit are closed in code. Apply migrations through **`057_platform_completion_hardening.sql`** in Supabase before deploy.

Ops-only items (not code gaps): backup restore drills, production mixed-load soak on Coolify.

## Inventory (lifecycle)

| Feature | Starts | Sync / Queue | Worker | Provider | Idempotency | Progress | Result storage | Summary | Usage ledger | Cancel/retry | Report | Crash recovery | Entitlement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Manual Maps scans | `POST /api/scans/create` → `dispatchScanProcessing` | Queue `process_scan` → `maps-scan` | `worker:maps` / `worker:all` | Bright Data | `maps-scan:{scanBatchId}` | Poll + Realtime | `scan_batches`, `scan_points`, `scan_results` | `feature_business_summaries` (maps) | Yes (org required) | Admin cancel/retry; rerun | single_scan / competitor | Lease reclaim + mismatch requeue | Plan credits |
| Scheduled Maps tracking | `scheduled_scans` + pg_cron SQL | SQL creates `scan_batches` only; cron TS `enqueueDueScheduledScanBatches` → platform queue | maps | Bright Data | `maps-scan:{batchId}` | Same as scan | `scheduled_scans` + scan tables | Report reads schedule | Org resolved from business | Enable / pause / archive | maps_campaign | Job reclaim | Skips untracked / suspended |
| Scan history | `GET /api/scans/history` | Sync read | n/a | none | n/a | none | scan tables | Overview recent | no | n/a | Feeds trend | n/a | none |
| Competitor grids | Compare UI / APIs | Sync (derived) | n/a | none | n/a | none | `top_competitors_json` | Overlay | no | n/a | competitor | n/a | none |
| Trend comparisons | Grid + reports | Sync | n/a | none | n/a | none | Historical scans | Trend report | no | n/a | trend | n/a | none |
| Maps “campaigns” | Report card only | Report async HTML | reports | none | report idempotency window | Job status poll | schedule metadata | Report only | no | Admin if queued | maps_campaign | Job reclaim | none |
| Reports / exports | `POST /api/reports/export` | HTML → `generate_report`; CSV sync | `worker:reports` / `worker:all` | none | `report:{biz}:{type}:…` | Hub polls job status | `reports` | none | no | Admin cancel/retry | HTML/CSV | Job reclaim | none |
| Reviews feed | `/reviews` | Sync read; refresh via momentum | messaging | ScrapingDog | momentum key | Module poller | `business_reviews` | Overview cards | Via `logProviderRun` | Admin job | reviews | Momentum reclaim | none on read |
| Review Momentum | `POST /api/reviews/momentum/run` | `review_momentum_run` | messaging | ScrapingDog + DeepSeek | `review-momentum:{biz}:{30s}` | Module poller | momentum tables + reviews | `review_momentum` | Via provider log → ledger | Admin | reviews report | Job reclaim | Plan feature checked |
| Review Requests (Quick Send) | send-email / send-sms | Sync | n/a | Brevo / Twilio | provider webhook dedupe | none | `review_request_sends` | KPI stats | Yes when org passed | Resend | no | n/a | `requireCampaignSendAccess` |
| Review Campaigns | campaigns APIs + enroll | Drain → `email-send` / `sms-send` | `worker:messaging` | Brevo / Twilio | `campaign-msg-send:{msgId}` | Campaign poll | campaign tables | `reviews_campaign` | Plan + provider ledger | Pause/cancel + org kill switch | review_campaign | Drain + claim | `requireCampaignSendAccess` |
| Contacts / imports | contacts + import | ≤200 sync; else `review-import` | messaging | none | `review-import:{uploadId}` | Upload/job poll | contacts + uploads | none | no | Admin cancel | error CSV | Job reclaim | `review_campaigns` |
| Incoming webhooks | ingest + manage APIs | Queue `integration_webhook_process` | messaging | Customer CRM | event unique + `webhook_event:{id}` | 202 accept | webhook tables | none | Plan webhook limits | Revoke | no | Job retry | `review_campaigns` |
| AI Visibility | `POST /api/ai-visibility/run` | `ai_visibility_run` | intelligence | ScrapingDog / LLMs | `ai-visibility:{biz}:{30s}` | Module poller | AI visibility tables | `ai_visibility` | Plan + provider | Admin | no | Job reclaim | `hasFeature(ai_visibility)` |
| Backlink Gap | `POST /api/backlink-gap/run` | `backlink_gap_run` | intelligence | DataForSEO + DeepSeek | `backlink-gap:{biz}:…` | Module poller | backlink tables | `backlink_gap` | Plan + DFS/DeepSeek ledger | Admin | no | Job reclaim | Feature checked |
| Local Trust | `POST /api/trust/run` | `local_trust_run` | intelligence | DeepSeek + search | `local-trust:{biz}:…` | Module poller | trust tables | `local_trust` | Plan + provider | Admin | no | Job reclaim | Feature checked |
| Growth Audit | `POST /api/growth-audit/run` | `growth_audit_run` | intelligence | Multi | `growth-audit:{biz}:{30s}` | Module poller | growth tables | `growth_audit` | Plan + provider | Admin | no | Job reclaim | Feature checked |
| Notifications | settings + alert drain | `review_alert_scan`; `send_notification` → Brevo | messaging | Brevo | drain minute key | none | notification tables | none | Partial | Settings + outbound pause | no | Drain | `review_campaigns` |
| Dashboard summaries | `/overview` | Sync SSR | n/a | none | n/a | none | Live + `feature_business_summaries` | Prefer summary, live fallback | no | n/a | Featured cards | n/a | none |
| Billing / usage | account + admin ops | Sync | n/a | none (Stripe later) | ledger idempotency keys | none | org plan + `usage_ledger` | Admin cost panel | Dual counters vs ledger | n/a | n/a | n/a | Plan / addons |
| Manual vs tracked | create / convert / untrack APIs | Sync | n/a | none | n/a | none | `businesses.is_tracked` | Schedules skip untracked | Slot count = tracked only | Convert API | n/a | n/a | Plan `max_businesses` |
| Provider webhooks | Twilio SMS / Brevo events+inbound | Sync handler | n/a | Twilio / Brevo | `provider_webhook_events` | n/a | delivery + replies | n/a | n/a | n/a | n/a | Dedupe claim | Secret / signature |
| Admin ops | `/admin/ops`, `/admin/accounts` | Sync + queue actions | n/a | none | n/a | Live | job_queue | Cost rollup | Yes | Cancel / retry / reconcile / outbound pause | n/a | Mismatch requeue | Admin email |

## Closed in this completion pass

1. **Scheduled Maps** — SQL only inserts `scan_batches`; `enqueueDueScheduledScanBatches` enqueues via `enqueueMapsScanJob` (org + idempotency). Skips untracked businesses.
2. **Reports** — HTML via `generate_report` worker; Reports hub polls job status for share URL. CSV remains sync.
3. **Entitlements** — Local Trust / Backlink Gap / Growth Audit / Review Momentum run routes check plan features.
4. **`send_notification`** — Brevo send (respects `outbound_paused`).
5. **Overview summaries** — `loadDashboardFeatured` reads `getFeatureSummary` with live fallback.
6. **Provider ledger** — Successful `logProviderRun` rows with `organizationId` write `usage_ledger` (covers DataForSEO GET/POST, ScrapingDog, DeepSeek, etc.).
7. **Manual vs tracked** — `is_tracked` / `tracking_source`; convert + untrack APIs; plan slot count is tracked-only.
8. **Schedules** — `action: pause | archive | enable`; disabled when business untracked.
9. **Campaign kill switch** — `organizations.outbound_paused`; Admin Accounts toggle; enroll/send + worker send gated.
10. **Provider webhook dedupe** — Twilio + Brevo claim `provider_webhook_events`.
11. **Frontend polling** — Shared module runner / terminal stop; reports hub uses it.
12. **Retention** — Deletes old `provider_webhook_events`; existing scrub paths unchanged.
13. **Admin reconcile** — Manual “Reconcile job/scan mismatches” + cron path.
14. **Tests** — Mixed-load + `completion-audit.test.ts` invariants.

## Remaining gaps

**None in product code for this audit.**

Explicit non-goals / ops follow-ups (not open engineering gaps):

- Stripe trial / upgrade / downgrade checkout flows
- Full onboarding UX tours
- Production backup restore drills
- Coolify multi-tenant soak with live provider keys (CI covers offline invariants)

## Coolify worker layout

| Process | Command | Owns |
| --- | --- | --- |
| Messaging | `npm run worker:messaging` | Campaign email/SMS (+ related messaging queues) |
| Core | `npm run worker:all` | Maps + intelligence + reports (**excludes** messaging send queues) |

Do **not** run messaging queues in both processes.

## Verification checklist (ops)

After deploy + migrations through **`057`**:

1. Manual 3×3 Maps scan → Admin Ops Cost shows Bright Data units/cost.
2. Job/scan mismatch → amber label; **Reconcile** or cron requeues.
3. Messaging worker listens on `email-send` / `sms-send`; campaign send completes once.
4. AI Visibility / Backlink Gap / Local Trust → intelligence worker logs (not long Next.js requests).
5. HTML report share → Reports hub shows link after job completes.
6. Admin **Pause outbound** → enroll/send returns 403; resume restores.
7. Twilio/Brevo duplicate delivery → second webhook is no-op (`duplicate`).
8. Untracked business → scheduled scans skipped; convert-to-tracked consumes a slot.
