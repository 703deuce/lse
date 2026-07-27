/** CORS helpers for public free-tool APIs (marketing site + local previews). */

export function publicToolCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = new Set([
    "https://localseoexpress.com",
    "https://www.localseoexpress.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:8765",
    "http://127.0.0.1:8765",
  ]);
  const value =
    origin && (allowed.has(origin) || origin.endsWith(".localseoexpress.com"))
      ? origin
      : "https://localseoexpress.com";
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
