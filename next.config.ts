import type { NextConfig } from "next";

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const defaultCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  // Next.js + inline styles used across the app; tighten later with nonces.
  // unsafe-eval removed — re-add only if a runtime dependency requires eval().
  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://maps.googleapis.com https://www.google.com",
  "worker-src 'self' blob:",
].join("; ");

/** Public SEO tool may be embedded on the marketing site. */
const embedFrameAncestors = [
  "'self'",
  "https://localseoexpress.com",
  "https://www.localseoexpress.com",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "http://127.0.0.1:8765",
  "http://localhost:8765",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
].join(" ");

const embedCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  `frame-ancestors ${embedFrameAncestors}`,
  "form-action 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://maps.googleapis.com https://www.google.com",
  "worker-src 'self' blob:",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/reports/share/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      // Catch-all first. Rely on CSP frame-ancestors (not X-Frame-Options) so
      // the public QR generator can override framing for the marketing site.
      {
        source: "/:path*",
        headers: [
          ...baseSecurityHeaders,
          { key: "Content-Security-Policy", value: defaultCsp },
        ],
      },
      {
        source: "/google-review-qr-code-generator",
        headers: [
          { key: "Content-Security-Policy", value: embedCsp },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/google-review-qr-code-generator/:path*",
        headers: [
          { key: "Content-Security-Policy", value: embedCsp },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/tools/review-response-generator",
        headers: [
          { key: "Content-Security-Policy", value: embedCsp },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/tools/review-response-generator/:path*",
        headers: [
          { key: "Content-Security-Policy", value: embedCsp },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/tools/google-review-widget",
        headers: [
          { key: "Content-Security-Policy", value: embedCsp },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/tools/google-review-widget/:path*",
        headers: [
          { key: "Content-Security-Policy", value: embedCsp },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/tools/google-maps-rank-checker",
        headers: [
          { key: "Content-Security-Policy", value: embedCsp },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/tools/google-maps-rank-checker/:path*",
        headers: [
          { key: "Content-Security-Policy", value: embedCsp },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/tools/local-seo-audit",
        headers: [
          { key: "Content-Security-Policy", value: embedCsp },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/tools/local-seo-audit/:path*",
        headers: [
          { key: "Content-Security-Policy", value: embedCsp },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/api/public/contact",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/api/public/contact/:path*",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/api/public/review-reply",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/api/public/review-reply/:path*",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/api/public/maps-rank-check",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/api/public/maps-rank-check/:path*",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/api/public/local-seo-audit",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/api/public/local-seo-audit/:path*",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
