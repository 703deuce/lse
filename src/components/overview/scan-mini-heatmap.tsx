import { rankHex } from "@/lib/maps/colors";
import { cn } from "@/lib/utils";

export function ScanMiniHeatmap({
  ranks,
  gridSize,
  className,
}: {
  ranks: Array<number | null>;
  gridSize: number;
  className?: string;
}) {
  const size = Math.max(3, Math.min(gridSize, 9));
  const cells = ranks.length ? ranks : Array.from({ length: size * size }, () => null);

  return (
    <div
      className={cn("inline-grid gap-px rounded border border-zinc-200/80 bg-zinc-200/80 p-px", className)}
      style={{
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        width: size <= 3 ? 28 : size <= 5 ? 36 : 44,
      }}
      aria-hidden
    >
      {cells.slice(0, size * size).map((rank, i) => (
        <span
          key={i}
          className="aspect-square rounded-[1px]"
          style={{ backgroundColor: rankHex(rank, "falcon") }}
        />
      ))}
    </div>
  );
}
