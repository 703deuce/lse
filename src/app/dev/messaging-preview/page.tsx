"use client";

import { useMemo, useState } from "react";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { AdminMessagingDetail } from "@/components/messaging/admin-messaging-detail";
import { AdminMessagingList } from "@/components/messaging/admin-messaging-list";
import { MessagingPageClient } from "@/components/messaging/messaging-page-client";
import {
  MESSAGING_ADMIN_PREVIEW_ROWS,
  MESSAGING_PREVIEW_BUSINESS_ID,
  MESSAGING_PREVIEW_BUSINESS_NAME,
  messagingPreviewRegistration,
} from "@/lib/messaging/preview-data";
import type { MessagingRegistration } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";

const SCREENS = [
  { id: "overview", label: "1. Overview" },
  { id: "business", label: "2. Business info" },
  { id: "use_case", label: "3. Use case" },
  { id: "review", label: "4. Review & submit" },
  { id: "status", label: "5. Registration status" },
  { id: "number", label: "6. Choose number" },
  { id: "dashboard", label: "7. Messaging dashboard" },
  { id: "admin_list", label: "8. Admin customers" },
  { id: "admin_detail", label: "9. Admin detail" },
] as const;

function draftRegistration(base: MessagingRegistration): MessagingRegistration {
  return {
    ...base,
    setupStep: "review",
    overallStatus: "action_required",
    businessDetailsStatus: "submitted",
    useCaseStatus: "submitted",
    brandVerificationStatus: "not_started",
    campaignReviewStatus: "not_started",
    numberStatus: "not_started",
    messagingStatus: "not_started",
    submittedAt: null,
    messagingEnabled: false,
    phoneNumberE164: null,
    phoneNumberFriendly: null,
    phoneNumberReserved: false,
  };
}

export default function MessagingPreviewPage() {
  const [screenId, setScreenId] = useState<(typeof SCREENS)[number]["id"]>("overview");

  const empty = useMemo(() => messagingPreviewRegistration("empty"), []);
  const filled = useMemo(() => draftRegistration(messagingPreviewRegistration("in_review")), []);
  const inReview = useMemo(() => messagingPreviewRegistration("in_review"), []);
  const ready = useMemo(() => messagingPreviewRegistration("ready"), []);

  const path = `/businesses/${MESSAGING_PREVIEW_BUSINESS_ID}/reputation/messaging`;

  const customerScreen =
    screenId === "business"
      ? "business"
      : screenId === "use_case"
        ? "use_case"
        : screenId === "review"
          ? "review"
          : screenId === "status"
            ? "status"
            : screenId === "number"
              ? "number"
              : "overview";

  const registration =
    screenId === "dashboard"
      ? ready
      : screenId === "status" || screenId === "number"
        ? inReview
        : screenId === "overview"
          ? empty
          : filled;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={MESSAGING_PREVIEW_BUSINESS_ID}
        pathname={path}
        businessName={MESSAGING_PREVIEW_BUSINESS_NAME}
        staticLinks
        showFooter={false}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <div className="mb-4 space-y-2" data-screenshot-nav>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
            Developer preview only — not shown in production. Customers use Back / Continue.
          </p>
          <div className="flex flex-wrap gap-2">
            {SCREENS.map((screen) => (
              <button
                key={screen.id}
                type="button"
                data-screen={screen.id}
                onClick={() => setScreenId(screen.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-90",
                  screenId === screen.id
                    ? "bg-[#137752] text-white"
                    : "bg-white text-[#667085] ring-1 ring-[#E6EAF0]"
                )}
              >
                {screen.label}
              </button>
            ))}
          </div>
        </div>

        <div data-messaging-screen={screenId}>
          {screenId === "admin_list" ? (
            <AdminMessagingList initialRegistrations={MESSAGING_ADMIN_PREVIEW_ROWS} />
          ) : screenId === "admin_detail" ? (
            <AdminMessagingDetail
              businessId={MESSAGING_PREVIEW_BUSINESS_ID}
              initialRegistration={inReview}
              initialEvents={[
                {
                  id: "evt-1",
                  eventType: "registration_submitted",
                  source: "system",
                  message: "Application submitted for business verification and brand registration.",
                  payload: {},
                  createdAt: new Date().toISOString(),
                },
                {
                  id: "evt-2",
                  eventType: "customer_profile_approved",
                  source: "mock",
                  message: "Business profile approved.",
                  payload: {},
                  createdAt: new Date().toISOString(),
                },
              ]}
            />
          ) : (
            <MessagingPageClient
              key={screenId}
              businessId={MESSAGING_PREVIEW_BUSINESS_ID}
              screen={customerScreen}
              initialRegistration={registration}
              initialEvents={
                screenId === "status" || screenId === "dashboard"
                  ? [
                      {
                        id: "evt-1",
                        eventType: "registration_submitted",
                        source: "system",
                        message: "Application submitted for business verification and brand registration.",
                        payload: {},
                        createdAt: new Date().toISOString(),
                      },
                      {
                        id: "evt-2",
                        eventType: "brand_pending",
                        source: "mock",
                        message: "Brand registration is in review.",
                        payload: {},
                        createdAt: new Date().toISOString(),
                      },
                    ]
                  : []
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}
