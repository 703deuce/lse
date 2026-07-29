import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPaymentQrAnalyticsCsv } from "./export-csv";
import type { PaymentQrAnalytics } from "./types";

const sampleAnalytics: PaymentQrAnalytics = {
  pageViews: 10,
  uniqueVisitors: 8,
  qrScans: 7,
  paymentOptionClicks: 5,
  providerClicks: { cash_app: 3, venmo: 2 },
  amountSelections: { 1000: 2 },
  externalPaymentReturns: 3,
  reviewPromptViews: 2,
  googleReviewClicks: 1,
  facebookReviewClicks: 0,
  qrDownloads: 0,
  posterDownloads: 0,
  verifiedStripePayments: 0,
  verifiedStripeAmountCents: 0,
  conversionRates: {
    scanToPageView: 0.5,
    pageViewToPaymentClick: 0.5,
    paymentClickToReturn: 0.6,
    returnToReviewClick: 0.33,
    pageViewToReviewClick: 0.1,
  },
  recentActivity: [
    {
      id: "1",
      eventType: "payment_option_clicked",
      provider: "cash_app",
      amountSelectedCents: 1000,
      createdAt: "2026-01-01T12:00:00.000Z",
      deviceCategory: "mobile",
    },
  ],
};

describe("payment qr csv export", () => {
  it("builds csv with summary and activity rows", () => {
    const csv = buildPaymentQrAnalyticsCsv(sampleAnalytics, {
      campaignName: "Test Shop",
      days: 30,
    });
    assert.ok(csv.includes("Payment QR Analytics Export"));
    assert.ok(csv.includes("Test Shop"));
    assert.ok(csv.includes("Page views"));
    assert.ok(csv.includes("Cash App"));
    assert.ok(csv.includes("payment option clicked"));
    assert.ok(csv.includes("Note: Payment-app activity"));
  });
});
