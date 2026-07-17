import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import {
  loadOrganizationReportBranding,
  updateOrganizationReportBranding,
} from "@/lib/reporting/white-label";
import { reportBrandingSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const auth = await requireAuth();
    const branding = await loadOrganizationReportBranding(auth.organizationId);
    return NextResponse.json({ branding });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load branding");
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    const parsed = reportBrandingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const branding = await updateOrganizationReportBranding(auth.organizationId, {
      logoUrl:
        parsed.data.logoUrl === ""
          ? null
          : parsed.data.logoUrl === undefined
            ? undefined
            : parsed.data.logoUrl,
      accentColor:
        parsed.data.accentColor === ""
          ? null
          : parsed.data.accentColor === undefined
            ? undefined
            : parsed.data.accentColor,
      footerText:
        parsed.data.footerText === undefined
          ? undefined
          : parsed.data.footerText?.trim() || null,
      contactLine:
        parsed.data.contactLine === undefined
          ? undefined
          : parsed.data.contactLine?.trim() || null,
      hidePlatformBranding: parsed.data.hidePlatformBranding,
    });

    return NextResponse.json({ branding });
  } catch (err) {
    return httpErrorFromException(err, "Failed to update branding");
  }
}
