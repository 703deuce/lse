import { NextResponse } from "next/server";
import { mapsSearch } from "@/lib/providers/scrapingdog";
import { myBusinessInfo } from "@/lib/providers/dataforseo";
import { publicToolCorsHeaders } from "@/lib/public/cors";
import { assertRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 45;

type CheckStatus = "good" | "fix" | "missing";

type AuditCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  category: "profile" | "website" | "reviews" | "citations";
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function scoreFromChecks(checks: AuditCheck[]): number {
  if (!checks.length) return 0;
  const points = checks.reduce((sum, c) => {
    if (c.status === "good") return sum + 1;
    if (c.status === "fix") return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((points / checks.length) * 100);
}

function categorySummary(checks: AuditCheck[], category: AuditCheck["category"]) {
  const subset = checks.filter((c) => c.category === category);
  const good = subset.filter((c) => c.status === "good").length;
  const fix = subset.filter((c) => c.status !== "good").length;
  return { good, fix, total: subset.length };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: publicToolCorsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const headers = publicToolCorsHeaders(request.headers.get("origin"));
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rate = await assertRateLimit({
      key: `public-local-audit:${ip}`,
      maxPerWindow: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Free audit limit reached for this network. Sign up for full audits." },
        { status: 429, headers }
      );
    }

    const body = (await request.json()) as {
      placeId?: string;
      name?: string;
      address?: string;
      rating?: number;
      reviewCount?: number;
    };

    const placeId = String(body.placeId ?? "").trim();
    const name = String(body.name ?? "").trim();
    const address = String(body.address ?? "").trim();

    if (!placeId || !name) {
      return NextResponse.json(
        { error: "Select a Google Business Profile to audit." },
        { status: 400, headers }
      );
    }

    let phone: string | undefined;
    let website: string | undefined;
    let category: string | undefined;
    let description: string | undefined;
    let hours: unknown;
    let claimed: boolean | undefined;
    let rating =
      typeof body.rating === "number" && Number.isFinite(body.rating) ? body.rating : undefined;
    let reviewCount =
      typeof body.reviewCount === "number" && Number.isFinite(body.reviewCount)
        ? body.reviewCount
        : undefined;

    try {
      const dfs = await withTimeout(
        myBusinessInfo({
          keyword: name,
          placeId,
          country: "United States",
        }),
        10000
      );
      const match = dfs.find((r) => r.place_id === placeId) ?? dfs[0];
      if (match) {
        phone = match.phone;
        website = match.url;
        category = match.category;
        description = match.description;
        hours = match.work_time;
        claimed = match.is_claimed;
        if (match.rating?.value != null) rating = match.rating.value;
        if (match.rating?.votes_count != null) reviewCount = match.rating.votes_count;
      }
    } catch {
      /* try maps search enrichment */
    }

    if (rating == null || reviewCount == null) {
      try {
        const sd = await withTimeout(mapsSearch({ query: name }), 8000);
        const match = sd.find((r) => r.place_id === placeId) ?? sd[0];
        if (match) {
          if (rating == null && typeof match.rating === "number") rating = match.rating;
          if (reviewCount == null && typeof match.reviews === "number") reviewCount = match.reviews;
          if (!website && match.website) website = match.website;
          if (!phone && match.phone) phone = match.phone;
        }
      } catch {
        /* continue with known fields */
      }
    }

    const checks: AuditCheck[] = [
      {
        id: "name",
        label: "Business name",
        status: name ? "good" : "missing",
        detail: name ? "Name is present on Google." : "Add a clear business name.",
        category: "profile",
      },
      {
        id: "address",
        label: "Business address",
        status: address ? "good" : "missing",
        detail: address ? "Address is present." : "Add your business address or service area.",
        category: "profile",
      },
      {
        id: "phone",
        label: "Phone number",
        status: phone ? "good" : "missing",
        detail: phone ? "Phone number found." : "Add a phone number customers can call.",
        category: "profile",
      },
      {
        id: "category",
        label: "Primary category",
        status: category ? "good" : "missing",
        detail: category ? `Category: ${category}` : "Set a primary Google Business category.",
        category: "profile",
      },
      {
        id: "description",
        label: "Business description",
        status: description ? "good" : "missing",
        detail: description
          ? "Description is present."
          : "Add a Google Business Profile description.",
        category: "profile",
      },
      {
        id: "hours",
        label: "Business hours",
        status: hours ? "good" : "fix",
        detail: hours ? "Hours appear to be set." : "Confirm and publish your business hours.",
        category: "profile",
      },
      {
        id: "claimed",
        label: "Claimed profile",
        status: claimed === false ? "missing" : claimed === true ? "good" : "fix",
        detail:
          claimed === true
            ? "Profile appears claimed."
            : claimed === false
              ? "Claim your Google Business Profile."
              : "Verify the profile is claimed and managed by you.",
        category: "profile",
      },
      {
        id: "website",
        label: "Website link",
        status: website ? "good" : "missing",
        detail: website ? "Website link found." : "Add your website to Google Business Profile.",
        category: "website",
      },
      {
        id: "review-count",
        label: "Review volume",
        status:
          (reviewCount ?? 0) >= 30 ? "good" : (reviewCount ?? 0) >= 10 ? "fix" : "missing",
        detail: `${reviewCount ?? 0} Google reviews found.`,
        category: "reviews",
      },
      {
        id: "rating",
        label: "Average rating",
        status: (rating ?? 0) >= 4.5 ? "good" : (rating ?? 0) >= 4 ? "fix" : "missing",
        detail: rating != null ? `${rating.toFixed(1)} average rating.` : "No rating found yet.",
        category: "reviews",
      },
      {
        id: "citations",
        label: "Citation readiness",
        status: phone && address && name ? "good" : "fix",
        detail:
          phone && address && name
            ? "NAP basics look ready for citation consistency checks."
            : "Complete name, address, and phone before fixing citations.",
        category: "citations",
      },
      {
        id: "nap-consistency",
        label: "NAP completeness",
        status: name && address && phone ? "good" : "fix",
        detail:
          name && address && phone
            ? "Core NAP fields are present."
            : "Finish name, address, and phone for NAP consistency.",
        category: "citations",
      },
    ];

    const score = scoreFromChecks(checks);
    const toFix = checks
      .filter((c) => c.status !== "good")
      .map((c) => ({ id: c.id, label: c.label, detail: c.detail, status: c.status }));

    return NextResponse.json(
      {
        business: {
          name,
          place_id: placeId,
          address,
          phone: phone ?? null,
          website: website ?? null,
          category: category ?? null,
          rating: rating ?? null,
          review_count: reviewCount ?? null,
        },
        score,
        categories: {
          profile: categorySummary(checks, "profile"),
          website: categorySummary(checks, "website"),
          reviews: categorySummary(checks, "reviews"),
          citations: categorySummary(checks, "citations"),
        },
        checks,
        to_fix: toFix,
        limited: true,
        upgrade_hint:
          "This free audit covers Google Business Profile basics. Sign up for the full Local SEO Audit with website crawl, competitors, and prioritized growth plans.",
      },
      { headers }
    );
  } catch {
    return NextResponse.json(
      { error: "Could not run the audit right now. Try again in a moment." },
      { status: 500, headers }
    );
  }
}
