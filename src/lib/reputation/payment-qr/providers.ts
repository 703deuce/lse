import type { PaymentProvider } from "./types";

const BLOCKED_PROTOCOLS = /^(javascript|data|vbscript):/i;

const APPROVED_PAYPAL_HOSTS = new Set([
  "paypal.me",
  "www.paypal.me",
  "paypal.com",
  "www.paypal.com",
]);

const APPROVED_VENMO_HOSTS = new Set([
  "venmo.com",
  "www.venmo.com",
  "account.venmo.com",
]);

const APPROVED_CASHAPP_HOSTS = new Set([
  "cash.app",
  "www.cash.app",
]);

export type PaymentProviderDefinition = {
  providerKey: PaymentProvider;
  displayName: string;
  brandColor: string;
  supportsAmount: boolean;
  supportsVerifiedPayment: boolean;
  validateInput: (input: string) => { ok: true; normalized: string } | { ok: false; error: string };
  normalizeInput: (input: string) => string;
  buildDestination: (input: string, amountCents?: number) => string | null;
  getFallbackInstructions: (input: string) => string;
};

function stripHandle(input: string): string {
  return input.trim().replace(/^[@$]/, "");
}

function isSafeHttpUrl(url: string, allowedHosts?: Set<string>): boolean {
  if (!url || BLOCKED_PROTOCOLS.test(url)) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (allowedHosts && !allowedHosts.has(parsed.hostname.toLowerCase())) return false;
    return true;
  } catch {
    return false;
  }
}

function formatDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export const CASH_APP_PROVIDER: PaymentProviderDefinition = {
  providerKey: "cash_app",
  displayName: "Cash App",
  brandColor: "#00D632",
  supportsAmount: true,
  supportsVerifiedPayment: false,
  normalizeInput: (input) => {
    const trimmed = input.trim();
    if (trimmed.startsWith("http")) return trimmed;
    const handle = stripHandle(trimmed);
    return handle ? `$${handle}` : "";
  },
  validateInput: (input) => {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, error: "Cash App Cashtag or URL is required." };
    if (trimmed.startsWith("http")) {
      if (!isSafeHttpUrl(trimmed, APPROVED_CASHAPP_HOSTS)) {
        return { ok: false, error: "Cash App URL must be from cash.app." };
      }
      return { ok: true, normalized: trimmed };
    }
    const handle = stripHandle(trimmed);
    if (!/^[a-zA-Z0-9_]{1,20}$/.test(handle)) {
      return { ok: false, error: "Invalid Cash App Cashtag." };
    }
    return { ok: true, normalized: `$${handle}` };
  },
  buildDestination: (input, amountCents) => {
    const trimmed = input.trim();
    if (trimmed.startsWith("http") && isSafeHttpUrl(trimmed, APPROVED_CASHAPP_HOSTS)) {
      if (amountCents && amountCents > 0) {
        const url = new URL(trimmed);
        url.searchParams.set("amount", formatDollars(amountCents));
        return url.toString();
      }
      return trimmed;
    }
    const handle = stripHandle(trimmed);
    if (!handle) return null;
    const base = `https://cash.app/${handle}`;
    if (amountCents && amountCents > 0) {
      return `${base}/${formatDollars(amountCents)}`;
    }
    return base;
  },
  getFallbackInstructions: (input) => {
    const handle = stripHandle(input);
    return handle ? `Open Cash App and send to $${handle}` : "Open Cash App to complete payment.";
  },
};

export const VENMO_PROVIDER: PaymentProviderDefinition = {
  providerKey: "venmo",
  displayName: "Venmo",
  brandColor: "#008CFF",
  supportsAmount: true,
  supportsVerifiedPayment: false,
  normalizeInput: (input) => {
    const trimmed = input.trim();
    if (trimmed.startsWith("http")) return trimmed;
    return stripHandle(trimmed);
  },
  validateInput: (input) => {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, error: "Venmo username or URL is required." };
    if (trimmed.startsWith("http")) {
      if (!isSafeHttpUrl(trimmed, APPROVED_VENMO_HOSTS)) {
        return { ok: false, error: "Venmo URL must be from venmo.com." };
      }
      return { ok: true, normalized: trimmed };
    }
    const username = stripHandle(trimmed);
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
      return { ok: false, error: "Invalid Venmo username." };
    }
    return { ok: true, normalized: username };
  },
  buildDestination: (input, amountCents) => {
    const trimmed = input.trim();
    if (trimmed.startsWith("http") && isSafeHttpUrl(trimmed, APPROVED_VENMO_HOSTS)) {
      if (amountCents && amountCents > 0) {
        const url = new URL(trimmed);
        url.searchParams.set("amount", formatDollars(amountCents));
        return url.toString();
      }
      return trimmed;
    }
    const username = stripHandle(trimmed);
    if (!username) return null;
    const base = `https://venmo.com/${encodeURIComponent(username)}`;
    if (amountCents && amountCents > 0) {
      return `${base}?txn=pay&amount=${formatDollars(amountCents)}`;
    }
    return `${base}?txn=pay`;
  },
  getFallbackInstructions: (input) => {
    const username = stripHandle(input);
    return username ? `Open Venmo and pay @${username}` : "Open Venmo to complete payment.";
  },
};

