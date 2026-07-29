import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPaymentDestination,
  CASH_APP_PROVIDER,
  getPaymentProviderCapabilities,
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

    it("builds destination with cashtag and amount", () => {
      const result = buildPaymentDestination("cash_app", {
        publicHandle: "$localshop",
        amountCents: 1000,
      });
      assert.equal(result.destinationUrl, "https://cash.app/localshop/10.00");
      assert.equal(result.manualFlow, false);
    });

    it("builds destination from payment link URL with amount", () => {
      const result = buildPaymentDestination("cash_app", {
        publicUrl: "https://cash.app/$localshop",
        amountCents: 2500,
        note: "Garage cleanout",
      });
      assert.ok(result.destinationUrl?.includes("amount=25.00"));
      assert.ok(result.destinationUrl?.includes("note=Garage"));
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

    it("builds pay URL with amount", () => {
      const result = buildPaymentDestination("venmo", {
        publicHandle: "localshop",
        amountCents: 500,
      });
      assert.ok(result.destinationUrl?.includes("venmo.com/localshop"));
      assert.ok(result.destinationUrl?.includes("amount=5.00"));
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

    it("appends amount to paypal.me URL", () => {
      const result = buildPaymentDestination("paypal", {
        publicHandle: "localshop",
        amountCents: 12500,
      });
      assert.ok(result.destinationUrl?.includes("/125.00"));
    });
  });

  describe("Zelle", () => {
    it("accepts email", () => {
      const r = validatePaymentMethodInput("zelle", "pay@localshop.com");
      assert.equal(r.ok, true);
    });

    it("uses manual flow without deep link", () => {
      const result = buildPaymentDestination("zelle", {
        publicHandle: "pay@localshop.com",
        amountCents: 1000,
      });
      assert.equal(result.destinationUrl, null);
      assert.equal(result.manualFlow, true);
    });

    it("rejects URLs", () => {
      const r = validatePaymentMethodInput("zelle", "https://example.com");
      assert.equal(r.ok, false);
    });
  });

  describe("provider capabilities", () => {
    it("marks wallet providers as not verified", () => {
      assert.equal(
        getPaymentProviderCapabilities("cash_app").supportsVerifiedCompletion,
        false
      );
      assert.equal(
        getPaymentProviderCapabilities("venmo").supportsVerifiedCompletion,
        false
      );
      assert.equal(
        getPaymentProviderCapabilities("paypal").supportsVerifiedCompletion,
        false
      );
      assert.equal(
        getPaymentProviderCapabilities("zelle").supportsVerifiedCompletion,
        false
      );
    });

    it("marks Zelle as not supporting prefilled amount", () => {
      assert.equal(ZELLE_PROVIDER.capabilities.supportsPrefilledAmount, false);
      assert.equal(CASH_APP_PROVIDER.capabilities.supportsPrefilledAmount, true);
      assert.equal(VENMO_PROVIDER.capabilities.supportsPrefilledAmount, true);
      assert.equal(PAYPAL_PROVIDER.capabilities.supportsPrefilledAmount, true);
    });
  });
});
