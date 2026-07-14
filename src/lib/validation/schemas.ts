import { z } from "zod";

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
  keyword: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

export const createScanSchema = z.object({
  businessId: z.string().uuid(),
  gridSize: z.number().int().min(3).max(11).default(7),
  radiusMeters: z.number().int().min(500).max(17000).default(8047),
  scanType: z.enum(["quick", "standard"]).default("quick"),
  device: z.enum(["desktop", "mobile"]).default("mobile"),
  os: z.enum(["android", "ios", "windows", "macos"]).default("android"),
  browser: z.enum(["chrome", "firefox"]).default("chrome"),
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

export const exportReportSchema = z.object({
  businessId: z.string().uuid(),
  scanBatchId: z.string().uuid(),
});

export const revokeReportSchema = z.object({
  businessId: z.string().uuid(),
  reportId: z.string().uuid(),
});

export const visionAnalyzeSchema = z.object({
  imageBase64: z.string().min(100),
  prompt: z.string().min(5),
});
