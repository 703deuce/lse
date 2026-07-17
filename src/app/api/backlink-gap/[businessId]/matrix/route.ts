import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { queryBacklinkGapMatrix } from "@/lib/backlink-gap/engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);

    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "10");

    const data = await queryBacklinkGapMatrix({ businessId, page, pageSize });
    return NextResponse.json(data);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load matrix");
  }
}
