# Local SEO Express — App Features & Tools Guide

Every feature and tool reachable from the **app sidebar (main menu)** or the **Free Tools menu**.  
Each entry is two short sentences: what it does, and the benefit to you.

**Last updated:** July 2026  
**App menu modes:** SMB (default, one-business) and Agency (full consultant nav). Set `NEXT_PUBLIC_NAV_MODE=agency` for agency menu.

---

## Part 1 — App main menu (SMB mode — default)

This is what most business owners see in the left sidebar after sign-in.

### Get started

**Get started** (`/onboarding`)  
Walks you through connecting your business and finishing first tasks. You reach a real result quickly instead of staring at an empty dashboard.

### Overview

**Overview** (`/businesses/{id}/overview`)  
Shows rankings, reviews, audits, and suggested next steps for your location in one screen. You get a fast “how am I doing?” without opening five different tools.

### Rank Tracking

**New Scan** (`/businesses/{id}/scans`)  
Runs a GeoGrid scan of your Google Maps rankings across your service area for a keyword. You see where you appear on the map pack—not just one pin at your storefront.

**Scan History** (`/scans`)  
Lists past Maps scans across your account. You can reopen old results for meetings, comparisons, or proof of progress.

**Keywords** (`/businesses/{id}/campaigns`) — paid; locked during trial  
Groups keywords and schedules recurring Maps scans automatically. You track rankings over time without redoing setup every week.

### Reviews

**Send Request** (`/businesses/{id}/reputation/requests`)  
Sends a one-off SMS or email asking a customer for a Google review. You collect reviews without awkward in-person asks.

**Customers** (`/businesses/{id}/reputation/contacts`)  
Stores your customer list with eligibility, import/export, and request history. You know who to ask next and avoid duplicate messages.

**Campaigns** (`/businesses/{id}/reputation/campaigns`) — paid; locked during trial  
Runs multi-step review automations with SMS/email, waits, and follow-ups. Review requests keep going until the customer clicks, replies, or opts out.

**QR Code & Review Link** (`/businesses/{id}/reputation/qr-campaigns`)  
Creates tracked Google review links and printable QR posters with scan analytics. You collect reviews offline—counter, invoice, job site—with measurable results.

**Request History** (`/businesses/{id}/reputation/requests?tab=bulk`)  
Logs every review request sent and how it performed. You have an audit trail of who was asked and what happened.

### Free Tools (app sidebar)

**Review Reply** (`/tools/review-response-generator`)  
Paste a customer review, pick a tone, and get an AI-drafted Google reply to copy and post. You respond professionally in seconds instead of staring at a blank box.

**Review Widget** (`/tools/google-review-widget`)  
Builds an embeddable review badge, bar, or review cards for your website. You add social proof on your site without hiring a developer.

**Scan Maps** (`/tools/google-maps-rank-checker`)  
Checks your Google Maps rank for one location and one keyword, plus top competitors. You get a quick visibility spot-check before buying full grid scans.

### Local SEO Audit

**Health Assessment** (`/businesses/{id}/local-seo-health`)  
Runs a fast local SEO health check for your business and keyword. You see what’s wrong quickly without a full deep audit.

**Complete Audit** (`/businesses/{id}/growth-audit`) — paid; locked during trial  
Runs a full audit across Google Business Profile, website, coverage, and competitors. You get a prioritized diagnosis of what is hurting local visibility.

### Settings

**Business Profile** (`/businesses/{id}/settings`)  
Edits business name, address, phone, Google Place, and keywords. Every tool stays pointed at the right business.

**Messaging** (`/businesses/{id}/reputation/messaging`) — paid; locked during trial  
Sets up A2P carrier registration and a dedicated SMS number for review requests. You send business texts legally and reliably from your own number.

**Review Sites** (`/businesses/{id}/reputation/settings`)  
Configures review links, quiet hours, detection rules, and retention settings. You control how and when review collection works.

**Billing** (`/settings/subscription`)  
Shows your plan, usage, and upgrade options. You see what is unlocked and what to buy next.

---

## Part 2 — App main menu (Agency mode)

Full consultant sidebar when `NEXT_PUBLIC_NAV_MODE=agency`. Free Tools section is empty in this mode; use marketing site or SMB nav for free tools.

