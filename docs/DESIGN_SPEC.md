# Transovo Dashboard — Design Spec

Enforcement layer for all dashboard pages. Pair with the Universal Design QA Checklist when reviewing UI.

## Layout

- **One sidebar** — `DashboardShell` in `src/app/(dashboard)/layout.tsx` mounts `DashboardSidebar` once for every dashboard route.
- **Pages render content only** — no per-page sidebar or `flex min-h-screen` wrappers.
- **Page chrome** — use `PageHeader` for H1 + subtitle; optional actions slot on the right.
- **Full-bleed routes** — rank grid map (`/businesses/[id]/grid/[scanId]`) gets zero padding from the shell.

## Typography

| Role | Class / token |
|------|----------------|
| Page title (H1) | `text-2xl font-bold tracking-tight text-zinc-900` |
| Card label | `text-xs font-medium uppercase tracking-wide text-zinc-500` |
| Body | `text-sm leading-relaxed text-zinc-600` |
| Stat value | `text-3xl font-bold tabular-nums text-zinc-900` |
| Stat suffix (`/100`, `%`) | `text-lg font-normal text-zinc-400` |

Max three text tiers per page: H1 → card label → body/data.

## Color system

Use `src/lib/design/score-colors.ts` for all 0–100 scores:

| Range | Band | Color |
|-------|------|-------|
| 0–39 | low | red |
| 40–69 | mid | amber |
| 70–100 | high | emerald |

Trend deltas: `trendTextClass()` — up green, down red, flat gray.

Brand accent (`emerald-600`) — CTAs and active nav only, not data-status colors.

## Components

- **Cards** — `rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]`
- **Primary button** — solid emerald (`bg-emerald-600 text-white`)
- **Secondary button** — outline zinc (`border border-zinc-200 … hover:bg-zinc-50`)
- **Status pills** — reuse band colors from `scoreBandClasses` for severity; never invent new palettes per page.

## Spacing

- Card grid gap: `gap-4`
- Section spacing: `mt-8` between major sections
- Card padding: `p-5` (consistent)

## Data integrity

- Never render `Invalid Date`, `null`, `undefined`, or `NaN` — use `—` or designed empty states.
- Header stats must match detail sections below.
- One date format per chart (e.g. `MMM d`).

## CSS tokens (`globals.css`)

- `--surface-muted` — page background (`#F9FAFB`)
- `--accent` — brand green (`#059669`)
- `--sidebar-width` — `15rem` (240px / `w-60`)

---

## Universal Design QA Checklist

Run against every page before shipping UI changes.

### 1. Typography Hierarchy
- Max 3 text tiers per page: H1 → card label → body/data
- Card labels: uppercase OR sentence case — pick one, never mix
- Labels subordinate to values (smaller, muted)
- Big numbers are boldest/largest in their card
- Suffixes (`/100`, `%`) smaller + lighter than the number
- Subtitles use `leading-relaxed` (1.5+)

### 2. Color System
- Use `score-colors.ts` for all 0–100 scores (red / amber / green)
- Same value = same color everywhere
- Trends: green up, red down, gray flat
- Brand accent for CTAs and active nav only

### 3. Component Consistency
- Peer cards share anatomy (icon → label → value → delta)
- One primary + one secondary button style
- Tabs/filters styled identically across pages

### 4. Spacing & Layout
- Card gap: `gap-4`, padding: `p-5`
- Section spacing: `mt-8`
- No duplicate sections showing the same data

### 5. Data Integrity (fix first)
- No `Invalid Date`, null, undefined, NaN in UI
- Consistent date formats in charts
- Header stats match detail sections
- Designed empty states

### 6. Interactive Polish
- Hover/focus/active on all clickables
- Consistent active nav/tab treatment

### 7. Iconography
- Lucide icons only, `h-4 w-4` next to text
