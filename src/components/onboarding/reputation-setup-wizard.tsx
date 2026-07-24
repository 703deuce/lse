"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
  Star,
  TrendingUp,
} from "lucide-react";
import {
  btnPrimary,
  btnSecondary,
  fieldLabelClass,
  inputClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

type Candidate = {
  name: string;
  address?: string;
  place_id?: string;
  cid?: string;
  category?: string;
  rating?: number;
  review_count?: number;
  phone?: string;
  lat?: number;
  lng?: number;
  website?: string;
  source?: string;
};

type BusinessForm = {
  name: string;
  website: string;
  phone: string;
  primaryService: string;
  city: string;
  locationCount: string;
};

type CollectionChannels =
  | "manual"
  | "upload"
  | "sms"
  | "email"
  | "qr"
  | "direct_link"
  | "automation_later";

type ReputationSummary = {
  rating: number | null;
  totalReviews: number;
  reviews30d: number;
  reviews90d: number;
  reviews365d: number;
  reviewsPerMonth: number;
  responseRatePct: number | null;
  avgResponseTime: string;
  unanswered: number | null;
  competitorReviewGap: number | null;
  competitorVelocityGap: number | null;
};

const ANALYZE_MESSAGES = [
  "Importing your Google reviews",
  "Calculating review velocity",
  "Checking response activity",
  "Finding local competitors",
  "Comparing your review performance",
] as const;

const CHANNEL_OPTIONS: Array<{ id: CollectionChannels; label: string }> = [
  { id: "manual", label: "Send manually" },
  { id: "upload", label: "Upload contacts" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
  { id: "qr", label: "QR code" },
  { id: "direct_link", label: "Direct review link" },
  { id: "automation_later", label: "Automated integration later" },
];

const FOLLOW_UP_OPTIONS = [
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
] as const;

const ACCENT = "#137752";

function formatMetric(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value}${suffix}`;
}

function deriveRecommendedPace(monthly: number): number {
  const m = Number.isFinite(monthly) ? Math.max(0, monthly) : 0;
  return Math.max(Math.round(m * 2), Math.round(m + 4));
}

function listingNeedsPrivateScanCenter(listing: Candidate): boolean {
  return !listing.address?.trim();
}

export function ReputationSetupWizard({
  initialBusinessId = null,
}: {
  initialBusinessId?: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [businessId, setBusinessId] = useState<string | null>(initialBusinessId);
  const [existingPlaceId, setExistingPlaceId] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(initialBusinessId));

  const [form, setForm] = useState<BusinessForm>({
    name: "",
    website: "",
    phone: "",
    primaryService: "",
    city: "",
    locationCount: "1",
  });

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [gbpConnected, setGbpConnected] = useState(false);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  const [analyzeIndex, setAnalyzeIndex] = useState(0);
  const [analyzeDone, setAnalyzeDone] = useState(false);
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const analyzeStarted = useRef(false);

  const [channels, setChannels] = useState<CollectionChannels[]>(["manual", "direct_link"]);
  const [displayName, setDisplayName] = useState("");
  const [requestMessage, setRequestMessage] = useState(
    "Hi {{name}} — thanks for choosing us! If you have a moment, we'd love a Google review."
  );
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [followUpDays, setFollowUpDays] = useState("7");
  const [savingCollection, setSavingCollection] = useState(false);

  const [notify, setNotify] = useState({
    every_new_review: true,
    low_rating_only: true,
    unanswered_only: true,
    response_overdue: true,
    velocity_drop: false,
    competitor_velocity_spike: false,
  });
  const [savingNotify, setSavingNotify] = useState(false);

  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationCountNum = Math.max(1, Number.parseInt(form.locationCount || "1", 10) || 1);
  const serviceAreaMode: "storefront" | "service_area" =
    locationCountNum > 1 || (selected ? listingNeedsPrivateScanCenter(selected) : false)
      ? "service_area"
      : "storefront";

  const step1Valid =
    form.name.trim().length > 0 &&
    form.primaryService.trim().length > 0 &&
    form.city.trim().length > 0;

  // Prefill when continuing with an existing business
  useEffect(() => {
    if (!initialBusinessId) return;
    let cancelled = false;
    (async () => {
      try {
        const [accountRes, settingsRes] = await Promise.all([
          fetch(`/api/businesses/${initialBusinessId}/account`),
          fetch(`/api/reputation/settings?businessId=${initialBusinessId}`),
        ]);
        const accountJson = await accountRes.json().catch(() => ({}));
        const settingsJson = await settingsRes.json().catch(() => ({}));
        if (cancelled) return;

        const account = accountJson.account as
          | {
              name?: string;
              website_url?: string | null;
              phone?: string | null;
              primary_category?: string | null;
              scan_center_label?: string | null;
              address_text?: string | null;
            }
          | undefined;
        const settings = settingsJson.settings as
          | {
              placeId?: string;
              businessName?: string;
              defaultSenderName?: string;
              defaultSenderEmail?: string;
              emailSenderName?: string;
            }
          | undefined;

        if (account) {
          setForm((prev) => ({
            ...prev,
            name: account.name ?? prev.name,
            website: account.website_url ?? prev.website,
            phone: account.phone ?? prev.phone,
            primaryService: account.primary_category ?? prev.primaryService,
            city:
              prev.city ||
              (account.scan_center_label || account.address_text || "")
                .split(",")
                .slice(-2)[0]
                ?.trim() ||
              prev.city,
          }));
          setDisplayName(account.name ?? "");
        }
        if (settings) {
          const placeId = settings.placeId?.trim() || null;
          setExistingPlaceId(placeId);
          if (placeId) {
            setGbpConnected(true);
            setSelected({
              name: settings.businessName || account?.name || "Connected listing",
              place_id: placeId,
            });
          }
          setSenderName(settings.defaultSenderName || settings.emailSenderName || "");
          setSenderEmail(settings.defaultSenderEmail || "");
        }
        setBusinessId(initialBusinessId);
      } catch {
        /* keep wizard usable even if prefetch fails */
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialBusinessId]);

  const searchGbp = useCallback(async () => {
    setSearching(true);
    setError(null);
    setCandidates([]);
    setSelected(null);
    setGbpConnected(false);
    try {
      const res = await fetch("/api/businesses/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          city: form.city.trim(),
          website: form.website.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      const list = (data.candidates ?? []) as Candidate[];
      setCandidates(list);
      if (!list.length) {
        setError("No Google listings found. Try a different name or city.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [form.name, form.city, form.website]);

  async function continueFromGbp() {
    if (!selected && !gbpConnected) {
      setError("Select your Google Business Profile listing to continue.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      // Already have a business with place_id connected — just continue
      if (businessId && gbpConnected && (selected?.place_id || existingPlaceId)) {
        if (selected?.place_id && selected.place_id !== existingPlaceId) {
          await fetch(`/api/businesses/${businessId}/attach-listing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              place_id: selected.place_id,
              cid: selected.cid ?? null,
              name: selected.name,
              website_url: selected.website ?? null,
              phone: selected.phone ?? null,
              address_text: selected.address ?? null,
              lat: selected.lat ?? null,
              lng: selected.lng ?? null,
              primary_category: selected.category ?? null,
            }),
          }).catch(() => null);
          setExistingPlaceId(selected.place_id);
        }
        setGbpConnected(true);
        setStep(3);
        return;
      }

      // Existing business without place_id — attach listing (no campaign entitlement)
      if (businessId && selected) {
        const patchRes = await fetch(`/api/businesses/${businessId}/attach-listing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            place_id: selected.place_id ?? null,
            cid: selected.cid ?? null,
            name: selected.name || form.name.trim(),
            website_url: selected.website || form.website.trim() || null,
            phone: selected.phone || form.phone.trim() || null,
            address_text: selected.address?.trim() || null,
            lat: selected.lat ?? null,
            lng: selected.lng ?? null,
            primary_category: selected.category || form.primaryService.trim() || null,
            service_area_mode: serviceAreaMode,
            scan_center_lat: selected.lat ?? null,
            scan_center_lng: selected.lng ?? null,
            scan_center_label: selected.address?.trim() || form.city.trim() || null,
          }),
        });
        if (patchRes.ok) {
          setExistingPlaceId(selected.place_id ?? null);
          setGbpConnected(true);
          setStep(3);
          return;
        }
        // Fall through to create if attach isn't available
      }

      if (!selected) {
        setError("Select a listing to continue.");
        return;
      }

      const res = await fetch("/api/businesses/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selected.name || form.name.trim(),
          website_url: selected.website || form.website.trim() || null,
          phone: selected.phone || form.phone.trim() || null,
          address_text: selected.address?.trim() || null,
          lat: selected.lat ?? null,
          lng: selected.lng ?? null,
          place_id: selected.place_id ?? null,
          cid: selected.cid ?? null,
          primary_category: selected.category || form.primaryService.trim() || null,
          service_area_mode: serviceAreaMode,
          keyword: form.primaryService.trim(),
          city: form.city.trim(),
          keywords: [form.primaryService.trim()],
          scan_center_lat: selected.lat ?? null,
          scan_center_lng: selected.lng ?? null,
          scan_center_label: selected.address?.trim() || form.city.trim() || null,
          isTracked: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create business");
      const id = data.business?.id as string | undefined;
      if (!id) throw new Error("Business created but no id returned");
      setBusinessId(id);
      setExistingPlaceId(selected.place_id ?? null);
      setGbpConnected(true);
      setDisplayName((d) => d || selected.name || form.name);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect listing");
    } finally {
      setCreating(false);
    }
  }

  const loadSummary = useCallback(async (id: string) => {
    let overview: Record<string, unknown> | null = null;
    let reviewsPage: Record<string, unknown> | null = null;

    try {
      const res = await fetch(`/api/reviews/overview?businessId=${encodeURIComponent(id)}`);
      if (res.ok) overview = await res.json();
    } catch {
      /* ignore */
    }

    if (!overview) {
      try {
        const res = await fetch(`/api/reviews/${encodeURIComponent(id)}`);
        if (res.ok) reviewsPage = await res.json();
      } catch {
        /* ignore */
      }
    } else {
      // Supplement response time / unanswered from reviews page when available
      try {
        const res = await fetch(`/api/reviews/${encodeURIComponent(id)}`);
        if (res.ok) reviewsPage = await res.json();
      } catch {
        /* ignore */
      }
    }

    if (overview) {
      const reviews30d = Number(overview.reviews30d ?? overview.gained30d ?? 0);
      const reviews90d = Number(overview.reviews90d ?? 0);
      const totalReviews = Number(overview.totalReviews ?? 0);
      const reviewsPerMonth = Number(overview.reviewsPerMonth ?? 0);
      const reviews365Approx =
        overview.reviews365d != null
          ? Number(overview.reviews365d)
          : totalReviews > 0 && reviews90d * 4 > totalReviews
            ? totalReviews
            : Math.max(reviews90d * 4, reviews30d * 12, totalReviews);

      const impactRows = (overview.impactRows as Array<{
        name: string;
        reviewsGained: number;
        isYou?: boolean;
      }>) ?? [];
      const youRow = impactRows.find((r) => r.isYou);
      const competitors = impactRows.filter(
        (r) => !r.isYou && !/benchmark/i.test(r.name)
      );
      const topComp = competitors.sort((a, b) => b.reviewsGained - a.reviewsGained)[0];
      const competitorReviewGap =
        youRow && topComp ? topComp.reviewsGained - youRow.reviewsGained : null;

      const trend = (overview.trendSeries as Array<{ you: number; competitor: number }>) ?? [];
      const last = trend[trend.length - 1];
      const competitorVelocityGap =
        last != null ? last.competitor - last.you : competitorReviewGap;

      const kpis = reviewsPage?.kpis as
        | {
            unanswered90d?: number;
            avgDaysWaiting?: number | null;
            responseRate?: number;
            reviewGap?: number;
          }
        | undefined;

      setSummary({
        rating: (overview.googleRating as number | null) ?? null,
        totalReviews,
        reviews30d,
        reviews90d,
        reviews365d: Math.round(reviews365Approx),
        reviewsPerMonth,
        responseRatePct:
          overview.responseRatePct != null
            ? Number(overview.responseRatePct)
            : kpis?.responseRate ?? null,
        avgResponseTime:
          kpis?.avgDaysWaiting != null ? `${kpis.avgDaysWaiting}d` : "—",
        unanswered:
          kpis?.unanswered90d ??
          (overview.unansweredNegative != null
            ? Number(overview.unansweredNegative)
            : overview.answeredOf != null && overview.answeredCount != null
              ? Number(overview.answeredOf) - Number(overview.answeredCount)
              : null),
        competitorReviewGap: kpis?.reviewGap ?? competitorReviewGap,
        competitorVelocityGap,
      });
      return;
    }

    if (reviewsPage) {
      const kpis = reviewsPage.kpis as {
        avgRating?: number | null;
        totalReviews?: number;
        newReviews90d?: number;
        responseRate?: number;
        unanswered90d?: number;
        avgDaysWaiting?: number | null;
        reviewGap?: number;
      };
      const reviews90d = Number(kpis?.newReviews90d ?? 0);
      const totalReviews = Number(kpis?.totalReviews ?? 0);
      const monthly = reviews90d / 3;
      setSummary({
        rating: kpis?.avgRating ?? null,
        totalReviews,
        reviews30d: Math.round(reviews90d / 3),
        reviews90d,
        reviews365d: Math.max(totalReviews, Math.round(reviews90d * 4)),
        reviewsPerMonth: Math.round(monthly * 10) / 10,
        responseRatePct: kpis?.responseRate ?? null,
        avgResponseTime:
          kpis?.avgDaysWaiting != null ? `${kpis.avgDaysWaiting}d` : "—",
        unanswered: kpis?.unanswered90d ?? null,
        competitorReviewGap: kpis?.reviewGap ?? null,
        competitorVelocityGap: null,
      });
      return;
    }

    setSummary({
      rating: null,
      totalReviews: 0,
      reviews30d: 0,
      reviews90d: 0,
      reviews365d: 0,
      reviewsPerMonth: 0,
      responseRatePct: null,
      avgResponseTime: "—",
      unanswered: null,
      competitorReviewGap: null,
      competitorVelocityGap: null,
    });
  }, []);

  // Step 3: sequential analysis UI + sync, then poll for summary data
  useEffect(() => {
    if (step !== 3 || !businessId || analyzeStarted.current) return;
    analyzeStarted.current = true;
    setAnalyzeDone(false);
    setAnalyzeIndex(0);
    setSummary(null);

    void fetch("/api/reputation/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    }).catch(() => null);

    const timers: ReturnType<typeof setTimeout>[] = [];
    ANALYZE_MESSAGES.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setAnalyzeIndex(i);
        }, i * 900)
      );
    });

    let cancelled = false;
    const pollSummary = async () => {
      const deadline = Date.now() + 18_000;
      while (!cancelled && Date.now() < deadline) {
        await loadSummary(businessId);
        // Stop early once we have meaningful review totals
        // (loadSummary sets state; re-read via a lightweight check)
        try {
          const res = await fetch(
            `/api/reviews/overview?businessId=${encodeURIComponent(businessId)}`
          );
          if (res.ok) {
            const json = (await res.json()) as { totalReviews?: number; hasReviewsData?: boolean };
            if (json.hasReviewsData || Number(json.totalReviews ?? 0) > 0) break;
          }
        } catch {
          /* keep polling */
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (!cancelled) {
        await loadSummary(businessId);
        setAnalyzeDone(true);
      }
    };

    timers.push(
      setTimeout(() => {
        void pollSummary();
      }, ANALYZE_MESSAGES.length * 900 + 200)
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [step, businessId, loadSummary]);

  function toggleChannel(id: CollectionChannels) {
    setChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function saveCollectionAndContinue(skip: boolean) {
    if (!businessId) {
      setError("Missing business — go back and connect a listing.");
      return;
    }
    setSavingCollection(true);
    setError(null);
    try {
      if (!skip) {
        await fetch("/api/workflow/setup-preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            displayName: (displayName || form.name).trim(),
            requestMessage: requestMessage.trim(),
            senderName: senderName.trim() || (displayName || form.name).trim(),
            senderEmail: senderEmail.trim() || undefined,
            followUpDays,
            channels,
            qrBrandingNote: "Use brand colors on the QR poster from Reputation → QR Poster.",
          }),
        }).catch(() => null);
      }
      setStep(5);
    } finally {
      setSavingCollection(false);
    }
  }

  async function saveNotificationsAndContinue() {
    if (!businessId) {
      setError("Missing business — go back and connect a listing.");
      return;
    }
    setSavingNotify(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          fromSetup: true,
          every_new_review: notify.every_new_review,
          low_rating_only: notify.low_rating_only,
          unanswered_only: notify.unanswered_only,
          response_overdue: notify.response_overdue,
          velocity_drop: notify.velocity_drop,
          competitor_velocity_spike: notify.competitor_velocity_spike,
        }),
      });
      // Soft-continue on entitlement/API failures so setup never gets stuck
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.warn("Notification save skipped:", json.error ?? res.status);
      }
      setStep(6);
    } catch {
      setStep(6);
    } finally {
      setSavingNotify(false);
    }
  }

  async function finishAndGo(path: "overview" | "requests") {
    if (!businessId) return;
    setFinishing(true);
    setError(null);
    try {
      const res = await fetch("/api/workflow/setup-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Could not complete setup");
      }
      const href =
        path === "overview"
          ? `/businesses/${businessId}/reputation/overview`
          : `/businesses/${businessId}/reputation/requests`;
      router.push(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish setup");
      setFinishing(false);
    }
  }

  const recommendedPace = useMemo(
    () => deriveRecommendedPace(summary?.reviewsPerMonth ?? 0),
    [summary?.reviewsPerMonth]
  );

  if (loadingExisting) {
    return (
      <div className="mx-auto flex max-w-xl items-center gap-2 py-16 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your business…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pb-10">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#137752]">
          Local SEO Express
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
          Reputation setup
        </h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Connect Google reviews, see where you stand, and turn on collection + alerts.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-medium text-zinc-600">
          Step {step} of 6
        </p>
        <div className="flex flex-1 justify-end gap-1">
          {([1, 2, 3, 4, 5, 6] as WizardStep[]).map((n) => (
            <span
              key={n}
              className={cn(
                "h-1.5 w-6 rounded-full sm:w-8",
                n <= step ? "bg-[#137752]" : "bg-zinc-200"
              )}
              style={n <= step ? { backgroundColor: ACCENT } : undefined}
            />
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </p>
      ) : null}

      {/* Step 1 */}
      {step === 1 ? (
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-900">Create the business</h2>
            <p className="mt-1 text-[13px] text-zinc-500">
              Tell us who you&apos;re setting up reputation for.
            </p>
          </div>
          <div className="space-y-3">
            <label className="block text-sm">
              <span className={fieldLabelClass}>Business name</span>
              <input
                className={cn(inputClass, "mt-1")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Acme Plumbing"
                autoFocus
              />
            </label>
            <label className="block text-sm">
              <span className={fieldLabelClass}>Website</span>
              <input
                className={cn(inputClass, "mt-1")}
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://example.com"
              />
            </label>
            <label className="block text-sm">
              <span className={fieldLabelClass}>Phone number</span>
              <input
                className={cn(inputClass, "mt-1")}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </label>
            <label className="block text-sm">
              <span className={fieldLabelClass}>Primary service</span>
              <input
                className={cn(inputClass, "mt-1")}
                value={form.primaryService}
                onChange={(e) => setForm((f) => ({ ...f, primaryService: e.target.value }))}
                placeholder="Emergency plumber"
              />
            </label>
            <label className="block text-sm">
              <span className={fieldLabelClass}>City / service area</span>
              <input
                className={cn(inputClass, "mt-1")}
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Austin, TX"
              />
            </label>
            <label className="block text-sm">
              <span className={fieldLabelClass}>Number of locations</span>
              <input
                type="number"
                min={1}
                className={cn(inputClass, "mt-1")}
                value={form.locationCount}
                onChange={(e) => setForm((f) => ({ ...f, locationCount: e.target.value }))}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={!step1Valid}
            className={cn(btnPrimary, "h-10 w-full text-[13px] sm:w-auto")}
            onClick={() => {
              setError(null);
              setDisplayName((d) => d || form.name.trim());
              setStep(2);
            }}
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </section>
      ) : null}

      {/* Step 2 */}
      {step === 2 ? (
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-900">
              Connect Google Business Profile
            </h2>
            <p className="mt-1 text-[13px] text-zinc-500">
              There is no separate Google login here. Search for your listing and select it —
              that grants Local SEO Express access to import your reviews and profile data.
            </p>
          </div>

          {gbpConnected && existingPlaceId && !candidates.length ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#137752]" />
              <div>
                <p className="text-[13px] font-semibold text-zinc-900">
                  Google Business Profile connected
                </p>
                <p className="mt-0.5 text-[12px] text-zinc-600">
                  {selected?.name || form.name}
                  {existingPlaceId ? (
                    <span className="mt-1 block font-mono text-[11px] text-zinc-400">
                      {existingPlaceId}
                    </span>
                  ) : null}
                </p>
                <button
                  type="button"
                  className="mt-2 text-[12px] font-semibold text-[#137752] hover:underline"
                  onClick={() => {
                    setGbpConnected(false);
                    void searchGbp();
                  }}
                >
                  Search again / change listing
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={searching || !form.name.trim()}
                  className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
                  onClick={() => void searchGbp()}
                >
                  {searching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  Search listings
                </button>
                <p className="self-center text-[11px] text-zinc-500">
                  Searching “{form.name}” near {form.city || "your city"}
                </p>
              </div>

              {candidates.length > 0 ? (
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {candidates.map((c, idx) => {
                    const active =
                      selected?.place_id === c.place_id &&
                      selected?.name === c.name &&
                      selected?.cid === c.cid;
                    return (
                      <li key={`${c.place_id ?? c.cid ?? c.name}-${idx}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(c);
                            setGbpConnected(false);
                            setError(null);
                          }}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition",
                            active
                              ? "border-[#137752] bg-[#ECFDF3]"
                              : "border-zinc-200 bg-white hover:border-zinc-300"
                          )}
                        >
                          <MapPin
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              active ? "text-[#137752]" : "text-zinc-400"
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold text-zinc-900">
                              {c.name}
                            </span>
                            {c.address ? (
                              <span className="mt-0.5 block text-[12px] text-zinc-500">
                                {c.address}
                              </span>
                            ) : (
                              <span className="mt-0.5 block text-[12px] text-amber-700">
                                Service-area listing (no public address)
                              </span>
                            )}
                            <span className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                              {c.rating != null ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <Star className="h-3 w-3 text-amber-500" /> {c.rating}
                                  {c.review_count != null ? ` · ${c.review_count} reviews` : ""}
                                </span>
                              ) : null}
                              {c.category ? <span>{c.category}</span> : null}
                            </span>
                          </span>
                          {active ? (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#137752]" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => {
                setError(null);
                setStep(1);
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={creating || (!selected && !gbpConnected)}
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              onClick={() => void continueFromGbp()}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      ) : null}

      {/* Step 3 */}
      {step === 3 ? (
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-900">Analyze the reputation</h2>
            <p className="mt-1 text-[13px] text-zinc-500">
              Pulling Google reviews and comparing local competition.
            </p>
          </div>

          {!analyzeDone ? (
            <ul className="space-y-2">
              {ANALYZE_MESSAGES.map((msg, i) => {
                const done = i < analyzeIndex;
                const active = i === analyzeIndex;
                return (
                  <li
                    key={msg}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]",
                      active
                        ? "border-[#A6F4C5] bg-[#ECFDF3] text-zinc-900"
                        : done
                          ? "border-zinc-100 text-zinc-500"
                          : "border-zinc-100 text-zinc-400"
                    )}
                  >
                    {done ? (
                      <Check className="h-3.5 w-3.5 text-[#137752]" />
                    ) : active ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#137752]" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border border-zinc-200" />
                    )}
                    {msg}
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <MetricCard
                  label="Current rating"
                  value={
                    summary?.rating != null ? summary.rating.toFixed(1) : "—"
                  }
                  icon={Star}
                />
                <MetricCard
                  label="Total reviews"
                  value={formatMetric(summary?.totalReviews)}
                  icon={MessageSquare}
                />
                <MetricCard
                  label="Last 30 days"
                  value={formatMetric(summary?.reviews30d)}
                />
                <MetricCard
                  label="Last 90 days"
                  value={formatMetric(summary?.reviews90d)}
                />
                <MetricCard
                  label="Last ~365 days"
                  value={formatMetric(summary?.reviews365d)}
                />
                <MetricCard
                  label="Avg monthly velocity"
                  value={formatMetric(summary?.reviewsPerMonth)}
                  icon={TrendingUp}
                />
                <MetricCard
                  label="Response rate"
                  value={
                    summary?.responseRatePct != null
                      ? `${Math.round(summary.responseRatePct)}%`
                      : "—"
                  }
                />
                <MetricCard
                  label="Avg response time"
                  value={summary?.avgResponseTime ?? "—"}
                />
                <MetricCard
                  label="Unanswered reviews"
                  value={formatMetric(summary?.unanswered)}
                />
                <MetricCard
                  label="Competitor review gap"
                  value={
                    summary?.competitorReviewGap == null
                      ? "—"
                      : summary.competitorReviewGap > 0
                        ? `−${summary.competitorReviewGap}`
                        : `+${Math.abs(summary.competitorReviewGap)}`
                  }
                />
                <MetricCard
                  label="Competitor velocity gap"
                  value={
                    summary?.competitorVelocityGap == null
                      ? "—"
                      : String(summary.competitorVelocityGap)
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
                  onClick={() => {
                    analyzeStarted.current = false;
                    setStep(2);
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button
                  type="button"
                  className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
                  onClick={() => {
                    setError(null);
                    setStep(4);
                  }}
                >
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* Step 4 */}
      {step === 4 ? (
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-900">
              Set up review collection
            </h2>
            <p className="mt-1 text-[13px] text-zinc-500">
              Choose how you plan to ask for reviews. You can refine campaigns later.
            </p>
          </div>

          <div>
            <p className={fieldLabelClass}>How will you request reviews?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CHANNEL_OPTIONS.map((opt) => {
                const on = channels.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleChannel(opt.id)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[12px] font-medium transition",
                      on
                        ? "border-[#137752] bg-[#ECFDF3] text-[#027A48]"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm">
              <span className={fieldLabelClass}>Business display name</span>
              <input
                className={cn(inputClass, "mt-1")}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={form.name}
              />
            </label>
            <label className="block text-sm">
              <span className={fieldLabelClass}>Review-request message</span>
              <textarea
                className={cn(inputClass, "mt-1 min-h-[88px]")}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className={fieldLabelClass}>Sender name</span>
                <input
                  className={cn(inputClass, "mt-1")}
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Jordan at Acme"
                />
              </label>
              <label className="block text-sm">
                <span className={fieldLabelClass}>Sender email</span>
                <input
                  type="email"
                  className={cn(inputClass, "mt-1")}
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="hello@example.com"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className={fieldLabelClass}>Follow-up timing</span>
              <select
                className={cn(inputClass, "mt-1")}
                value={followUpDays}
                onChange={(e) => setFollowUpDays(e.target.value)}
              >
                {FOLLOW_UP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
              QR poster branding uses your workspace brand colors and logo when you print posters
              from Reputation → Requests. You can customize branding in Settings anytime.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep(3)}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={savingCollection}
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              onClick={() => void saveCollectionAndContinue(false)}
            >
              {savingCollection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={savingCollection}
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => void saveCollectionAndContinue(true)}
            >
              Skip for now — I&apos;ll start manually
            </button>
          </div>
        </section>
      ) : null}

      {/* Step 5 */}
      {step === 5 ? (
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
              <Bell className="h-4 w-4 text-[#137752]" />
              Configure notifications
            </h2>
            <p className="mt-1 text-[13px] text-zinc-500">
              Choose which reputation events should alert your team.
            </p>
          </div>

          <ul className="space-y-2">
            {(
              [
                {
                  key: "every_new_review" as const,
                  label: "New review received",
                  hint: "every_new_review",
                },
                {
                  key: "low_rating_only" as const,
                  label: "Negative review received",
                  hint: "low_rating_only",
                },
                {
                  key: "unanswered_only" as const,
                  label: "Review needs a response",
                  hint: "unanswered_only / response_overdue",
                },
                {
                  key: "velocity_drop" as const,
                  label: "Review velocity declines",
                  hint: "velocity_drop",
                },
                {
                  key: "competitor_velocity_spike" as const,
                  label: "Competitor gains reviews unusually quickly",
                  hint: "competitor_velocity_spike",
                },
              ] as const
            ).map((item) => (
              <li key={item.key}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 hover:bg-zinc-50">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-[#137752] focus:ring-[#137752]"
                    checked={notify[item.key]}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setNotify((n) => {
                        const next = { ...n, [item.key]: checked };
                        // "Needs a response" also drives response_overdue
                        if (item.key === "unanswered_only") {
                          next.response_overdue = checked;
                        }
                        return next;
                      });
                    }}
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-zinc-900">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-zinc-400">{item.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep(4)}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={savingNotify}
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              onClick={() => void saveNotificationsAndContinue()}
            >
              {savingNotify ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      ) : null}

      {/* Step 6 */}
      {step === 6 ? (
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-900">
              Your Google review system is ready.
            </h2>
            <p className="mt-1 text-[13px] text-zinc-500">
              {displayName || form.name || "Your business"} is connected and ready for review
              growth.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <MetricCard
              label="Rating"
              value={summary?.rating != null ? summary.rating.toFixed(1) : "—"}
              icon={Star}
            />
            <MetricCard label="Total reviews" value={formatMetric(summary?.totalReviews)} />
            <MetricCard
              label="Monthly velocity"
              value={formatMetric(summary?.reviewsPerMonth)}
              icon={TrendingUp}
            />
            <MetricCard
              label="Recommended monthly pace"
              value={String(recommendedPace)}
            />
            <MetricCard
              label="Response rate"
              value={
                summary?.responseRatePct != null
                  ? `${Math.round(summary.responseRatePct)}%`
                  : "—"
              }
            />
            <MetricCard
              label="Unanswered"
              value={formatMetric(summary?.unanswered)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={finishing || !businessId}
              className={cn(btnPrimary, "h-10 px-4 text-[13px]")}
              onClick={() => void finishAndGo("overview")}
            >
              {finishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Go to Reputation Overview
            </button>
            <button
              type="button"
              disabled={finishing || !businessId}
              className={cn(btnSecondary, "h-10 px-4 text-[13px]")}
              onClick={() => void finishAndGo("requests")}
            >
              Start Getting Reviews
            </button>
          </div>

          {businessId ? (
            <p className="text-[11px] text-zinc-400">
              Or open{" "}
              <Link
                href={`/businesses/${businessId}/reputation/overview`}
                className="font-medium text-[#137752] hover:underline"
              >
                overview
              </Link>{" "}
              after setup completes.
            </p>
          ) : null}

          <button
            type="button"
            className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
            onClick={() => setStep(5)}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Star;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2.5">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}
