import type { PageThemeTokens } from "@/lib/reputation/payment-qr/page-themes";
import { FloralBranchArt } from "@/components/reputation/payment-qr/payment-page-header-decor";

/** Page-level decorations that must not be clipped by the card container. */
export function PaymentPageBackgroundDecor({ theme }: { theme: PageThemeTokens }) {
  if (theme.headerDecor === "floral") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
        <div
          className="absolute -left-[72px] -top-[72px] h-[160px] w-[160px] rounded-full"
          style={{ background: theme.accent, opacity: 0.45 }}
        />
        <div
          className="absolute -right-[72px] -top-[72px] h-[160px] w-[160px] rounded-full"
          style={{ background: theme.accent, opacity: 0.45 }}
        />
        <div
          className="absolute -left-[48px] top-[24px] h-[100px] w-[100px] rounded-full"
          style={{ background: theme.primary, opacity: 0.12 }}
        />
        <div
          className="absolute -right-[48px] top-[24px] h-[100px] w-[100px] rounded-full"
          style={{ background: theme.primary, opacity: 0.12 }}
        />
        <FloralBranchArt
          className="absolute -left-2 bottom-6 h-[88px] w-[88px]"
          color={theme.accent}
          stroke={theme.primary}
          opacity={0.35}
        />
        <FloralBranchArt
          className="absolute -right-2 bottom-6 h-[88px] w-[88px] scale-x-[-1]"
          color={theme.accent}
          stroke={theme.primary}
          opacity={0.35}
        />
      </div>
    );
  }

  if (theme.headerDecor === "wave") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
        <div
          className="absolute -left-20 -top-20 h-40 w-40 rounded-full opacity-20"
          style={{ background: theme.primary }}
        />
        <div
          className="absolute -right-16 top-10 h-32 w-32 rounded-full opacity-15"
          style={{ background: theme.accent }}
        />
      </div>
    );
  }

  return null;
}
