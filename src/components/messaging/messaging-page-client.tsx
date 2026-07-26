"use client";

import { MessagingBusinessFormScreen } from "./messaging-business-form";
import { MessagingNumberPicker } from "./messaging-number-picker";
import { MessagingOverview } from "./messaging-overview";
import { MessagingReviewSubmit } from "./messaging-review-submit";
import { MessagingStatusScreen } from "./messaging-status";
import { MessagingLoadingSkeleton } from "./messaging-ui";
import { MessagingUseCaseFormScreen } from "./messaging-use-case-form";
import { useMessagingRegistration } from "./use-messaging-registration";
import type { MessagingRegistration, MessagingRegistrationEvent } from "@/lib/messaging/types";

export type MessagingScreen =
  | "overview"
  | "business"
  | "use_case"
  | "review"
  | "status"
  | "number";

export function MessagingPageClient({
  businessId,
  screen,
  initialRegistration,
  initialEvents,
}: {
  businessId: string;
  screen: MessagingScreen;
  initialRegistration?: MessagingRegistration;
  initialEvents?: MessagingRegistrationEvent[];
}) {
  const {
    registration,
    events,
    progress,
    nextHref,
    loading,
    saving,
    error,
    runAction,
  } = useMessagingRegistration(
    businessId,
    initialRegistration
      ? { registration: initialRegistration, events: initialEvents }
      : undefined
  );

  if (loading || !registration) {
    if (error) {
      return <p className="text-sm text-[#B42318]">{error}</p>;
    }
    return <MessagingLoadingSkeleton />;
  }

  if (screen === "business") {
    return (
      <MessagingBusinessFormScreen
        businessId={businessId}
        registration={registration}
        progress={progress}
        saving={saving}
        error={error}
        onSave={async (business) => {
          await runAction("save_business", { business });
        }}
      />
    );
  }

  if (screen === "use_case") {
    return (
      <MessagingUseCaseFormScreen
        businessId={businessId}
        registration={registration}
        progress={progress}
        saving={saving}
        error={error}
        onSave={async (useCase) => {
          await runAction("save_use_case", { useCase });
        }}
      />
    );
  }

  if (screen === "review") {
    return (
      <MessagingReviewSubmit
        businessId={businessId}
        registration={registration}
        progress={progress}
        saving={saving}
        error={error}
        onSubmit={async () => {
          await runAction("submit");
        }}
      />
    );
  }

  if (screen === "status") {
    return (
      <MessagingStatusScreen
        businessId={businessId}
        registration={registration}
        progress={progress}
        events={events}
        saving={saving}
        error={error}
        onRefresh={async () => {
          await runAction("refresh_status");
        }}
      />
    );
  }

  if (screen === "number") {
    return (
      <MessagingNumberPicker
        businessId={businessId}
        registration={registration}
        progress={progress}
        saving={saving}
        error={error}
        onPurchase={async (phoneNumber) => {
          await runAction("purchase_number", { phoneNumber });
        }}
      />
    );
  }

  return (
    <MessagingOverview
      businessId={businessId}
      registration={registration}
      progress={progress}
      events={events}
      nextHref={nextHref}
    />
  );
}
