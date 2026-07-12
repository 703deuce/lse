import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "not_configured",
    message: "Google OAuth callback placeholder.",
  });
}
