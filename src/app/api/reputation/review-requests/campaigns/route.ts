import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import {
  createReviewCampaign,
  duplicateCampaign,
  listCampaigns,
  type CampaignChannel,
  type CreateCampaignInput,
} from "@/lib/reputation/campaigns";
import type { CsvMapTarget } from "@/lib/reputation/bulk-csv";
import type { ValidatedRecipient } from "@/lib/reputation/bulk-validate";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    await requireBusinessAccess(businessId);
    const campaigns = await listCampaigns(businessId);
    return NextResponse.json({ campaigns });
  } catch (err) {
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
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);

    if (duplicateFrom) {
      const result = await duplicateCampaign(duplicateFrom, businessId, auth.organizationId);
      return NextResponse.json(result);
    }

    if (!name || !recipients || !mapping) {
      return NextResponse.json({ error: "name, recipients, and mapping required" }, { status: 400 });
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
      timezone: timezone ?? "America/New_York",
      duplicateProtectionDays: duplicateProtectionDays ?? 90,
      startDate: startDate ?? new Date().toISOString().slice(0, 10),
      consentConfirmed: consentConfirmed ?? false,
      filename,
      mapping,
      recipients,
      status: status ?? "active",
    };

    const result = await createReviewCampaign(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
