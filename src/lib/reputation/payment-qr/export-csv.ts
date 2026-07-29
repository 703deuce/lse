import type { PaymentQrAnalytics } from "./types";

const PROVIDER_LABELS: Record<string, string> = {
  cash_app: "Cash App",
  venmo: "Venmo",
  paypal: "PayPal",
  zelle: "Zelle",
};

function csvCell(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function pct(rate: number | null): string {
  if (rate == null) return "";
  return `${(rate * 100).toFixed(1)}%`;
}

export function buildPaymentQrAnalyticsCsv(
  analytics: PaymentQrAnalytics,
  meta: { campaignName: string; days: number }
): string {
  const lines: string[] = [];

  lines.push("Payment QR Analytics Export");
  lines.push(`Campaign: ${csvCell(meta.campaignName)}`);
  lines.push(`Period: Last ${meta.days} days`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Summary");
  lines.push(
    ["Metric", "Value"].map(csvCell).join(",")
  );
  lines.push(["Page views", analytics.pageViews].map(csvCell).join(","));
  lines.push(["Unique visitors", analytics.uniqueVisitors].map(csvCell).join(","));
  lines.push(["QR scans", analytics.qrScans].map(csvCell).join(","));
  lines.push(["Payment-option clicks", analytics.paymentOptionClicks].map(csvCell).join(","));
  lines.push(
    ["Google review clicks", analytics.googleReviewClicks].map(csvCell).join(",")
  );
  lines.push(
    ["Facebook review clicks", analytics.facebookReviewClicks].map(csvCell).join(",")
  );
  lines.push(
    ["External payment returns", analytics.externalPaymentReturns].map(csvCell).join(",")
  );
  lines.push(
    ["Review prompt views", analytics.reviewPromptViews].map(csvCell).join(",")
  );
  lines.push("");
  lines.push("Conversion rates");
  lines.push(
    ["Scan to page view", pct(analytics.conversionRates.scanToPageView)].map(csvCell).join(",")
  );
  lines.push(
    ["Page view to payment click", pct(analytics.conversionRates.pageViewToPaymentClick)]
      .map(csvCell)
      .join(",")
  );
  lines.push(
    ["Payment click to return", pct(analytics.conversionRates.paymentClickToReturn)]
      .map(csvCell)
      .join(",")
  );
  lines.push(
    ["Page view to review click", pct(analytics.conversionRates.pageViewToReviewClick)]
      .map(csvCell)
      .join(",")
  );
  lines.push("");
  lines.push("Payment-option clicks by provider");
  lines.push(["Provider", "Clicks"].map(csvCell).join(","));
  for (const [provider, count] of Object.entries(analytics.providerClicks)) {
    lines.push([PROVIDER_LABELS[provider] ?? provider, count].map(csvCell).join(","));
  }
  lines.push("");
  lines.push("Selected amounts");
  lines.push(["Amount (USD)", "Selections"].map(csvCell).join(","));
  for (const [cents, count] of Object.entries(analytics.amountSelections)) {
    lines.push([`$${(Number(cents) / 100).toFixed(2)}`, count].map(csvCell).join(","));
  }
  lines.push("");
  lines.push("Recent activity");
  lines.push(
    ["Timestamp", "Event", "Provider", "Amount (USD)", "Device"].map(csvCell).join(",")
  );
  for (const row of analytics.recentActivity) {
    lines.push(
      [
        row.createdAt,
        row.eventType.replace(/_/g, " "),
        row.provider ? PROVIDER_LABELS[row.provider] ?? row.provider : "",
        row.amountSelectedCents ? (row.amountSelectedCents / 100).toFixed(2) : "",
        row.deviceCategory ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  lines.push("");
  lines.push(
    "Note: Payment-app activity represents clicks and selections. Completion cannot be confirmed unless the payment provider supplies a verified payment event."
  );

  return lines.join("\n");
}
