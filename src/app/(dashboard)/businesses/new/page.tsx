"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Search } from "lucide-react";

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

export default function NewBusinessPage() {
  const router = useRouter();
  const [step, setStep] = useState<"search" | "select" | "setup">("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [form, setForm] = useState({
    name: "",
    city: "",
    keyword: "",
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

  async function handleCreate() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/businesses/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selected.name,
          website_url: selected.website ?? form.website,
          phone: selected.phone,
          address_text: selected.address,
          lat: selected.lat,
          lng: selected.lng,
          place_id: selected.place_id,
          cid: selected.cid,
          primary_category: selected.category,
          service_area_mode: form.service_area_mode,
          scan_center_lat: selected.lat,
          scan_center_lng: selected.lng,
          keyword: form.keyword || form.name,
          city: form.city,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      router.push(`/businesses/${data.business.id}/overview`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
        <Link href="/businesses" className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold">Add a business</h1>
        <p className="mt-1 text-sm text-zinc-500">Find your Google listing and set up tracking</p>

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
              <label className="block text-sm font-medium">Primary keyword to track</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="e.g. plumber, dentist"
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
              />
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
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
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
                  setStep("setup");
                }}
                className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-left hover:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-zinc-500">{c.address}</p>
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
          <div className="mt-8">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="font-medium">{selected.name}</p>
              <p className="text-sm text-zinc-500">{selected.address}</p>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save & continue
            </button>
          </div>
        )}
    </div>
  );
}
