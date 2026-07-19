#!/usr/bin/env node
/**
 * Local SEO Express — full static SEO audit
 * Run: node scripts/seo-audit.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');
const BASE = 'https://localseoexpress.com';

const KEYWORD_MAP = {
  '/': {
    primary: 'local SEO company',
    secondary: ['local SEO agency', 'local SEO experts'],
    title: 'Local SEO Company That Generates Calls & Leads | Local SEO Express',
    h1: 'A Local SEO Company Focused on Calls, Leads and Growth',
  },
  '/local-seo-services/': {
    primary: 'local SEO services',
    secondary: ['local search engine optimization services', 'managed local SEO'],
    title: 'Local SEO Services That Generate Calls & Leads | Local SEO Express',
    h1: 'Local SEO Services Built to Generate Calls, Leads and Customers',
  },
  '/local-seo-packages/': {
    primary: 'local SEO packages',
    secondary: ['local SEO pricing', 'local SEO plans', 'local SEO packages for small business'],
    title: 'Local SEO Packages & Pricing for Small Businesses | Local SEO Express',
    h1: 'Local SEO Packages Built Around Your Market—Not a Generic Checklist',
  },
  '/google-maps-seo-services/': {
    primary: 'Google Maps SEO services',
    secondary: ['Google Maps SEO company', 'Google Maps ranking services', 'Google Maps optimization services'],
    title: 'Google Maps SEO Services That Generate Calls & Leads | Local SEO Express',
    h1: 'Google Maps SEO Services Built to Generate More Calls and Leads',
  },
  '/local-seo-for-plumbers/': {
    primary: 'local SEO for plumbers',
    secondary: ['plumber SEO services', 'SEO for plumbers', 'plumbing SEO company'],
    title: 'Local SEO for Plumbers That Generates More Calls | Local SEO Express',
    h1: 'Local SEO for Plumbers That Generates Calls and Booked Jobs',
  },
  '/local-seo-for-dentists/': {
    primary: 'local SEO for dentists',
    secondary: ['dental SEO services', 'SEO for dentists', 'dentist SEO company'],
    title: 'Local SEO for Dentists That Brings More Patients | Local SEO Express',
    h1: 'Local SEO for Dentists That Generates More Patient Appointments',
  },
  '/local-seo-services-for-small-business/': {
    primary: 'local SEO services for small business',
    secondary: ['SEO services for local business', 'small business local SEO'],
    title: 'Local SEO Services for Small Business That Drive Leads | Local SEO Express',
    h1: 'Local SEO Services for Small Businesses That Need More Calls and Customers',
  },
  '/citation-building-services/': {
    primary: 'citation building services',
    secondary: ['local citation building services', 'citation cleanup service', 'manual citation building'],
    title: 'Citation Building Services | Manual Listings & NAP Cleanup',
    h1: 'Citation Building Services That Fix and Strengthen Your Listings',
  },
  '/about/': {
    primary: 'Local SEO Express / Anthony Johnson',
    secondary: ['local SEO company', 'digital marketing experience'],
    title: 'About Local SEO Express | Anthony Johnson, Owner',
    h1: 'Local SEO Built Around Calls, Leads and Real Business Growth',
  },
  '/contact/': {
    primary: 'contact Local SEO Express',
    secondary: ['free local SEO audit', 'local SEO consultation'],
    title: 'Contact Local SEO Express | Request Your Free SEO Audit',
    h1: "Let's Find Out What Is Holding Back Your Local Rankings",
  },
};

const ROUTE_TO_FILE = {
  '/': 'index.html',
  '/local-seo-services/': 'local-seo-services/index.html',
  '/local-seo-packages/': 'local-seo-packages/index.html',
  '/google-maps-seo-services/': 'google-maps-seo-services/index.html',
  '/local-seo-for-plumbers/': 'local-seo-for-plumbers/index.html',
  '/local-seo-for-dentists/': 'local-seo-for-dentists/index.html',
  '/local-seo-services-for-small-business/': 'local-seo-services-for-small-business/index.html',
  '/citation-building-services/': 'citation-building-services/index.html',
  '/about/': 'about/index.html',
  '/contact/': 'contact/index.html',
  '/privacy-policy/': 'privacy-policy/index.html',
  '/terms-of-service/': 'terms-of-service/index.html',
};

const FILE_TO_ROUTE = Object.fromEntries(Object.entries(ROUTE_TO_FILE).map(([r, f]) => [f, r]));

function routeToFilePath(route) {
  if (route === '/') return path.join(ROOT, 'index.html');
  const slug = route.replace(/^\//, '').replace(/\/$/, '');
  return path.join(ROOT, slug, 'index.html');
}

function discoverHtmlFiles() {
  const files = [];
  if (fs.existsSync(path.join(ROOT, 'index.html'))) files.push('index.html');
  for (const route of Object.keys(ROUTE_TO_FILE)) {
    if (route === '/') continue;
    const rel = ROUTE_TO_FILE[route];
    if (fs.existsSync(path.join(ROOT, rel))) files.push(rel);
  }
  return files;
}

const LIVE_ROUTES = new Set(Object.keys(ROUTE_TO_FILE));

const UNFINISHED_ROUTES = [
  '/local-seo-audit/',
  '/local-seo-for-hvac/',
  '/google-business-profile-optimization/',
  '/affordable-local-seo-services/',
];

const FAKE_CLAIM_PATTERNS = [
  { pattern: /1,000\+/i, label: 'Unverified "1,000+" stat' },
  { pattern: /500\+ businesses/i, label: 'Unverified "500+" stat' },
  { pattern: /250%\+?/i, label: 'Unverified "250%" stat' },
  { pattern: /100\+ cities/i, label: 'Unverified "100+ cities" stat' },
  { pattern: /Top 3 (Rankings|in Maps)/i, label: 'Unverified "Top 3" ranking claim' },
  { pattern: /4\.9\/5|★★★★★ 4\.9/i, label: 'Fake rating score in visible content' },
  { pattern: /5-Star Rated/i, label: 'Unverified 5-star claim' },
  { pattern: /Nashville|Dallas,?\s*TX/i, label: 'Unverified city address' },
  { pattern: /Google Partner|Ahrefs|Semrush partnership|BrightLocal partnership|Moz partnership/i, label: 'Unverified partnership badge' },
  { pattern: /\[PRICE\]|\[PHONE\]|\[ADDRESS\]|lorem ipsum/i, label: 'Placeholder copy' },
];

const APPLIED_FIXES = [
  'Removed unverified stats (1,000+, 250%+, 100+ cities, Top 3 rankings) from hero/trust bars',
  'Updated homepage, services, and Google Maps H1s to approved brief copy',
  'Added skip-to-content link in site header partial',
  'Added og:image and twitter:image across commercial pages',
  'Updated contact meta description to emphasize free SEO audit',
  'Removed fake 4.9 ratings from visible hero mockups on homepage and services page',
  'Replaced about page stat bar with verified National/Owner-Led/Virginia claims',
  'Removed self-link to /about/ on About page for Anthony Johnson',
];

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripBoilerplate(html) {
  return html
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav class="breadcrumb[\s\S]*?<\/nav>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function jaccardSimilarity(a, b) {
  const wa = new Set(a.split(/\s+/).filter((w) => w.length > 3));
  const wb = new Set(b.split(/\s+/).filter((w) => w.length > 3));
  const inter = [...wa].filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union ? inter / union : 0;
}

function normalizeHref(href) {
  if (!href || href === '#' || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      const u = new URL(href);
      if (!u.hostname.includes('localseoexpress.com')) return null;
      href = u.pathname + u.search;
    } catch {
      return null;
    }
  }
  if (href.endsWith('.html')) {
    const base = href.replace(/^\.\//, '').replace(/index\.html$/, '').replace(/\.html$/, '');
    href = base ? `/${base}/` : '/';
  }
  if (!href.startsWith('/')) href = `/${href}`;
  if (href !== '/' && !href.endsWith('/') && !/\.\w+$/.test(href)) href += '/';
  return href;
}

function extractMeta(html, name) {
  const re = new RegExp(`<meta\\s+(?:name|property)=["']${name}["']\\s+content=["']([^"']*)["']`, 'i');
  const alt = new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+(?:name|property)=["']${name}["']`, 'i');
  return decodeHtml((html.match(re) || html.match(alt) || [])[1] || '');
}

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? decodeHtml(m[1]) : '';
}

function extractCanonical(html) {
  const m = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

function extractHeadings(html) {
  const headings = [];
  const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    headings.push({ level: parseInt(m[1], 10), text: decodeHtml(m[2].replace(/<[^>]+>/g, '')) });
  }
  return headings;
}

function extractMainText(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i);
  const chunk = main ? main[0] : html;
  return chunk.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
}

function extractFirstWords(html, n = 120) {
  const text = decodeHtml(extractMainText(html).replace(/<[^>]+>/g, ' '));
  return text.split(/\s+/).slice(0, n).join(' ');
}

function wordCount(html) {
  const text = decodeHtml(extractMainText(html).replace(/<[^>]+>/g, ' '));
  return text.split(/\s+/).filter(Boolean).length;
}

function extractJsonLdTypes(html) {
  const types = [];
  const re = /"@type"\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) types.push(m[1]);
  return [...new Set(types)];
}

function extractImages(html) {
  const images = [];
  const re = /<img\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const src = (attrs.match(/src=["']([^"']+)["']/i) || [])[1] || '';
    const alt = (attrs.match(/alt=["']([^"']*)["']/i) || [])[1];
    const width = (attrs.match(/width=["']([^"']+)["']/i) || [])[1];
    const height = (attrs.match(/height=["']([^"']+)["']/i) || [])[1];
    const loading = (attrs.match(/loading=["']([^"']+)["']/i) || [])[1];
    images.push({ src, alt, width, height, loading });
  }
  return images;
}

function extractLinks(html, sourceRoute) {
  const links = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const inner = decodeHtml(m[2].replace(/<[^>]+>/g, ' '));
    const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
    const href = hrefMatch ? hrefMatch[1] : '';
    const normalized = normalizeHref(href);
    if (!normalized) continue;
    links.push({ sourceRoute, href: normalized, anchor: inner || '(empty)' });
  }
  return links;
}

function parseSitemap() {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    try {
      return new URL(m[1]).pathname;
    } catch {
      return m[1];
    }
  });
  return urls;
}

function auditPage(filename) {
  const html = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  const route = FILE_TO_ROUTE[filename];
  const map = KEYWORD_MAP[route];
  const issues = [];
  const fixes = [];

  const title = extractTitle(html);
  const description = extractMeta(html, 'description');
  const canonical = extractCanonical(html);
  const robots = extractMeta(html, 'robots');
  const ogTitle = extractMeta(html, 'og:title');
  const ogDesc = extractMeta(html, 'og:description');
  const ogUrl = extractMeta(html, 'og:url');
  const ogImage = extractMeta(html, 'og:image');
  const headings = extractHeadings(html);
  const h1s = headings.filter((h) => h.level === 1);
  const h1 = h1s[0]?.text || '';
  const images = extractImages(html);
  const links = route ? extractLinks(html, route) : [];
  const jsonLdTypes = extractJsonLdTypes(html);
  const first120 = extractFirstWords(html);
  const wc = wordCount(html);
  const hasMain = /<main\b/i.test(html);
  const hasSkipLink = /skip-link|#main-content/i.test(html);
  const hasLang = /<html[^>]*lang=["']en["']/i.test(html);

  const expectedCanonical = route ? `${BASE}${route === '/' ? '/' : route}` : '';

  if (!title) issues.push({ severity: 'critical', category: 'title', message: 'Missing title tag' });
  if (h1s.length === 0) issues.push({ severity: 'critical', category: 'heading', message: 'Missing H1' });
  if (h1s.length > 1) issues.push({ severity: 'high', category: 'heading', message: `Multiple H1s (${h1s.length})` });
  if (!description) issues.push({ severity: 'high', category: 'meta', message: 'Missing meta description' });
  if (!canonical) issues.push({ severity: 'critical', category: 'canonical', message: 'Missing canonical' });
  else if (canonical !== expectedCanonical) {
    issues.push({ severity: 'critical', category: 'canonical', message: `Canonical mismatch: ${canonical}`, recommended: expectedCanonical });
  }
  if (/noindex/i.test(robots) && route && KEYWORD_MAP[route]) {
    issues.push({ severity: 'critical', category: 'indexability', message: 'Money page has noindex' });
  }
  if (!hasMain) issues.push({ severity: 'medium', category: 'accessibility', message: 'Missing <main> landmark' });
  if (!hasSkipLink) issues.push({ severity: 'low', category: 'accessibility', message: 'Missing skip-to-content link' });
  if (!hasLang) issues.push({ severity: 'medium', category: 'accessibility', message: 'Missing lang="en" on html' });

  if (title.length < 35 || title.length > 65) {
    issues.push({ severity: 'low', category: 'title', message: `Title length ${title.length} chars (review 35–65)` });
  }
  if (description && (description.length < 110 || description.length > 170)) {
    issues.push({ severity: 'low', category: 'meta', message: `Meta description length ${description.length} chars (review 110–170)` });
  }

  if (map) {
    if (title !== map.title) {
      issues.push({ severity: title.toLowerCase().includes(map.primary.toLowerCase()) ? 'low' : 'medium', category: 'title', message: 'Title differs from brief', current: title, recommended: map.title });
    }
    if (h1 !== map.h1) {
      issues.push({ severity: h1.toLowerCase().includes(map.primary.split('/')[0].trim().toLowerCase()) ? 'low' : 'medium', category: 'heading', message: 'H1 differs from brief', current: h1, recommended: map.h1 });
    }
    const primaryRe = new RegExp(map.primary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const brandedPage = route === '/about/' || route === '/contact/';
    if (!brandedPage && !primaryRe.test(title)) {
      issues.push({ severity: 'high', category: 'keyword', message: `Primary keyword "${map.primary}" not in title` });
    }
    if (brandedPage && route === '/about/' && !/Anthony Johnson|Local SEO Express/i.test(title)) {
      issues.push({ severity: 'high', category: 'keyword', message: 'About title should include brand and owner name' });
    }
    if (!primaryRe.test(h1) && route !== '/about/' && route !== '/contact/') {
      issues.push({ severity: 'high', category: 'keyword', message: `Primary keyword "${map.primary}" not in H1` });
    }
    if (route !== '/about/' && route !== '/contact/' && !primaryRe.test(first120)) {
      issues.push({ severity: 'high', category: 'keyword', message: `Primary keyword "${map.primary}" not in first 120 words` });
    }
  }

  if (!ogImage && route && KEYWORD_MAP[route]) {
    issues.push({ severity: 'medium', category: 'social', message: 'Missing og:image' });
  }
  if (ogUrl && ogUrl !== expectedCanonical) {
    issues.push({ severity: 'medium', category: 'social', message: `og:url mismatch: ${ogUrl}` });
  }

  for (const { pattern, label } of FAKE_CLAIM_PATTERNS) {
    const mainVisible = extractMainText(html).replace(/aria-hidden=["']true["']/gi, '');
    if (pattern.test(mainVisible)) {
      issues.push({ severity: 'critical', category: 'authenticity', message: label });
    }
  }

  if (jsonLdTypes.includes('AggregateRating') || jsonLdTypes.includes('Review')) {
    issues.push({ severity: 'critical', category: 'schema', message: 'Self-serving Review/AggregateRating schema present' });
  }
  if (jsonLdTypes.includes('LocalBusiness') && !html.includes('streetAddress')) {
    issues.push({ severity: 'medium', category: 'schema', message: 'LocalBusiness schema without public street address' });
  }

  for (const img of images) {
    if (!img.src) issues.push({ severity: 'high', category: 'image', message: 'Image missing src' });
    if (img.alt === undefined) issues.push({ severity: 'medium', category: 'image', message: `Image missing alt: ${img.src}` });
    if (img.src && !img.width && !img.height && !img.src.endsWith('.svg')) {
      issues.push({ severity: 'low', category: 'image', message: `Image missing dimensions: ${img.src}` });
    }
  }

  for (const link of links) {
    if (UNFINISHED_ROUTES.includes(link.href)) {
      issues.push({ severity: 'critical', category: 'links', message: `Link to unfinished route ${link.href}`, anchor: link.anchor });
    }
    if (!LIVE_ROUTES.has(link.href) && !link.href.startsWith('http') && !/\.\w+$/.test(link.href)) {
      const filePath = routeToFilePath(link.href);
      if (!fs.existsSync(filePath)) {
        issues.push({ severity: 'high', category: 'links', message: `Broken internal link: ${link.href}`, anchor: link.anchor });
      }
    }
  }

  if (route === '/contact/') {
    const labels = (html.match(/<label\b/gi) || []).length;
    const inputs = (html.match(/<(?:input|textarea|select)\b/gi) || []).length;
    if (labels < 3) issues.push({ severity: 'high', category: 'form', message: 'Contact form may be missing visible labels' });
    if (!html.includes('application/ld+json') || !html.includes('ContactPage')) {
      issues.push({ severity: 'low', category: 'schema', message: 'Missing ContactPage schema' });
    }
  }

  const primaryKeywordCount = map
    ? (extractMainText(html).match(new RegExp(map.primary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length
    : 0;

  return {
    url: expectedCanonical,
    route,
    filename,
    primaryKeyword: map?.primary || null,
    secondaryKeywords: map?.secondary || [],
    httpStatus: 'not-tested-locally',
    indexability: /noindex/i.test(robots) ? 'noindex' : 'indexable',
    canonical,
    title,
    titleLength: title.length,
    metaDescription: description,
    metaDescriptionLength: description.length,
    h1,
    first120Words: first120,
    headingOutline: headings,
    wordCount: wc,
    internalLinksOut: links.filter((l) => LIVE_ROUTES.has(l.href)).length,
    images,
    structuredDataTypes: jsonLdTypes,
    openGraph: { title: ogTitle, description: ogDesc, url: ogUrl, image: ogImage },
    primaryKeywordOccurrences: primaryKeywordCount,
    issues,
    fixes,
    fixStatus: issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length ? 'needs-work' : 'pass',
  };
}

function buildCannibalization(pages) {
  const warnings = [];
  const money = pages.filter((p) => p.route && KEYWORD_MAP[p.route]);

  for (let i = 0; i < money.length; i++) {
    for (let j = i + 1; j < money.length; j++) {
      const a = money[i];
      const b = money[j];
      const sim = jaccardSimilarity(stripBoilerplate(fs.readFileSync(path.join(ROOT, a.filename), 'utf8')), stripBoilerplate(fs.readFileSync(path.join(ROOT, b.filename), 'utf8')));
      if (sim > 0.7) {
        warnings.push({
          severity: sim > 0.85 ? 'critical' : 'high',
          pages: [a.route, b.route],
          similarity: Math.round(sim * 100),
          message: `${Math.round(sim * 100)}% content similarity between ${a.route} and ${b.route}`,
        });
      }
    }
  }

  const titles = {};
  const descs = {};
  const h1s = {};
  for (const p of pages) {
    if (p.title) {
      titles[p.title] = titles[p.title] || [];
      titles[p.title].push(p.route);
    }
    if (p.metaDescription) {
      descs[p.metaDescription] = descs[p.metaDescription] || [];
      descs[p.metaDescription].push(p.route);
    }
    if (p.h1) {
      h1s[p.h1] = h1s[p.h1] || [];
      h1s[p.h1].push(p.route);
    }
  }
  for (const [t, routes] of Object.entries(titles)) {
    if (routes.length > 1) warnings.push({ severity: 'high', message: `Duplicate title across ${routes.join(', ')}`, value: t });
  }
  for (const [d, routes] of Object.entries(descs)) {
    if (routes.length > 1) warnings.push({ severity: 'high', message: `Duplicate meta description across ${routes.join(', ')}` });
  }
  for (const [h, routes] of Object.entries(h1s)) {
    if (routes.length > 1) warnings.push({ severity: 'high', message: `Duplicate H1 across ${routes.join(', ')}`, value: h });
  }

  return warnings;
}

function buildIncomingLinks(pages) {
  const incoming = {};
  for (const r of LIVE_ROUTES) incoming[r] = [];
  for (const p of pages) {
    if (!p.route) continue;
    for (const l of extractLinks(fs.readFileSync(path.join(ROOT, p.filename), 'utf8'), p.route)) {
      if (incoming[l.href]) incoming[l.href].push({ from: p.route, anchor: l.anchor });
    }
  }
  return incoming;
}

function ownerVerificationItems(pages) {
  const items = [];
  items.push({
    item: 'Package pricing and deliverable quantities',
    reason: 'Verify all prices, setup fees, contract terms, and "starting at" language on /local-seo-packages/ reflect real offers',
    route: '/local-seo-packages/',
  });
  items.push({
    item: 'Citation package quantities and prices',
    reason: 'Verify citation building package counts/prices on /citation-building-services/ if shown',
    route: '/citation-building-services/',
  });
  items.push({
    item: 'Contact form delivery and spam protection',
    reason: 'Confirm form backend, email delivery, reCAPTCHA/honeypot, and success/thank-you flow work in production',
    route: '/contact/',
  });
  items.push({
    item: 'GA4 and conversion event tracking',
    reason: 'Verify GA4 loads once, Search Console verification, and CTA/form events fire correctly',
    route: 'sitewide',
  });
  items.push({
    item: 'HTTPS redirects and canonical host',
    reason: 'Confirm http→https and www/non-www single-hop redirects to https://localseoexpress.com in production',
    route: 'server',
  });
  items.push({
    item: 'Lighthouse / Core Web Vitals',
    reason: 'Run PageSpeed Insights on production URLs; lab tests cannot be run reliably from static files alone',
    route: 'sitewide',
  });
  items.push({
    item: 'Anthony Johnson photo',
    reason: 'If a founder photo is displayed on /about/, confirm it is an approved image of Anthony',
    route: '/about/',
  });
  items.push({
    item: 'Social profile sameAs URLs',
    reason: 'Verify LinkedIn/X/Facebook URLs in Organization/Person schema are official profiles',
    route: '/',
  });
  items.push({
    item: 'Illustrative dashboard mockup numbers',
    reason: 'Wireframe charts on service pages (calls, visits, ranking graphs) are decorative—not verified metrics. Consider replacing with non-numeric illustrations or owner-approved case data.',
    route: 'multiple service pages',
  });

  for (const p of pages) {
    for (const i of p.issues.filter((x) => x.category === 'authenticity')) {
      items.push({ item: i.message, reason: `Still detected on ${p.route}`, route: p.route, status: 'CRITICAL—fix required' });
    }
  }

  return items;
}

function toMarkdownReport(report) {
  let md = `# SEO Audit Report — Local SEO Express\n\n`;
  md += `Generated: ${report.generatedAt}\n\n`;
  md += `## Executive Summary\n\n`;
  md += `| Metric | Count |\n|--------|-------|\n`;
  md += `| Pages audited | ${report.summary.pagesAudited} |\n`;
  md += `| Critical issues | ${report.summary.critical} |\n`;
  md += `| High issues | ${report.summary.high} |\n`;
  md += `| Medium issues | ${report.summary.medium} |\n`;
  md += `| Low issues | ${report.summary.low} |\n`;
  md += `| Cannibalization warnings | ${report.cannibalization.length} |\n\n`;

  md += `### Cannot verify locally\n\n`;
  for (const n of report.notTestableLocally) {
    md += `- ${n}\n`;
  }
  md += `\n`;

  for (const page of report.pages) {
    md += `---\n\n## ${page.route || page.filename}\n\n`;
    md += `- **URL:** ${page.url}\n`;
    md += `- **Primary keyword:** ${page.primaryKeyword || 'n/a'}\n`;
    md += `- **HTTP status:** ${page.httpStatus}\n`;
    md += `- **Indexability:** ${page.indexability}\n`;
    md += `- **Canonical:** ${page.canonical}\n`;
    md += `- **Sitemap:** ${page.inSitemap ? 'yes' : 'NO'}\n`;
    md += `- **Title (${page.titleLength}):** ${page.title}\n`;
    md += `- **Meta (${page.metaDescriptionLength}):** ${page.metaDescription}\n`;
    md += `- **H1:** ${page.h1}\n`;
    md += `- **Word count:** ${page.wordCount}\n`;
    md += `- **Primary keyword occurrences:** ${page.primaryKeywordOccurrences}\n`;
    md += `- **Incoming internal links:** ${page.incomingLinksCount}\n`;
    md += `- **Structured data:** ${page.structuredDataTypes.join(', ') || 'none'}\n`;
    md += `- **Fix status:** ${page.fixStatus}\n\n`;

    md += `**First 120 words:** ${page.first120Words.slice(0, 400)}…\n\n`;

    if (page.headingOutline.length) {
      md += `**Heading outline:**\n`;
      for (const h of page.headingOutline.slice(0, 20)) {
        md += `- H${h.level}: ${h.text}\n`;
      }
      md += `\n`;
    }

    if (page.issues.length) {
      md += `**Issues:**\n\n`;
      for (const i of page.issues) {
        md += `- **[${i.severity.toUpperCase()}] ${i.category}:** ${i.message}`;
        if (i.current) md += ` (current: "${i.current}")`;
        if (i.recommended) md += ` → recommended: "${i.recommended}"`;
        md += `\n`;
      }
      md += `\n`;
    }
  }

  if (report.cannibalization.length) {
    md += `---\n\n## Cannibalization & Duplication\n\n`;
    for (const w of report.cannibalization) {
      md += `- **[${w.severity}]** ${w.message}\n`;
    }
    md += `\n`;
  }

  return md;
}

function fixesMarkdown(fixes, pages) {
  let md = `# SEO Fixes Applied\n\nGenerated: ${new Date().toISOString()}\n\n`;
  md += `## Automatic fixes applied in this audit session\n\n`;
  for (const f of fixes) md += `- ${f}\n`;
  md += `\n## Remaining issues by page\n\n`;
  for (const p of pages) {
    const open = p.issues.filter((i) => i.severity === 'critical' || i.severity === 'high');
    if (open.length) {
      md += `### ${p.route}\n\n`;
      for (const i of open) md += `- **[${i.severity}]** ${i.message}\n`;
      md += `\n`;
    }
  }
  return md;
}

function ownerMarkdown(items) {
  let md = `# Owner Verification Needed\n\nGenerated: ${new Date().toISOString()}\n\n`;
  md += `These items require Anthony Johnson's input or production-environment verification.\n\n`;
  for (const item of items) {
    md += `## ${item.item}\n\n`;
    md += `- **Route:** ${item.route}\n`;
    md += `- **Reason:** ${item.reason}\n`;
    if (item.status) md += `- **Status:** ${item.status}\n`;
    md += `\n`;
  }
  return md;
}

function main() {
  const sitemapRoutes = new Set(parseSitemap());
  const htmlFiles = discoverHtmlFiles();
  const pages = htmlFiles.map(auditPage);
  const incoming = buildIncomingLinks(pages);

  for (const p of pages) {
    if (p.route) {
      p.inSitemap = sitemapRoutes.has(p.route);
      p.incomingLinksCount = (incoming[p.route] || []).length;
      if (!p.inSitemap && KEYWORD_MAP[p.route]) {
        p.issues.push({ severity: 'high', category: 'sitemap', message: 'Money page missing from sitemap.xml' });
      }
      if (p.incomingLinksCount < 2 && p.route !== '/') {
        p.issues.push({ severity: 'medium', category: 'links', message: `Only ${p.incomingLinksCount} incoming internal links (target: 2+ contextual)` });
      }
    }
  }

  const cannibalization = buildCannibalization(pages);
  const allIssues = pages.flatMap((p) => p.issues.map((i) => ({ ...i, route: p.route, file: p.filename })));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      pagesAudited: pages.length,
      critical: allIssues.filter((i) => i.severity === 'critical').length,
      high: allIssues.filter((i) => i.severity === 'high').length,
      medium: allIssues.filter((i) => i.severity === 'medium').length,
      low: allIssues.filter((i) => i.severity === 'low').length,
    },
    notTestableLocally: [
      'HTTP 200/HTTPS/redirect chains (requires production server)',
      'Playwright rendered crawl and mobile viewport screenshots',
      'Lighthouse / Core Web Vitals lab scores',
      'Live Rich Results Test validation',
      'Contact form submission and email delivery',
      'GA4 / Search Console / conversion event verification',
    ],
    pages,
    cannibalization,
    allIssues,
  };

  const ownerItems = ownerVerificationItems(pages);

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, 'seo-audit-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(REPORTS_DIR, 'seo-audit-report.md'), toMarkdownReport(report));
  fs.writeFileSync(path.join(REPORTS_DIR, 'seo-fixes-applied.md'), fixesMarkdown(APPLIED_FIXES, pages));
  fs.writeFileSync(path.join(REPORTS_DIR, 'seo-owner-verification-needed.md'), ownerMarkdown(ownerItems));

  // Keep internal linking report
  fs.writeFileSync(path.join(REPORTS_DIR, 'internal-linking-report.json'), JSON.stringify({ incoming, generatedAt: report.generatedAt }, null, 2));

  console.log(`SEO audit complete:`);
  console.log(`  Critical: ${report.summary.critical}`);
  console.log(`  High: ${report.summary.high}`);
  console.log(`  Medium: ${report.summary.medium}`);
  console.log(`  Low: ${report.summary.low}`);
  console.log(`Reports: reports/seo-audit-report.{md,json}, seo-fixes-applied.md, seo-owner-verification-needed.md`);
}

main();
