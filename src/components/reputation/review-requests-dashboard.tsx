"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  FileText,
  History,
  Loader2,
  Mail,
  MessageSquare,
  MousePointerClick,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRoundPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ReviewRequestsPanel } from "@/components/reputation/review-requests-panel";
import type { ReviewRequestsSection } from "@/components/reputation/review-requests-sub-tabs";
import {
  RepBadge,
  RepMetricCard,
  RepPageHeader,
  RepTabs,
  rep,
} from "@/components/reputation/rep-ui";
import { ModulePage } from "@/components/ui/design-system";
import { renderTemplate } from "@/lib/reputation/template-vars";
import type { PosterConfig } from "@/lib/reputation/poster-config";
import { cn } from "@/lib/utils";

type RequestTab = "send" | "bulk" | "qr" | "link";

type TemplateRow = {
  id: string;
  channel: string;
  name: string;
  subject?: string | null;
  body: string;
  is_default?: boolean;
};

type KitData = {
  businessName: string;
  placeId: string | null;
  link: {
    id: string;
    review_url: string;
    short_url?: string | null;
    place_id?: string;
    poster_config?: PosterConfig;
  } | null;
  posterConfig: PosterConfig;
  mapsFallbackUrl: string | null;
  warning: string | null;
  templates: TemplateRow[];
  events: Array<{ id: string; event_type: string; channel?: string | null; created_at: string }>;
  keywordSuggestions: Array<{ id?: string; keyword: string; keyword_type?: string; gap?: number }>;
};

type SendRow = {
  id: string;
  channel: string;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  status: string;
  message_body: string;
  sent_at?: string | null;
  created_at: string;
  has_reply?: boolean;
  review_request_contacts?: { customer_name?: string | null } | null;
};

type Stats = {
  total_sent: number;
  email_sent: number;
  sms_sent: number;
  manual_sent: number;
  failed: number;
  last_7_days: number;
  last_30_days: number;
  replies?: number;
  reviews_generated?: number;
  review_link_clicks?: number;
  recent_sends: SendRow[];
  trial_sms_template?: string | null;
};

const TABS: Array<{ id: RequestTab; label: string }> = [
  { id: "send", label: "One-Time Send" },
  { id: "bulk", label: "Bulk Send" },
  { id: "qr", label: "QR Code" },
  { id: "link", label: "Link & Share" },
];

function parseTab(value: string | null): RequestTab {
  if (value === "bulk") return "bulk";
  if (value === "poster" || value === "qr") return "qr";
  if (value === "messages" || value === "templates" || value === "link") return "link";
  return "send";
}

function panelSectionForTab(tab: RequestTab): ReviewRequestsSection {
  if (tab === "bulk") return "bulk";
  if (tab === "link") return "poster";
  if (tab === "qr") return "poster";
  return "send";
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString();
}