### Get started

**Get started** (`/onboarding`)  
Guided setup to connect businesses and complete first wins. New users and team members get productive fast.

### Work

**Workspace** (`/workspace`)  
Daily hub for clients, prospects, your queue, and next actions. Consultants run the whole book of business from one place.

**Prospects** (`/prospects`)  
Pipeline of potential clients you are selling to. Sales opportunities stay organized instead of scattered in notes.

**All prospects** (`/prospects`)  
Full list view of every prospect in the pipeline. Quick access to open any opportunity.

**Prospect audits** (`/prospects/audits`)  
Runs and shares local SEO audits before you close a deal. You show prospects concrete gaps—not vague promises.

**Clients** (`/clients`)  
List of managed client locations. Jump into the right account in one click.

**Dashboard** (`/businesses/{id}/overview`)  
Performance snapshot for a selected client location. Per-location health at a glance.

**Maps Scans** (`/businesses/{id}/scans`)  
GeoGrid Google Maps rank scans for the selected location. Map-pack visibility proof for clients.

**Maps Campaigns** (`/businesses/{id}/campaigns`)  
Keyword groups plus scheduled recurring Maps scans. Ongoing rank tracking without weekly manual setup.

**Recent Scans** (`/scans`)  
Account-wide history of past Maps scans. Historical proof for reports and client meetings.

### Growth Tools

**Growth Audit** (`/businesses/{id}/growth-audit`)  
Full audit across profile, website, coverage, and competitors. Prioritized fix list for local visibility problems.

**Backlink Gap** (`/businesses/{id}/backlink-gap`)  
Compares competitor backlinks to find domains you are missing. Real outreach targets for stronger local authority.

**Local Trust** (`/businesses/{id}/trust`)  
Surfaces local credibility opportunities—directories, mentions, trust signals. Easy wins that make a business look more legitimate.

**AI Visibility** (`/ai-visibility` or `/businesses/{id}/ai-visibility`)  
Tracks whether AI search engines mention the business for local prompts. Presence in the new AI-search landscape.

### Text Messaging

**Overview** (`/businesses/{id}/reputation/messaging`)  
Shows SMS readiness and messaging status for the location. Quick answer to “can we text customers yet?”

**Registration** (`/businesses/{id}/reputation/messaging/status`)  
Tracks Brand and Campaign A2P registration progress with carriers. Know when approval lands—or what failed.

**Phone Number** (`/businesses/{id}/reputation/messaging/number`)  
Search, buy, and manage a dedicated business sending number. Texts come from a real business line, not a random shared number.

### Reputation

**Overview** (`/businesses/{id}/reputation/overview`)  
High-level review intelligence and coach signals for the location. Fast “are we on track?” for reputation.

#### Intelligence

**Reviews** (`/businesses/{id}/reputation/reviews`)  
Google review inbox with reply drafting in one place. Respond faster and stay on top of new feedback.

**Review Velocity** (`/businesses/{id}/reputation/analytics`)  
Charts review volume, speed, and trust trends over time. See if review growth is accelerating or stalling.

**Competitors** (`/businesses/{id}/reputation/competitors`)  
Leaderboard comparing your reviews vs local competitors. Know who is winning the review race in your market.

**Insights** (`/businesses/{id}/reputation/insights`)  
Themes and keywords customers mention in reviews. Turn feedback into service and product priorities.

**Reputation Audit** (`/businesses/{id}/reputation/audit`)  
Strategic reputation report for the location. Client-ready diagnosis of review strength and gaps.

#### Growth

**Review Requests** (`/businesses/{id}/reputation/requests`)  
Send one-off SMS or email review requests to customers. More reviews without manual follow-up every time.

**QR Campaigns** (`/businesses/{id}/reputation/qr-campaigns`)  
Tracked QR codes, review links, and printable posters with scan analytics. Offline review collection with measurable scans.

**Campaigns** (`/businesses/{id}/reputation/campaigns`)  
Sequenced multi-step review request automations. Hands-off follow-up until click, reply, or opt-out.

**Templates** (`/businesses/{id}/reputation/templates`)  
Reusable SMS and email message templates with merge fields. Consistent, on-brand review asks every time.

