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
      prompt: `Who offers same-day ${service} in ${loc}?`,
      reason: "High-intent emergency searches often appear in AI answers",
      category: "Same-day",
      intent_type: "same_day",
      estimated_priority: "High" as const,
      opportunity_score: 5,
    },
    {
      prompt: `Which ${service} company has the best reviews in ${city}?`,
      reason: "Review-focused queries drive trust-driven recommendations",
      category: "Top-rated",
      intent_type: "top_rated",
      estimated_priority: "High" as const,
      opportunity_score: 5,
    },
    {
      prompt: `Affordable ${service} near ${city}`,
      reason: "Price-sensitive buyers ask AI for budget options",
      category: "Affordable",
      intent_type: "affordable",
      estimated_priority: "Medium" as const,
      opportunity_score: 4,
    },
    {
      prompt: `Best furniture removal companies in ${loc}`,
      reason: "Service-specific query with strong commercial intent",
      category: "Furniture Removal",
      intent_type: "service_specific",
      estimated_priority: "High" as const,
      opportunity_score: 5,
    },
    {
      prompt: `Who removes appliances in ${city}?`,
      reason: "Narrow service query with conversion intent",
      category: "Appliance Removal",
      intent_type: "service_specific",
      estimated_priority: "Medium" as const,
      opportunity_score: 4,
    },
    {
      prompt: `Best garage cleanout company in ${city}`,
      reason: "Problem-specific cleanout searches",
      category: "Garage Cleanouts",
      intent_type: "problem",
      estimated_priority: "Medium" as const,
      opportunity_score: 4,
    },
    {
      prompt: `Estate cleanout services near ${city}`,
      reason: "Higher-ticket niche with fewer AI mentions",
      category: "Estate Cleanouts",
      intent_type: "service_specific",
      estimated_priority: "Medium" as const,
      opportunity_score: 3,
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
