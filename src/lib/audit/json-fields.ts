/** DataForSEO / GBP place topics may arrive as an array, object map, or string. */
export function normalizePlaceTopics(raw: unknown): string[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          if (typeof o.title === "string") return o.title.trim();
          if (typeof o.keyword === "string") return o.keyword.trim();
          if (typeof o.name === "string") return o.name.trim();
          if (typeof o.topic === "string") return o.topic.trim();
        }
        return null;
      })
      .filter((s): s is string => Boolean(s));
  }

  if (typeof raw === "object") {
    return Object.keys(raw as Record<string, unknown>).filter(Boolean);
  }

  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

/** Coerce JSONB list fields that should be string arrays. */
export function normalizeStringList(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item)).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}
