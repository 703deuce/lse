"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  Info,
} from "lucide-react";
import { momentumBadgeClass, type MomentumLabel } from "@/lib/reviews/metrics";
import { CircularGauge } from "@/components/overview/overview-charts";
import { cn } from "@/lib/utils";

export type MomentumChartPoint = {
  label: string;
  value: number;
};

export function OverviewMomentumCard({
  businessId,
  hasData,
  momentumScore,
  momentumLabel,
  weeklyPaceGap,
  targetSharePct,
  reviews30d,
  marketPotential,
  chartData,
  alertMessage,
}: {
  businessId: string;
  hasData: boolean;
  momentumScore: number | null;
  momentumLabel: MomentumLabel | null;
  weeklyPaceGap: number | null;
  targetSharePct: number | null;
  reviews30d: number | null;
  marketPotential: string | null;
  chartData: MomentumChartPoint[];
  alertMessage: string | null;
}) {
  const isAccelerating =
    momentumLabel === "Accelerating" || momentumLabel === "Exploding" || momentumLabel === "Healthy";

  return (
    <section className="rounded-xl border border-border/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-sm font-semibold text-text">Review Momentum™</h2>
        <Info className="h-3.5 w-3.5 text-text-muted" />
      </div>

      {!hasData ? (
        <div className="py-5 text-center">
          <p className="text-xs text-text-muted">
            Compare review velocity vs competitors. Run a momentum audit.
          </p>
          <Link
            href={`/businesses/${businessId}/review-momentum`}
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
          >
            Open Review Momentum
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="w-full shrink-0 space-y-2.5 md:w-[220px]">
              <div className="flex items-center gap-2">
                {momentumLabel && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      momentumBadgeClass(momentumLabel)
                    )}
                  >
                    {isAccelerating && <span aria-hidden>↑</span>}
                    {momentumLabel}
                  </span>
                )}
              </div>

              {targetSharePct != null && (
                <p className="text-xs leading-relaxed text-text-muted">
                  Only{" "}
                  <span className="font-semibold text-text">{targetSharePct}%</span> of new market
                  reviews went to you (30d).
                  {weeklyPaceGap != null && weeklyPaceGap > 0 && (
                    <>
                      {" "}
                      Need{" "}
                      <span className="font-semibold text-emerald-700">
                        +{weeklyPaceGap}/wk
                      </span>{" "}
                      to match top competitors.
                    </>
                  )}
                </p>
              )}

              <ul className="space-y-1 text-xs">
                {reviews30d != null && (
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-text-muted">New reviews (30d)</span>
                    <span className="font-semibold tabular-nums text-text">{reviews30d}</span>
                  </li>
                )}
                {weeklyPaceGap != null && weeklyPaceGap > 0 && (
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-text-muted">Reviews needed / week</span>
                    <span className="font-semibold tabular-nums text-emerald-700">
                      +{weeklyPaceGap}
                    </span>
                  </li>
                )}
                {marketPotential && (
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-text-muted">Market potential</span>
                    <span className="font-semibold text-emerald-700">{marketPotential}</span>
                  </li>
                )}
              </ul>

              <Link
                href={`/businesses/${businessId}/review-momentum`}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                Open Review Momentum
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="h-28 min-h-[112px] flex-1">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="momentumFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fill: "#a1a1aa" }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide domain={[0, "auto"]} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#059669"
                      strokeWidth={2}
                      fill="url(#momentumFill)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg bg-surface-subtle text-xs text-text-muted">
                  No trend data yet
                </div>
              )}
            </div>

            {momentumScore != null && (
              <div className="flex shrink-0 items-center justify-center md:justify-end">
                <CircularGauge score={momentumScore} size={96} />
              </div>
            )}
          </div>

          {alertMessage && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-xs text-emerald-900">{alertMessage}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
