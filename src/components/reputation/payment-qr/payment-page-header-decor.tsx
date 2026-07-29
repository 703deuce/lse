import type { PageThemeTokens } from "@/lib/reputation/payment-qr/page-themes";

export function PaymentPageHeaderDecor({ theme }: { theme: PageThemeTokens }) {
  if (theme.headerDecor === "wave") {
    return (
      <div className="relative h-[88px] w-full" style={{ background: theme.cardBg }}>
        <svg
          className="absolute left-0 top-0 h-[88px] w-full"
          viewBox="0 0 400 88"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0,0 L400,0 L400,52 C310,78 270,28 200,48 C130,68 90,18 0,48 Z" fill={theme.headerBg} />
          <path
            d="M0,32 C70,58 150,18 200,38 C250,58 330,22 400,42 L400,88 L0,88 Z"
            fill={theme.cardBg}
          />
        </svg>
        <svg
          className="absolute left-0 top-0 h-[56px] w-full opacity-25"
          viewBox="0 0 400 56"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0,8 C120,0 280,48 400,20 L400,0 L0,0 Z" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  if (theme.headerDecor === "floral") {
    return (
      <div className="relative h-[72px] w-full" style={{ background: theme.cardBg }}>
        <div
          className="absolute -left-[56px] -top-[56px] h-[128px] w-[128px] rounded-full"
          style={{ background: theme.accent, opacity: 0.5 }}
        />
        <div
          className="absolute -right-[56px] -top-[56px] h-[128px] w-[128px] rounded-full"
          style={{ background: theme.accent, opacity: 0.5 }}
        />
        <FloralBranchArt
          className="absolute left-0 top-0 h-[72px] w-[72px]"
          color={theme.accent}
          stroke={theme.primary}
          opacity={0.4}
        />
        <FloralBranchArt
          className="absolute right-0 top-0 h-[72px] w-[72px] scale-x-[-1]"
          color={theme.accent}
          stroke={theme.primary}
          opacity={0.4}
        />
      </div>
    );
  }

  if (theme.headerDecor === "shield") {
    return (
      <div
        className="relative flex h-[108px] w-full flex-col items-center justify-end overflow-visible pb-1"
        style={{ background: theme.headerBg }}
      >
        <div
          className="absolute left-0 top-0 h-1 w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${theme.primary}, transparent)` }}
        />
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 400 56"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0,0 L400,0 L400,26 L200,52 L0,26 Z" fill={theme.pageBg} />
        </svg>
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 400 56"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,0 L400,0 L400,24 L200,50 L0,24 Z"
            fill="none"
            stroke={theme.primary}
            strokeWidth="2.5"
          />
        </svg>
      </div>
    );
  }

  if (theme.headerDecor === "dark") {
    return (
      <div className="relative h-[80px] w-full overflow-visible" style={{ background: theme.headerBg }}>
        <div
          className="absolute left-1/2 top-0 h-[100px] w-[180px] -translate-x-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${theme.primary}55 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute bottom-0 left-0 h-px w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${theme.primary}60, transparent)` }}
        />
      </div>
    );
  }

  return (
    <div
      className="h-12 w-full"
      style={{
        background: `linear-gradient(180deg, ${theme.headerBg} 0%, ${theme.cardBg} 100%)`,
      }}
    />
  );
}

export function FloralBranchArt({
  className,
  color,
  stroke,
  opacity = 1,
}: {
  className?: string;
  color: string;
  stroke: string;
  opacity?: number;
}) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden style={{ opacity }}>
      <path
        d="M8 62 C18 42 32 38 48 48 C38 28 52 14 68 18 C58 8 42 6 30 18 C18 8 8 22 12 38 C4 48 8 62 8 62Z"
        fill={color}
        opacity="0.55"
      />
      <path
        d="M72 28 C82 18 92 24 94 36 C96 48 86 58 76 52 C70 62 58 68 48 62"
        stroke={stroke}
        strokeWidth="1.4"
        fill="none"
        opacity="0.65"
      />
      <path
        d="M18 72 C32 58 48 62 62 54 C74 48 86 56 90 68"
        stroke={stroke}
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />
      <circle cx="24" cy="34" r="4.5" fill={stroke} opacity="0.35" />
      <circle cx="38" cy="22" r="3.5" fill={stroke} opacity="0.3" />
      <circle cx="70" cy="40" r="3" fill={color} opacity="0.45" />
    </svg>
  );
}

export function PaymentPageFooterWave({ theme }: { theme: PageThemeTokens }) {
  if (theme.headerDecor !== "wave") return null;
  return (
    <div className="relative h-[64px] w-full" style={{ background: theme.cardBg }}>
      <svg
        className="absolute left-0 top-0 h-full w-full"
        viewBox="0 0 400 64"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0,12 C90,44 170,4 200,24 C230,44 310,4 400,28 L400,64 L0,64 Z"
          fill={theme.headerBg}
          opacity="0.14"
        />
        <path
          d="M0,28 C100,56 300,16 400,40 L400,64 L0,64 Z"
          fill={theme.headerBg}
          opacity="0.1"
        />
      </svg>
      <svg
        className="absolute bottom-0 left-0 h-[36px] w-full"
        viewBox="0 0 400 36"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0,0 C110,30 290,0 400,18 L400,36 L0,36 Z"
          fill={theme.headerBg}
          opacity="0.22"
        />
      </svg>
    </div>
  );
}
