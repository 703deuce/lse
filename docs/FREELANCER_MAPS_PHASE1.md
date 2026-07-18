# Freelancer Maps — Phase 1 architecture summary

Product: **Unlimited Google Maps rank tracking and client reporting for freelance local SEO professionals** (≈1–20 locations).

## 1. Current architecture

- **Auth:** Supabase Auth → `profiles` + `organization_members` → `organizations` (workspace/tenant).
- **Core entity:** `businesses` (one Google listing / scan pin per row). Plan slots via `is_tracked`.
- **Scans:** `scan_batches` → `scan_points` → `scan_results`; Bright Data only for Maps; persistent recovery (`recovering` + `maps-cell-retry`).
- **Reports:** `reports` with HTML share + PDF artifacts; org white-label columns.
- **AI visibility:** `ai_visibility_*` tables; optional reporting feature.
- **Reputation:** Full review-campaign stack exists but is a **separate product** — hidden from Maps nav in Phase 1.
- **Usage:** Location slots + internal `map_credits_used` ledger (credits hidden from freelancer UI).

## 2. Files changed in Phase 1

- `src/lib/product/freelancer-maps.ts` — product flags
- `src/components/dashboard/dashboard-nav.ts` — freelancer Work/Setup nav; reputation empty
- `src/components/dashboard/sidebar.tsx` — Prospects/Clients org nav; branding
- `src/middleware.ts` — protect `/prospects`, `/clients`
- `src/app/(dashboard)/prospects/page.tsx`, `clients/page.tsx`
- `src/components/accounts/accounts-hub.tsx`
- `src/app/(dashboard)/businesses/page.tsx` — redirect → `/clients`
- `src/app/(dashboard)/businesses/new/page.tsx` — `?as=prospect|client`
- `src/components/overview/dashboard-quick-actions.tsx`
- `src/components/scan/scan-setup-studio.tsx`, `grid-scan-view.tsx` — no credit anxiety copy
- `src/components/settings/account-plan-usage-card.tsx`
- `src/app/(dashboard)/agency/clients/page.tsx`, `agency/reports/page.tsx`
- `src/app/layout.tsx` — product title

## 3. Models reused (no duplicates)

| Product term | Existing model |
|---|---|
| Workspace | `organizations` |
| User | Supabase user + `profiles` |
| Prospect / Client | `businesses` (`is_tracked` false/true until Phase 2 `account_type`) |
| Location | same `businesses` row (+ optional `rank_locations`) |
| Keywords | `business_keywords` |
| Maps campaign | deferred — use keywords + `scheduled_scans` until Phase 3 |
| Scans / Reports / Share / PDF / AI / Branding | existing tables & libs |

## 4. Required migrations (later phases)

Phase 1: **none**.

Later:

- `account_type` / `prospect_status` / `archived_at` on businesses (or thin `accounts` view)
- `campaigns` + keyword FK for Maps keyword campaigns
- `PlanLimits` shape (max concurrent, schedule freqs, AI monthly) if not already expressible
- Branding profile table only if org columns prove insufficient

## 5. Present — reposition only

Persistent scans, dashboard recent scans, Bright Data grid, reports, share links, PDF, white-label org branding, AI visibility, scheduling (`scheduled_scans`), competitor compare, location slot limits.

## 6. Missing entirely

First-class prospect CRM statuses, Maps keyword campaigns, freelancer onboarding wizard, analytics events suite, assistant seat UX, richer dashboard attention widgets, report templates (prospect/monthly/campaign) as first-class builders.

## 7. Hidden / removed from Maps UX

- Reputation / review-request nav and dashboard CTA
- Map credit balance / “credits used” scan copy
- Growth Plan sidebar promo
- Agency-centric titles

## 8. Data risks

Do **not** rename `businesses` → `accounts` (FK/RLS blast radius). Prefer columns + product vocabulary. `is_tracked=false` currently means both “prospect audit” and “archived client” — Phase 2 must separate with `account_type` / `archived_at` without deleting scan history.

## 9. Phased order

1. Audit + nav/reposition (this phase)  
2. Prospects/clients CRM fields + conversion  
3. Campaigns + keywords  
4. Persistent scan UX polish (mostly done)  
5. Historical comparison  
6. Branding + report builder  
7. Share links polish  
8. AI visibility reporting  
9. Scheduling  
10. Polish + tests  

## 10. Assumptions to verify

- Bright Data remains sole Maps provider in production workers.
- Existing tracked businesses = clients; untracked = prospects/archives until migration.
- Internal credit reservation may remain for abuse control while UI never shows credit anxiety.
- Reputation routes may stay reachable by URL but out of Maps nav.
