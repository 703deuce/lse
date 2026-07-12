import type { NormalizedReview } from "@/lib/reviews/normalize";
import { hasOwnerResponse } from "@/lib/reviews/normalize";

export type ResponseAudit = {
  responseRate: number;
  totalWithText: number;
  answered: number;
  unansweredPositive: number;
  unansweredNegative: number;
  unansweredNeutral: number;
  genericResponseSuspected: number;
};

function sentimentFromRating(rating: number | null): "positive" | "negative" | "neutral" {
  if (rating == null) return "neutral";
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

function isGenericResponse(text: string): boolean {
  const t = text.toLowerCase().trim();
  const generic = [
    "thank you for your review",
    "thanks for your feedback",
    "we appreciate your business",
    "thank you for choosing",
  ];
  return generic.some((g) => t.includes(g)) && t.length < 120;
}

export function auditOwnerResponses(reviews: NormalizedReview[]): ResponseAudit {
  const withText = reviews.filter((r) => (r.reviewText ?? "").trim().length > 0);
  const answered = withText.filter((r) => hasOwnerResponse(r.ownerResponseText));
  const unanswered = withText.filter((r) => !hasOwnerResponse(r.ownerResponseText));

  let unansweredPositive = 0;
  let unansweredNegative = 0;
  let unansweredNeutral = 0;
  let genericResponseSuspected = 0;

  for (const r of withText) {
    const sent = sentimentFromRating(r.rating);
    const hasResponse = hasOwnerResponse(r.ownerResponseText);
    if (!hasResponse) {
      if (sent === "positive") unansweredPositive++;
      else if (sent === "negative") unansweredNegative++;
      else unansweredNeutral++;
    } else if (isGenericResponse(r.ownerResponseText!)) {
      genericResponseSuspected++;
    }
  }

  const responseRate =
    withText.length > 0 ? Math.round((answered.length / withText.length) * 1000) / 10 : 0;

  return {
    responseRate,
    totalWithText: withText.length,
    answered: answered.length,
    unansweredPositive,
    unansweredNegative,
    unansweredNeutral,
    genericResponseSuspected,
  };
}

export function sentimentLabel(rating: number | null): string {
  return sentimentFromRating(rating);
}
