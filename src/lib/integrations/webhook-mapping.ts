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
      asString(pick(m.event_id, "event_id", "eventId")) ??
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

type PathHit = { path: string; key: string; value: unknown };

function collectPaths(value: unknown, prefix = "", out: PathHit[] = []): PathHit[] {
  if (value == null) return out;
  if (Array.isArray(value)) {
    if (value.length > 0) collectPaths(value[0], prefix ? `${prefix}.0` : "0", out);
    return out;
  }
  if (typeof value !== "object") {
    if (prefix) {
      const key = prefix.split(".").pop() ?? prefix;
      out.push({ path: prefix, key, value });
    }
    return out;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      collectPaths(v, path, out);
    } else if (Array.isArray(v)) {
      collectPaths(v, path, out);
    } else {
      out.push({ path, key: k, value: v });
    }
  }
  return out;
}

function scorePath(hit: PathHit, patterns: RegExp[]): number {
  let score = 0;
  for (const re of patterns) {
    if (re.test(hit.key) || re.test(hit.path)) score += 2;
  }
  if (typeof hit.value === "string" && hit.value.trim()) score += 1;
  return score;
}

function bestPath(hits: PathHit[], patterns: RegExp[]): string | undefined {
  let best: { path: string; score: number } | null = null;
  for (const hit of hits) {
    const score = scorePath(hit, patterns);
    if (score < 2) continue;
    if (!best || score > best.score) best = { path: hit.path, score };
  }
  return best?.path;
}

/**
 * Infer a FieldMapping from a sample Zapier/Make/CRM JSON payload.
 * Prefers nested customer.* style paths when scores tie via path length heuristics.
 */
export function detectFieldMapping(sample: unknown): FieldMapping {
  if (!sample || typeof sample !== "object" || Array.isArray(sample)) return {};
  const hits = collectPaths(sample);
  const mapping: FieldMapping = {};

  const pick = (key: keyof FieldMapping, patterns: RegExp[]) => {
    const path = bestPath(hits, patterns);
    if (path) mapping[key] = path;
  };

  pick("email", [/^email$/i, /e[_-]?mail/i, /Email$/]);
  pick("phone", [/^phone$/i, /phone/i, /mobile/i, /cell/i, /telephone/i]);
  pick("first_name", [/^first[_-]?name$/i, /first[_-]?name/i, /firstname/i, /^fname$/i]);
  pick("last_name", [/^last[_-]?name$/i, /last[_-]?name/i, /lastname/i, /^lname$/i]);
  pick("name", [/^name$/i, /customer[_-]?name/i, /full[_-]?name/i, /client[_-]?name/i]);
  pick("external_customer_id", [
    /external[_-]?(customer[_-]?)?id/i,
    /customer[_-]?id/i,
    /client[_-]?id/i,
    /^contact[_-]?id$/i,
  ]);
  pick("event_id", [/^event[_-]?id$/i, /job[_-]?id/i, /invoice[_-]?id/i, /order[_-]?id/i]);
  pick("event_type", [/^event[_-]?type$/i, /^type$/i, /trigger/i]);
  pick("occurred_at", [/occurred/i, /completed[_-]?at/i, /finished[_-]?at/i, /timestamp/i]);
  pick("completed_at", [/completed[_-]?at/i, /finished[_-]?at/i, /service[_-]?date/i]);
  pick("transaction_id", [/transaction[_-]?id/i, /job[_-]?id/i, /invoice[_-]?id/i, /order[_-]?id/i]);
  pick("job_type", [/job[_-]?type/i, /service[_-]?type/i, /work[_-]?type/i]);
  pick("email_consent", [/email[_-]?consent/i, /marketing[_-]?email/i]);
  pick("sms_consent", [/sms[_-]?consent/i, /marketing[_-]?sms/i, /text[_-]?consent/i]);

  // Prefer dedicated name fields over a generic "name" colliding with business name.
  if (mapping.name && (mapping.first_name || mapping.last_name)) {
    const nameHit = hits.find((h) => h.path === mapping.name);
    if (nameHit && /business|company|org/i.test(nameHit.path)) {
      delete mapping.name;
    }
  }

  return mapping;
}
