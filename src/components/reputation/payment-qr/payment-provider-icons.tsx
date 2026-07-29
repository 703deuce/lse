import type { ReactElement } from "react";
import type { PaymentProvider } from "@/lib/reputation/payment-qr/types";
import { cn } from "@/lib/utils";

type IconProps = {
  className?: string;
  variant?: "color" | "mono";
};

export function StripeApplePayIcon({ className, variant = "color" }: IconProps) {
  if (variant === "mono") {
    return (
      <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
        <rect x="4" y="10" width="32" height="22" rx="4" stroke="currentColor" strokeWidth="2" />
        <rect x="4" y="14" width="32" height="4" fill="currentColor" opacity="0.35" />
        <rect x="8" y="22" width="10" height="6" rx="1.5" fill="currentColor" opacity="0.5" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#635BFF" />
      <rect x="8" y="12" width="24" height="16" rx="3" fill="white" opacity="0.95" />
      <rect x="8" y="15" width="24" height="4" fill="#635BFF" opacity="0.25" />
      <rect x="11" y="21" width="9" height="5" rx="1" fill="#C4B5FD" />
      <path
        d="M22 24.5c0-1.2 1-1.8 1.7-1.8.5 0 .9.3 1.1.5l.8-.8c-.5-.5-1.2-.8-2-.8-1.9 0-3.1 1.3-3.1 3.1 0 1.9 1.2 3.1 3.2 3.1.8 0 1.5-.3 2-.8l-.8-.8c-.3.3-.7.5-1.2.5-.7 0-1.6-.6-1.6-1.9z"
        fill="#1A1A1A"
      />
    </svg>
  );
}

export function VenmoIcon({ className, variant = "color" }: IconProps) {
  if (variant === "mono") {
    return (
      <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
        <path
          d="M28.5 8.5c-2.8 3.8-5.2 8.2-7 12.8 2.3-1 4.8-1.5 7.5-1.5 1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5c-5.2 0-9.5-2.1-12.5-5.5C8.5 22.5 6 28 4.5 32.5h5.5c1.5-4 3.5-7.5 6-10.5 1.5 1.2 3.5 2 5.5 2.5-1.5 3-2.5 6.5-3 10h5.5c.5-4.5 2-9 4.5-13 2-3 4.5-5.5 7.5-7.5l-2.5-4z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#3D95CE" />
      <path
        d="M28.5 8.5c-2.8 3.8-5.2 8.2-7 12.8 2.3-1 4.8-1.5 7.5-1.5 1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5c-5.2 0-9.5-2.1-12.5-5.5C8.5 22.5 6 28 4.5 32.5h5.5c1.5-4 3.5-7.5 6-10.5 1.5 1.2 3.5 2 5.5 2.5-1.5 3-2.5 6.5-3 10h5.5c.5-4.5 2-9 4.5-13 2-3 4.5-5.5 7.5-7.5l-2.5-4z"
        fill="white"
        transform="translate(4, 2) scale(0.85)"
      />
    </svg>
  );
}

export function CashAppIcon({ className, variant = "color" }: IconProps) {
  if (variant === "mono") {
    return (
      <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
        <path
          d="M20 6c-7.7 0-14 6.3-14 14s6.3 14 14 14 14-6.3 14-14-6.3-14-14-14zm1.5 21.5h-3v-2.5h3c1.4 0 2.5-1.1 2.5-2.5s-1.1-2.5-2.5-2.5h-3v-2.5h3c2.8 0 5 2.2 5 5s-2.2 5-5 5zm-1.5-11h-3v-2.5h3c2.8 0 5 2.2 5 5h-2.5c0-1.4-1.1-2.5-2.5-2.5z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#00D632" />
      <path
        d="M20 9c-6.1 0-11 4.9-11 11s4.9 11 11 11 11-4.9 11-11-4.9-11-11-11zm1.5 18.5h-3v-2.5h3c1.4 0 2.5-1.1 2.5-2.5s-1.1-2.5-2.5-2.5h-3v-2.5h3c2.8 0 5 2.2 5 5s-2.2 5-5 5zm-1.5-11h-3v-2.5h3c2.8 0 5 2.2 5 5h-2.5c0-1.4-1.1-2.5-2.5-2.5z"
        fill="white"
      />
    </svg>
  );
}

export function PayPalIcon({ className, variant = "color" }: IconProps) {
  if (variant === "mono") {
    return (
      <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
        <path
          d="M14 10h6.5c3.5 0 5.5 1.8 5 4.5-.5 2.5-2.8 4-5.5 4H15l-1 6h-4l3-14.5zm2 8h3.5c2 0 3.2-1.2 3.5-3-.3-1.5-1.5-2.5-3.2-2.5H16l-1 5.5z"
          fill="currentColor"
        />
        <path
          d="M24 18.5h4l-1 5.5h-4l1-5.5zm1.5-8.5h6l-.5 2.5h-5.5l.5-2.5zm-1 5h5.5l-.5 2.5H25l.5-2.5z"
          fill="currentColor"
          opacity="0.75"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#003087" />
      <path
        d="M14 11h6.5c3.5 0 5.5 1.8 5 4.5-.5 2.5-2.8 4-5.5 4H15l-1 6h-4l3-14.5zm2 8h3.5c2 0 3.2-1.2 3.5-3-.3-1.5-1.5-2.5-3.2-2.5H16l-1 5.5z"
        fill="white"
      />
      <path
        d="M24 19.5h4l-1 5.5h-4l1-5.5zm1.5-8.5h6l-.5 2.5h-5.5l.5-2.5zm-1 5h5.5l-.5 2.5H25l.5-2.5z"
        fill="#009CDE"
      />
    </svg>
  );
}

export function ZelleIcon({ className, variant = "color" }: IconProps) {
  if (variant === "mono") {
    return (
      <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
        <path
          d="M26 10L14 22h8l-2 12 14-14h-8l2-14z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#6D1ED4" />
      <path
        d="M26 11L14 23h8l-2 12 14-14h-8l2-14z"
        fill="white"
        stroke="white"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICON_MAP: Record<PaymentProvider, (props: IconProps) => ReactElement> = {
  stripe: StripeApplePayIcon,
  venmo: VenmoIcon,
  cash_app: CashAppIcon,
  paypal: PayPalIcon,
  zelle: ZelleIcon,
};

export function PaymentProviderIcon({
  provider,
  className,
  variant = "color",
}: {
  provider: PaymentProvider;
  className?: string;
  variant?: "color" | "mono";
}) {
  const Icon = ICON_MAP[provider];
  return (
    <Icon
      className={cn("h-10 w-10 shrink-0", className)}
      variant={variant}
    />
  );
}
