/**
 * Dot-path field mapping for Zapier/Make payloads → canonical review webhook shape.
 */

export type FieldMapping = {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  external_customer_id?: string;
  transaction_id?: string;
  completed_at?: string;
  email_consent?: string;
  sms_consent?: string;
  job_type?: string;
};

export type CanonicalWebhookPayload = {
  event_id: string | null;
  event_type: string;
  occurred_at: string | null;
  customer: {
    external_id: string | null;
    first_name: string | null;
    last_name: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  transaction: {
    external_id: string | null;
    type: string | null;
    completed_at: string | null;
  };
  consent: {
    email: boolean | null;
    sms: boolean | null;
  };
};

function getByPath(obj: unknown, path: string): unknown {
  if (!path?.trim()) return undefined;
  const parts = path.trim().split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return null;
}

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(s)) return true;
    if (["false", "0", "no", "n"].includes(s)) return false;
  }
  return null;
}

/** Apply mapping; empty mapping falls back to canonical + common aliases. */
export function applyFieldMapping(
  raw: Record<string, unknown>,
  mapping: FieldMapping | null | undefined,
  defaults?: { eventType?: string }
): CanonicalWebhookPayload {
  const m = mapping ?? {};
  const pick = (path: string | undefined, ...fallbacks: string[]): unknown => {
    if (path) {
      const v = getByPath(raw, path);
      if (v !== undefined && v !== null && v !== "") return v;
    }
    for (const fb of fallbacks) {
      const v = getByPath(raw, fb);
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };

  const customerObj =
    raw.customer && typeof raw.customer === "object"
      ? (raw.customer as Record<string, unknown>)
      : {};
  const transactionObj =
    raw.transaction && typeof raw.transaction === "object"
      ? (raw.transaction as Record<string, unknown>)
      : {};
  const consentObj =
    raw.consent && typeof raw.consent === "object"
      ? (raw.consent as Record<string, unknown>)
      : {};

  const first =
    asString(pick(m.first_name, "customer.first_name", "customer.firstName", "first_name", "firstName")) ??
    asString(customerObj.first_name) ??
    asString(customerObj.firstName);
  const last =
    asString(pick(m.last_name, "customer.last_name", "customer.lastName", "last_name", "lastName")) ??
    asString(customerObj.last_name) ??
    asString(customerObj.lastName);
  const name =
    asString(pick(m.name, "customer.name", "name", "customer_name", "customerName")) ??
    asString(customerObj.name) ??
    ([first, last].filter(Boolean).join(" ") || null);

  return {
    event_id:
      asString(pick(m.event_id, "event_id", "eventId", "id")) ??
      asString(transactionObj.external_id) ??
      null,
    event_type:
      asString(pick(m.event_type, "event_type", "eventType", "type")) ??
      defaults?.eventType ??
      "service.completed",
    occurred_at:
      asString(pick(m.occurred_at, "occurred_at", "occurredAt", "completed_at", "completedAt")) ??
      null,
    customer: {
      external_id:
        asString(
          pick(
            m.external_customer_id,
            "customer.external_id",
            "customer.externalId",
            "external_id",
            "externalId"
          )
        ) ?? asString(customerObj.external_id) ??
        asString(customerObj.externalId),
      first_name: first,
      last_name: last,
      name,
      email:
        asString(pick(m.email, "customer.email", "email", "customer_email", "customerEmail"))
          ?.toLowerCase() ??
        asString(customerObj.email)?.toLowerCase() ??
        null,
      phone:
        asString(pick(m.phone, "customer.phone", "phone", "customer_phone", "customerPhone")) ??
        asString(customerObj.phone) ??
        null,
    },
    transaction: {
      external_id:
        asString(
          pick(m.transaction_id, "transaction.external_id", "transaction.id", "job_id", "jobId")
        ) ?? asString(transactionObj.external_id) ??
        asString(transactionObj.id),
      type:
        asString(pick(m.job_type, "transaction.type", "job_type", "jobType", "service_type")) ??
        asString(transactionObj.type),
      completed_at:
        asString(
          pick(m.completed_at, "transaction.completed_at", "completed_at", "completedAt")
        ) ?? asString(transactionObj.completed_at),
    },
    consent: {
      email: asBool(pick(m.email_consent, "consent.email")) ?? asBool(consentObj.email),
      sms: asBool(pick(m.sms_consent, "consent.sms")) ?? asBool(consentObj.sms),
    },
  };
}

export const CANONICAL_EVENT_TYPES = [
  "service.completed",
  "appointment.completed",
  "invoice.paid",
  "order.fulfilled",
  "customer.created",
  "contact.enroll",
  "review_request.send",
  "custom",
] as const;

export type CanonicalEventType = (typeof CANONICAL_EVENT_TYPES)[number];

export function isEnrollEventType(eventType: string): boolean {
  return [
    "service.completed",
    "appointment.completed",
    "invoice.paid",
    "order.fulfilled",
    "contact.enroll",
    "review_request.send",
  ].includes(eventType);
}
