/** Normalize GBP category to a natural service phrase for prompts. */
export function normalizeServicePhrase(category: string | null | undefined): string {
  if (!category?.trim()) return "local business";
  let s = category.trim().toLowerCase();
  s = s.replace(/\bservice\b/g, "").replace(/\bcompany\b/g, "").replace(/\s+/g, " ").trim();
  if (!s) return "local business";
  return s;
}

export function formatCityState(city: string, state: string): string {
  const st = state.trim().toUpperCase();
  return `${city.trim()}, ${st}`;
}

export function buildPrimaryPrompt(params: {
  category: string | null | undefined;
  city: string;
  state: string;
}): string {
  const service = normalizeServicePhrase(params.category);
  const location = formatCityState(params.city, params.state);
  return `What are the best ${service} companies in ${location}?`;
}

export function fallbackSuggestedPrompts(params: {
  category: string | null | undefined;
  city: string;
  state: string;
  services?: string[];
}): Array<{
  prompt: string;
  reason: string;
  category: string;
  intent_type: string;
  estimated_priority: "High" | "Medium" | "Low";
  opportunity_score: number;
}> {
  const service = normalizeServicePhrase(params.category);
  const loc = formatCityState(params.city, params.state);
  const city = params.city.trim();

  const base = [
    {
      prompt: `What are the best ${service} companies in ${loc}, and why would you recommend each one?`,
      reason: "Matthew Wood style local SEO prompt: broad buyer discovery with recommendation reasoning",
      category: "Local SEO - Discovery",
      intent_type: "local_discovery",
      estimated_priority: "High" as const,
      opportunity_score: 5,
    },
    {
      prompt: `Which ${service} near ${city} has the strongest reviews, reputation, and local trust signals?`,
      reason: "Matthew Wood style local SEO prompt: reputation and trust comparison",
      category: "Local SEO - Trust",
      intent_type: "reputation_trust",
      estimated_priority: "High" as const,
      opportunity_score: 5,
    },
    {
      prompt: `If I need ${service} in ${loc}, what local businesses should I compare before choosing?`,
      reason: "Matthew Wood style local SEO prompt: competitor comparison and consideration set",
      category: "Local SEO - Comparison",
      intent_type: "comparison",
      estimated_priority: "High" as const,
      opportunity_score: 5,
    },
    {
      prompt: `Who is the most reliable ${service} in ${city} for a customer who cares about quality, proof, and convenience?`,
      reason: "Matthew Wood style local SEO prompt: decision criteria beyond simple company names",
      category: "Local SEO - Decision",
      intent_type: "decision",
      estimated_priority: "High" as const,
      opportunity_score: 5,
    },
    {
      prompt: `${service} companies near me in ${city}`,
      reason: "Near-me phrasing mirrors how buyers talk to AI",
      category: "Near me",
      intent_type: "near_me",
      estimated_priority: "Medium" as const,
      opportunity_score: 4,
    },
  ];

  for (const svc of params.services ?? []) {
    if (!svc || svc.length < 3) continue;
    base.push({
      prompt: `What are the best ${svc.toLowerCase()} companies in ${loc}?`,
      reason: `Based on GBP service: ${svc}`,
      category: svc,
      intent_type: "category",
      estimated_priority: "Medium",
      opportunity_score: 4,
    });
  }

  return base.slice(0, 12);
}
