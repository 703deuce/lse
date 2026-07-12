import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { applyMapping, type CsvMapTarget } from "@/lib/reputation/bulk-csv";
import { validateBulkRecipients } from "@/lib/reputation/bulk-validate";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      businessId,
      headers,
      rows,
      mapping,
      duplicateProtectionDays,
    } = body as {
      businessId?: string;
      headers?: string[];
      rows?: string[][];
      mapping?: Record<string, CsvMapTarget>;
      duplicateProtectionDays?: number;
    };

    if (!businessId || !headers?.length || !rows || !mapping) {
      return NextResponse.json({ error: "businessId, headers, rows, and mapping required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    const mapped = applyMapping(headers, rows, mapping);
    const result = await validateBulkRecipients({
      businessId,
      rows: mapped,
      duplicateProtectionDays: duplicateProtectionDays ?? 90,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
