"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { RepBadge, RepMetricCard, RepPageHeader, RepTabs, rep } from "@/components/reputation/rep-ui";
import type {
  ReputationAlertRow,
  ReputationAlertsData,
  ReputationAlertSeverity,
} from "@/lib/reputation/alerts-data";
import { cn } from "@/lib/utils";

type AlertTab = "all" | "critical" | "warning" | "info" | "resolved";

const TABS: Array<{ id: AlertTab; label: string }> = [
  { id: "all", label: "All Alerts" },
  { id: "critical", label: "Critical" },
  { id: "warning", label: "Warning" },
  { id: "info", label: "Info" },
  { id: "resolved", label: "Resolved" },
];

const SEVERITY_TONE: Record<ReputationAlertSeverity, "red" | "amber" | "blue" | "gray"> = {
  critical: "red",
  high: "red",
  medium: "amber",
  low: "blue",
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function severityGroup(severity: ReputationAlertSeverity): AlertTab {
  if (severity === "critical" || severity === "high") return "critical";
  if (severity === "medium") return "warning";
  return "info";
}

function categoryLabel(category: string) {
  return category.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AlertStatusBadge({ alert }: { alert: ReputationAlertRow }) {
  if (alert.status === "resolved" || alert.status === "dismissed") {
    return <RepBadge tone="green">Resolved</RepBadge>;
  }
  if (alert.source === "persisted") return <RepBadge tone="amber">Acknowledged</RepBadge>;
  return <RepBadge tone="blue">New</RepBadge>;
}

export function ReputationAlertsDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: ReputationAlertsData;
}) {
  const [activeTab, setActiveTab] = useState<AlertTab>("all");
  const [activeAlerts, setActiveAlerts] = useState(data.activeAlerts);
  const [resolvedAlerts, setResolvedAlerts] = useState(data.resolvedAlerts);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const allRows = useMemo(() => [...activeAlerts, ...resolvedAlerts], [activeAlerts, resolvedAlerts]);
  const categories = useMemo(
    () => Array.from(new Set(allRows.map((alert) => alert.category))).sort(),
    [allRows]
  );
  const filteredRows = useMemo(() => {
    const base = activeTab === "resolved" ? resolvedAlerts : activeAlerts;
    return base.filter((alert) => {
      const tabMatch = activeTab === "all" || activeTab === "resolved" || severityGroup(alert.severity) === activeTab;
      const categoryMatch = categoryFilter === "all" || alert.category === categoryFilter;
      return tabMatch && categoryMatch;
    });
  }, [activeAlerts, activeTab, categoryFilter, resolvedAlerts]);
  const categoryCounts = useMemo(
    () =>
      categories.map((category) => ({
        category,
        count: allRows.filter((alert) => alert.category === category).length,
      })),
    [allRows, categories]
  );
  const requiringAction = activeAlerts.filter((alert) => alert.severity === "critical" || alert.severity === "high").length;
  const resolved30d = resolvedAlerts.filter((alert) => {
    const resolvedAt = alert.resolvedAt ? new Date(alert.resolvedAt).getTime() : 0;
    return resolvedAt > now - 30 * 86_400_000;
  }).length;

  async function resolveAlert(alert: ReputationAlertRow) {
    setResolvingId(alert.id);
    try {
      await fetch("/api/reputation/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, alertId: alert.id, source: alert.source }),
      });
    } finally {
      const resolved = { ...alert, status: "resolved" as const, resolvedAt: new Date().toISOString() };
      setActiveAlerts((rows) => rows.filter((row) => row.id !== alert.id));
      setResolvedAlerts((rows) => [resolved, ...rows]);
      setResolvingId(null);
    }
  }

  return (
    <div className={rep.page}>
      <RepPageHeader
        title="Alerts"
        subtitle={`Monitor reputation risks, opportunities, and notifications for ${data.businessName}.`}
        showCompare={false}
        showExport={false}
        showFilters={false}
        actions={
          <>
            <button type="button" className={rep.btnPrimary}>
              <Plus className="h-4 w-4" />
              New Alert
            </button>
            <button type="button" className={rep.btnSecondary}>
              <Settings className="h-4 w-4" />
              Alert Settings
            </button>
            <button type="button" className={rep.btnSecondary}>
              <Bell className="h-4 w-4" />
              Notification Preferences
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <RepMetricCard label="Active Alerts" value={activeAlerts.length} icon={AlertTriangle} hint="Open reputation events" />
        <RepMetricCard label="Requiring Action" value={requiringAction} icon={AlertCircle} iconClassName="bg-[#FEF3F2] text-[#B42318]" hint="High or critical" />
        <RepMetricCard label="Resolved 30d" value={resolved30d} icon={CheckCircle2} hint="Recently closed" />
        <RepMetricCard label="Notifications Sent" value={data.preferences.email_recipients?.length ? "On" : "0"} icon={Mail} hint="Email recipients configured" />
        <RepMetricCard label="Alert Accuracy" value="—" icon={ShieldCheck} hint="Calibrates with usage" />
      </div>

      <RepTabs tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as AlertTab)} />

      <div className="flex flex-col gap-3 lg:flex-row">
        <main className="min-w-0 flex-1 space-y-3">
          <div className={cn(rep.card, "flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between")}>
            <div className="flex flex-wrap gap-2">
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={rep.select}>
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </select>
              <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className={rep.select}>
                <option value="all">All locations</option>
                <option value={businessId}>{data.businessName}</option>
              </select>
            </div>
            <p className="text-xs text-[#667085]">
              Showing {filteredRows.length} alert{filteredRows.length === 1 ? "" : "s"} · {locationFilter === "all" ? "All locations" : data.businessName}
            </p>
          </div>

          <div className={cn(rep.card, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#667085]">
                  <tr>
                    <th className="min-w-[320px] px-4 py-3 font-semibold">Alert</th>
                    <th className="px-4 py-3 font-semibold">Severity</th>
                    <th className="px-4 py-3 font-semibold">Business</th>
                    <th className="px-4 py-3 font-semibold">Triggered</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {filteredRows.map((alert) => (
                    <tr key={alert.id} className="bg-white hover:bg-[#F9FAFB]">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#FEF3F2] text-[#B42318]">
                            <AlertTriangle className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="font-semibold text-[#101828]">{alert.title}</p>
                            {alert.body ? <p className="mt-1 max-w-xl line-clamp-2 text-xs text-[#667085]">{alert.body}</p> : null}
                            <p className="mt-1 text-xs text-[#98A2B3]">{categoryLabel(alert.category)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RepBadge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</RepBadge>
                      </td>
                      <td className="px-4 py-3 text-[#344054]">{data.businessName}</td>
                      <td className="px-4 py-3 text-[#667085]">{fmtDate(alert.createdAt)}</td>
                      <td className="px-4 py-3"><AlertStatusBadge alert={alert} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {alert.status === "active" ? (
                            <button
                              type="button"
                              disabled={resolvingId === alert.id}
                              onClick={() => void resolveAlert(alert)}
                              className="text-xs font-semibold text-[#137752] hover:underline disabled:opacity-60"
                            >
                              {resolvingId === alert.id ? "Resolving..." : "Resolve"}
                            </button>
                          ) : (
                            <span className="text-xs text-[#98A2B3]">Closed</span>
                          )}
                          <button type="button" className="rounded-lg p-1.5 text-[#98A2B3] hover:bg-[#F2F4F7]">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#667085]">
                        No alerts match the selected filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <aside className="w-full space-y-3 lg:w-[340px]">
          <div className={cn(rep.card, "p-4")}>
            <h2 className="text-sm font-semibold text-[#101828]">Alert Categories</h2>
            <div className="mt-3 space-y-2">
              {categoryCounts.slice(0, 6).map((item) => (
                <div key={item.category} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2">
                  <span className="text-sm text-[#344054]">{categoryLabel(item.category)}</span>
                  <span className="text-sm font-semibold text-[#101828]">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={cn(rep.card, "p-4")}>
            <h2 className="text-sm font-semibold text-[#101828]">Severity Guide</h2>
            <div className="mt-3 space-y-2 text-sm text-[#667085]">
              <p><span className="font-semibold text-[#B42318]">Critical:</span> immediate reputation or customer risk.</p>
              <p><span className="font-semibold text-[#B54708]">Warning:</span> trend needs attention this week.</p>
              <p><span className="font-semibold text-[#175CD3]">Info:</span> monitor or tune settings.</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#B7E4CC] bg-[#ECFDF3] p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-[#137752]" />
              <p className="text-sm text-[#344054]">
                Smart tip: resolve unanswered negative reviews first; they affect conversion and Maps trust fastest.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className={cn(rep.card, "p-4")}>
          <h2 className="text-sm font-semibold text-[#101828]">Common Triggers</h2>
          <div className="mt-3 space-y-2">
            {["Negative review without response", "Review velocity drop", "Campaign delivery issue"].map((trigger) => (
              <div key={trigger} className="flex items-center gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm text-[#344054]">
                <SlidersHorizontal className="h-4 w-4 text-[#98A2B3]" />
                {trigger}
              </div>
            ))}
          </div>
        </div>
        <div className={cn(rep.card, "p-4")}>
          <h2 className="text-sm font-semibold text-[#101828]">Notification Channels</h2>
          <div className="mt-4 space-y-3">
            {[
              { label: "Email", value: data.preferences.email_recipients?.length ? 100 : 0, icon: Mail },
              { label: "In-app", value: 72, icon: Bell },
              { label: "SMS", value: 38, icon: MessageSquare },
            ].map((channel) => (
              <div key={channel.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-[#344054]"><channel.icon className="h-4 w-4 text-[#98A2B3]" />{channel.label}</span>
                  <span className="font-semibold text-[#101828]">{channel.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#F2F4F7]">
                  <div className="h-2 rounded-full bg-[#137752]" style={{ width: `${channel.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={cn(rep.card, "p-4")}>
          <h2 className="text-sm font-semibold text-[#101828]">Recommended Actions</h2>
          <div className="mt-3 space-y-2">
            {(activeAlerts.length ? activeAlerts : resolvedAlerts).slice(0, 3).map((alert) => (
              <div key={alert.id} className="rounded-lg bg-[#F9FAFB] p-3">
                <p className="text-sm font-medium text-[#101828]">{alert.recommendedAction ?? "Review the alert details and assign an owner."}</p>
                <button type="button" className={cn(rep.btnSecondary, "mt-2 h-8 px-2.5 text-xs")}>Open CTA</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
