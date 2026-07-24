/**
 * Capture all Reputation Intelligence pages from this branch (real /reputation/* routes).
 * Also captures live production counterparts where routes already exist.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const LOCAL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const LIVE = process.env.LIVE_URL ?? "https://app.localseoexpress.com";
const LOCAL_BIZ = process.env.DEV_BUSINESS_ID ?? "preview";
const LIVE_BIZ = process.env.LIVE_BUSINESS_ID ?? "e64dbadd-69bb-4715-a526-6d137c0ae409";
const OUT = "/opt/cursor/artifacts/screenshots/reputation-live-verify";
const VIEWPORT = { width: 1440, height: 900 };

const NEW_PAGES = [
  ["overview", "Overview"],
  ["reviews", "Review Feed"],
  ["analytics", "Analytics"],
  ["insights", "Insights"],
  ["competitors", "Competitors"],
  ["alerts", "Alerts"],
  ["audit", "Audit"],
  ["automations", "Automations"],
  ["campaigns", "Campaigns"],
  ["contacts", "Contacts"],
  ["templates", "Templates"],
  ["requests", "Requests"],
  ["qr", "QR Poster"],
  ["settings", "Settings"],
];

const LIVE_PAGES = [
  ["reviews", "Reviews (live)"],
  ["review-momentum", "Momentum/Analytics (live)"],
  ["review-campaigns", "Campaigns (live)"],
  ["review-requests", "Requests (live)"],
  ["review-templates", "Templates (live)"],
  ["integrations", "Automations/Webhooks (live)"],
  ["review-settings", "Settings (live)"],
];

async function shot(page, url, file, waitText) {
  console.log("→", url);
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3500);
  if (waitText) {
    try {
      await page.getByText(waitText, { exact: false }).first().waitFor({ timeout: 15000 });
    } catch {
      console.warn("  waitText miss:", waitText);
    }
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: file, fullPage: true });
  const status = res?.status() ?? 0;
  const body = await page.locator("body").innerText().catch(() => "");
  const ok =
    status < 400 &&
    !/Application error|This page could not be found|Internal Server Error/i.test(body);
  console.log(" ", status, ok ? "OK" : "FAIL", path.basename(file));
  return { url, status, ok, file, snippet: body.slice(0, 180).replace(/\s+/g, " ") };
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "branch"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "live"), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });

  const results = { branch: [], live: [], sync: null };

  // Trigger live sync (momentum + audit) so live pages have fresh data.
  try {
    const syncMomentum = await page.request.post(`${LIVE}/api/reviews/momentum/run`, {
      data: { businessId: LIVE_BIZ, forceRefresh: true },
    });
    const syncAudit = await page.request.post(`${LIVE}/api/reputation/run`, {
      data: { businessId: LIVE_BIZ, forceRefresh: true },
    });
    results.sync = {
      momentum: await syncMomentum.json().catch(() => ({ status: syncMomentum.status() })),
      audit: await syncAudit.json().catch(() => ({ status: syncAudit.status() })),
    };
    console.log("live sync queued", results.sync);
    await page.waitForTimeout(8000);
  } catch (err) {
    console.warn("live sync failed", err);
  }

  for (const [slug, label] of NEW_PAGES) {
    const file = path.join(OUT, "branch", `reputation-${slug}.png`);
    results.branch.push(
      await shot(
        page,
        `${LOCAL}/businesses/${LOCAL_BIZ}/reputation/${slug}`,
        file,
        label.split(" ")[0]
      )
    );
  }

  for (const [slug, label] of LIVE_PAGES) {
    const file = path.join(OUT, "live", `${slug}.png`);
    results.live.push(
      await shot(page, `${LIVE}/businesses/${LIVE_BIZ}/${slug}`, file, null)
    );
  }

  // Probe whether new reputation routes exist on live yet.
  const liveNew = [];
  for (const [slug] of NEW_PAGES) {
    const url = `${LIVE}/businesses/${LIVE_BIZ}/reputation/${slug}`;
    const res = await page.request.get(url);
    liveNew.push({ slug, status: res.status() });
  }
  results.liveNewRouteStatus = liveNew;

  // Live API smoke checks for wired backends
  const apis = [
    `/api/reviews/${LIVE_BIZ}`,
    `/api/reputation/${LIVE_BIZ}`,
    `/api/reputation/review-requests/campaigns?businessId=${LIVE_BIZ}`,
    `/api/reputation/templates?businessId=${LIVE_BIZ}`,
    `/api/reputation/campaign-templates`,
    `/api/integrations/webhooks?businessId=${LIVE_BIZ}`,
    `/api/reputation/contacts?businessId=${LIVE_BIZ}`,
    `/api/reputation/settings?businessId=${LIVE_BIZ}`,
    `/api/reputation/review-link/${LIVE_BIZ}`,
  ];
  results.apis = [];
  for (const api of apis) {
    const res = await page.request.get(`${LIVE}${api}`);
    const json = await res.json().catch(() => null);
    results.apis.push({
      api,
      status: res.status(),
      ok: res.ok(),
      keys: json && typeof json === "object" ? Object.keys(json).slice(0, 12) : null,
      error: json?.error ?? null,
    });
    console.log("API", res.status(), api, json?.error ?? "ok");
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(results, null, 2));
  console.log("Wrote", path.join(OUT, "index.json"));

  const badBranch = results.branch.filter((r) => !r.ok);
  if (badBranch.length) {
    console.error("Branch page failures:", badBranch.map((b) => b.url));
    process.exit(1);
  }
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
