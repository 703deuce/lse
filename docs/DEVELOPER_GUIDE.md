# Developer Guide — Maps Growth Agent

## Product philosophy

Every SOP step becomes **an audit, a score, or a task**. The app is not a Chrome extension overlay — it is a **GMB Everywhere-style audit workspace inside the SaaS**, with an action-plan engine on top.

## Maps Audit Workspace

**Route:** `/businesses/[businessId]/workspace`

**Purpose:** Recreate the GMB Everywhere flow: search → see businesses → click one → audit buttons → every audit becomes a task.

### Layout

| Area | Content |
|------|---------|
| Top toolbar | Keyword, city, grid size, Run Scan |
| Left panel | Target business + competitor listings |
| Center/right | Leaflet map + selected business profile card |
| Profile card | Name, rating, categories, NAP, audit module buttons |

### Audit module buttons

| Button | Module | Behavior |
|--------|--------|----------|
| Basic | — | GBP profile: NAP, categories, hours, photos, services |
| Website | `website-match` | NAP/title/meta/H1/hours/Core 30 alignment |
| AI | `competitor-gaps` | Why competitors beat you (relevance/distance/prominence) |
| Rank | — | Opens latest grid scan |
| Review | stub | Review count/keywords from enrichment |
| Post | stub | GBP posts (ScrapingDog when available) |
| Categories | `category-gap` | Primary/secondary vs competitors, missing pages |
| Photos | stub | Photo count vs competitors |
| Services | `core30` | GBP services vs website pages |
| Tasks | `action-plan` | Top 3 urgent + 7-day + 30-day work order |

## SOP module pages

| Nav label | Route | Engine |
|-----------|-------|--------|
| Rank Grid | `/scans`, `/grid/[scanId]` | DataForSEO grid scan |
| GBP Audit | `/audit` | Deterministic 4-bucket audit |
| Website Match Audit | `/website-match` | `runWebsiteMatchAudit` |
| Category Gap | `/category-gap` | `runCategoryGapAudit` |
| Core 30 Checker | `/core30` | `runCore30Audit` |
| Hyper-Local Pages | `/hyperlocal` | `runHyperLocalAudit` |
| Competitor Gaps | `/competitor-gaps` | `runCompetitorGapAudit` |
| Citation Tracker | `/citations` | Stub |
| Local Trust | `/trust` | Stub |
| Weekly Action Plan | `/tasks` | Scan action plan + `buildActionPlanFromAudits` |
| Monthly Progress Report | `/progress` | Stub |

## Audit engines

Located in `src/lib/audit/`:

- `types.ts` — `MatchStatus`: Match | Partial Match | Missing | Mismatch
- `website-crawler.ts` — SSRF-safe fetch + HTML parse + shallow crawl
- `website-match.ts` — GMB Everywhere-style website audit checks
- `category-gap.ts` — Categories/services vs site pages + suggested titles
- `core30.ts` — Completion score, missing/weak/wrong-title pages
- `hyperlocal.ts` — Service + neighborhood page checklist
- `competitor-gap.ts` — Top 3 competitor comparison + “why they beat you”
- `action-plan-engine.ts` — Urgent / 7-day / 30-day tasks with impact, effort, evidence
- `run-audit.ts` — Load GBP profile, run suite, persist to `module_audits`

## API

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/workspace/[businessId]` | GET | Workspace listings, GBP profile, map center |
| `/api/audits/modules` | POST | Run module: `website-match`, `category-gap`, `core30`, `hyperlocal`, `competitor-gaps`, `action-plan`, `full` |

## Database

Run migration `003_module_audits.sql`:

```sql
module_audits (business_id, module_type, score, result_json, created_at)
```

## Website Match scoring

Each check returns one of:

- **Match** — aligned
- **Partial Match** — close but incomplete
- **Missing** — not found on website
- **Mismatch** — conflicting data

## Action plan output shape

```ts
{
  urgent: ActionTask[];      // top 3
  sevenDay: ActionTask[];
  thirtyDay: ActionTask[];
}
```

Each task includes: `title`, `description`, `why`, `impact`, `effort`, `bucket`, `evidence`, `module`.

## Adding a new SOP step

1. Add audit logic in `src/lib/audit/`
2. Register module in `POST /api/audits/modules`
3. Add nav item in `sidebar.tsx` (sidebar mounts once via `src/app/(dashboard)/layout.tsx`)
4. Add dedicated page or wire into workspace buttons
5. Extend `buildActionPlanFromAudits` to emit tasks

## Security

All website fetches use `validatePublicUrl` + `safeFetchWebsite` (SSRF protection). Never bypass for user-supplied URLs.
