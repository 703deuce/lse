"use client";

import { PaymentPublicPage } from "@/components/reputation/payment-qr/payment-public-page";
import {
  MOCK_CAMPAIGN,
  MOCK_CONFIG,
  TEMPLATE_SHOWCASE,
} from "@/lib/reputation/payment-qr/showcase-mock";
import { PAGE_THEMES } from "@/lib/reputation/payment-qr/page-themes";

export function PaymentTemplatesShowcase() {
  return (
    <div className="min-h-screen bg-[#E8ECF2] px-4 py-8">
      <div className="mx-auto max-w-[1600px]">
        <h1 className="text-2xl font-extrabold text-[#0B1B32]">Pay &amp; Review Page templates</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          Five mobile-first hosted page themes — payments, reviews, and social links on one page.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-5">
          {TEMPLATE_SHOWCASE.map((item) => {
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
            return (
              <div key={item.theme} id={`template-${item.theme}`}>
                <p className="mb-3 text-center text-sm font-bold text-[#0B1B32]">
                  {PAGE_THEMES[item.theme].label}
                </p>
                <div className="overflow-hidden rounded-[2rem] border-4 border-[#0B1B32] shadow-xl">
                  <div className="h-[780px] overflow-y-auto">
                    <PaymentPublicPage
                      slug={`preview-${item.theme}`}
                      campaign={campaign}
                      config={config}
                      businessName={item.businessName}
                      isPreview
                      themeOverride={item.theme}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
