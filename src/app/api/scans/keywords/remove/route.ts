import { NextResponse } from "next/server";
import { z } from "zod";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

const schema = z.object({
  businessId: z.string().uuid(),
  keywordId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose a keyword to remove." },
        { status: 400 }
      );
    }

    const { businessId, keywordId } = parsed.data;
    await requireBusinessAccess(businessId);

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("business_keywords")
      .update({ active: false })
      .eq("id", keywordId)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json(
        { error: "Could not remove that keyword." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return httpErrorFromException(err, "Could not remove that keyword");
  }
}
