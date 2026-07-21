/**
 * Local SEO Express — product design tokens (rulebook)
 * Use these values; do not invent one-off spacing/radius/type sizes.
 */

export const color = {
  page: "#F6F7F9",
  surface: "#FFFFFF",
  text: "#111827",
  textSecondary: "#5F6B7A",
  textMuted: "#87909E",
  border: "#E4E7EC",
  brand: "#137752",
  brandHover: "#0f6344",
  info: "#2563EB",
  warning: "#D97706",
  danger: "#DC2626",
} as const;

/** 8-point spacing scale */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
} as const;

export const type = {
  pageTitle: { size: 28, weight: 700, line: 1.2 },
  pageDesc: { size: 15, weight: 400, line: 1.5 },
  primaryMetric: { size: 40, weight: 700, line: 1 },
  sectionTitle: { size: 18, weight: 600, line: 1.3 },
  cardTitle: { size: 14, weight: 600, line: 1.3 },
  body: { size: 14, weight: 400, line: 1.5 },
  label: { size: 12, weight: 500, line: 1.3 },
} as const;

export const elevation = {
  none: "none",
  card: "0 1px 2px rgba(15,23,42,0.04)",
  featured: "0 8px 30px rgba(15,23,42,0.06)",
  overlay: "0 16px 40px rgba(15,23,42,0.14)",
} as const;

export const layout = {
  contentMax: 1440,
  pagePadDesktop: 32,
  pagePadTablet: 24,
  pagePadMobile: 16,
} as const;

export const control = {
  heightSm: 32,
  heightMd: 40,
  heightLg: 44,
} as const;
