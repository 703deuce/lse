"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, MapPin, Search } from "lucide-react";

interface Candidate {
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
  source: string;
}

function listingNeedsPrivateScanCenter(listing: Candidate): boolean {
  return !listing.address?.trim();
}

export default function NewBusinessPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 py-12 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      }
    >
      <NewBusinessPageInner />
    </Suspense>
  );
}

function NewBusinessPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountAs = useMemo(() => {
    const raw = searchParams.get("as");
    return raw === "prospect" ? "prospect" : "client";
  }, [searchParams]);
  const isProspect = accountAs === "prospect";
  const [step, setStep] = useState<"search" | "select" | "setup">("search");
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [privateAddress, setPrivateAddress] = useState("");
  const [scanCenter, setScanCenter] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    city: "",
    keyword: "",
    keyword2: "",
    keyword3: "",
    website: "",
    service_area_mode: "storefront" as "storefront" | "service_area",
  });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/businesses/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          city: form.city,
          website: form.website,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setCandidates(data.candidates ?? []);
      setStep("select");
      if (!data.candidates?.length) {
        setError("No listings found. Try a different name or city.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function verifyPrivateAddress() {
    const q = privateAddress.trim();
    if (!q) {
      setError("Enter a street address, or a city and state, for your private scan center.");
      return;
    }
    setGeocoding(true);
    setError(null);
    try {
      const res = await fetch("/api/scans/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: q }),
      });
      const json = (await res.json()) as {
        error?: string;
        lat?: number;
        lng?: number;
        label?: string;
        displayName?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not find that location");
      if (json.lat == null || json.lng == null) throw new Error("Could not find that location");
      setScanCenter({
        lat: json.lat,
        lng: json.lng,
        label: json.displayName ?? json.label ?? q,
      });
    } catch (err) {
      setScanCenter(null);
      setError(err instanceof Error ? err.message : "Could not find that location");
    } finally {
      setGeocoding(false);
    }
  }

  async function handleCreate() {
    if (!selected) return;

    const needsPrivate = listingNeedsPrivateScanCenter(selected);
    if (needsPrivate && !scanCenter) {
      setError("Verify a private scan-center address before saving.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const keywordList = [form.keyword, form.keyword2, form.keyword3]
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 3);
      const primaryKeyword = keywordList[0] || form.name;
      const res = await fetch("/api/businesses/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selected.name,
          website_url: selected.website ?? form.website,
          phone: selected.phone,
          address_text: selected.address?.trim() || null,
          lat: selected.lat ?? scanCenter?.lat ?? null,
          lng: selected.lng ?? scanCenter?.lng ?? null,
          place_id: selected.place_id,
          cid: selected.cid,
          primary_category: selected.category,
          service_area_mode: form.service_area_mode,
          scan_center_lat: scanCenter?.lat ?? selected.lat ?? null,
          scan_center_lng: scanCenter?.lng ?? selected.lng ?? null,
          scan_center_label: scanCenter?.label ?? selected.address?.trim() ?? null,
          keyword: isProspect ? undefined : primaryKeyword,
          keywords: isProspect ? (keywordList.length ? keywordList : [primaryKeyword]) : undefined,
          city: form.city,
          // Prospects do not consume an active location slot until converted.
          isTracked: !isProspect,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 || /max businesses|plan limit/i.test(String(data.error ?? ""))) {
          throw new Error(
            data.error ??
              "Active location limit reached for your plan. Archive a client or upgrade to add another."
          );
        }
        throw new Error(data.error ?? "Create failed");
      }
      if (isProspect) {
        router.push(`/prospects/${data.business.id}/audit`);
      } else {
        router.push(`/businesses/${data.business.id}/overview`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  const needsPrivateAddress = selected ? listingNeedsPrivateScanCenter(selected) : false;
  const canSave =
    !!selected &&
    !loading &&
    !geocoding &&
    (!needsPrivateAddress || !!scanCenter);

  return (
    <div className="mx-auto w-full max-w-2xl">
        <Link
          href={isProspect ? "/prospects" : "/clients"}
          className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold">
          {isProspect ? "Add a prospect" : "Add a client"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isProspect
            ? "Find their Google listing to run a prospect audit. Scans and reports stay with this record if you convert them to a client later."
            : "Find their Google listing. Each client location gets its own keywords, Maps scans, and branded reports."}
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {step === "search" && (
          <form onSubmit={handleSearch} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium">Business name</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">City</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                {isProspect ? "Primary audit keywords" : "Primary keyword to track"}
              </label>
              {isProspect ? (
                <div className="mt-1 space-y-2">
                  <input
                    required
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                    placeholder="Keyword 1 (required) — e.g. junk removal Woodbridge"
                    value={form.keyword}
                    onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  />
                  <input
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                    placeholder="Keyword 2 (optional)"
                    value={form.keyword2}
                    onChange={(e) => setForm({ ...form, keyword2: e.target.value })}
                  />
                  <input
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                    placeholder="Keyword 3 (optional)"
                    value={form.keyword3}
                    onChange={(e) => setForm({ ...form, keyword3: e.target.value })}
                  />
                  <p className="text-xs text-zinc-500">
                    These prefill the Prospect Audit. You can still edit them before running.
                  </p>
                </div>
              ) : (
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="e.g. plumber, dentist"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium">Website (optional)</label>
              <input
                type="url"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Business type</label>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={form.service_area_mode}
                onChange={(e) =>
                  setForm({ ...form, service_area_mode: e.target.value as "storefront" | "service_area" })
                }
              >
                <option value="storefront">Storefront (fixed location)</option>
                <option value="service_area">Service area business</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-[#137752] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f6344] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Find listing
            </button>
          </form>
        )}

        {step === "select" && (
          <div className="mt-8 space-y-3">
            <p className="text-sm text-zinc-500">Select the correct listing:</p>
            {candidates.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSelected(c);
                  setScanCenter(null);
                  setPrivateAddress(form.city.trim());
                  setError(null);
                  if (listingNeedsPrivateScanCenter(c) && form.service_area_mode === "storefront") {
                    setForm((prev) => ({ ...prev, service_area_mode: "service_area" }));
                  }
                  setStep("setup");
                }}
                className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-left hover:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-zinc-500">
                  {c.address?.trim() || "No public address (service-area listing)"}
                </p>
                <div className="mt-2 flex gap-3 text-xs text-zinc-400">
                  {c.category && <span>{c.category}</span>}
                  {c.rating != null && <span>★ {c.rating} ({c.review_count} reviews)</span>}
                  <span>{c.source}</span>
                </div>
              </button>
            ))}
            <button type="button" onClick={() => setStep("search")} className="text-sm text-zinc-500 hover:underline">
              Search again
            </button>
          </div>
        )}

        {step === "setup" && selected && (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="font-medium">{selected.name}</p>
              <p className="text-sm text-zinc-500">
                {selected.address?.trim() || "No public address on Google"}
              </p>
            </div>

            {needsPrivateAddress ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      Add a private scan-center address
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-200/90">
                      Service-area listings hide the street address on Google. Local SEO Express needs
                      a private center so grids land in the right market. Saved in your account — you
                      won&apos;t re-enter it every scan.
                    </p>
                    <label className="mt-3 block text-sm font-medium text-amber-950 dark:text-amber-100">
                      Private address
                      <input
                        className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-zinc-900 dark:border-amber-800 dark:bg-zinc-900 dark:text-zinc-100"
                        placeholder='e.g. "123 Main St, Woodbridge, VA" or "Woodbridge, VA"'
                        value={privateAddress}
                        onChange={(e) => {
                          setPrivateAddress(e.target.value);
                          setScanCenter(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void verifyPrivateAddress();
                          }
                        }}
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={geocoding || !privateAddress.trim()}
                        onClick={() => void verifyPrivateAddress()}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50 dark:bg-amber-700"
                      >
                        {geocoding ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        Verify address
                      </button>
                      {scanCenter ? (
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                          Ready · {scanCenter.label}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canSave}
                className="inline-flex items-center gap-2 rounded-full bg-[#137752] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f6344] disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isProspect ? "Save prospect & continue" : "Save client & continue"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("select");
                  setError(null);
                }}
                className="text-sm text-zinc-500 hover:underline"
              >
                Pick a different listing
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
