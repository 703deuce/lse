import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  console.log("Google Business Profile notification:", body);
  return NextResponse.json({ received: true });
}
