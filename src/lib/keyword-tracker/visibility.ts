export type RankBucket = "top3" | "top10" | "top20" | "beyond" | "unranked";

export function visibilityFromRank(rank: number | null | undefined): number {
  if (rank == null || rank <= 0) return 0;
  if (rank === 1) return 100;
  if (rank === 2) return 85;
  if (rank === 3) return 70;
  if (rank === 4) return 55;
  if (rank === 5) return 45;
  if (rank === 6) return 38;
  if (rank === 7) return 32;
  if (rank === 8) return 27;
  if (rank === 9) return 23;
  if (rank === 10) return 20;
  if (rank >= 11 && rank <= 20) {
    return Math.round(15 - ((rank - 11) / 9) * 10);
  }
  return 0;
}

export function rankBucketFromRank(rank: number | null | undefined): RankBucket {
  if (rank == null || rank <= 0) return "unranked";
  if (rank <= 3) return "top3";
  if (rank <= 10) return "top10";
  if (rank <= 20) return "top20";
  return "beyond";
}

export function rankBadgeClass(bucket: RankBucket): string {
  switch (bucket) {
    case "top3":
      return "bg-emerald-100 text-emerald-800";
    case "top10":
      return "bg-amber-100 text-amber-800";
    case "top20":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-red-100 text-red-800";
  }
}

export function formatVolume(volume: number | null | undefined): string {
  if (volume == null) return "—";
  if (volume < 15) return "<15";
  if (volume < 100) return `~${volume}`;
  if (volume < 1000) return `~${volume}`;
  return `~${volume.toLocaleString("en-US")}`;
}

export function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function rankChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return previous - current;
}

export function opportunityScore(rank: number | null, volume: number | null): number {
  const vol = volume ?? 0;
  const vis = visibilityFromRank(rank);
  if (vol <= 0) return Math.max(0, 100 - vis);
  return Math.round(vol * ((100 - vis) / 100));
}
