import { getConnectionStatus } from "@/lib/providers/google-business-profile";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(getConnectionStatus());
}

export async function POST() {
  return NextResponse.json(
    { error: "Google OAuth requires Firebase auth + GCP Business Profile API approval." },
    { status: 501 }
  );
}
