/**
 * QR poster template registry.
 * `classic_poster` is the free default. All others are Pro/paid templates.
 */

export const CLASSIC_POSTER_TEMPLATE = "classic_poster" as const;

export const PREMIUM_POSTER_TEMPLATE_KEYS = [
  "modern_minimal",
  "solid_green",
  "elegant_black",
  "friendly_green",
  "premium_gold",
  "cafe_coffee",
  "clear_blue",
  "black_white",
  "rustic_wood",
  "bold_palette",
] as const;

export type PremiumPosterTemplateKey = (typeof PREMIUM_POSTER_TEMPLATE_KEYS)[number];
export type PosterTemplateKey = typeof CLASSIC_POSTER_TEMPLATE | PremiumPosterTemplateKey;

export type PosterTemplateMeta = {
  key: PosterTemplateKey;
  label: string;
  /** Short blurb under the thumbnail */
  blurb: string;
  /** Suggested default headline when first selecting this template */
  suggestedTitle: string;
  /** Suggested description */
  suggestedDescription: string;
  /** Swatch / accent shown on the picker card */
  accent: string;
  /** Whether this requires a paid (non-trial) plan */
  premium: boolean;
};

export const POSTER_TEMPLATES: PosterTemplateMeta[] = [
  {
    key: "classic_poster",
    label: "Classic Green",
    blurb: "Default free poster",
    suggestedTitle: "Rate us on Google",
    suggestedDescription: "We value your feedback!",
    accent: "#137752",
    premium: false,
  },
  {
    key: "modern_minimal",
    label: "Modern Minimal",
    blurb: "Clean white · Scan Me",
    suggestedTitle: "Review Us on Google",
    suggestedDescription: "Scan the code with your phone camera",
    accent: "#137752",
    premium: true,
  },
  {
    key: "solid_green",
    label: "Solid Green",
    blurb: "Bold brand field",
    suggestedTitle: "Love our service?",
    suggestedDescription: "Tell us how it was!",
    accent: "#137752",
    premium: true,
  },
  {
    key: "elegant_black",
    label: "Elegant Black",
    blurb: "Charcoal · gold accents",
    suggestedTitle: "Thank You for Your Visit",
    suggestedDescription: "Scan to leave a review",
    accent: "#C9A227",
    premium: true,
  },
  {
    key: "friendly_green",
    label: "Friendly Green",
    blurb: "Waves · soft script",
    suggestedTitle: "Leave us your feedback!",
    suggestedDescription: "Scan the code with your phone camera",
    accent: "#137752",
    premium: true,
  },
  {
    key: "premium_gold",
    label: "Premium Gold",
    blurb: "Black · gold foil",
    suggestedTitle: "Leave a Review and Receive a Free Item",
    suggestedDescription: "Scan to leave a review",
    accent: "#D4AF37",
    premium: true,
  },
  {
    key: "cafe_coffee",
    label: "Cafe Warm",
    blurb: "Cream · cozy",
    suggestedTitle: "Enjoyed the Experience?",
    suggestedDescription: "Scan to leave a review",
    accent: "#8B5E3C",
    premium: true,
  },
  {
    key: "clear_blue",
    label: "Clear Blue",
    blurb: "Bright · friendly",
    suggestedTitle: "We Appreciate You!",
    suggestedDescription: "Scan the code with your phone camera",
    accent: "#1D4ED8",
    premium: true,
  },
  {
    key: "black_white",
    label: "Black & White",
    blurb: "Diagonal split",
    suggestedTitle: "Help Us Get Better",
    suggestedDescription: "Scan to leave a review",
    accent: "#0B1220",
    premium: true,
  },
  {
    key: "rustic_wood",
    label: "Rustic Wood",
    blurb: "Warm plank texture",
    suggestedTitle: "Thank You",
    suggestedDescription: "Scan to leave a review",
    accent: "#5C4033",
    premium: true,
  },
  {
    key: "bold_palette",
    label: "Bold Palette",
    blurb: "Colorful shapes",
    suggestedTitle: "Happy with Our Service?",
    suggestedDescription: "Scan the code with your phone camera",
    accent: "#E11D48",
    premium: true,
  },
];

export function isPosterTemplateKey(value: string | null | undefined): value is PosterTemplateKey {
  return POSTER_TEMPLATES.some((t) => t.key === value);
}

export function normalizePosterTemplateKey(value: string | null | undefined): PosterTemplateKey {
  if (isPosterTemplateKey(value)) return value;
  return CLASSIC_POSTER_TEMPLATE;
}

export function getPosterTemplate(key: string | null | undefined): PosterTemplateMeta {
  const normalized = normalizePosterTemplateKey(key);
  return POSTER_TEMPLATES.find((t) => t.key === normalized) ?? POSTER_TEMPLATES[0]!;
}

export function isPremiumPosterTemplate(key: string | null | undefined): boolean {
  return getPosterTemplate(key).premium;
}