**Contacts** (`/businesses/{id}/reputation/contacts`)  
Manage who is eligible for review requests and import/export lists. Control who gets asked and avoid duplicates.

#### Automation

**Automations** (`/businesses/{id}/reputation/automations`)  
Webhooks and triggers from Zapier, Make, or your CRM to start review flows. Requests fire automatically when a job completes.

**Alerts** (`/businesses/{id}/reputation/alerts`)  
Notifications for reputation risks and opportunities. Early warning when volume drops or negatives spike.

#### Configuration

**Reputation Settings** (`/businesses/{id}/reputation/settings`)  
Module configuration: links, quiet hours, detection, retention, sender settings. Fine-tune how review collection behaves.

### Deliverables

**Reports** (`/reports` or `/businesses/{id}/reports`)  
Build shareable PDF or link reports from scans, reviews, and campaigns. Client-ready proof without spreadsheets.

**Growth Plan** (`/businesses/{id}/tasks`)  
Action list generated from audit findings. A clear fix list instead of a dense report nobody reads.

### Account

**Branding** (`/branding`)  
Logo, colors, and report footer for white-label deliverables. Client reports look like your agency’s brand.

**Settings** (`/settings`)  
Account hub: profile, team, subscription, security, and more. Owners manage access and billing safely.

---

## Part 3 — Free Tools menu (marketing website)

Reachable from the **Free Tools** dropdown on localseoexpress.com. No account required for most tools.

**All Free Tools** (`https://localseoexpress.com/free-tools/`)  
Hub catalog listing every free tool on the marketing site. Starting point before you sign up.

**Google Review Link & QR Code** (`https://localseoexpress.com/tools/google-review-link-qr-code/`)  
Creates a free printable Google review QR poster; customize colors; download PDF or PNG. Collect reviews at the counter, on invoices, or at job sites today.

App URL: `https://app.localseoexpress.com/google-review-qr-code-generator`

**AI Review Reply Generator** (`https://localseoexpress.com/tools/review-response-generator/`)  
Paste a review, pick a tone, generate a professional reply to post on Google. Respond to happy and unhappy customers in seconds.

App URL: `https://app.localseoexpress.com/tools/review-response-generator`

**Google Review Widget** (`https://localseoexpress.com/tools/google-review-widget/`)  
Build an embeddable review badge, bar, or review cards for your website. Show Google social proof without custom development.

App URL: `https://app.localseoexpress.com/tools/google-review-widget`

**Maps Rank Checker** (`https://localseoexpress.com/tools/google-maps-rank-checker/`)  
Free single-location, single-keyword Google Maps rank check with top competitors. Quick visibility spot-check before full GeoGrid scans.

App URL: `https://app.localseoexpress.com/tools/google-maps-rank-checker`

---

## Quick reference — menu vs mode

| Section | SMB menu (default) | Agency menu |
|--------|-------------------|-------------|
| Get started | Yes | Yes |
| Overview / Work | Overview only | Full Work section |
| Rank Tracking | New Scan, Scan History, Keywords* | Maps Scans, Maps Campaigns, Recent Scans |
| Reviews | Send Request, Customers, Campaigns*, QR, History | Full Reputation section |
| Free Tools | Review Reply, Review Widget, Scan Maps | Not in sidebar |
| Local SEO Audit | Health Assessment, Complete Audit* | Under Growth Tools (Growth Audit) |
| Settings | Business Profile, Messaging*, Review Sites, Billing | Account: Branding, Settings |
| Growth Tools | — | Growth Audit, Backlink Gap, Local Trust, AI Visibility |
| Text Messaging | — | Overview, Registration, Phone Number |
| Deliverables | — | Reports, Growth Plan |

\* Locked during trial → upgrade via Billing or `/settings/subscription?upgrade=…`

---

## How to download this file

- **From the repo:** `docs/App-Features-and-Tools-Guide.md`
- **From GitHub:** open the file in the repository and use Download or Raw view
- **From Cursor:** right-click the file in the file tree and download

For the full product feature list (including pages not in these menus), see `docs/Local-SEO-Express-Feature-List.md`.
