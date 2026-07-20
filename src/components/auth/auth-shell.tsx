import type { ReactNode } from "react";
import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 15% 20%, rgba(19,119,82,0.16), transparent 55%), radial-gradient(ellipse 55% 45% at 90% 80%, rgba(15,99,68,0.12), transparent 50%), linear-gradient(180deg, #eef5f1 0%, #f3f5f7 48%, #e8eef2 100%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <Link
            href="https://localseoexpress.com"
            className="inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-zinc-900"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#137752] text-sm font-bold text-white shadow-[0_8px_20px_rgba(19,119,82,0.28)]">
              LSE
            </span>
            Local SEO <span className="font-extrabold">Express</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white/95 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur-sm sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-[1.65rem] font-bold tracking-tight text-zinc-900">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{subtitle}</p>
          </div>
          {children}
        </div>

        {footer ? <div className="mt-5 text-center text-sm text-zinc-500">{footer}</div> : null}
      </div>
    </div>
  );
}
