# Freelancer Maps — migration report

## Migration `071_freelancer_accounts_campaigns.sql`

### What changed

| Object | Change |
|---|---|
| `businesses` | Added `account_type`, `prospect_status`, contact/notes/tags, `archived_at` |
| `maps_campaigns` | New table for Maps keyword campaigns (not review campaigns) |
| `business_keywords` | Optional `campaign_id`, `active`, `sort_order` |
| `app_notifications` | In-app notification events for later email wiring |

### Data preservation

- **No rows deleted.**
- Tracked businesses (`is_tracked = true`) → `account_type = 'client'`.
- Untracked businesses → `account_type = 'prospect'`, `prospect_status = 'new'`.
- Existing scans, reports, share tokens, AI visibility, and keywords kept on the same `business_id`.
- Orphan keywords backfilled into a per-business `Primary keywords` Maps campaign when possible.

### Report URLs

- Public share routes remain `/reports/share/[token]` (unchanged).
- Agency report list retitled; paths preserved.

### Follow-up caution

`is_tracked = false` previously meant both “manual audit” and “archived slot.”
After 071, **archive** sets `archived_at` while conversion sets `account_type = client` + `is_tracked = true`.
Re-run the migration backfill only on fresh DBs; production should apply once.

### Deploy order

1. Apply SQL migration 071.
2. Deploy web + maps worker (web first if only UI; both if create API uses new columns).
3. Smoke: create prospect → scan → convert → client list shows record; campaigns list loads.

## Migration `072_freelancer_share_team.sql`

### What changed

| Object | Change |
|---|---|
| `reports` | `share_view_count`, `share_last_viewed_at`, `publish_status` (`draft` / `published` / `archived`) |
| `organization_members.role` | Accepts `assistant` (≈ member without billing/invite/ownership) |

### Product surfaces wired

- Share link password / expiry / regenerate / view count / publish status in Reports hub
- AI executive summary generate + save (tone presets)
- Report section toggles persisted on `metadata_json.sections`
- Settings → Team assistant invite
- Public share page increments view count and blocks draft/archived links

### Deploy order

1. Apply SQL migrations **071** then **072**.
2. Redeploy **web + maps worker**.
3. Smoke: create share → set password → open link → view count increments; invite assistant seat.

## Migration `073_campaign_baseline.sql`

### What changed

| Object | Change |
|---|---|
| `maps_campaigns` | Optional `baseline_scan_batch_id` → `scan_batches(id)` for baseline-vs-current reports |

### Deploy order

1. Apply SQL migrations **071 → 072 → 073** (do not run 073 alone — it needs `maps_campaigns` from 071).
2. Redeploy **web + maps worker** if not already on the freelancer-journey build.
3. Smoke: convert a prospect → campaign has baseline when a completed scan exists; campaign schedule panel can set baseline.
