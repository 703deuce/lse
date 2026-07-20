/** Only allow same-origin relative paths for post-login redirects. */
export function safeNextPath(raw: string | null | undefined, fallback = "/workspace"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }
  return raw;
}

export function safeNextPathOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return null;
  }
  return raw;
}
