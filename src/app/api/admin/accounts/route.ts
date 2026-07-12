import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { isAdminEmail, listOrganizationsForAdmin } from "@/lib/auth/admin";
import { getCurrentUsage } from "@/lib/plans";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!isAdminEmail(auth.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const orgs = await listOrganizationsForAdmin();
    const withUsage = await Promise.all(
      orgs.map(async (org) => ({
        ...org,
        usage: await getCurrentUsage(org.id),
      }))
    );

    return NextResponse.json({ accounts: withUsage });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
