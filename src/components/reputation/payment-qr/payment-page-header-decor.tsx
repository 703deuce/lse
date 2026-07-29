import type { PageThemeTokens } from "@/lib/reputation/payment-qr/page-themes";

export function PaymentPageHeaderDecor({ theme }: { theme: PageThemeTokens }) {
  if (theme.headerDecor === "wave") {
    return (
      <div className="relative h-24 w-full overflow-hidden" style={{ background: theme.headerBg }}>
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 400 48"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,24 C80,48 160,0 200,24 C240,48 320,0 400,24 L400,48 L0,48 Z"
            fill={theme.cardBg}
          />
        </svg>
        <svg
          className="absolute top-0 left-0 w-full opacity-30"
          viewBox="0 0 400 96"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,48 C100,0 300,96 400,32 L400,0 L0,0 Z"
            fill="#ffffff"
          />
        </svg>
      </div>
    );
  }

  if (theme.headerDecor === "floral") {
    return (
      <div
        className="relative h-28 w-full overflow-hidden"
        style={{ background: theme.headerBg }}
      >
        <svg className="absolute -left-2 top-0 h-24 w-24 opacity-40" viewBox="0 0 100 100" aria-hidden>
          <circle cx="30" cy="30" r="8" fill={theme.accent} />
          <circle cx="50" cy="20" r="6" fill={theme.primary} />
          <circle cx="20" cy="50" r="5" fill={theme.primary} />
          <path d="M30 30 Q50 10 70 30" stroke={theme.primary} strokeWidth="2" fill="none" />
        </svg>
        <svg className="absolute -right-2 top-0 h-24 w-24 opacity-40" viewBox="0 0 100 100" aria-hidden>
          <circle cx="70" cy="30" r="8" fill={theme.accent} />
          <circle cx="50" cy="20" r="6" fill={theme.primary} />
          <circle cx="80" cy="50" r="5" fill={theme.primary} />
          <path d="M70 30 Q50 10 30 30" stroke={theme.primary} strokeWidth="2" fill="none" />
        </svg>
      </div>
    );
  }

  if (theme.headerDecor === "shield") {
    return (
      <div
        className="relative flex h-28 w-full items-center justify-center"
        style={{ background: theme.headerBg }}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-lg border-2"
          style={{ borderColor: theme.primary, background: "#1a1a1a" }}
        >
          <div
            className="h-8 w-8 rounded-sm"
            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
          />
        </div>
      </div>
    );
  }

  if (theme.headerDecor === "dark") {
    return (
      <div
        className="relative h-20 w-full"
        style={{
          background: `linear-gradient(180deg, ${theme.primary}22 0%, ${theme.cardBg} 100%)`,
        }}
      />
    );
  }

  return (
    <div className="h-16 w-full" style={{ background: theme.headerBg }} />
  );
}

export function PaymentPageFooterWave({ theme }: { theme: PageThemeTokens }) {
  if (theme.headerDecor !== "wave") return null;
  return (
    <div className="relative h-12 w-full overflow-hidden" style={{ background: theme.cardBg }}>
      <svg
        className="absolute top-0 left-0 w-full"
        viewBox="0 0 400 48"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M0,0 C100,48 300,0 400,24 L400,48 L0,48 Z" fill={theme.headerBg} opacity="0.15" />
      </svg>
    </div>
  );
}
