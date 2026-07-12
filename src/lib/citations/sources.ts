export type CitationVertical = "general" | "home_services" | "legal" | "medical";

export type CitationSource = {
  name: string;
  domain: string;
  sourceType: string;
  vertical: string;
  priority: "high" | "medium" | "low";
};

export const HOME_SERVICE_KEYWORDS = [
  "junk removal",
  "plumber",
  "plumbing",
  "hvac",
  "electrician",
  "roofing",
  "landscap",
  "cleaning",
  "pest control",
  "garage door",
  "remodel",
  "contractor",
  "handyman",
  "moving",
  "tree service",
  "locksmith",
  "painting",
  "flooring",
];

export function detectVertical(category: string | null | undefined, keyword?: string | null): CitationVertical {
  const text = `${category ?? ""} ${keyword ?? ""}`.toLowerCase();
  if (/lawyer|attorney|legal|law firm/.test(text)) return "legal";
  if (/doctor|dentist|medical|clinic|health|physician|chiropract/.test(text)) return "medical";
  if (HOME_SERVICE_KEYWORDS.some((k) => text.includes(k))) return "home_services";
  return "general";
}

export function sourcesForVertical(
  allSources: CitationSource[],
  vertical: CitationVertical
): CitationSource[] {
  return allSources.filter(
    (s) => s.vertical === "all" || s.vertical === vertical || (vertical === "general" && s.vertical === "all")
  );
}

export function suggestedSearchUrl(domain: string, businessName: string): string {
  const q = encodeURIComponent(`"${businessName.trim()}" site:${domain}`);
  return `https://www.google.com/search?q=${q}`;
}
