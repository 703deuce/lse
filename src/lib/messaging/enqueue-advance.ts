import { dispatchFeatureJob } from "@/lib/queue/dispatch";

/** Enqueue (or reuse) the registration state-machine job for a business. */
export async function enqueueMessagingRegistrationAdvance(params: {
  organizationId: string;
  businessId: string;
  businessName: string;
  delayMs?: number;
}): Promise<void> {
  await dispatchFeatureJob({
    jobType: "messaging_registration_advance",
    payload: {
      organizationId: params.organizationId,
      businessId: params.businessId,
      businessName: params.businessName,
    },
    organizationId: params.organizationId,
    businessId: params.businessId,
    relatedResourceId: params.businessId,
    idempotencyKey: `messaging-registration-advance:${params.businessId}`,
    priority: "normal",
    delayMs: params.delayMs,
    maxAttempts: 50,
  });
}
