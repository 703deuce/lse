# Maps Growth Agent

Google Maps-first SaaS that audits local visibility, compares competitors, and turns gaps into a weekly action plan.

## Stack

- **Next.js 16** (App Router)
- **Supabase** (Postgres + PostGIS, RLS, job queue, cron SQL, realtime)
- **DataForSEO** — Live + Standard grid rank scans
- **ScrapingDog** — enrichment (details, reviews, photos, posts)
- **DeepSeek** — action plan generation (Zod-validated JSON)
- **Kimi** — screenshot analysis API + UI
- **Gemini** — grounded research panel
- **Leaflet** — scan heatmaps

## Setup

1. Copy `.env.example` to `.env.local` and fill in keys.
2. Run migrations in Supabase SQL editor **in order**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_enhancements.sql`
   - `supabase/migrations/003_module_audits.sql`
3. Optional: `supabase/seed/seed.sql`
4. Enable Supabase Cron (Dashboard → Integrations → Cron) with:
   ```sql
   SELECT cron.schedule('weekly-scans', '0 9 * * 1', $$ SELECT process_due_scheduled_scans(); $$);
   ```
5. Set `DEV_BYPASS_AUTH=true` until Firebase auth is wired.

```powershell
npm install
npm run dev
```

## Auth (deferred by design)

Firebase Auth replaces dev bypass later. Sign-in/sign-up are placeholders.

## Features implemented

| Area | Status |
|------|--------|
| Business intake + GBP resolve | ✅ |
| Grid scan (Live + Standard/postback) | ✅ |
| Heatmap + trends vs prior scan | ✅ |
| Competitor side-by-side audit | ✅ |
| Deterministic audit (4 buckets + website probe) | ✅ |
| DeepSeek action plan + fallback | ✅ |
| Task completion tracking | ✅ |
| HTML reports + share links | ✅ |
| Gemini research + sources + suggestions | ✅ |
| Kimi screenshot upload | ✅ |
| Weekly scan scheduling (DB + cron SQL) | ✅ |
| Agency clients + bulk reports | ✅ |
| API auth on protected routes | ✅ |
| Zod validation | ✅ |
| PostGIS geom on insert | ✅ |
| Provider audit logging | ✅ |
| SSRF-safe website probe | ✅ |
| Maps Audit Workspace (GMB Everywhere-style) | ✅ |
| Website Match / Category Gap / Core 30 / Hyper-Local audits | ✅ |
| Competitor gap audit + SOP action plan engine | ✅ |
| Google OAuth connected mode | Stub (needs GCP + Firebase) |
| Firebase login | Not built (next) |
| Stripe billing | Not in MVP |
| Q&A API | Discontinued by Google |

## API routes

| Route | Purpose |
|-------|---------|
| `POST /api/businesses/resolve` | Find GBP candidates |
| `POST /api/businesses/create` | Save business + keyword |
| `POST /api/scans/create` | Queue grid scan |
| `GET /api/scans/[id]/status` | Poll scan + prior metrics |
| `POST /api/scans/[id]/rerun` | Re-run scan |
| `POST /api/reports/export` | Generate shareable report |
| `POST /api/research` | Grounded research |
| `POST /api/vision/analyze` | Kimi screenshot analysis |
| `POST /api/schedule` | Enable weekly scans |
| `POST /api/webhooks/dataforseo` | Standard task postback |
| `GET/POST /api/jobs/process` | Process job queue (cron) |

## Repo layout

```
src/app/(dashboard)/   — UI pages
src/app/api/           — Route handlers
src/lib/providers/     — DataForSEO, ScrapingDog, DeepSeek, Kimi, Gemini, GBP stub
src/lib/jobs/          — Scan pipeline, enrichment, finalize
src/lib/scoring/       — Deterministic audit engine
src/lib/rules/         — Website probe
src/lib/rls/           — RLS policy reference
src/components/        — Maps, audit, scan, tasks, research
supabase/migrations/   — Schema + cron functions
supabase/functions/    — Edge function notes
```