export const PAYPAL_PROVIDER: PaymentProviderDefinition = {
  providerKey: "paypal",
  displayName: "PayPal",
  brandColor: "#003087",
  supportsAmount: true,
  supportsVerifiedPayment: false,
  normalizeInput: (input) => input.trim(),
  validateInput: (input) => {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, error: "PayPal.me URL is required." };
    if (!trimmed.startsWith("http")) {
      const handle = stripHandle(trimmed);
      if (!/^[a-zA-Z0-9._-]{1,50}$/.test(handle)) {
        return { ok: false, error: "Invalid PayPal.me handle." };
      }
      return { ok: true, normalized: `https://paypal.me/${handle}` };
    }
    if (!isSafeHttpUrl(trimmed, APPROVED_PAYPAL_HOSTS)) {
      return { ok: false, error: "PayPal URL must be from paypal.me or paypal.com." };
    }
    return { ok: true, normalized: trimmed };
  },
  buildDestination: (input, amountCents) => {
    const trimmed = input.trim();
    let url: string;
    if (trimmed.startsWith("http") && isSafeHttpUrl(trimmed, APPROVED_PAYPAL_HOSTS)) {
      url = trimmed;
    } else {
      const handle = stripHandle(trimmed);
      if (!handle) return null;
      url = `https://paypal.me/${handle}`;
    }
    if (amountCents && amountCents > 0) {
      const parsed = new URL(url);
      parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/${formatDollars(amountCents)}`;
      return parsed.toString();
    }
    return url;
  },
  getFallbackInstructions: (input) => {
    const trimmed = input.trim();
    if (trimmed.startsWith("http")) return "Open PayPal to complete payment.";
    const handle = stripHandle(trimmed);
    return handle ? `Open PayPal and pay paypal.me/${handle}` : "Open PayPal to complete payment.";
  },
};

export const ZELLE_PROVIDER: PaymentProviderDefinition = {
  providerKey: "zelle",
  displayName: "Zelle",
  brandColor: "#6D1ED4",
  supportsAmount: false,
  supportsVerifiedPayment: false,
  normalizeInput: (input) => input.trim(),
  validateInput: (input) => {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, error: "Zelle email or phone is required." };
    if (trimmed.startsWith("http")) {
      return { ok: false, error: "Zelle does not support URL links. Enter email or phone." };
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    const phoneOk = /^\+?[\d\s().-]{7,20}$/.test(trimmed);
    if (!emailOk && !phoneOk) {
      return { ok: false, error: "Enter a valid Zelle email or phone number." };
    }
    return { ok: true, normalized: trimmed };
  },
  buildDestination: () => null,
  getFallbackInstructions: (input) => {
    return `Send via Zelle to: ${input.trim()}`;
  },
};

export const PAYMENT_PROVIDER_MAP: Record<PaymentProvider, PaymentProviderDefinition> = {
  cash_app: CASH_APP_PROVIDER,
  venmo: VENMO_PROVIDER,
  paypal: PAYPAL_PROVIDER,
  zelle: ZELLE_PROVIDER,
};

export function getPaymentProvider(provider: PaymentProvider): PaymentProviderDefinition {
  return PAYMENT_PROVIDER_MAP[provider];
}

export function validatePaymentMethodInput(
  provider: PaymentProvider,
  input: string
): { ok: true; normalized: string } | { ok: false; error: string } {
  return getPaymentProvider(provider).validateInput(input);
}

export function buildPaymentDestination(
  provider: PaymentProvider,
  input: string,
  amountCents?: number
): string | null {
  const def = getPaymentProvider(provider);
  const validated = def.validateInput(input);
  if (!validated.ok) return null;
  return def.buildDestination(validated.normalized, amountCents);
}

export function isBlockedUrl(url: string): boolean {
  return BLOCKED_PROTOCOLS.test(url.trim());
}
