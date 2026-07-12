export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function nameInText(name: string, text: string): boolean {
  const n = normalizeName(name);
  if (n.length < 3) return false;
  const hay = text.toLowerCase();
  if (hay.includes(n)) return true;
  const tokens = n.split(" ").filter((t) => t.length > 2);
  if (tokens.length >= 2) {
    return tokens.every((t) => hay.includes(t));
  }
  return false;
}

function extractNumberedCompanies(text: string): string[] {
  const lines = text.split(/\n/);
  const companies: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)[.)]\s*(.+)/);
    if (m) companies.push(m[2].replace(/\*\*/g, "").trim());
  }
  return companies;
}

export function extractMentionPosition(businessName: string, text: string): number | null {
  const numbered = extractNumberedCompanies(text);
  for (let i = 0; i < numbered.length; i++) {
    if (nameInText(businessName, numbered[i]!)) return i + 1;
  }
  if (nameInText(businessName, text)) return null;
  return null;
}

export function extractCompetitorMentions(
  text: string,
  competitors: Array<{ name: string }>,
  businessName: string
): string[] {
  const found: string[] = [];
  for (const c of competitors) {
    if (normalizeName(c.name) === normalizeName(businessName)) continue;
    if (nameInText(c.name, text)) found.push(c.name);
  }
  return [...new Set(found)];
}

export function parseEngineVisibility(params: {
  businessName: string;
  competitors: Array<{ name: string }>;
  answerText: string;
  mapNames?: string[];
}): {
  targetMentioned: boolean;
  mentionPosition: number | null;
  competitors: string[];
} {
  const text = params.answerText ?? "";
  const mapText = (params.mapNames ?? []).join("\n");
  const combined = `${text}\n${mapText}`;

  const targetMentioned = nameInText(params.businessName, combined);
  const mentionPosition = targetMentioned ? extractMentionPosition(params.businessName, text) : null;
  const competitors = extractCompetitorMentions(combined, params.competitors, params.businessName);

  return { targetMentioned, mentionPosition, competitors };
}

export function computeVisibilityScore(params: {
  engineResults: Array<{ targetMentioned: boolean; mentionPosition: number | null; status: string }>;
}): number {
  const complete = params.engineResults.filter((r) => r.status === "complete");
  if (!complete.length) return 0;

  let score = 0;
  for (const r of complete) {
    if (!r.targetMentioned) continue;
    score += 25;
    if (r.mentionPosition === 1) score += 10;
    else if (r.mentionPosition != null && r.mentionPosition <= 3) score += 5;
  }

  return Math.min(100, Math.round(score / complete.length + (complete.filter((r) => r.targetMentioned).length / complete.length) * 50));
}
