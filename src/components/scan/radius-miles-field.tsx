"use client";

import { useEffect, useState } from "react";
import {
  MAX_RADIUS_MILES,
  MIN_RADIUS_MILES,
  RADIUS_MILE_OPTIONS,
  clampRadiusMiles,
  formatRadiusMiles,
  metersToMiles,
  milesToMeters,
  nearestRadiusMileOption,
} from "@/lib/maps/grid-metrics";
import { cn } from "@/lib/utils";

/**
 * Local Falcon–style radius control: pick any 0.1–100 mi spread from the list,
 * or type a custom value. Map grid spacing follows the chosen meters.
 */
export function RadiusMilesField({
  valueMeters,
  onChangeMeters,
  label = "Radius",
  labelClassName,
  selectClassName,
  inputClassName,
  hint = "0.1–100 miles · 0.1 mi steps (or type any value)",
}: {
  valueMeters: number;
  onChangeMeters: (meters: number) => void;
  label?: string;
  labelClassName?: string;
  selectClassName?: string;
  inputClassName?: string;
  hint?: string | null;
}) {
  const selectedMiles = nearestRadiusMileOption(valueMeters);
  const [draft, setDraft] = useState(() => String(metersToMiles(valueMeters)));

  useEffect(() => {
    setDraft(String(metersToMiles(valueMeters)));
  }, [valueMeters]);

  function applyMiles(raw: number) {
    const next = clampRadiusMiles(raw);
    onChangeMeters(milesToMeters(next));
    setDraft(String(next));
  }

  function commitDraft() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(metersToMiles(valueMeters)));
      return;
    }
    applyMiles(parsed);
  }

  return (
    <div className="space-y-1.5">
      <label className={labelClassName}>
        {label}
        <select
          value={selectedMiles}
          onChange={(e) => applyMiles(Number(e.target.value))}
          className={selectClassName}
        >
          {RADIUS_MILE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {formatRadiusMiles(m)}
              {m === 5 ? " — recommended" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={MIN_RADIUS_MILES}
          max={MAX_RADIUS_MILES}
          step={0.1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            }
          }}
          className={cn(inputClassName)}
          aria-label="Custom radius in miles"
        />
        <span className="shrink-0 text-[11px] text-zinc-500">mi</span>
      </div>
      {hint ? <p className="text-[11px] leading-snug text-zinc-500">{hint}</p> : null}
    </div>
  );
}
