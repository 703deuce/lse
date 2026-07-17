import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requirePlatformAdmin, listOrganizationsForAdmin } from "@/lib/auth/admin";
import { getCurrentUsage } from "@/lib/plans";

export async function GET() {
  try {
    await requirePlatformAdmin();
    const orgs = await listOrganizationsForAdmin();
    const withUsage = await Promise.all(
      orgs.map(async (org) => ({
        ...org,
        usage: await getCurrentUsage(org.id),
      }))
    );

    return NextResponse.json({ accounts: withUsage });
  } catch (err) {
    return httpErrorFromException(err);
  }
}
