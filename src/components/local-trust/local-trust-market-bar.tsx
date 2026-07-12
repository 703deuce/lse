"use client";

import { useState } from "react";
import { ChevronDown, MapPin, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MarketOption = {
  city: string;
  state: string;
  county?: string | null;
  acceptedCount: number;
};

type Props = {
  markets: MarketOption[];
  selected: { city: string; state: string } | "all";
  onSelect: (value: { city: string; state: string } | "all") => void;
  onSearchNewMarket: (input: { city: string; state: string; county?: string }) => void;
  suggestions?: Array<{ city: string; state: string }>;
  disabled?: boolean;
};

export function LocalTrustMarketBar({
  markets,
  selected,
  onSelect,
  onSearchNewMarket,
  suggestions = [],
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");

  const label =
    selected === "all"
      ? "All Service Areas"
      : `${selected.city}, ${selected.state}`;

  function submitNewMarket(e: React.FormEvent) {
    e.preventDefault();
    if (!city.trim() || !state.trim()) return;
    onSearchNewMarket({ city: city.trim(), state: state.trim(), county: county.trim() || undefined });
    setModalOpen(false);
    setCity("");
    setState("");
    setCounty("");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <MapPin className="h-4 w-4 text-emerald-600" />
          Market
        </div>

        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex min-w-[200px] items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
          >
            {label}
            <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition", open && "rotate-180")} />
          </button>

          {open && (
            <div className="absolute left-0 z-20 mt-1 min-w-[240px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                onClick={() => {
                  onSelect("all");
                  setOpen(false);
                }}
              >
                All Service Areas
              </button>
              {markets.map((m) => (
                <button
                  key={`${m.city}-${m.state}`}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                  onClick={() => {
                    onSelect({ city: m.city, state: m.state });
                    setOpen(false);
                  }}
                >
                  <span>
                    {m.city}, {m.state}
                  </span>
                  <span className="text-xs tabular-nums text-zinc-400">{m.acceptedCount}</span>
                </button>
              ))}
              {!markets.length && (
                <p className="px-3 py-2 text-xs text-zinc-400">No markets scanned yet</p>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Search New Market
        </button>
      </div>

      {suggestions.length > 0 && selected !== "all" && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600">
          Want more opportunities? Search nearby service areas like{" "}
          {suggestions.map((s, i) => (
            <span key={`${s.city}-${s.state}`}>
              {i > 0 && (i === suggestions.length - 1 ? ", or " : ", ")}
              <button
                type="button"
                className="font-medium text-emerald-700 hover:underline"
                onClick={() => onSearchNewMarket(s)}
              >
                {s.city}
              </button>
            </span>
          ))}
          .
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">Search New Market</h3>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close">
                <X className="h-5 w-5 text-zinc-400" />
              </button>
            </div>
            <form onSubmit={submitNewMarket} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-600">City</span>
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                  placeholder="Lake Ridge"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-600">State</span>
                <input
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                  placeholder="VA"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-600">County (optional)</span>
                <input
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                  placeholder="Prince William"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Start Scan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
