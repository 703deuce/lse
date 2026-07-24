"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, RefreshCw, Settings } from "lucide-react";
import {
  ModuleHeader,
  ModulePage,
  TabBar,
  cardClass,
  moduleStack,
} from "@/components/ui/design-system";
import { ReviewAlertSettings } from "@/components/reputation/review-alert-settings";
import { cn } from "@/lib/utils";
import type {
  ReputationAlertRow,
  ReputationAlertsData,
  ReputationAlertSeverity,
} from "@/lib/reputation/alerts-data";

type TabId = "active" | "resolved" | "preferences";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "active", label: "Active" },
  { id: "resolved", label: "Resolved" },
  { id: "preferences", label: "Preferences" },
];

const SEVERITY_CLASS: Record<ReputationAlertSeverity, string> = {
  low: "bg-zinc-100 text-zinc-700",
  medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  high: "bg-orange-50 text-orange-700 ring-1 ring-orange-100",
  critical: "bg-red-50 text-red-700 ring-1 ring-red-100",
};

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(cardClass, "p-4", className)}>{children}</div>;
}

function SeverityBadge({ severity }: { severity: ReputationAlertSeverity }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", SEVERITY_CLASS[severity])}>
      {severity}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="py-10 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-[#137752]" />
      <h2 className="mt-3 text-[15px] font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 text-[13px] text-zinc-500">{body}</p>
    </Card>
  );
}

function AlertList({
  rows,
  onResolve,
  resolvingId,
  showResolve,
}: {
  rows: ReputationAlertRow[];
  onResolve?: (alert: ReputationAlertRow) => void;
  resolvingId?: string | null;
  showResolve?: boolean;
}) {
  return (
    <div className="space-y-2">
      {rows.map((alert) => (
        <Card key={alert.id} className={alert.severity === "critical" ? "border-red-100 bg-red-50/30" : undefined}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={alert.severity} />
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium capitalize text-zinc-600">
                  {alert.category.replace(/_/g, " ")}
                </span>
                <span className="text-[11px] text-zinc-400">
                  {new Date(alert.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
              <h2 className="mt-2 text-[15px] font-semibold text-zinc-900">{alert.title}</h2>
              {alert.body ? <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-zinc-600">{alert.body}</p> : null}
              {alert.recommendedAction ? (
                <p className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-[12px] font-medium text-zinc-700 ring-1 ring-zinc-100">
                  Recommended: {alert.recommendedAction}
                </p>
              ) : null}
            </div>
            {showResolve ? (
              <button
                type="button"
                disabled={resolvingId === alert.id}
                onClick={() => onResolve?.(alert)}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[#137752] px-3 text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(19,119,82,0.22)] disabled:opacity-60"
              >
                {resolvingId === alert.id ? "Resolving..." : "Resolve"}
              </button>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ReputationAlertsDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: ReputationAlertsData;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("active");
  const [activeAlerts, setActiveAlerts] = useState(data.activeAlerts);
  const [resolvedAlerts, setResolvedAlerts] = useState(data.resolvedAlerts);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function resolveAlert(alert: ReputationAlertRow) {
    setResolvingId(alert.id);
    try {
      await fetch("/api/reputation/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, alertId: alert.id, source: alert.source }),
      });
    } finally {
      const resolved: ReputationAlertRow = {
        ...alert,
        status: "resolved",
        resolvedAt: new Date().toISOString(),
      };
      setActiveAlerts((rows) => rows.filter((row) => row.id !== alert.id));
      setResolvedAlerts((rows) => [resolved, ...rows]);
      setResolvingId(null);
    }
  }

  async function refreshAlerts() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/reputation/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, action: "run" }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setActiveAlerts(json.data.activeAlerts ?? []);
        setResolvedAlerts(json.data.resolvedAlerts ?? []);
      }
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ModulePage className={moduleStack}>
      <ModuleHeader
        title="Reputation Alerts"
        subtitle={`Active risks, resolved alerts, and notification preferences for ${data.businessName}.`}
        icon={AlertTriangle}
        meta={
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-600">
            {activeAlerts.length} active · {resolvedAlerts.length} resolved
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshAlerts()}
              disabled={refreshing}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh alerts
            </button>
            <Link
              href={`/businesses/${businessId}/reputation/overview`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Overview
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      />

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "active" ? (
        activeAlerts.length > 0 ? (
          <AlertList rows={activeAlerts} onResolve={resolveAlert} resolvingId={resolvingId} showResolve />
        ) : (
          <EmptyState title="No active alerts" body="No unanswered negatives or configured alert issues are active right now." />
        )
      ) : null}

      {activeTab === "resolved" ? (
        resolvedAlerts.length > 0 ? (
          <AlertList rows={resolvedAlerts} />
        ) : (
          <EmptyState title="No resolved alerts yet" body="Resolved or dismissed persisted alerts will appear here." />
        )
      ) : null}

      {activeTab === "preferences" ? (
        <div className="grid gap-2 lg:grid-cols-3">
          <Card>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-[#137752]" />
              <h2 className="text-[14px] font-semibold text-zinc-900">Current preferences</h2>
            </div>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Every new review</dt>
                <dd className="font-semibold text-zinc-900">{data.preferences.every_new_review ? "On" : "Off"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Low rating only</dt>
                <dd className="font-semibold text-zinc-900">{data.preferences.low_rating_only ? "On" : "Off"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Unanswered only</dt>
                <dd className="font-semibold text-zinc-900">{data.preferences.unanswered_only ? "On" : "Off"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Recipients</dt>
                <dd className="font-semibold text-zinc-900">{data.preferences.email_recipients.length}</dd>
              </div>
            </dl>
          </Card>
          <Card className="lg:col-span-2">
            <ReviewAlertSettings businessId={businessId} />
          </Card>
        </div>
      ) : null}
    </ModulePage>
  );
}
