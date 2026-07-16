import { createServiceClient } from "@/lib/db/client";
import { normalizePhoneE164, phoneDigitsForMatch } from "@/lib/reputation/phone";
import type { MappedRow } from "@/lib/reputation/bulk-csv";

export type RecipientStatus =
  | "ready"
  | "duplicate"
  | "invalid_contact"
  | "missing_contact"
  | "recently_contacted"
  | "opted_out"
  | "skipped";

export type ValidatedRecipient = MappedRow & {
  status: RecipientStatus;
  skip_reason?: string;
  normalized_phone?: string;
  normalized_email?: string;
};

export type ValidationSummary = {
  total_rows: number;
  ready: number;
  duplicate: number;
  invalid_contact: number;
  missing_contact: number;
  recently_contacted: number;
  opted_out: number;
  skipped: number;
};

export type ValidationChannel = "sms" | "email" | "both";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export async function validateBulkRecipients(params: {
  businessId: string;
  rows: MappedRow[];
  duplicateProtectionDays?: number;
  /** When sms/email-only, suppressions on the other channel do not block readiness. */
  channel?: ValidationChannel;
}): Promise<{ summary: ValidationSummary; recipients: ValidatedRecipient[] }> {
  const supabase = createServiceClient();
  const days = params.duplicateProtectionDays ?? 90;
  const channel: ValidationChannel = params.channel ?? "both";
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentSends } = await supabase
    .from("review_request_sends")
    .select("recipient_phone, recipient_email, sent_at")
    .eq("business_id", params.businessId)
    .in("status", ["sent", "delivered", "clicked", "completed"])
    .gte("sent_at", since);

  const recentPhones = new Set<string>();
  const recentEmails = new Set<string>();
  for (const s of recentSends ?? []) {
    if (s.recipient_phone) recentPhones.add(phoneDigitsForMatch(s.recipient_phone));
    if (s.recipient_email) recentEmails.add(s.recipient_email.toLowerCase());
  }
  const { data: recentMessages } = await supabase
    .from("review_request_messages")
    .select("sent_at, recipient_id")
    .eq("business_id", params.businessId)
    .in("status", ["sent", "delivered", "clicked"])
    .gte("sent_at", since);

  if (recentMessages?.length) {
    const recipientIds = [...new Set(recentMessages.map((m) => m.recipient_id))];
    const { data: msgRecipients } = await supabase
      .from("review_request_recipients")
      .select("id, phone, email")
      .in("id", recipientIds);
    for (const r of msgRecipients ?? []) {
      if (r.phone) recentPhones.add(phoneDigitsForMatch(r.phone));
      if (r.email) recentEmails.add(r.email.toLowerCase());
    }
  }

  const { data: suppressions } = await supabase
    .from("review_request_suppression")
    .select("phone, email, expires_at")
    .eq("business_id", params.businessId);

  const suppressedPhones = new Set<string>();
  const suppressedEmails = new Set<string>();
  const now = Date.now();
  for (const s of suppressions ?? []) {
    if (s.expires_at && new Date(s.expires_at).getTime() < now) continue;
    if (s.phone) suppressedPhones.add(phoneDigitsForMatch(s.phone));
    if (s.email) suppressedEmails.add(s.email.toLowerCase());
  }

  // Also honor contact-level opt-out flags (may exist without a suppression row).
  const { data: optedContacts } = await supabase
    .from("review_request_contacts")
    .select("phone_e164, email_normalized, sms_opt_out, email_unsubscribed")
    .eq("business_id", params.businessId)
    .or("sms_opt_out.eq.true,email_unsubscribed.eq.true")
    .limit(5000);
  for (const c of optedContacts ?? []) {
    if (c.sms_opt_out && c.phone_e164) {
      suppressedPhones.add(phoneDigitsForMatch(c.phone_e164));
    }
    if (c.email_unsubscribed && c.email_normalized) {
      suppressedEmails.add(String(c.email_normalized).toLowerCase());
    }
  }

  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const recipients: ValidatedRecipient[] = [];

  const summary: ValidationSummary = {
    total_rows: params.rows.length,
    ready: 0,
    duplicate: 0,
    invalid_contact: 0,
    missing_contact: 0,
    recently_contacted: 0,
    opted_out: 0,
    skipped: 0,
  };

  for (const row of params.rows) {
    const phoneRaw = row.phone?.trim();
    const emailRaw = row.email?.trim().toLowerCase();
    const normalized_phone = phoneRaw ? normalizePhoneE164(phoneRaw) : null;
    const normalized_email = emailRaw && isValidEmail(emailRaw) ? emailRaw : emailRaw ? null : undefined;

    let status: RecipientStatus = "ready";
    let skip_reason: string | undefined;
    let outPhone: string | null | undefined = normalized_phone ?? phoneRaw ?? undefined;
    let outEmail: string | null | undefined = normalized_email ?? emailRaw ?? undefined;

    const phoneOk = Boolean(normalized_phone);
    const emailOk = Boolean(normalized_email);
    const phoneKey = normalized_phone ? phoneDigitsForMatch(normalized_phone) : null;
    const phoneSuppressed = Boolean(phoneKey && suppressedPhones.has(phoneKey));
    const emailSuppressed = Boolean(normalized_email && suppressedEmails.has(normalized_email));
    const phoneRecent = Boolean(phoneKey && recentPhones.has(phoneKey));
    const emailRecent = Boolean(normalized_email && recentEmails.has(normalized_email));
    const phoneDup = Boolean(phoneKey && seenPhones.has(phoneKey));
    const emailDup = Boolean(normalized_email && seenEmails.has(normalized_email));

    if (channel === "sms") {
      if (!phoneRaw) {
        status = "missing_contact";
        skip_reason = "No phone number";
      } else if (!normalized_phone) {
        status = "invalid_contact";
        skip_reason = "Invalid phone number";
      } else if (phoneSuppressed) {
        status = "opted_out";
        skip_reason = "Opted out (SMS)";
      } else if (phoneRecent) {
        status = "recently_contacted";
        skip_reason = `Contacted in last ${days} days (phone)`;
      } else if (phoneDup) {
        status = "duplicate";
        skip_reason = "Duplicate phone in CSV";
      } else {
        seenPhones.add(phoneKey!);
        // Email opt-out / recent email must not block SMS; drop unusable email.
        if (emailSuppressed || emailRecent || !emailOk) outEmail = undefined;
      }
    } else if (channel === "email") {
      if (!emailRaw) {
        status = "missing_contact";
        skip_reason = "No email address";
      } else if (!normalized_email) {
        status = "invalid_contact";
        skip_reason = "Invalid email address";
      } else if (emailSuppressed) {
        status = "opted_out";
        skip_reason = "Opted out (email)";
      } else if (emailRecent) {
        status = "recently_contacted";
        skip_reason = `Contacted in last ${days} days (email)`;
      } else if (emailDup) {
        status = "duplicate";
        skip_reason = "Duplicate email in CSV";
      } else {
        seenEmails.add(normalized_email);
        if (phoneSuppressed || phoneRecent || !phoneOk) outPhone = undefined;
      }
    } else {
      // both: ready if at least one channel path works
      if (!phoneRaw && !emailRaw) {
        status = "missing_contact";
        skip_reason = "No phone or email";
      } else if (phoneRaw && !normalized_phone && emailRaw && !normalized_email) {
        status = "invalid_contact";
        skip_reason = "Invalid phone and email";
      } else if (phoneRaw && !normalized_phone && !emailRaw) {
        status = "invalid_contact";
        skip_reason = "Invalid phone number";
      } else if (emailRaw && !isValidEmail(emailRaw) && !normalized_phone) {
        status = "invalid_contact";
        skip_reason = "Invalid email address";
      } else {
        const smsReady = phoneOk && !phoneSuppressed && !phoneRecent && !phoneDup;
        const emailReady = emailOk && !emailSuppressed && !emailRecent && !emailDup;

        if (smsReady || emailReady) {
          if (smsReady && phoneKey) seenPhones.add(phoneKey);
          if (emailReady && normalized_email) seenEmails.add(normalized_email);
          if (!smsReady) outPhone = undefined;
          if (!emailReady) outEmail = undefined;
        } else if (
          (phoneSuppressed || !phoneOk) &&
          (emailSuppressed || !emailOk) &&
          (phoneSuppressed || emailSuppressed)
        ) {
          status = "opted_out";
          skip_reason =
            phoneSuppressed && emailSuppressed
              ? "Opted out (SMS and email)"
              : phoneSuppressed
                ? "Opted out (SMS)"
                : "Opted out (email)";
        } else if (phoneRecent || emailRecent) {
          status = "recently_contacted";
          skip_reason =
            phoneRecent && emailRecent
              ? `Contacted in last ${days} days`
              : phoneRecent
                ? `Contacted in last ${days} days (phone)`
                : `Contacted in last ${days} days (email)`;
        } else if (phoneDup || emailDup) {
          status = "duplicate";
          skip_reason = phoneDup ? "Duplicate phone in CSV" : "Duplicate email in CSV";
        } else if (phoneSuppressed || emailSuppressed) {
          status = "opted_out";
          skip_reason = phoneSuppressed ? "Opted out (SMS)" : "Opted out (email)";
        } else {
          status = "invalid_contact";
          skip_reason = "No usable phone or email";
        }
      }
    }

    if (status === "ready") summary.ready++;
    else if (status === "duplicate") summary.duplicate++;
    else if (status === "invalid_contact") summary.invalid_contact++;
    else if (status === "missing_contact") summary.missing_contact++;
    else if (status === "recently_contacted") summary.recently_contacted++;
    else if (status === "opted_out") summary.opted_out++;
    else summary.skipped++;

    recipients.push({
      ...row,
      status,
      skip_reason,
      normalized_phone: outPhone && normalized_phone ? normalized_phone : undefined,
      normalized_email: outEmail && normalized_email ? normalized_email : undefined,
      phone: outPhone ?? undefined,
      email: outEmail ?? undefined,
    });
  }

  return { summary, recipients };
}

export function recipientsToCsv(recipients: ValidatedRecipient[]): string {
  const headers = [
    "row_index",
    "first_name",
    "last_name",
    "full_name",
    "phone",
    "email",
    "status",
    "skip_reason",
  ];
  const lines = [headers.join(",")];
  for (const r of recipients) {
    if (r.status === "ready") continue;
    lines.push(
      [
        r.rowIndex,
        r.first_name ?? "",
        r.last_name ?? "",
        r.full_name ?? "",
        r.phone ?? "",
        r.email ?? "",
        r.status,
        r.skip_reason ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
  }
  return lines.join("\n");
}

export async function addSuppression(params: {
  organizationId: string;
  businessId: string;
  phone?: string | null;
  email?: string | null;
  reason?: string;
}) {
  const supabase = createServiceClient();
  await supabase.from("review_request_suppression").insert({
    organization_id: params.organizationId,
    business_id: params.businessId,
    phone: params.phone ?? null,
    email: params.email?.toLowerCase() ?? null,
    reason: params.reason ?? "opt_out",
  });
}
