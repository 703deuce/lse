import {
  createAndSubmitSecondaryCustomerProfile,
  createCustomerSubaccount,
  refreshLiveRegistrationStatus,
} from "./twilio-adapter";
import { isLiveTwilioMessaging } from "./twilio-config";
import {
  mockPurchaseNumber,
  mockReconcileStatus,
  mockSearchNumbers,
  mockSubmitRegistration,
} from "./mock-adapter";
import {
  appendEvents,
  getRegistration,
  listAllRegistrations,
  listEvents,
  saveRegistration,
} from "./store";
import type {
  AvailablePhoneNumber,
  MessagingBusinessForm,
  MessagingRegistration,
  MessagingRegistrationEvent,
  MessagingUseCaseForm,
} from "./types";

function useLiveAdapter(reg: MessagingRegistration): boolean {
  return isLiveTwilioMessaging() || reg.adapterMode === "twilio";
}

export const messagingOnboarding = {
  async getCustomerAccount(params: {
    organizationId: string;
    businessId: string;
    businessName: string;
  }): Promise<{ registration: MessagingRegistration; events: MessagingRegistrationEvent[] }> {
    const registration = await getRegistration(params);
    const events = await listEvents(params.businessId);
    return { registration, events };
  },

  /** Start Registration: ensure draft exists; in live mode create subaccount (idempotent). */
  async startRegistration(params: {
    organizationId: string;
    businessId: string;
    businessName: string;
  }): Promise<MessagingRegistration> {
    let current = await getRegistration(params);
    if (current.setupStep === "overview") {
      current = await saveRegistration({
        ...current,
        setupStep: "business",
        overallStatus:
          current.overallStatus === "not_started" ? "action_required" : current.overallStatus,
        adapterMode: isLiveTwilioMessaging() ? "twilio" : current.adapterMode,
      });
    }

    if (!useLiveAdapter(current)) {
      await appendEvents(current, [
        {
          eventType: "registration_started",
          message: "Text messaging registration started (mock mode).",
        },
      ]);
      return current;
    }

    try {
      const result = await createCustomerSubaccount(current);
      const saved = await saveRegistration(result.registration);
      await appendEvents(saved, [
        {
          eventType: "registration_started",
          message: "Text messaging registration started.",
        },
        ...result.events,
      ]);
      return saved;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failed = await saveRegistration({
        ...current,
        lastError: message,
        adapterMode: "twilio",
      });
      await appendEvents(failed, [
        {
          eventType: "subaccount_create_failed",
          message: `Failed to create Twilio subaccount: ${message}`,
        },
      ]);
      throw new Error(message);
    }
  },

  async saveBusinessProfile(params: {
    organizationId: string;
    businessId: string;
    businessName: string;
    business: MessagingBusinessForm;
  }): Promise<MessagingRegistration> {
    const current = await getRegistration(params);
    const incomplete =
      !params.business.legalBusinessName.trim() ||
      !params.business.ein.trim() ||
      !params.business.authRepFullName.trim() ||
      !params.business.authRepEmail.trim() ||
      !params.business.businessIdentity;
    const next: MessagingRegistration = {
      ...current,
      business: params.business,
      businessDetailsStatus: incomplete ? "action_required" : "submitted",
      setupStep: incomplete ? "business" : "use_case",
      overallStatus:
        current.overallStatus === "not_started" ? "action_required" : current.overallStatus,
      brandType:
        params.business.businessIdentity === "sole_proprietor"
          ? "SOLE_PROPRIETOR"
          : useLiveAdapter(current)
            ? "STANDARD"
            : "LOW_VOLUME",
      adapterMode: isLiveTwilioMessaging() ? "twilio" : current.adapterMode,
    };
    const saved = await saveRegistration(next);
    await appendEvents(saved, [
      {
        eventType: "business_profile_saved",
        message: incomplete
          ? "Business details saved as draft — complete required fields to continue."
          : "Business details saved.",
      },
    ]);
    return saved;
  },

  async saveUseCase(params: {
    organizationId: string;
    businessId: string;
    businessName: string;
    useCase: MessagingUseCaseForm;
  }): Promise<MessagingRegistration> {
    const current = await getRegistration(params);
    const incomplete =
      !params.useCase.campaignDescription.trim() ||
      !params.useCase.optInMethod.trim() ||
      !params.useCase.privacyPolicyUrl.trim() ||
      !params.useCase.termsUrl.trim() ||
      params.useCase.sampleMessages.filter((m) => m.trim()).length < 2;
    const next: MessagingRegistration = {
      ...current,
      useCase: params.useCase,
      useCaseStatus: incomplete ? "action_required" : "submitted",
      setupStep: incomplete ? "use_case" : "review",
    };
    const saved = await saveRegistration(next);
    await appendEvents(saved, [
      {
        eventType: "use_case_saved",
        message: incomplete
          ? "Messaging use case saved as draft — finish consent and sample messages."
          : "Messaging use case saved.",
      },
    ]);
    return saved;
  },

  async submitBusinessProfile(params: {
    organizationId: string;
    businessId: string;
    businessName: string;
  }): Promise<MessagingRegistration> {
    const current = await getRegistration(params);
    if (
      !current.business.certAuthorized ||
      !current.business.certAccurate ||
      !current.business.certUnderstandsDelays
    ) {
      throw new Error("All certifications are required before submission.");
    }
    if (
      current.businessDetailsStatus === "not_started" ||
      current.businessDetailsStatus === "action_required"
    ) {
      throw new Error("Complete business details before submitting.");
    }
    if (
      current.useCaseStatus === "not_started" ||
      current.useCaseStatus === "action_required"
    ) {
      throw new Error("Complete messaging use case before submitting.");
    }

    if (!useLiveAdapter(current)) {
      const result = mockSubmitRegistration(current);
      const saved = await saveRegistration(result.registration);
      await appendEvents(saved, result.events);
      return saved;
    }

    // Ensure subaccount exists, then create/submit Secondary Customer Profile.
    let working = current;
    const sub = await createCustomerSubaccount(working);
    working = await saveRegistration(sub.registration);
    await appendEvents(working, sub.events);

    const profile = await createAndSubmitSecondaryCustomerProfile(working);
    const saved = await saveRegistration(profile.registration);
    await appendEvents(saved, profile.events);

    if (
      saved.businessDetailsStatus === "action_required" &&
      saved.twilio.profileFailureReasons.length
    ) {
      throw new Error(
        saved.lastError ||
          saved.twilio.profileFailureReasons[0] ||
          "Secondary Customer Profile submission failed."
      );
    }
    return saved;
  },

  async registerBrand(params: {
    organizationId: string;
    businessId: string;
    businessName: string;
  }): Promise<MessagingRegistration> {
    return this.refreshStatus(params);
  },

  async submitCampaign(params: {
    organizationId: string;
    businessId: string;
    businessName: string;
  }): Promise<MessagingRegistration> {
    return this.refreshStatus(params);
  },

  async searchNumbers(params: {
    areaCode?: string;
    city?: string;
    postalCode?: string;
    contains?: string;
  }): Promise<AvailablePhoneNumber[]> {
    return mockSearchNumbers(params);
  },

  async purchaseNumber(params: {
    organizationId: string;
    businessId: string;
    businessName: string;
    phoneNumber: string;
  }): Promise<MessagingRegistration> {
    const current = await getRegistration(params);
    const matches = mockSearchNumbers({});
    const selected = matches.find((row) => row.phoneNumber === params.phoneNumber);
    if (!selected) throw new Error("Selected number is no longer available.");
    const result = mockPurchaseNumber(current, selected);
    const saved = await saveRegistration(result.registration);
    await appendEvents(saved, result.events);
    return saved;
  },

  async activateMessaging(params: {
    organizationId: string;
    businessId: string;
    businessName: string;
  }): Promise<MessagingRegistration> {
    const current = await getRegistration(params);
    if (current.campaignReviewStatus !== "approved" || !current.phoneNumberE164) {
      throw new Error("Campaign must be approved and a number assigned before activation.");
    }
    const next: MessagingRegistration = {
      ...current,
      messagingEnabled: true,
      messagingPaused: false,
      messagingStatus: "ready",
      overallStatus: "ready",
      setupStep: "ready",
      numberStatus: "approved",
    };
    const saved = await saveRegistration(next);
    await appendEvents(saved, [
      { eventType: "messaging_enabled", message: "Text messaging is now active." },
    ]);
    return saved;
  },

  async refreshStatus(params: {
    organizationId: string;
    businessId: string;
    businessName: string;
  }): Promise<MessagingRegistration> {
    const current = await getRegistration(params);
    if (useLiveAdapter(current)) {
      if (!current.twilio.customerProfileSid) return current;
      try {
        const result = await refreshLiveRegistrationStatus(current);
        const saved = await saveRegistration(result.registration);
        await appendEvents(saved, result.events);
        return saved;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const failed = await saveRegistration({
          ...current,
          lastError: message,
          lastStatusCheckedAt: new Date().toISOString(),
        });
        await appendEvents(failed, [
          {
            eventType: "status_refresh_failed",
            message: `Failed to refresh Twilio status: ${message}`,
          },
        ]);
        throw new Error(message);
      }
    }
    if (!current.submittedAt) return current;
    const result = mockReconcileStatus(current);
    const saved = await saveRegistration(result.registration);
    await appendEvents(saved, result.events);
    return saved;
  },

  async listCustomers(): Promise<MessagingRegistration[]> {
    return listAllRegistrations();
  },

  async adminUpdate(params: {
    businessId: string;
    organizationId: string;
    businessName: string;
    patch: Partial<
      Pick<
        MessagingRegistration,
        | "overallStatus"
        | "businessDetailsStatus"
        | "brandVerificationStatus"
        | "campaignReviewStatus"
        | "numberStatus"
        | "messagingStatus"
        | "adminNotes"
        | "messagingPaused"
        | "messagingEnabled"
      >
    >;
  }): Promise<MessagingRegistration> {
    const current = await getRegistration(params);
    const saved = await saveRegistration({ ...current, ...params.patch });
    await appendEvents(saved, [
      {
        eventType: "admin_override",
        message: "Admin updated registration fields.",
        payload: params.patch as Record<string, unknown>,
        source: "admin",
      },
    ]);
    return saved;
  },
};
