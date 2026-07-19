import { z } from "zod";
import { DEFAULT_RADIUS_METERS, MAX_RADIUS_METERS, MIN_RADIUS_METERS } from "@/lib/maps/grid-metrics";

export const resolveBusinessSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
});

export const createBusinessSchema = z.object({
  name: z.string().min(1),
  website_url: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address_text: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  place_id: z.string().nullable().optional(),
  cid: z.string().nullable().optional(),
  primary_category: z.string().nullable().optional(),
  service_area_mode: z.enum(["storefront", "service_area"]).optional(),
  scan_center_lat: z.number().nullable().optional(),
  scan_center_lng: z.number().nullable().optional(),
  /** Private scan-center address (service-area / hidden GBP address). */
  scan_center_label: z.string().max(240).nullable().optional(),
  keyword: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

export const mapsProviderModeSchema = z.enum(["hybrid", "scrapingdog", "dataforseo"]);

export const createScanSchema = z.object({
  businessId: z.string().uuid(),
  gridSize: z.number().int().min(3).max(11).default(7),
  radiusMeters: z
    .number()
    .int()
    .min(MIN_RADIUS_METERS)
    .max(MAX_RADIUS_METERS)
    .default(DEFAULT_RADIUS_METERS),
  scanType: z.enum(["quick", "standard"]).default("quick"),
  device: z.enum(["desktop", "mobile"]).default("mobile"),
  os: z.enum(["android", "ios", "windows", "macos"]).default("android"),
  browser: z.enum(["chrome", "firefox"]).default("chrome"),
  /** Standard = dataforseo (Maps Live Advanced). hybrid = Bright Data alternate. */
  mapsProviderMode: mapsProviderModeSchema.default("dataforseo"),
  parityLabel: z.string().optional(),
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  centerLabel: z.string().max(240).optional(),
});

export const actionPlanOutputSchema = z.object({
  summary: z.string(),
  actions: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      bucket: z.enum(["relevance", "distance", "prominence", "trust"]),
      impact: z.enum(["low", "medium", "high"]),
      effort: z.enum(["low", "medium", "high"]),
      reason_code: z.string(),
      evidence_refs: z.array(z.string()),
    })
  ),
});

export const researchSchema = z.object({
  question: z.string().min(5),
});

export const updateTaskSchema = z.object({
  itemId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "done", "skipped"]),
});

export const reportTypeSchema = z.enum([
  "single_scan",
  "competitor",
  "trend",
  "location",
  "keyword",
  "maps_campaign",
  "reviews",
  "review_campaign",
]);

export const exportReportSchema = z.object({
  businessId: z.string().uuid(),
  scanBatchId: z.string().uuid().optional(),
  reportType: reportTypeSchema.optional().default("single_scan"),
  keywordId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  gridSize: z.number().int().positive().optional().nullable(),
  radiusMeters: z.number().positive().optional().nullable(),
  selectedCompetitorKeys: z.array(z.string()).optional(),
  /** Bust ready-share reuse and regenerate HTML from current data. */
  force: z.boolean().optional(),
  dateFrom: z.string().datetime({ offset: true }).or(z.string().min(8).max(40)).optional().nullable(),
  dateTo: z.string().datetime({ offset: true }).or(z.string().min(8).max(40)).optional().nullable(),
  executiveSummary: z.string().max(8000).optional().nullable(),
  sections: z.record(z.string(), z.boolean()).optional().nullable(),
  workCompleted: z.string().max(4000).optional().nullable(),
  freelancerNotes: z.string().max(4000).optional().nullable(),
  nextSteps: z.string().max(4000).optional().nullable(),
  periodLabel: z.string().max(120).optional().nullable(),
  publishStatus: z.enum(["draft", "published"]).optional().nullable(),
  format: z
    .enum(["share", "csv", "summary_csv", "points_csv", "preview", "pdf"])
    .optional()
    .default("share"),
});

const reportLogoUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (v) =>
      v === "" ||
      /^https?:\/\//i.test(v) ||
      v.startsWith("/") ||
      /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(v),
    "logoUrl must be an http(s) URL, site-relative path, or data:image (no SVG) base64"
  );

export const reportBrandingSchema = z.object({
  logoUrl: z.union([reportLogoUrlSchema, z.null()]).optional(),
  accentColor: z
    .union([
      z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex color like #059669"),
      z.literal(""),
      z.null(),
    ])
    .optional(),
  footerText: z.union([z.string().max(240), z.null()]).optional(),
  contactLine: z.union([z.string().max(240), z.null()]).optional(),
  hidePlatformBranding: z.boolean().optional(),
});

export const revokeReportSchema = z.object({
  businessId: z.string().uuid(),
  reportId: z.string().uuid(),
});

const VISION_DATA_URL =
  /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/;

export const visionAnalyzeSchema = z.object({
  imageBase64: z
    .string()
    .min(100)
    .refine((value) => VISION_DATA_URL.test(value), {
      message: "imageBase64 must be a data URL for png, jpeg, jpg, or webp",
    })
    .refine((value) => {
      const match = value.match(VISION_DATA_URL);
      if (!match?.[2]) return false;
      try {
        return Buffer.from(match[2], "base64").length <= 4_000_000;
      } catch {
        return false;
      }
    }, "image payload too large"),
  prompt: z.string().min(5),
});

export const sendReviewEmailSchema = z.object({
  businessId: z.string().uuid(),
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.string().trim().email().max(320),
  serviceType: z.string().max(120).optional(),
  templateId: z.string().uuid().optional(),
  customMessage: z.string().max(2000).optional(),
});

export const sendReviewSmsSchema = z.object({
  businessId: z.string().uuid(),
  customerName: z.string().trim().min(1).max(200),
  customerPhone: z.string().trim().min(7).max(32),
  serviceType: z.string().max(120).optional(),
  templateId: z.string().uuid().optional(),
  customMessage: z.string().max(800).optional(),
});
