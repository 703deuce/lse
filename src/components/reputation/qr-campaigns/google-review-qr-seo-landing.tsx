"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileText,
  Gift,
  Heart,
  MapPin,
  MessageCircle,
  Palette,
  Printer,
  QrCode,
  Receipt,
  Search,
  Shield,
  Star,
  Store,
  Truck,
  Users,
  X,
} from "lucide-react";
import { PublicQrGenerator } from "./public-qr-generator";

const MARKETING = "https://localseoexpress.com";
const APP = "https://app.localseoexpress.com";

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
      <div className="min-h-screen bg-[#F8FAFC] px-3 py-4 sm:px-5 sm:py-5">
        {/* Full mockup hero inside iframe so left/right heights stay balanced */}
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
        <section className="border-b border-[#E2E8F0] bg-[radial-gradient(ellipse_at_top_left,_#ECFDF5_0%,_#ffffff_42%,_#F8FAFC_100%)]">
          <div id="generator" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
            <PublicQrGenerator seoLayout />
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6 lg:py-12">
            <p className="text-base leading-7 text-[#475569]">
              A Google Review QR Code — sometimes called a Google My Business QR Code or Google
              Business Profile QR Code — sends customers straight to your Google review page. No
              searching. No friction. Just scan, rate, and review.
            </p>
            <p className="mt-3 text-base leading-7 text-[#475569]">
              Whether you need a Google review poster for your front desk or a printable QR code for
              Google reviews on invoices and trucks, this free Google Review QR Code Generator gets
              you there fast. Create a free account later to track scans and compare placements.
            </p>
          </div>
        </section>

        <section id="benefits" className="scroll-mt-24 border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:py-14">
            {[
              { icon: BarChart3, title: "Get More Google Reviews", body: "Make it easier for happy customers to leave a review before they forget." },
              { icon: Printer, title: "Ready to Print", body: "Download a professional poster, table sign, or QR image in seconds." },
              { icon: Gift, title: "No Account Required", body: "Generate and download your first Google Review QR Code for free." },
              { icon: BarChart3, title: "Track Performance Later", body: "Create a free account anytime to see scans, compare placements, and measure engagement." },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECFDF3] text-[#16A34A]">
                  <item.icon className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 text-base font-bold text-[#0B1220]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#64748B]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0B1220]">
              Why Use a Google Review QR Code?
            </h2>
            <div className="mt-5 space-y-4 text-base leading-7 text-[#475569]">
              <p>
                People are much more likely to leave a review when the process is simple. Instead of
                asking customers to search for your business, a Google Review QR Code takes them
                directly to your review page with a single scan.
              </p>
              <p>
                That means fewer steps, less frustration, and more completed reviews. Whether you own
                a local service business, restaurant, dental office, law firm, or retail store, a QR
                code helps you collect reviews at the moment your customer is happiest.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-white">
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
                ["Track and Measure", "Save your campaign later to compare placements and understand engagement."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                  <h3 className="text-base font-bold text-[#0B1220]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#64748B]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-center text-3xl font-extrabold tracking-tight text-[#0B1220]">
              How to Create a Google Review QR Code
            </h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { icon: Search, title: "Find your business" },
                { icon: Palette, title: "Customize your poster" },
                { icon: QrCode, title: "Generate your QR code" },
                { icon: Download, title: "Download and print" },
                { icon: MapPin, title: "Display and get reviews" },
              ].map((step, i, arr) => (
                <li key={step.title} className="relative text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#16A34A] shadow-sm ring-1 ring-[#E2E8F0]">
                    <step.icon className="h-6 w-6" strokeWidth={1.75} />
                  </span>
                  {i < arr.length - 1 ? (
                    <ArrowRight className="absolute right-[-0.75rem] top-5 hidden h-4 w-4 text-[#CBD5E1] lg:block" />
                  ) : null}
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#16A34A]">
                    Step {i + 1}
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-[#0B1220]">{step.title}</h3>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-center font-semibold text-[#0B1220]">
              The entire process only takes a few minutes.
            </p>
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-white">
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
                { icon: Users, title: "Waiting Areas", body: "Capture reviews while customers are already on-site." },
                { icon: FileText, title: "Table Tents", body: "Keep a review prompt on every table or counter." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#16A34A]">
                    <item.icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-3 font-bold text-[#0B1220]">{item.title}</h3>
                  <p className="mt-1 text-sm text-[#64748B]">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-2 sm:px-6">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#0B1220] sm:text-3xl">
                Google Review QR Code vs Google My Business QR Code Generator
              </h2>
              <div className="mt-6 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#0B1220] text-white">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Feature</th>
                      <th className="px-4 py-3 font-semibold">Google&apos;s QR</th>
                      <th className="px-4 py-3 font-semibold">Local SEO Express</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Direct review page link", true, true],
                      ["Branded printable poster", false, true],
                      ["Custom colors & headline", false, true],
                      ["Instant download", false, true],
                      ["Scan tracking after signup", false, true],
                      ["Placement comparisons", false, true],
                      ["Multiple campaigns", false, true],
                    ].map(([label, basic, lse]) => (
                      <tr key={String(label)} className="border-t border-[#E2E8F0]">
                        <td className="px-4 py-3 font-medium text-[#0B1220]">{label}</td>
                        <td className="px-4 py-3">
                          {basic ? <Check className="h-5 w-5 text-[#16A34A]" /> : <X className="h-5 w-5 text-[#94A3B8]" />}
                        </td>
                        <td className="px-4 py-3">
                          {lse ? <Check className="h-5 w-5 text-[#16A34A]" /> : <X className="h-5 w-5 text-[#94A3B8]" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#0B1220] sm:text-3xl">
                Can You Track Google Review QR Code Scans?
              </h2>
              <p className="mt-4 text-base leading-7 text-[#475569]">
                Yes. Every QR campaign can use a tracked link before sending visitors to your Google
                review page. After creating a free account, you can view:
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-[#475569]">
                {[
                  "Total scans",
                  "Estimated unique scans",
                  "Scan history",
                  "Device type",
                  "Campaign comparisons",
                  "Placement performance",
                ].map((line) => (
                  <li key={line} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#16A34A]" />
                    {line}
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-sm leading-6 text-[#1E3A8A]">
                No platform can prove a scan became a Google review. Tracking scans still helps you
                see which posters and locations generate the most engagement.
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-center text-3xl font-extrabold tracking-tight text-[#0B1220]">
              Best Practices for Getting More Google Reviews
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Clock, title: "Ask at the Right Time", body: "Request a review right after a great experience or completed job." },
                { icon: Eye, title: "Place it Where It’s Seen", body: "Front desk, counters, and waiting areas convert best." },
                { icon: MessageCircle, title: "Keep It Simple", body: "One scan. One Google review form. Done." },
                { icon: Heart, title: "Personalize Your Request", body: "A friendly ask beats a generic poster alone." },
                { icon: Shield, title: "Follow Google’s Rules", body: "Never incentivize reviews or filter feedback." },
                { icon: Star, title: "Respond to Reviews", body: "Replies build trust and encourage more reviews." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 text-center">
                  <item.icon className="mx-auto h-6 w-6 text-[#16A34A]" strokeWidth={1.75} />
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
                  className="group rounded-xl border border-[#E2E8F0] bg-white px-5 py-4"
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
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 transition hover:border-[#16A34A]"
                >
                  <h3 className="font-bold text-[#0B1220]">{tool.title}</h3>
                  <p className="mt-1 text-sm text-[#64748B]">{tool.body}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0B1220] text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 py-14 sm:flex-row sm:items-center sm:px-6">
            <div className="max-w-xl">
              <h2 className="text-3xl font-extrabold tracking-tight">
                Ready to Get More Google Reviews?
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/75">
                Generate your first Google Review QR Code in seconds. Download your poster
                immediately, or create a free account to unlock scan tracking and campaign tools.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#generator"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-[#16A34A] px-6 text-sm font-bold text-white"
                >
                  Generate Free QR Code
                </a>
                <Link
                  href="/sign-up"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-white/25 px-6 text-sm font-bold text-white"
                >
                  Create Free Account
                </Link>
              </div>
            </div>
            <div className="w-full max-w-[220px] rounded-xl bg-white p-2 shadow-xl">
              <div className="rounded-lg bg-[#16A34A] px-3 py-4 text-center text-white">
                <p className="text-xs">★★★★★</p>
                <p className="mt-1 text-sm font-bold">Love our service?</p>
                <div className="mx-auto mt-3 h-20 w-20 rounded bg-white" />
                <p className="mt-2 text-[10px] opacity-90">Scan to leave a review</p>
              </div>
            </div>
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
