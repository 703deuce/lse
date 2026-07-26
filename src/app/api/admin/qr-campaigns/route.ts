import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import {
  adminListQrCampaigns,
  adminPauseQrCampaign,
  buildQrTrackedUrl,
} from "@/lib/reputation/qr-campaigns";
import { httpErrorFromException } from "@/lib/security/http-errors";

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const url = new URL(request.url);
    const campaigns = await adminListQrCampaigns({
      q: url.searchParams.get("q") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? "100"),
    });
    return NextResponse.json({
      campaigns: campaigns.map((c) => ({
        ...c,
        trackedUrl: buildQrTrackedUrl(c.shortCode),
      })),
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to list QR campaigns");
  }
}

export async function POST(request: Request) {
  try {
    await requirePlatformAdmin();
    const body = (await request.json()) as { action?: string; campaignId?: string };
    if (body.action === "pause" && body.campaignId) {
      await adminPauseQrCampaign(body.campaignId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return httpErrorFromException(err, "Admin QR action failed");
  }
}
