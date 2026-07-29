import type { PageThemeTokens } from "@/lib/reputation/payment-qr/page-themes";

export function PaymentPageHeaderDecor({ theme }: { theme: PageThemeTokens }) {
  if (theme.headerDecor === "wave") {
    return (
      <div
        className="relative h-[100px] w-full overflow-hidden"
        style={{ background: theme.headerBg }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor={theme.headerBg} />
            </linearGradient>
          </defs>
          <path d="M0,0 L400,0 L400,55 C320,85 280,35 200,55 C120,75 80,25 0,55 Z" fill="url(#waveGrad)" />
          <path
            d="M0,40 C60,70 140,20 200,45 C260,70 340,25 400,50 L400,100 L0,100 Z"
            fill={theme.cardBg}
          />
        </svg>
        <svg
          className="absolute left-0 top-0 h-full w-full opacity-20"
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,20 C100,0 300,80 400,30 L400,0 L0,0 Z"
            fill="#ffffff"
          />
        </svg>
      </div>
    );
  }

  if (theme.headerDecor === "floral") {
    return (
      <div
        className="relative h-[110px] w-full overflow-hidden"
        style={{ background: theme.headerBg }}
      >
        <FloralCorner className="absolute -left-1 top-0 h-[100px] w-[100px]" color={theme.accent} stroke={theme.primary} />
        <FloralCorner className="absolute -right-1 top-0 h-[100px] w-[100px] scale-x-[-1]" color={theme.accent} stroke={theme.primary} />
        <div
          className="absolute bottom-0 left-0 h-6 w-full"
          style={{ background: `linear-gradient(to bottom, transparent, ${theme.cardBg})` }}
        />
      </div>
    );
  }

  if (theme.headerDecor === "shield") {
    return (
      <div
        className="relative flex h-[120px] w-full flex-col items-center justify-end overflow-hidden pb-2"
        style={{ background: theme.headerBg }}
      >
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 400 60"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0,0 L400,0 L400,30 L200,58 L0,30 Z" fill={theme.pageBg} />
        </svg>
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 400 60"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,0 L400,0 L400,28 L200,54 L0,28 Z"
            fill="none"
            stroke={theme.primary}
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  }

  if (theme.headerDecor === "dark") {
    return (
      <div className="relative h-[72px] w-full overflow-hidden" style={{ background: theme.headerBg }}>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 100% at 50% 0%, ${theme.primary}30 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute bottom-0 left-0 h-px w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${theme.primary}50, transparent)` }}
        />
      </div>
    );
  }

  return (
    <div
      className="h-14 w-full"
      style={{
        background: `linear-gradient(180deg, ${theme.headerBg} 0%, ${theme.cardBg} 100%)`,
      }}
    />
  );
}

function FloralCorner({
  className,
  color,
  stroke,
}: {
  className?: string;
  color: string;
  stroke: string;
}) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden>
      <path
        d="M15 55 Q25 35 40 45 Q30 25 50 20 Q35 10 25 25 Q10 15 15 35 Q5 45 15 55Z"
        fill={color}
        opacity="0.35"
      />
      <path
        d="M20 70 Q35 55 45 65 Q55 50 65 58 Q75 45 80 60 Q90 55 85 70 Q95 80 80 85 Q70 95 55 88 Q40 95 30 85 Q15 80 20 70Z"
        fill={color}
        opacity="0.25"
      />
      <circle cx="28" cy="38" r="5" fill={stroke} opacity="0.4" />
      <circle cx="42" cy="28" r="4" fill={stroke} opacity="0.35" />
      <path
        d="M25 45 C35 30 50 25 65 35"
        stroke={stroke}
        strokeWidth="1.5"
        opacity="0.5"
        fill="none"
      />
      <path
        d="M30 60 C45 50 55 55 70 48"
        stroke={stroke}
        strokeWidth="1.2"
        opacity="0.4"
        fill="none"
      />
    </svg>
  );
}

export function PaymentPageFooterWave({ theme }: { theme: PageThemeTokens }) {
  if (theme.headerDecor !== "wave") return null;
  return (
    <div className="relative h-[56px] w-full overflow-hidden" style={{ background: theme.cardBg }}>
      <svg
        className="absolute top-0 left-0 w-full"
        viewBox="0 0 400 56"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0,8 C80,40 160,0 200,20 C240,40 320,0 400,24 L400,56 L0,56 Z"
          fill={theme.headerBg}
          opacity="0.12"
        />
        <path
          d="M0,20 C100,50 300,10 400,32 L400,56 L0,56 Z"
          fill={theme.headerBg}
          opacity="0.08"
        />
      </svg>
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 400 32"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0,0 C100,28 300,0 400,16 L400,32 L0,32 Z"
          fill={theme.headerBg}
          opacity="0.18"
        />
      </svg>
    </div>
  );
}
