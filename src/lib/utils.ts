import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRank(rank: number | null | undefined): string {
  if (rank == null) return "Not found";
  if (rank <= 3) return `#${rank}`;
  if (rank <= 10) return `#${rank}`;
  if (rank <= 20) return `#${rank}`;
  return `#${rank}`;
}

export function rankColor(rank: number | null | undefined): string {
  if (rank == null) return "bg-gray-400";
  if (rank <= 3) return "bg-emerald-700";
  if (rank === 4) return "bg-lime-700";
  if (rank <= 10) return "bg-amber-400";
  if (rank <= 19) return "bg-orange-500";
  return "bg-red-500";
}

export async function hashRequest(body: unknown): Promise<string> {
  const text = JSON.stringify(body);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
