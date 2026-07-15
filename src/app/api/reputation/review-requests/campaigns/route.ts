import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import { createServiceClient } from "@/lib/db/client";
import {
  createReviewCampaign,
  duplicateCampaign,
  listCampaigns,
  type CampaignChannel,
  type CreateCampaignInput,
} from "@/lib/reputation/campaigns";
import type { CsvMapTarget } from "@/lib/reputation/bulk-csv";
import type { ValidatedRecipient } from "@/lib/reputation/bulk-validate";
import { PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";
import { ymdInTimeZone } from "@/lib/reputation/campaign-scheduler";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");
    const campaigns = await listCampaigns(businessId);
    return NextResponse.json({ campaigns });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to list campaigns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      businessId,
      duplicateFrom,
      name,
      channel,
      templateId,
      dailySendLimit,
      sendDays,
      sendWindowStart,
      sendWindowEnd,
      timezone,
      duplicateProtectionDays,
      startDate,
      consentConfirmed,
      filename,
      mapping,
      recipients,
      status,
      sequence,
      description,
    } = body as {
      businessId?: string;
      duplicateFrom?: string;
      name?: string;
      channel?: CampaignChannel;
      templateId?: string | null;
      dailySendLimit?: number;
      sendDays?: number[];
      sendWindowStart?: string;
      sendWindowEnd?: string;
      timezone?: string;
      duplicateProtectionDays?: number;
      startDate?: string;
      consentConfirmed?: boolean;
      filename?: string;
      mapping?: Record<string, CsvMapTarget>;
      recipients?: ValidatedRecipient[];
      status?: "draft" | "scheduled" | "active";
      sequence?: CreateCampaignInput["sequence"];
      description?: string | null;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    if (duplicateFrom) {
      const supabase = createServiceClient();
      const { data: sourceCampaign } = await supabase
        .from("review_request_campaigns")
        .select("id")
        .eq("id", duplicateFrom)
        .eq("business_id", businessId)
        .maybeSingle();
      if (!sourceCampaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
      const { data: peekRecs } = await supabase
        .from("review_request_recipients")
        .select("status")
        .eq("campaign_id", duplicateFrom)
        .eq("business_id", businessId);
      const readyCount = (peekRecs ?? []).filter((r) => r.status === "ready").length;

      if (readyCount > 0) {
        await reserveUsageOrThrow(auth.organizationId, "bulk_review_requests_used", readyCount);
      }
      try {
        const result = await duplicateCampaign(duplicateFrom, businessId, auth.organizationId);
        return NextResponse.json(result);
      } catch (dupErr) {
        if (readyCount > 0) {
          await releaseUsage(auth.organizationId, "bulk_review_requests_used", readyCount).catch(
            () => undefined
          );
        }
        throw dupErr;
      }
    }

    if (!name || !recipients || !mapping) {
      return NextResponse.json({ error: "name, recipients, and mapping required" }, { status: 400 });
    }

    const tz = timezone ?? "America/New_York";
    const readyCount = recipients.filter((r) => r.status === "ready").length;
    if (readyCount > 0) {
      await reserveUsageOrThrow(auth.organizationId, "bulk_review_requests_used", readyCount);
    }

    const input: CreateCampaignInput = {
      organizationId: auth.organizationId,
      businessId,
      name,
      channel: channel ?? "both",
      templateId,
      dailySendLimit: dailySendLimit ?? 10,
      sendDays: sendDays ?? [1, 2, 3, 4, 5],
      sendWindowStart: sendWindowStart ?? "10:00",
      sendWindowEnd: sendWindowEnd ?? "18:00",
      timezone: tz,
      duplicateProtectionDays: duplicateProtectionDays ?? 90,
      startDate: startDate ?? ymdInTimeZone(new Date(), tz),
      consentConfirmed: consentConfirmed ?? false,
      filename,
      mapping,
      recipients,
      status: status ?? "active",
      sequence,
      description: description ?? null,
    };

    try {
      const result = await createReviewCampaign(input);
      return NextResponse.json(result);
    } catch (createErr) {
      if (readyCount > 0) {
        await releaseUsage(auth.organizationId, "bulk_review_requests_used", readyCount).catch(
          () => undefined
        );
      }
      throw createErr;
    }
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Failed to create campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