function pct(numerator: number | null | undefined, denominator: number | null | undefined): string {
  if (!numerator || !denominator || denominator <= 0) return "--";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function deliveryRate(stats: Stats | null): string {
  if (!stats) return "--";
  const attempted = stats.total_sent + stats.failed;
  return attempted > 0 ? `${Math.round((stats.total_sent / attempted) * 100)}%` : "--";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SectionCard({
  number,
  title,
  children,
  className,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(rep.card, "p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECFDF3] text-xs font-bold text-[#137752]">
          {number}
        </span>
        <h2 className="text-[15px] font-semibold text-[#101828]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ChannelCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
        active
          ? "border-[#137752] bg-[#ECFDF3] shadow-[0_0_0_1px_rgba(19,119,82,0.14)]"
          : "border-[#E6EAF0] bg-white hover:bg-[#F9FAFB]"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-white text-[#137752]" : "bg-[#F2F4F7] text-[#667085]"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
          {title}
          {active ? <Check className="h-3.5 w-3.5 text-[#137752]" /> : null}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-[#667085]">{description}</span>
      </span>
    </button>
  );
}

function PhonePreview({
  businessName,
  body,
}: {
  businessName: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-[250px] rounded-[2rem] border-[5px] border-[#101828] bg-[#101828] p-1.5 shadow-xl">
      <div className="overflow-hidden rounded-[1.55rem] bg-[#F2F4F7]">
        <div className="flex items-center justify-between bg-white px-4 py-2 text-[10px] font-semibold text-[#101828]">
          <span>9:41</span>
          <span className="text-[#98A2B3]">5G</span>
        </div>
        <div className="border-b border-[#E6EAF0] bg-white px-4 py-2 text-center">
          <p className="text-[11px] font-semibold text-[#101828]">{businessName}</p>
          <p className="text-[10px] text-[#98A2B3]">Review request</p>
        </div>
        <div className="min-h-[230px] px-3 py-4">
          <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[12px] leading-relaxed text-[#344054] shadow-sm">
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecipientTable({ sends }: { sends: SendRow[] }) {
  return (
    <div className={cn(rep.card, "overflow-hidden")}>
      <div className="border-b border-[#E6EAF0] px-4 py-3">
        <h2 className="text-[15px] font-semibold text-[#101828]">Recipients</h2>
        <p className="mt-0.5 text-xs text-[#667085]">Recent recipients and delivery status.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
              <th className="px-4 py-2 font-semibold">Customer</th>
              <th className="px-4 py-2 font-semibold">Channel</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Sent</th>
            </tr>
          </thead>
          <tbody>
            {sends.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#667085]">
                  No recent recipients yet.
                </td>
              </tr>
            ) : (
              sends.slice(0, 8).map((send) => (
                <tr key={send.id} className="border-b border-[#F2F4F7] last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#101828]">
                      {send.review_request_contacts?.customer_name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-[#667085]">{send.recipient_email ?? send.recipient_phone ?? "--"}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-[#344054]">{send.channel}</td>
                  <td className="px-4 py-3">
                    <RepBadge tone={send.status === "failed" ? "red" : send.has_reply ? "blue" : "green"}>
                      {send.has_reply ? "Replied" : send.status}
                    </RepBadge>
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{formatDate(send.sent_at ?? send.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OneTimeSend({
  businessId,
  data,
  stats,
  loading,
  onRefresh,
}: {
  businessId: string;
  data: KitData | null;
  stats: Stats | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    serviceType: "",
    channel: "sms" as "sms" | "email" | "both",
    templateId: "",
    schedule: "now" as "now" | "later",
  });
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const templates = data?.templates ?? [];
  const channelForTemplate = form.channel === "both" ? "sms" : form.channel;
  const matchingTemplates = templates.filter((template) => template.channel === channelForTemplate);
  const fallbackTemplate =
    matchingTemplates.find((template) => template.is_default) ??
    matchingTemplates[0] ??
    templates.find((template) => template.channel === "sms") ??
    templates[0];
  const selectedTemplate =
    templates.find((template) => template.id === form.templateId) ?? fallbackTemplate;
  const reviewUrl = data?.link?.review_url ?? null;
  const previewBody = selectedTemplate
    ? renderTemplate(selectedTemplate.body, {
        customer_name: form.customerName || "there",
        business_name: data?.businessName ?? "your business",
        review_link: reviewUrl ?? "{{review_link}}",
        service_type: form.serviceType || "recent service",
      })
    : "Hi {{customer_name}}, thanks for choosing us. Leave a review here: {{review_link}}";
  const reviewsGenerated = stats?.reviews_generated;
  const conversion =
    reviewsGenerated != null && stats?.last_30_days ? pct(reviewsGenerated, stats.last_30_days) : "--";

  async function sendEmail() {
    const res = await fetch("/api/reputation/review-requests/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        serviceType: form.serviceType || undefined,
        templateId: selectedTemplate?.channel === "email" ? selectedTemplate.id : undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Email failed");
  }

  async function sendSms() {
    const res = await fetch("/api/reputation/review-requests/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        serviceType: form.serviceType || undefined,
        templateId: selectedTemplate?.channel === "sms" ? selectedTemplate.id : undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "SMS failed");
  }

  async function handleSend() {
    setError(null);
    setMessage(null);
    if (!reviewUrl) {
      setError("Generate a review link before sending requests.");
      return;
    }
    if (!form.customerName.trim()) {
      setError("Customer name is required.");
      return;
    }
    if ((form.channel === "email" || form.channel === "both") && !form.customerEmail.trim()) {
      setError("Customer email is required for email sends.");
      return;
    }
    if ((form.channel === "sms" || form.channel === "both") && !form.customerPhone.trim()) {
      setError("Customer phone is required for SMS sends.");
      return;
    }
    setSending(true);
    try {
      if (form.channel === "email" || form.channel === "both") await sendEmail();
      if (form.channel === "sms" || form.channel === "both") await sendSms();
      setMessage(form.schedule === "later" ? "Request queued for the selected schedule." : "Review request sent.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <RepMetricCard label="Requests Sent" value={loading ? "--" : formatNumber(stats?.last_30_days)} hint="Last 30 days" icon={Send} />
        <RepMetricCard label="Delivery Rate" value={deliveryRate(stats)} hint="Delivered / attempted" icon={ShieldCheck} />
        <RepMetricCard label="Reviews Generated" value={formatNumber(reviewsGenerated)} hint={reviewsGenerated == null ? "Attribution unavailable" : "Last 30 days"} icon={Sparkles} />
        <RepMetricCard label="Est Conversion" value={conversion} hint="Reviews / requests" icon={MousePointerClick} />
        <RepMetricCard label="Review Link Clicks" value={formatNumber(stats?.review_link_clicks)} hint={stats?.review_link_clicks == null ? "Click data unavailable" : "Tracked clicks"} icon={MousePointerClick} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {error ? <div className="rounded-xl border border-[#FDA29B] bg-[#FEF3F2] px-4 py-3 text-sm text-[#B42318]">{error}</div> : null}
          {message ? <div className="rounded-xl border border-[#ABEFC6] bg-[#ECFDF3] px-4 py-3 text-sm text-[#027A48]">{message}</div> : null}

          <SectionCard number={1} title="Who">
            <div className="grid gap-3 md:grid-cols-2">
              <button type="button" className={rep.btnPrimary}>
                <UserRoundPlus className="h-4 w-4" />
                Select Contacts
              </button>
              <button type="button" className={rep.btnSecondary}>
                <Upload className="h-4 w-4" />
                Import
              </button>
              <select className={cn(rep.select, "md:col-span-2")}>
                <option>Eligible customers only</option>
                <option>All contacts</option>
                <option>Recently completed jobs</option>
              </select>
              <div>
                <label className={rep.label}>Customer Name</label>
                <input
                  value={form.customerName}
                  onChange={(e) => setForm((current) => ({ ...current, customerName: e.target.value }))}
                  className={cn(rep.input, "mt-1")}
                />
              </div>
              <div>
                <label className={rep.label}>Service</label>
                <input
                  value={form.serviceType}
                  onChange={(e) => setForm((current) => ({ ...current, serviceType: e.target.value }))}
                  className={cn(rep.input, "mt-1")}
                />
              </div>
              <div>
                <label className={rep.label}>Email</label>
                <input
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm((current) => ({ ...current, customerEmail: e.target.value }))}
                  className={cn(rep.input, "mt-1")}
                />
              </div>
              <div>
                <label className={rep.label}>Phone</label>
                <input
                  type="tel"
                  value={form.customerPhone}
                  onChange={(e) => setForm((current) => ({ ...current, customerPhone: e.target.value }))}
                  className={cn(rep.input, "mt-1")}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                {["Completed job", "No recent request", "Has consent"].map((tag) => (
                  <RepBadge key={tag} tone="green">{tag}</RepBadge>
                ))}
                <span className="ml-auto text-xs font-semibold text-[#667085]">1 selected</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard number={2} title="Channel">
            <div className="grid gap-3 md:grid-cols-3">
              <ChannelCard
                active={form.channel === "sms"}
                icon={MessageSquare}
                title="SMS"
                description="Best for immediate follow-up."
                onClick={() => setForm((current) => ({ ...current, channel: "sms" }))}
              />
              <ChannelCard
                active={form.channel === "email"}
                icon={Mail}
                title="Email"
                description="Longer note with review CTA."
                onClick={() => setForm((current) => ({ ...current, channel: "email" }))}
              />
              <ChannelCard
                active={form.channel === "both"}
                icon={Users}
                title="Both"
                description="Send email and SMS together."
                onClick={() => setForm((current) => ({ ...current, channel: "both" }))}
              />
            </div>
          </SectionCard>

          <SectionCard number={3} title="Template">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <label className={rep.label}>Template Picker</label>
                <select
                  value={selectedTemplate?.id ?? ""}
                  onChange={(e) => setForm((current) => ({ ...current, templateId: e.target.value }))}
                  className={cn(rep.select, "mt-1 w-full")}
                >
                  {templates.length === 0 ? <option>No templates found</option> : null}
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.channel})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className={rep.label}>Merge Fields</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {["{{customer_name}}", "{{business_name}}", "{{review_link}}", "{{service_type}}"].map((token) => (
                    <span key={token} className="rounded-full border border-[#E6EAF0] bg-[#F9FAFB] px-2 py-1 text-[11px] font-semibold text-[#667085]">
                      {token}
                    </span>
                  ))}
                </div>
              </div>
              <textarea readOnly value={previewBody} rows={4} className={cn(rep.input, "h-auto resize-none lg:col-span-2")} />
            </div>
          </SectionCard>

          <SectionCard number={5} title="Send">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, schedule: "now" }))}
                className={cn(rep.btnSecondary, form.schedule === "now" && "border-[#137752] bg-[#ECFDF3] text-[#137752]")}
              >
                <Send className="h-4 w-4" />
                Send now
              </button>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, schedule: "later" }))}
                className={cn(rep.btnSecondary, form.schedule === "later" && "border-[#137752] bg-[#ECFDF3] text-[#137752]")}
              >
                <CalendarClock className="h-4 w-4" />
                Schedule
              </button>
              <button type="button" onClick={() => void handleSend()} disabled={sending} className={rep.btnPrimary}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Request
              </button>
              <p className="text-xs text-[#667085] md:col-span-3">
                Estimated cost: {form.channel === "email" ? "$0.00" : form.channel === "sms" ? "~1 SMS credit" : "~1 SMS credit + email"}
              </p>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4">
          <SectionCard number={4} title="Preview">
            <PhonePreview businessName={data?.businessName ?? "Your business"} body={previewBody} />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-[#F9FAFB] p-2">
                <p className="text-sm font-bold text-[#101828]">142</p>
                <p className="text-[10px] text-[#667085]">Chars</p>
              </div>
              <div className="rounded-lg bg-[#F9FAFB] p-2">
                <p className="text-sm font-bold text-[#101828]">{form.channel.toUpperCase()}</p>
                <p className="text-[10px] text-[#667085]">Channel</p>
              </div>
              <div className="rounded-lg bg-[#F9FAFB] p-2">
                <p className="text-sm font-bold text-[#101828]">A</p>
                <p className="text-[10px] text-[#667085]">Template</p>
              </div>
            </div>
          </SectionCard>
          <RecipientTable sends={stats?.recent_sends ?? []} />
        </aside>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Personalized", body: "Merge fields make requests feel hand-written and improve response rates.", icon: Sparkles },
          { title: "Track Results", body: "Monitor delivery, clicks, replies, and attributed reviews from one place.", icon: MousePointerClick },
          { title: "Stay Compliant", body: "Send to eligible customers and include opt-out language for SMS.", icon: ShieldCheck },
        ].map((tip) => (
          <div key={tip.title} className={cn(rep.card, "p-4")}>
            <tip.icon className="h-5 w-5 text-[#137752]" />
            <h3 className="mt-3 text-sm font-semibold text-[#101828]">{tip.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#667085]">{tip.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkSharePanel({ data, businessId }: { data: KitData | null; businessId: string }) {
  const reviewUrl = data?.link?.review_url ?? null;
  const shortUrl = data?.link?.short_url ? `reviews.mapsgrowth.app/${data.link.short_url}` : null;

  return (
    <div className="space-y-4">
      <div className={cn(rep.card, "p-4")}>
        <h2 className="text-[15px] font-semibold text-[#101828]">Shareable Review Link</h2>
        <p className="mt-1 text-sm text-[#667085]">Copy this link into invoices, follow-up emails, or team scripts.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input readOnly value={shortUrl ?? reviewUrl ?? "Generate a review link first"} className={cn(rep.input, "min-w-[260px] flex-1")} />
          <button
            type="button"
            className={rep.btnPrimary}
            onClick={() => {
              if (reviewUrl) void navigator.clipboard.writeText(reviewUrl);
            }}
          >
            <Copy className="h-4 w-4" />
            Copy Link
          </button>
        </div>
      </div>
      <ReviewRequestsPanel businessId={businessId} section="messages" hideSubTabs />
    </div>
  );
}

export function ReviewRequestsDashboard({ businessId }: { businessId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<RequestTab>(() => parseTab(searchParams.get("tab")));
  const [data, setData] = useState<KitData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kitRes, statsRes] = await Promise.all([
        fetch(`/api/reputation/review-link/${businessId}`),
        fetch(`/api/reputation/review-requests/stats/${businessId}`),
      ]);
      const kitJson = await kitRes.json().catch(() => ({}));
      const statsJson = await statsRes.json().catch(() => ({}));
      if (!kitRes.ok) throw new Error(kitJson.error ?? "Failed to load review link");
      setData(kitJson);
      setStats(statsRes.ok ? statsJson : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review requests");
      setData(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleTabChange = useCallback(
    (next: string) => {
      const nextTab = next as RequestTab;
      setTab(nextTab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", nextTab);
      router.replace(`/businesses/${businessId}/reputation/requests?${params.toString()}`, {
        scroll: false,
      });
    },
    [businessId, router, searchParams]
  );

  return (
    <ModulePage className={rep.page}>
      <RepPageHeader
        title="Review Requests"
        subtitle="Send one-time review requests to your customers."
        dateRangeLabel="Last 30 days"
        showExport={false}
        showFilters={false}
        actions={
          <>
            <button type="button" className={rep.btnSecondary}>
              How it works
            </button>
            <button type="button" className={rep.btnSecondary}>
              <FileText className="h-4 w-4" />
              Templates
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </>
        }
        primaryAction={
          <button type="button" className={rep.btnPrimary}>
            <History className="h-4 w-4" />
            History
          </button>
        }
      />

      <RepTabs tabs={TABS} active={tab} onChange={handleTabChange} />

      {error ? (
        <div className="rounded-xl border border-[#FDA29B] bg-[#FEF3F2] px-4 py-3 text-sm text-[#B42318]">{error}</div>
      ) : null}

      {tab === "send" ? (
        <OneTimeSend businessId={businessId} data={data} stats={stats} loading={loading} onRefresh={load} />
      ) : null}

      {tab === "bulk" ? (
        <ReviewRequestsPanel businessId={businessId} section={panelSectionForTab(tab)} hideSubTabs />
      ) : null}

      {tab === "qr" ? (
        <ReviewRequestsPanel businessId={businessId} section={panelSectionForTab(tab)} hideSubTabs />
      ) : null}

      {tab === "link" ? <LinkSharePanel businessId={businessId} data={data} /> : null}
    </ModulePage>
  );
}
