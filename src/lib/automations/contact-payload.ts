/** Normalize Zapier/Make flat or nested contact payloads. */

export type AutomationContactInput = {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  externalId?: string | null;
  jobType?: string | null;
  serviceDate?: string | null;
  tags?: string[];
};

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function parseAutomationContact(body: Record<string, unknown>): AutomationContactInput {
  const nested =
    body.contact && typeof body.contact === "object"
      ? (body.contact as Record<string, unknown>)
      : body;

  const firstName = pickString(nested, "firstName", "first_name", "First Name");
  const lastName = pickString(nested, "lastName", "last_name", "Last Name");
  const name =
    pickString(nested, "name", "customerName", "customer_name", "full_name", "fullName", "Name") ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    null;

  const tagsRaw = nested.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
    : typeof tagsRaw === "string" && tagsRaw.trim()
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : undefined;

  return {
    firstName,
    lastName,
    name,
    phone: pickString(nested, "phone", "customerPhone", "customer_phone", "mobile", "Phone"),
    email: pickString(nested, "email", "customerEmail", "customer_email", "Email"),
    notes: pickString(nested, "notes", "Notes"),
    externalId: pickString(
      nested,
      "externalId",
      "external_id",
      "externalCustomerId",
      "customer_id",
      "jobId",
      "job_id"
    ),
    jobType: pickString(nested, "jobType", "job_type", "serviceType", "service_type", "service"),
    serviceDate: pickString(
      nested,
      "serviceDate",
      "service_date",
      "completedAt",
      "completed_at",
      "jobDate"
    ),
    tags,
  };
}

export function contactDisplayName(c: AutomationContactInput): string {
  if (c.name?.trim()) return c.name.trim();
  const parts = [c.firstName, c.lastName].filter((p) => p?.trim());
  if (parts.length) return parts.join(" ");
  return "Customer";
}
