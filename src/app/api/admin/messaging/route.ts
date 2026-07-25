import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { messagingOnboarding } from "@/lib/messaging/service";
import { httpErrorFromException } from "@/lib/security/http-errors";

export async function GET() {
  try {
    await requirePlatformAdmin();
    const registrations = await messagingOnboarding.listCustomers();
    return NextResponse.json({ registrations });
  } catch (err) {
    return httpErrorFromException(err, "Failed to list messaging customers");
  }
}
