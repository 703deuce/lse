/**
 * DataForSEO Maps execution modes for A/B testing.
 *
 * Each mode stays pure end-to-end (primary + recovery + integrity):
 * - priority: task_post with API priority=2
 * - standard: task_post with API priority=1
 * - live: serp/google/maps/live/advanced
 */

export const DFS_EXECUTION_MODES = ["priority", "standard", "live"] as const;
export type DfsExecutionMode = (typeof DFS_EXECUTION_MODES)[number];

export const DEFAULT_DFS_EXECUTION_MODE: DfsExecutionMode = "priority";

/** DataForSEO task_post priority values. */
export const DFS_API_PRIORITY_STANDARD = 1;
export const DFS_API_PRIORITY_HIGH = 2;

export type DfsExecutionModeOption = {
  id: DfsExecutionMode;
  label: string;
  shortLabel: string;
  description: string;
};

export const DFS_EXECUTION_MODE_OPTIONS: DfsExecutionModeOption[] = [
  {
    id: "priority",
    label: "Priority (batch)",
    shortLabel: "Priority",
    description: "DataForSEO task_post with priority=2 (fast queue).",
  },
  {
    id: "standard",
    label: "Standard (batch)",
    shortLabel: "Standard",
    description: "DataForSEO task_post with priority=1 (normal queue).",
  },
  {
    id: "live",
    label: "Live",
    shortLabel: "Live",
    description: "DataForSEO Maps live/advanced (immediate per cell).",
  },
];

export function isDfsExecutionMode(value: unknown): value is DfsExecutionMode {
  return (
    typeof value === "string" &&
    (DFS_EXECUTION_MODES as readonly string[]).includes(value)
  );
}

export function parseDfsExecutionMode(value: unknown): DfsExecutionMode {
  return isDfsExecutionMode(value) ? value : DEFAULT_DFS_EXECUTION_MODE;
}

/** API priority for task_post modes. Live ignores this. */
export function dfsApiPriorityForMode(mode: DfsExecutionMode): 1 | 2 {
  return mode === "standard" ? DFS_API_PRIORITY_STANDARD : DFS_API_PRIORITY_HIGH;
}

export function dfsExecutionModeLabel(mode: DfsExecutionMode): string {
  return (
    DFS_EXECUTION_MODE_OPTIONS.find((o) => o.id === mode)?.shortLabel ?? mode
  );
}

export function dfsMethodForMode(mode: DfsExecutionMode): string {
  return mode === "live" ? "dfs_live_advanced" : "dfs_priority_batch";
}

/** Default OS when only device is chosen. */
export function osForScanDevice(device: "desktop" | "mobile"): "windows" | "android" {
  return device === "mobile" ? "android" : "windows";
}
