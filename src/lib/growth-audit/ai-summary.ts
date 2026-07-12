import { logProviderRun } from "@/lib/providers/dataforseo";

const BASE_URL = "https://api.deepseek.com/v1";

export async function generateGrowthAuditSummary(params: {
  businessName: string;
  keyword: string;
  growthScore: number;
  strengths: string[];
  weaknesses: string[];
  topTasks: string[];
  organizationId?: string;
}): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const start = Date.now();

  const systemPrompt = `You are a Google Maps local SEO advisor. Write a 2-3 sentence executive summary of a Maps Growth Audit for a business owner. Be direct, actionable, and encouraging. No bullet points.`;

  const userPrompt = JSON.stringify({
    business: params.businessName,
    keyword: params.keyword,
    growthScore: params.growthScore,
    strengths: params.strengths,
    weaknesses: params.weaknesses,
    topTasks: params.topTasks,
  });

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() ?? null;

    await logProviderRun({
      organizationId: params.organizationId,
      provider: "deepseek",
      endpoint: "growth-audit-summary",
      request: { business: params.businessName },
      response: { ok: !!content },
      statusCode: res.status,
      latencyMs: Date.now() - start,
    });

    return content;
  } catch {
    return null;
  }
}
