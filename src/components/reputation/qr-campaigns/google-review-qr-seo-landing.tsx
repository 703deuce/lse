"use client";

import Link from "next/link";
import {
  BarChart3,
  Check,
  ChevronDown,
  CreditCard,
  Download,
  Palette,
  Printer,
  QrCode,
  Receipt,
  Search,
  Star,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { PublicQrGenerator } from "./public-qr-generator";

const MARKETING = "https://localseoexpress.com";

const iconBubble =
  "mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_40%,rgba(22,163,74,0.18)_0%,#ECFDF3_70%)] text-[#16A34A] shadow-[0_0_0_8px_rgba(22,163,74,0.05)]";

const iconBubbleSm =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_40%,rgba(22,163,74,0.18)_0%,#ECFDF3_70%)] text-[#16A34A] shadow-[0_0_0_6px_rgba(22,163,74,0.05)]";

const FAQS = [
  {
    q: "Is this Google Review QR Code Generator really free?",
    a: "Yes. You can create and download your first QR code for free.",
  },
  {
    q: "Does Google provide a QR code?",
    a: "Google offers a basic QR code for eligible Business Profiles. Our generator helps you create branded posters and unlock scan tracking after signup.",
  },
  {
    q: "Can I print my QR code?",
    a: "Yes. Download a high-quality version that is ready for printing on posters, flyers, invoices, business cards, and more.",
  },
  {
    q: "Can I track QR code scans?",
    a: "Yes. Create a free account to save your campaign and view scan analytics over time.",
  },
  {
    q: "Will customers need an app?",
    a: "No. Most modern iPhones and Android phones can scan QR codes directly from the camera.",
  },
  {
    q: "Can I create multiple QR codes?",
    a: "Yes. Create different campaigns for your front desk, invoices, vehicles, business cards, and other locations to compare performance.",
  },
] as const;

export function GoogleReviewQrSeoLanding({ embed = false }: { embed?: boolean }) {
  if (embed) {
    return (
      <div className="min-h-[100%] bg-white px-2 py-2 sm:px-4 sm:py-3">
        <PublicQrGenerator embedded seoLayout />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#334155]">
      <header className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href={MARKETING} className="text-sm font-bold text-[#0B1220]">
            Local SEO <span className="text-[#16A34A]">Express</span>
          </a>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-[#475569] md:flex">
            <a href="#benefits" className="hover:text-[#16A34A]">
              Features
            </a>
            <a href={`${MARKETING}/free-tools/`} className="hover:text-[#16A34A]">
              Tools
            </a>
            <a href={`${MARKETING}/local-seo-packages/`} className="hover:text-[#16A34A]">
              Pricing
            </a>
            <a href="#faq" className="hover:text-[#16A34A]">
              Resources
            </a>
            <Link href="/sign-in" className="hover:text-[#16A34A]">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center rounded-lg bg-[#16A34A] px-4 text-white shadow-[0_8px_20px_rgba(22,163,74,0.25)]"
            >
              Create Free Account
            </Link>
          </nav>
          <Link href="/sign-up" className="text-sm font-bold text-[#16A34A] md:hidden">
            Join Free
          </Link>
        </div>
      </header>

      <main>
        <section className="border-b border-[#E2E8F0] bg-white">
          <div id="generator" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
            <PublicQrGenerator seoLayout />
          </div>
        </section>

        <section
          id="benefits"
          className="scroll-mt-24 border-b border-[#E2E8F0] bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#ECFDF5_0%,transparent_55%),linear-gradient(180deg,#F7FDF9_0%,#FFFFFF_100%)]"
        >
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:gap-6">
            {[
              { icon: Star, title: "Get More Google Reviews", body: "Make it easier for happy customers to leave a review before they forget." },
              { icon: Download, title: "Ready to Print", body: "Download a professional poster, table sign, or QR image in seconds." },
              { icon: Check, title: "No Account Required", body: "Generate and download your first Google Review QR Code for free." },
              { icon: BarChart3, title: "Track Performance Later", body: "Create a free account anytime to see scans, compare placements, and measure engagement." },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[#E2E8F0] bg-white px-5 py-7 text-center shadow-[0_12px_32px_rgba(11,27,50,0.05)]"
              >
                <span className={iconBubble}>
                  <item.icon className="h-6 w-6" strokeWidth={1.85} />
                </span>
                <h3 className="mt-4 text-base font-extrabold tracking-tight text-[#0B1220]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#64748B]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mx-auto mb-10 max-w-xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-[#0B1220]">
                How to Create a Google Review QR Code
              </h2>
              <p className="mt-3 text-base text-[#475569]">Four simple steps. No design skills needed.</p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Search, title: "Find your business", body: "Search by name or paste your Google Place ID / review link." },
                { icon: Palette, title: "Customize your poster", body: "Set your business name, scan message, and brand color." },
                { icon: QrCode, title: "Generate QR Code", body: "Create a print-ready Google Review QR code instantly." },
                { icon: Download, title: "Download and print", body: "Export your poster or QR-only image and display it in-store." },
              ].map((step, i) => (
                <li
                  key={step.title}
                  className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_8px_24px_rgba(11,27,50,0.04)]"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#14532D] text-xs font-extrabold text-white">
                      {i + 1}
                    </span>
                    <span className={iconBubbleSm}>
                      <step.icon className="h-5 w-5" strokeWidth={1.85} />
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-[#0B1220]">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-[#64748B]">{step.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-center font-bold text-[#0B1220]">
              The entire process only takes a few minutes.
            </p>
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-[radial-gradient(ellipse_at_top,rgba(22,163,74,0.06)_0%,transparent_50%),#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-[#0B1220]">
                Where Should You Display Your Google Review QR Code?
              </h2>
              <p className="mt-3 text-base text-[#475569]">
                Put it where happy customers already are — right after a great experience.
              </p>
            </div>
            <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Store, title: "Front Desk", body: "Perfect for offices, clinics, and retail stores." },
                { icon: Receipt, title: "Receipts & Invoices", body: "Ask for reviews after every completed job." },
                { icon: CreditCard, title: "Business Cards", body: "Keep collecting reviews after networking events." },
                { icon: Truck, title: "Company Vehicles", body: "Turn every service call into a review opportunity." },
                { icon: Printer, title: "Window Signs", body: "Encourage walk-in customers to share their experience." },
                { icon: Users, title: "Waiting Rooms", body: "Capture reviews while customers are already on-site." },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_8px_22px_rgba(11,27,50,0.035)]"
                >
                  <span className={iconBubbleSm}>
                    <item.icon className="h-5 w-5" strokeWidth={1.85} />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-[#0B1220]">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#64748B]">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] sm:px-6">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#0B1220] sm:text-3xl">
                Google Review QR Code vs Google My Business QR Code Generator
              </h2>
              <div className="mt-5 space-y-4 text-base leading-7 text-[#475569]">
                <p>
                  These terms are often used interchangeably. A Google Review QR Code sends customers
                  directly to your Google review page — no searching, no friction.
                </p>
                <p>
                  Our free generator creates a printable, branded poster ready for real-world use.
                  After creating a free account, you can also track scans, compare placements, and
                  manage multiple review campaigns.
                </p>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_14px_36px_rgba(11,27,50,0.06)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0B1220] text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Feature</th>
                    <th className="px-4 py-3 font-semibold">Google QR Code</th>
                    <th className="px-4 py-3 font-semibold">Local SEO Express</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Direct review page link", true, true],
                    ["Professional design", false, true],
                    ["Custom colors & headline", false, true],
                    ["Instant poster download", false, true],
                    ["Scan tracking after signup", false, true],
                    ["Placement comparisons", false, true],
                    ["Multiple campaigns", false, true],
                  ].map(([label, basic, lse]) => (
                    <tr key={String(label)} className="border-t border-[#E2E8F0] even:bg-[#FAFBFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1220]">{label}</td>
                      <td className="px-4 py-3 text-center text-base font-bold text-[#CBD5E1]">
                        {basic ? <Check className="mx-auto h-5 w-5 text-[#16A34A]" /> : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {lse ? <Check className="mx-auto h-5 w-5 text-[#16A34A]" /> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section
          id="faq"
          className="scroll-mt-24 border-b border-[#E2E8F0] bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#ECFDF5_0%,transparent_55%),#FFFFFF]"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mx-auto mb-10 max-w-xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-[#0B1220]">
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-base text-[#475569]">
                Quick answers about the free Google Review QR Code Generator.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {FAQS.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-2xl border border-[#E2E8F0] bg-white px-5 py-4 shadow-[0_4px_14px_rgba(11,27,50,0.03)]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-[#0B1220]">
                    {faq.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#94A3B8] transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-[#475569]">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[radial-gradient(ellipse_at_left,rgba(34,197,94,0.18)_0%,transparent_45%),linear-gradient(135deg,#14532D_0%,#166534_55%,#14532D_100%)] text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 py-14 sm:flex-row sm:items-center sm:px-6">
            <div className="max-w-xl">
              <h2 className="text-3xl font-extrabold tracking-tight">Get More Google Reviews Today</h2>
              <p className="mt-3 text-sm leading-6 text-white/78">
                Generate your free Google Review QR Code in seconds — then print it and start
                collecting reviews.
              </p>
            </div>
            <a
              href="#generator"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#4ADE80] px-6 text-sm font-extrabold text-[#14532D] shadow-[0_14px_32px_rgba(0,0,0,0.22)] transition hover:bg-[#86EFAC]"
            >
              Download Now
              <Download className="h-4 w-4" strokeWidth={2.2} />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-[#64748B] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Local SEO Express</p>
          <div className="flex flex-wrap gap-4">
            <a href={`${MARKETING}/free-tools/`} className="hover:text-[#16A34A]">
              Free Tools
            </a>
            <a href={`${MARKETING}/privacy-policy/`} className="hover:text-[#16A34A]">
              Privacy
            </a>
            <a href={`${MARKETING}/terms-of-service/`} className="hover:text-[#16A34A]">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
