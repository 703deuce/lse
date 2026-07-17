import { getConnectionStatus } from "@/lib/providers/google-business-profile";
import { requireAuth } from "@/lib/auth/context";
import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";

export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json(getConnectionStatus());
  } catch (err) {
    return httpErrorFromException(err);
  }
}

export async function POST() {
  try {
    await requireAuth();
    return NextResponse.json(
      { error: "Google OAuth requires Firebase auth + GCP Business Profile API approval." },
      { status: 501 }
    );
  } catch (err) {
    return httpErrorFromException(err);
  }
}
