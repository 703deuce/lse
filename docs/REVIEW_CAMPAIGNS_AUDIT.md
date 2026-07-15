# Review Campaigns — Codebase Audit (Phase 1)

Date: 2026-07-15  
Scope: Inventory before building Add-on #1 (Review Campaigns).

## 1. Existing inventory

### Pages
| Route | Role |
|-------|------|
| `/businesses/[id]/reviews` | Review feed / KPIs |
| `/businesses/[id]/review-momentum` | Review Momentum™ |
| `/businesses/[id]/review-requests` | Poster, templates, quick send, bulk, tracking |
| `/businesses/[id]/reputation` | Parallel reputation audit UI (not in sidebar) |
| `/r/[trackingToken]` | Campaign click → Google redirect |

### API routes
- Reviews: `/api/reviews/*`, momentum run/latest/tasks
- Reputation kit: review-link CRUD, templates generate, send-sms/email, log-manual, stats
- Campaigns: `/api/reputation/review-requests/campaigns`, bulk validate
- Webhooks: Twilio SMS (STOP/replies), Brevo inbound, Google notifications (**stub**)
- Jobs: `/api/jobs/process` → `processCampaignMessages`

### Core libs
`src/lib/reputation/{campaigns,campaign-processor,campaign-scheduler,bulk-csv,bulk-validate,twilio,brevo,tracking,template-vars,review-sends,phone}.ts`  
`src/lib/reviews/{momentum-engine,review-store,fetch-reviews,…}.ts`  
`src/lib/plans.ts` — plan features + monthly usage meters

### Tables (migrations 004–031)
`business_reviews`, momentum runs/entities/tasks · `review_records` (audit) · `review_request_links/templates/events` · `review_request_contacts/sends` · `review_request_campaigns/uploads/recipients/messages/clicks/suppression`

### Nav today
Reputation → Reviews; sublink Review Requests. Momentum is under Main.

---

## 2. Capability matrix

| Requirement | Status | Notes |
|-------------|--------|-------|
| Manual review requests | **Full** | Quick Send + log-manual |
| Bulk CSV → campaign | **Full** | Client parse + validate + create |
| SMS send + Twilio signature | **Partial** | Works; trial body rewrite; START does not clear suppression |
| Email send + delivery webhooks | **Partial** | Brevo outbound + inbound replies only |
| Review links + QR | **Partial** | Kit + QR; campaign trackable `/r/`; one-off uses raw Google URL |
| Review feed / monitoring | **Full** | `/reviews` + `business_reviews` |
| Review Momentum | **Full** | Engine + page + APIs |
| Contacts CRM | **Partial** | Insert-on-send only; no page/API; no unique constraint |
| Templates CRUD | **Partial** | DB + AI generate; weak edit/list/archive UX |
| Multi-step sequences | **Missing** | Single paced send only |
| Pause / resume / cancel / duplicate | **Full** | Campaign PATCH + duplicate |
| Feature entitlement (add-on) | **Partial** | Usage limits exist; `hasFeature(review_*)` unused |
| Opt-out / suppression | **Partial** | STOP + send-time check; no management UI; no email unsub |
| Review↔campaign attribution | **Missing** | Explicitly not claimed in UI |
| New-review alerts | **Missing** | Google webhook stub |
| Campaign SMS/email metering | **Missing** | Only `bulk_review_requests_used` at create |
| Dedicated messaging number | **Missing** | Shared Twilio only |

---

## 3. Conflicts / duplicates to consolidate

1. **Two review stores:** `business_reviews` (feed/momentum) vs `review_records` (reputation audit).
2. **Two send pipelines:** `review_request_sends` (one-off) vs `review_request_messages` (campaigns).
3. **Naming:** “Review Requests” UI vs product name “Review Campaigns” — consolidate under Campaigns; keep Quick Send as a tool.
4. **Duplicate `hashIp`** in `campaigns.ts` / `tracking.ts`.

---

## 4. Reliability / security findings (fix in Phase 1+)

| Issue | Severity | Action |
|-------|----------|--------|
| Twilio reply matcher loads last 100 SMS sends **globally** then matches phone | **High** | Query by normalized phone + business scope; include campaign messages |
| START does not clear suppression | Medium | Clear business-level row on START |
| Campaign sends bypass SMS/email monthly meters | High | Meter on successful send |
| `listCampaigns` loads all message rows then filters in JS | Medium | Aggregate counts |
| Contacts always insert (duplicate growth) | Medium | Normalize + upsert + unique indexes |
| Feature flags not enforced on campaign APIs | High | Add-on entitlement gate |
| Email hard-bounce / complaint webhooks absent | Medium | Phase later |
| Google notifications unsigned stub | Medium | Phase 7 |

---

## 5. Delivery mapping (this codebase)

| Brief phase | Approach |
|-------------|----------|
| 1 Foundation | Audit (this doc), entitlements, nav, security/metering fixes, schema prep |
| 2 Contacts/import | Extend `review_request_contacts` + Contacts page/API; reuse CSV validates |
| 3 Templates/links | Templates page/API on existing table; keep `/r/` redirects |
| 4 Builder | Evolve bulk wizard into multi-step builder |
| 5 Execution | Extend processor for sequences; keep atomic claim |
| 6 Reporting | Campaigns hub + detail on existing aggregates |
| 7 Reviews | Alerts + honest attribution labels into Momentum |
| 8 Billing | Org `addons` + usage meters already partially present |

**Policy (billing delinquent):** pause outbound scheduling immediately; keep historical data; resume when `billing_status` is healthy. Already-queued messages are not sent while paused/inactive.

---

## 6. Phase 2 progress

- **Nav:** Review Requests is the parent; **Campaigns** is nested indented under it (own page `/review-campaigns`).
- **Workers:** Coolify/Hetzner cron → `POST /api/jobs/process` with `CRON_SECRET` (see `docs/COOLIFY_CRON_CAMPAIGNS.md`).
- **Campaign detail** + recipient pagination; contacts CSV import API `/api/reputation/contacts/import`.

