import type { AuditCheck, GbpProfile, MatchStatus } from "@/lib/audit/types";
import { compareText, normalizePhone, normalizeText } from "@/lib/audit/types";
import { crawlSitePages, fetchAndParsePage } from "@/lib/audit/website-crawler";

function check(
  id: string,
  label: string,
  status: MatchStatus,
  bucket: AuditCheck["bucket"],
  gbpValue?: string,
  websiteValue?: string,
  why?: string
): AuditCheck {
  return { id, label, status, bucket, gbpValue, websiteValue, evidence: why, whyItMatters: why };
}

function containsKeyword(text: string | null | undefined, keyword: string): MatchStatus {
  if (!text) return "missing";
  return normalizeText(text).includes(normalizeText(keyword)) ? "match" : "missing";
}

export async function runWebsiteMatchAudit(gbp: GbpProfile, keyword?: string) {
  if (!gbp.website) {
    return {
      checks: [
        check("website_url", "Website URL on GBP", "missing", "trust", gbp.website ?? undefined, undefined, "No website linked on GBP"),
      ],
      score: 0,
      pages: [],
    };
  }

  const homepage = await fetchAndParsePage(gbp.website);
  const pages = await crawlSitePages(gbp.website, 10);
  const checks: AuditCheck[] = [];

  checks.push(
    check("name_match", "GBP name vs website name", compareText(gbp.name, homepage.title), "trust", gbp.name, homepage.title ?? undefined, "Brand consistency helps trust and relevance")
  );
  checks.push(
    check(
      "address_match",
      "GBP address vs website address",
      gbp.address && homepage.bodyText.toLowerCase().includes(normalizeText(gbp.address).slice(0, 12))
        ? "partial"
        : gbp.address
          ? "missing"
          : "missing",
      "trust",
      gbp.address ?? undefined,
      undefined,
      "NAP consistency is a core local trust signal"
    )
  );

  const sitePhone = homepage.bodyText.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0];
  const phoneStatus: MatchStatus =
    gbp.phone && sitePhone && normalizePhone(gbp.phone) === normalizePhone(sitePhone)
      ? "match"
      : sitePhone
        ? "partial"
        : "missing";
  checks.push(check("phone_match", "GBP phone vs website phone", phoneStatus, "trust", gbp.phone ?? undefined, sitePhone, "Phone NAP match"));

  if (gbp.primaryCategory) {
    checks.push(
      check("category_in_title", "Primary category in title tag", containsKeyword(homepage.title, gbp.primaryCategory), "relevance", gbp.primaryCategory, homepage.title ?? undefined, "Category in title strengthens query relevance")
    );
  }
  if (gbp.city) {
    checks.push(
      check("city_in_title", "City in title tag", containsKeyword(homepage.title, gbp.city), "relevance", gbp.city, homepage.title ?? undefined, "Geo relevance in title")
    );
  }
  if (gbp.primaryCategory && gbp.city) {
    const metaHay = `${homepage.metaDescription ?? ""} ${homepage.title ?? ""}`;
    const hasBoth =
      normalizeText(metaHay).includes(normalizeText(gbp.primaryCategory)) &&
      normalizeText(metaHay).includes(normalizeText(gbp.city));
    checks.push(
      check("category_city_meta", "Category + city in meta description", hasBoth ? "match" : metaHay ? "partial" : "missing", "relevance", `${gbp.primaryCategory} + ${gbp.city}`, homepage.metaDescription ?? undefined)
    );
  }
  if (keyword) {
    checks.push(
      check("keyword_content", "Target keyword in page content", containsKeyword(homepage.bodyText.slice(0, 5000), keyword), "relevance", keyword, undefined, "Keyword presence supports relevance")
    );
  }

  checks.push(
    check("h1_present", "H1 heading present", homepage.h1.length ? "match" : "missing", "relevance", undefined, homepage.h1[0], "Clear H1 helps relevance")
  );
  checks.push(
    check("content_depth", "Homepage word count (300+)", homepage.wordCount >= 300 ? "match" : homepage.wordCount >= 150 ? "partial" : "missing", "prominence", undefined, String(homepage.wordCount), "Thin content limits prominence")
  );
  checks.push(
    check("click_to_call", "Click-to-call phone link", homepage.hasClickToCall ? "match" : "missing", "trust", undefined, homepage.hasClickToCall ? "tel: link found" : "none", "Mobile conversion + trust")
  );
  checks.push(
    check("hours_on_site", "Hours found on website", homepage.hoursMentions.length ? "match" : gbp.hoursText ? "missing" : "missing", "trust", gbp.hoursText ?? undefined, homepage.hoursMentions.join("; ") || undefined, "Hours mismatch erodes trust")
  );

  const grammarIssues = (homepage.bodyText.match(/\b(recieve|seperate|definately|occured)\b/gi) ?? []).length;
  checks.push(
    check("basic_grammar", "Spelling/basic grammar", grammarIssues === 0 ? "match" : "partial", "trust", undefined, grammarIssues ? `${grammarIssues} possible issues` : "none flagged")
  );

  return { checks, score: Math.round(checks.filter((c) => c.status === "match").length / checks.length * 100), pages };
}
