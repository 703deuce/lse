"use client";

import { PaymentPublicPage } from "@/components/reputation/payment-qr/payment-public-page";
import {
  MOCK_CAMPAIGN,
  MOCK_CONFIG,
  TEMPLATE_SHOWCASE,
} from "@/lib/reputation/payment-qr/showcase-mock";
import { PAGE_THEMES, type PageThemeKey } from "@/lib/reputation/payment-qr/page-themes";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type PaymentThemePickerProps = {
  value: PageThemeKey;
  onChange: (theme: PageThemeKey) => void;
  businessName?: string;
};

export function PaymentThemePicker({ value, onChange, businessName }: PaymentThemePickerProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {TEMPLATE_SHOWCASE.map((item) => {
        const selected = value === item.theme;
        const config = {
          ...MOCK_CONFIG,
          ...item.configPatch,
          pageTheme: item.theme,
        };
        const campaign = {
          ...MOCK_CAMPAIGN,
          name: item.businessName,
          headline: item.businessName,
        };
        const previewBusiness = businessName?.trim() || item.businessName;

        return (
          <button
            key={item.theme}
            type="button"
            onClick={() => onChange(item.theme)}
            className={cn(
              "group relative overflow-hidden rounded-2xl border-2 text-left transition",
              selected
                ? "border-[#2563EB] bg-[#EFF6FF] shadow-[0_8px_24px_rgba(37,99,235,0.18)]"
                : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:shadow-sm"
            )}
          >
            {selected ? (
              <span
                className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-md"
                aria-hidden
              >
                <Check className="h-4 w-4" />
              </span>
            ) : null}

            <div className="relative mx-auto mt-4 h-[220px] w-full max-w-[200px] overflow-hidden rounded-[1.25rem] bg-[#E8ECF2] shadow-inner ring-1 ring-[#CBD5E1]">
              <div
                className="pointer-events-none absolute left-0 top-0 origin-top-left"
                style={{ width: 390, transform: "scale(0.52)", transformOrigin: "top left" }}
              >
                <PaymentPublicPage
                  slug={`theme-pick-${item.theme}`}
                  campaign={campaign}
                  config={config}
                  businessName={previewBusiness}
                  isPreview
                  themeOverride={item.theme}
                />
              </div>
            </div>

            <div className="px-4 pb-4 pt-3">
              <p className="text-sm font-bold text-[#0B1B32]">{PAGE_THEMES[item.theme].label}</p>
              <p className="mt-0.5 text-xs text-[#64748B]">
                {item.configPatch.description ?? "Payments, reviews & social links"}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
