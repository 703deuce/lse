import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import {
  loadBusinessNextBestActions,
  loadOrgNextBestActions,
  loadOrgSetupProgress,
} from "@/lib/journey/next-best-actions";
import { httpErrorFromException } from "@/lib/security/http-errors";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const mode = url.searchParams.get("mode") as "prospect" | "client" | null;
    const includeSetup = url.searchParams.get("setup") === "1";

    if (businessId) {
      const auth = await requireBusinessAccess(businessId);
      const actions = await loadBusinessNextBestActions(businessId, {
        mode: mode ?? undefined,
        limit: 6,
      });
      return NextResponse.json({
        actions,
        organizationId: auth.organizationId,
      });
    }

    const auth = await requireAuth();
    const [actions, setup] = await Promise.all([
      loadOrgNextBestActions(auth.organizationId, { limit: 5 }),
      includeSetup ? loadOrgSetupProgress(auth.organizationId) : Promise.resolve(null),
    ]);
    return NextResponse.json({ actions, setup });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load next actions");
  }
}
