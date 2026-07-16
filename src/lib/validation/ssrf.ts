import { URL } from "url";
import dns from "dns/promises";
import net from "net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata",
]);

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 2_000_000;

function normalizeIp(ip: string): string {
  const mapped = /^:ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  return ip.toLowerCase();
}

export function isPrivateIp(ip: string): boolean {
  const n = normalizeIp(ip);
  if (net.isIPv4(n)) {
    const parts = n.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
  }
  if (net.isIPv6(n)) {
    if (n === "::1" || n === "::") return true;
    if (n.startsWith("fc") || n.startsWith("fd")) return true;
    if (n.startsWith("fe80")) return true;
    if (n.startsWith("ff")) return true;
  }
  return false;
}

async function resolvePublicAddresses(hostname: string): Promise<string[]> {
  const [v4, v6] = await Promise.all([
    dns.resolve4(hostname).catch(() => [] as string[]),
    dns.resolve6(hostname).catch(() => [] as string[]),
  ]);
  return [...v4, ...v6];
}

export async function validatePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP(S) URLs allowed");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs with credentials are not allowed");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTS.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Blocked hostname");
  }

  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error("URL resolves to private IP");
  }

  const addresses = await resolvePublicAddresses(hostname);
  if (addresses.length === 0 && !net.isIP(hostname)) {
    throw new Error("Unable to resolve hostname");
  }
  for (const ip of addresses) {
    if (isPrivateIp(ip)) {
      throw new Error("URL resolves to private IP");
    }
  }

  return parsed;
}

async function fetchValidated(
  url: string,
  timeoutMs: number,
  redirectsLeft: number
): Promise<Response> {
  const parsed = await validatePublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "manual",
      headers: {
        "User-Agent": "MapsGrowthAgent/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      if (redirectsLeft <= 0) throw new Error("Too many redirects");
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect without location");
      const next = new URL(location, parsed).toString();
      return fetchValidated(next, timeoutMs, redirectsLeft - 1);
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function safeFetchWebsite(url: string, timeoutMs = 10000): Promise<Response> {
  const res = await fetchValidated(url, timeoutMs, MAX_REDIRECTS);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) {
    throw new Error("Response too large");
  }
  return res;
}
