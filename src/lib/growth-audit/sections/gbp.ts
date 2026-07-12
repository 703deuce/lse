import type { GbpProfile } from "@/lib/audit/types";
import { scoreChecks } from "@/lib/audit/types";
import type { ReviewAuditResult, PostAuditResult, PhotoAuditResult } from "@/lib/audit/gbp-modules";
import type { CategoryAlignmentResult } from "@/lib/audit/category-alignment";
import type { AuditCheck } from "@/lib/audit/types";
import type { GbpSection } from "@/lib/growth-audit/types";

export function buildGbpSection(input: {
  gbp: GbpProfile;
  reviews: ReviewAuditResult;
  posts: PostAuditResult;
  photos: PhotoAuditResult;
  categoryAlignment?: CategoryAlignmentResult | null;
}): GbpSection {
  const checks: AuditCheck[] = [
    {
      id: "nap-name",
      label: "Business name",
      status: input.gbp.name ? "match" : "missing",
      gbpValue: input.gbp.name,
      bucket: "trust",
    },
    {
      id: "nap-address",
      label: "Address",
      status: input.gbp.address ? "match" : "missing",
      gbpValue: input.gbp.address ?? undefined,
      bucket: "trust",
    },
    {
      id: "nap-phone",
      label: "Phone",
      status: input.gbp.phone ? "match" : "missing",
      gbpValue: input.gbp.phone ?? undefined,
      bucket: "trust",
    },
    {
      id: "primary-category",
      label: "Primary category",
      status: input.gbp.primaryCategory ? "match" : "missing",
      gbpValue: input.gbp.primaryCategory ?? undefined,
      bucket: "relevance",
    },
    {
      id: "description",
      label: "Business description",
      status: input.gbp.description ? "match" : "missing",
      gbpValue: input.gbp.description ? `${input.gbp.description.slice(0, 80)}…` : undefined,
      bucket: "relevance",
    },
    {
      id: "hours",
      label: "Business hours",
      status: input.gbp.hoursText ? "match" : "missing",
      gbpValue: input.gbp.hoursText ?? undefined,
      bucket: "trust",
    },
    {
      id: "photos",
      label: "Photo count",
      status: (input.photos.photoCount ?? 0) >= 10 ? "match" : (input.photos.photoCount ?? 0) >= 5 ? "partial" : "missing",
      gbpValue: String(input.photos.photoCount),
      bucket: "prominence",
    },
    {
      id: "posts",
      label: "Recent posts",
      status: (input.posts.postCount ?? 0) >= 2 ? "match" : (input.posts.postCount ?? 0) >= 1 ? "partial" : "missing",
      gbpValue: String(input.posts.postCount),
      bucket: "prominence",
    },
    {
      id: "reviews",
      label: "Reviews",
      status: (input.reviews.reviewCount ?? 0) >= 30 ? "match" : (input.reviews.reviewCount ?? 0) >= 10 ? "partial" : "missing",
      gbpValue: `${input.reviews.reviewCount} (${input.reviews.rating}★)`,
      bucket: "prominence",
    },
  ];

  return {
    score: scoreChecks(checks),
    profile: input.gbp,
    checks,
    reviews: input.reviews,
    posts: input.posts,
    photos: input.photos,
    categoryAlignment: input.categoryAlignment ?? null,
  };
}
