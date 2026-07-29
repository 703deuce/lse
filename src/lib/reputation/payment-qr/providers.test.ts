import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPaymentDestination,
  CASH_APP_PROVIDER,
  isBlockedUrl,
  PAYPAL_PROVIDER,
  validatePaymentMethodInput,
  VENMO_PROVIDER,
  ZELLE_PROVIDER,
} from "./providers";

describe("payment providers", () => {
  describe("Cash App", () => {
    it("validates cashtag", () => {
      const r = validatePaymentMethodInput("cash_app", "$localshop");
      assert.equal(r.ok, true);
      if (r.ok) assert.equal(r.normalized, "$localshop");
    });

    it("rejects invalid cashtag", () => {
      const r = validatePaymentMethodInput("cash_app", "bad handle!");
      assert.equal(r.ok, false);
    });

    it("builds destination with amount", () => {
      const url = buildPaymentDestination("cash_app", "$localshop", 1000);
      assert.equal(url, "https://cash.app/localshop/10.00");
    });

    it("rejects malicious URLs", () => {
      assert.equal(isBlockedUrl("javascript:alert(1)"), true);
      const r = validatePaymentMethodInput("cash_app", "javascript:alert(1)");
      assert.equal(r.ok, false);
    });
  });

  describe("Venmo", () => {
    it("validates username", () => {
      const r = validatePaymentMethodInput("venmo", "localshop");
      assert.equal(r.ok, true);
    });

    it("builds pay URL", () => {
      const url = buildPaymentDestination("venmo", "localshop", 500);
      assert.ok(url?.includes("venmo.com/localshop"));
      assert.ok(url?.includes("amount=5.00"));
    });
  });

  describe("PayPal", () => {
    it("normalizes handle to paypal.me", () => {
      const r = validatePaymentMethodInput("paypal", "localshop");
      assert.equal(r.ok, true);
      if (r.ok) assert.ok(r.normalized.includes("paypal.me/localshop"));
    });

    it("rejects non-paypal domains", () => {
      const r = validatePaymentMethodInput("paypal", "https://evil.com/phish");
      assert.equal(r.ok, false);
    });
  });

  describe("Zelle", () => {
    it("accepts email", () => {
      const r = validatePaymentMethodInput("zelle", "pay@localshop.com");
      assert.equal(r.ok, true);
    });

    it("does not build deep link", () => {
      assert.equal(buildPaymentDestination("zelle", "pay@localshop.com"), null);
    });

    it("rejects URLs", () => {
      const r = validatePaymentMethodInput("zelle", "https://example.com");
      assert.equal(r.ok, false);
    });
  });

  describe("provider definitions", () => {
    it("marks wallet providers as not verified", () => {
      assert.equal(CASH_APP_PROVIDER.supportsVerifiedPayment, false);
      assert.equal(VENMO_PROVIDER.supportsVerifiedPayment, false);
      assert.equal(PAYPAL_PROVIDER.supportsVerifiedPayment, false);
      assert.equal(ZELLE_PROVIDER.supportsVerifiedPayment, false);
    });
  });
});
