import { safeFetchWebsite } from "@/lib/validation/ssrf";

export interface WebsiteProbeResult {
  title: string | null;
  h1: string | null;
  keywordInTitle: boolean;
  keywordInH1: boolean;
}

export async function probeWebsite(
  url: string,
  keyword: string
): Promise<WebsiteProbeResult | null> {
  try {
    const res = await safeFetchWebsite(url);
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
    const title = titleMatch?.[1]?.trim() ?? null;
    const h1 = h1Match?.[1]?.trim() ?? null;
    const kw = keyword.toLowerCase();
    return {
      title,
      h1,
      keywordInTitle: title?.toLowerCase().includes(kw) ?? false,
      keywordInH1: h1?.toLowerCase().includes(kw) ?? false,
    };
  } catch {
    return null;
  }
}
