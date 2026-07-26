"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  Building2,
  Car,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  Eye,
  FileText,
  Heart,
  LayoutDashboard,
  MessageCircle,
  Printer,
  QrCode,
  Receipt,
  Shield,
  Star,
  Store,
  Truck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { PublicQrGenerator } from "./public-qr-generator";
import { cn } from "@/lib/utils";

const MARKETING = "https://localseoexpress.com";
const APP = "https://app.localseoexpress.com";

const FAQS = [
  {
    q: "Is this Google Review QR Code Generator free?",
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
    // Marketing site owns the H1/intro; embed is form + live preview only.
    return (
      <div className="min-h-screen bg-[#F8FAFC] px-3 py-4 sm:px-5 sm:py-6">
        <PublicQrGenerator embedded />
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
            <a href="#faq" className="hover:text-[#16A34A]">
              FAQ
            </a>
            <a href={`${MARKETING}/local-seo-packages/`} className="hover:text-[#16A34A]">
              Pricing
            </a>
            <a href={`${MARKETING}/about/`} className="hover:text-[#16A34A]">
              About Us
            </a>
            <Link href="/sign-in" className="hover:text-[#16A34A]">
              Log In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center rounded-lg bg-[#16A34A] px-4 text-white shadow-[0_8px_20px_rgba(22,163,74,0.25)]"
            >
              Start for Free
            </Link>
          </nav>
          <Link href="/sign-up" className="text-sm font-bold text-[#16A34A] md:hidden">
            Start free
          </Link>
        </div>
      </header>

      <main>
        {/* Hero = tool (mockup #2) */}
        <section className="border-b border-[#E2E8F0] bg-[radial-gradient(ellipse_at_top_left,_#ECFDF5_0%,_#ffffff_45%,_#F8FAFC_100%)]">
          <div id="generator" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-10 sm:px-6 lg:py-14">
            <PublicQrGenerator seoLayout />
          </div>
        </section>

        {/* SEO support copy under the tool */}
        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
            <p className="text-base leading-7 text-[#475569]">
              A Google Review QR Code — sometimes called a Google My Business QR Code or Google
              Business Profile QR Code — sends customers straight to your Google review page. No
              searching. No friction. Just scan, rate, and review. Whether you need a Google review
              poster for your front desk or a printable QR code for Google reviews on invoices and
              trucks, this free Google Review QR Code Generator gets you there fast.
            </p>
            <p className="mt-4 text-base leading-7 text-[#475569]">
              Use it to create a Google Review QR Code free, download a high-quality image, and print
              it anywhere. When you&apos;re ready, create a free Local SEO Express account to track
              Google Review QR Code scans, compare placements, and manage review campaigns alongside
              SMS and email requests.
            </p>
          </div>
        </section>

        {/* Benefits row */}
        <section id="benefits" className="scroll-mt-24 border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {[
              {
                icon: Star,
                title: "Get More Google Reviews",
                body: "Make it easier for happy customers to leave a review before they forget.",
              },
              {
                icon: Printer,
                title: "Ready to Print",
                body: "Download a professional poster, table sign, or QR image in seconds.",
              },
              {
                icon: Users,
                title: "No Account Required",
                body: "Generate and download your first Google Review QR Code for free.",
              },
              {
                icon: BarChart3,
                title: "Track Performance Later",
                body: "Create a free account anytime to see scans, compare placements, and measure engagement.",
              },
            ].map((item) => (
              <div key={item.title} className="text-center sm:text-left">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECFDF3] text-[#16A34A] sm:mx-0">
                  <item.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-3 text-base font-bold text-[#0B1220]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#64748B]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <ContentSection title="Why Use a Google Review QR Code?">
          <p>
            People are much more likely to leave a review when the process is simple. Instead of
            asking customers to search for your business, a Google Review QR Code takes them
            directly to your review page with a single scan.
          </p>
          <p>
            That means fewer steps, less frustration, and more completed reviews. Whether you own a
            local service business, restaurant, dental office, law firm, or retail store, a QR code
            helps you collect reviews at the moment your customer is happiest.
          </p>
        </ContentSection>

        <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0B1220]">
              Benefits of Using a Google Review QR Code Generator
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Increase Google Reviews", "Removing extra steps encourages more customers to leave feedback."],
                ["Save Time", "Generate a professional review poster in minutes without using design software."],
                ["Build Trust", "Recent reviews help future customers feel confident choosing your business."],
                ["Improve Local Visibility", "More high-quality Google reviews can strengthen your local presence over time."],
                ["Print Anywhere", "Use your QR code on counters, invoices, business cards, trucks, windows, or leave-behind materials."],
                ["Grow Into Tracking", "Save your campaign later to compare placements and understand engagement."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
                  <h3 className="text-base font-bold text-[#0B1220]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#64748B]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How to — horizontal 5 steps */}
        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-center text-3xl font-extrabold tracking-tight text-[#0B1220]">
              How to Create a Google Review QR Code
            </h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { icon: Store, title: "Find your Business", body: "Enter name or Google review link." },
                { icon: FileText, title: "Customize your poster", body: "Pick a theme and write your ask." },
                { icon: QrCode, title: "Generate QR Code", body: "Click to create your tracked code." },
                { icon: Printer, title: "Download and Print", body: "Get poster or QR-only files." },
                { icon: Building2, title: "Display in your shop", body: "Put it where customers will see it." },
              ].map((step, i) => (
                <li key={step.title} className="relative text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ECFDF3] text-[#16A34A] ring-4 ring-white">
                    <step.icon className="h-6 w-6" />
                  </span>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#16A34A]">
                    Step {i + 1}
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-[#0B1220]">{step.title}</h3>
                  <p className="mt-1 text-sm text-[#64748B]">{step.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-center font-semibold text-[#0B1220]">
              The entire process only takes a few minutes.
            </p>
          </div>
        </section>

        {/* Placements — 8 icons */}
        <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0B1220]">
              Where Should You Display Your Google Review QR Code?
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Store, title: "Front Desk", body: "Perfect for offices, clinics, and retail stores." },
                { icon: Receipt, title: "Invoices", body: "Ask for reviews after every completed job." },
                { icon: CreditCard, title: "Business Cards", body: "Continue collecting reviews after networking events." },
                { icon: Truck, title: "Company Vehicles", body: "Turn every service call into a review opportunity." },
                { icon: Building2, title: "Window Signs", body: "Encourage walk-in customers to share their experience." },
                { icon: Users, title: "Waiting Rooms", body: "Capture reviews while customers are already on-site." },
                { icon: FileText, title: "Table Tents", body: "Keep a review prompt on every table or counter." },
                { icon: Car, title: "Flyers", body: "Hand out a printable QR card after service." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECFDF3] text-[#16A34A]">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-bold text-[#0B1220]">{item.title}</h3>
                  <p className="mt-1 text-sm text-[#64748B]">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison — strong table from mock #1 + checklist */}
        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1.1fr_0.9fr] sm:px-6">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-[#0B1220]">
                Google Review QR Code vs Google My Business QR Code Generator
              </h2>
              <p className="mt-4 text-base leading-7 text-[#475569]">
                These terms are often used interchangeably. A Google Review QR Code sends customers
                directly to your Google review page. Our Google Review QR Code Generator lets you
                create a printable, branded version that looks professional and is ready for
                real-world use. After creating a free account, you can also track scans, compare
                placements, and manage multiple review campaigns.
              </p>
              <div className="mt-6 overflow-x-auto rounded-2xl border border-[#E2E8F0]">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-[#0B1220] text-white">
                    <tr>
                      <th className="px-4 py-3.5 font-semibold">Feature</th>
                      <th className="px-4 py-3.5 font-semibold">Google QR</th>
                      <th className="px-4 py-3.5 font-semibold">Local SEO Express</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Direct review page link", true, true],
                      ["Branded printable poster", false, true],
                      ["Custom colors & headline", false, true],
                      ["Instant PNG / QR download", false, true],
                      ["Scan tracking after signup", false, true],
                      ["Placement comparisons", false, true],
                      ["Multiple campaigns", false, true],
                      ["Review growth tools", false, true],
                    ].map(([label, basic, lse]) => (
                      <tr key={String(label)} className="border-t border-[#E2E8F0]">
                        <td className="px-4 py-3 font-medium text-[#0B1220]">{label}</td>
                        <td className="px-4 py-3">
                          {basic ? (
                            <Check className="h-5 w-5 text-[#16A34A]" />
                          ) : (
                            <X className="h-5 w-5 text-[#F43F5E]" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {lse ? (
                            <Check className="h-5 w-5 text-[#16A34A]" />
                          ) : (
                            <X className="h-5 w-5 text-[#F43F5E]" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
              <h3 className="text-lg font-bold text-[#0B1220]">How the funnel works</h3>
              <ul className="mt-5 space-y-3 text-sm text-[#475569]">
                {[
                  "Scan code",
                  "Direct to review page",
                  "Leave star rating / review",
                  "View scan analytics later",
                  "Compare placements",
                  "See review growth",
                  "Manage unlimited campaigns",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <ContentSection title="Can You Track a Google Review QR Code?" muted>
          <p>Yes. Every QR campaign can use a tracked link before sending visitors to your Google review page.</p>
          <p>After creating a free account, you can view:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Total scans</li>
            <li>Estimated unique scans</li>
            <li>Scan history</li>
            <li>Device type</li>
            <li>Campaign comparisons</li>
            <li>Placement performance</li>
          </ul>
          <p className="mt-4">
            While no platform can prove that a scan became a Google review, tracking scans helps you
            understand which posters and locations generate the most customer engagement.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: QrCode, label: "QR Campaigns" },
              { icon: BarChart3, label: "Scan Analytics" },
              { icon: LayoutDashboard, label: "Review Overview" },
              { icon: Zap, label: "Growth Funnel" },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-[#E2E8F0] bg-white p-4 text-center"
              >
                <card.icon className="mx-auto h-8 w-8 text-[#16A34A]" />
                <p className="mt-2 text-sm font-bold text-[#0B1220]">{card.label}</p>
                <p className="mt-1 text-xs text-[#64748B]">Unlocked after free signup</p>
              </div>
            ))}
          </div>
        </ContentSection>

        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0B1220]">
              Best Practices for Getting More Google Reviews
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[#475569]">
              A QR code works best when paired with good timing. Ask customers shortly after
              completing a job or service. Place your QR code somewhere highly visible. Keep your
              request simple and friendly. Always follow Google&apos;s review policies and never
              offer incentives in exchange for reviews.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Clock, title: "Ask at the right time", body: "Request a review right after a great experience." },
                { icon: Eye, title: "Place it where it’s seen", body: "Front desk, counters, and waiting areas win." },
                { icon: MessageCircle, title: "Keep it simple", body: "One scan. One Google review form. Done." },
                { icon: Heart, title: "Personalize your request", body: "A friendly ask beats a generic poster alone." },
                { icon: Shield, title: "Follow Google’s rules", body: "Never incentivize reviews or filter feedback." },
                { icon: Star, title: "Respond to reviews", body: "Replies build trust and encourage more reviews." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                  <item.icon className="h-5 w-5 text-[#16A34A]" />
                  <h3 className="mt-3 font-bold text-[#0B1220]">{item.title}</h3>
                  <p className="mt-1 text-sm text-[#64748B]">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0B1220]">
              Frequently Asked Questions
            </h2>
            <div className="mt-8 grid gap-3 lg:grid-cols-2">
              {FAQS.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-2xl border border-[#E2E8F0] bg-white px-5 py-4"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-[#0B1220]">
                    {faq.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B] transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-[#475569]">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-extrabold text-[#0B1220]">Related Tools</h2>
            <p className="mt-2 text-sm text-[#64748B]">
              After you generate your QR code, these Local SEO Express tools help you grow reviews
              even faster.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { href: `${APP}/sign-up`, title: "Review Request Templates", body: "Send SMS & email review asks." },
                { href: `${APP}/sign-up`, title: "Review Velocity", body: "See how fast reviews are growing." },
                { href: `${APP}/sign-up`, title: "Reputation Audit", body: "Find gaps vs nearby competitors." },
              ].map((tool) => (
                <a
                  key={tool.title}
                  href={tool.href}
                  className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 transition hover:border-[#16A34A]"
                >
                  <h3 className="font-bold text-[#0B1220]">{tool.title}</h3>
                  <p className="mt-1 text-sm text-[#64748B]">{tool.body}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0B1220] text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center sm:px-6">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#86EFAC]">
                Ready to get more Google Reviews?
              </p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
                Create Your Free Google Review QR Code
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/75">
                Generate your first Google Review QR Code in seconds. Download your poster
                immediately, or create a free account to unlock scan tracking, campaign management,
                and review growth tools.
              </p>
            </div>
            <a
              href="#generator"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#16A34A] px-6 text-sm font-bold text-white shadow-[0_12px_28px_rgba(22,163,74,0.35)]"
            >
              Generate Free QR Code
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

function ContentSection({
  title,
  children,
  muted = false,
}: {
  title: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <section className={cn("border-b border-[#E2E8F0]", muted ? "bg-[#F8FAFC]" : "bg-white")}>
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#0B1220]">{title}</h2>
        <div className="mt-5 space-y-4 text-base leading-7 text-[#475569]">{children}</div>
      </div>
    </section>
  );
}
