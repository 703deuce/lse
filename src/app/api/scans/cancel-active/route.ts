import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { cancelAllOrgScans } from "@/lib/scans/cancel-scan";
import { createServiceClient } from "@/lib/db/client";

/**
 * Cancel every queued/running Maps scan for the signed-in org.
 * Also turns off maps_campaign schedules so they do not immediately relaunch.
 */
export async function POST() {
  try {
    const auth = await requireAuth();
    const supabase = createServiceClient();

    // Stop schedules first so cron does not enqueue replacements.
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id")
      .eq("organization_id", auth.organizationId);
    const businessIds = (businesses ?? []).map((b) => b.id as string);
    if (businessIds.length) {
      await supabase
        .from("maps_campaigns")
        .update({
          schedule_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .in("business_id", businessIds)
        .eq("schedule_enabled", true);
    }

    const result = await cancelAllOrgScans({
      organizationId: auth.organizationId,
      reason: "Canceled by user",
    });

    return NextResponse.json({
      ok: true,
      cancelledScans: result.cancelledScans,
      cancelledJobs: result.cancelledJobs,
      schedulesDisabled: true,
    });
  } catch (err) {
    return httpErrorFromException(err, "Cancel active scans failed");
  }
}
