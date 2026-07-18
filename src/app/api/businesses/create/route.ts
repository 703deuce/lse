import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { setBusinessGeom } from "@/lib/db/geo";
import { parseUsAddressCityState } from "@/lib/geo/us-address";
import { assertWithinLimit, PlanLimitError } from "@/lib/plans";
import { createBusinessSchema } from "@/lib/validation/schemas";
import { trackProductEvent } from "@/lib/analytics/product-events";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    const parsed = createBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const data = parsed.data;
    const supabase = createServiceClient();

    const isTracked = (body as { isTracked?: boolean }).isTracked !== false;

    // Tracked businesses consume plan slots; manual audits may set isTracked: false.
    if (isTracked) {
      await assertWithinLimit(auth.organizationId, "max_businesses", 1);
    }

    const publicAddress = data.address_text?.trim() || null;
    const scanCenterLabel = data.scan_center_label?.trim() || null;
    const scanCenterLat = data.scan_center_lat ?? data.lat ?? null;
    const scanCenterLng = data.scan_center_lng ?? data.lng ?? null;
    const hasUsableScanCenter =
      scanCenterLat != null &&
      scanCenterLng != null &&
      Number.isFinite(Number(scanCenterLat)) &&
      Number.isFinite(Number(scanCenterLng)) &&
      !(Number(scanCenterLat) === 0 && Number(scanCenterLng) === 0);

    // Service-area / hidden-address listings must save a private scan center
    // so Maps grids have a real pin without re-entering every scan.
    if (!publicAddress && (!scanCenterLabel || !hasUsableScanCenter)) {
      return NextResponse.json(
        {
          error:
            "This listing has no public address. Add a private scan-center address before saving.",
        },
        { status: 400 }
      );
    }

    const { data: business, error } = await supabase
      .from("businesses")
      .insert({
        organization_id: auth.organizationId,
        name: data.name,
        website_url: data.website_url ?? null,
        phone: data.phone ?? null,
        address_text: publicAddress,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        place_id: data.place_id ?? null,
        cid: data.cid ?? null,
        primary_category: data.primary_category ?? null,
        service_area_mode: data.service_area_mode ?? "storefront",
        scan_center_lat: scanCenterLat,
        scan_center_lng: scanCenterLng,
        scan_center_label: scanCenterLabel ?? publicAddress,
        is_tracked: isTracked,
        tracking_source: isTracked ? "manual" : "manual",
        account_type: isTracked ? "client" : "prospect",
        prospect_status: isTracked ? null : "new",
      })
      .select("*")
      .single();

    // If freelancer CRM columns are not migrated yet, retry without them.
    let businessRow = business;
    let createError = error;
    if (createError && /account_type|prospect_status/i.test(createError.message)) {
      const retry = await supabase
        .from("businesses")
        .insert({
          organization_id: auth.organizationId,
          name: data.name,
          website_url: data.website_url ?? null,
          phone: data.phone ?? null,
          address_text: publicAddress,
          lat: data.lat ?? null,
          lng: data.lng ?? null,
          place_id: data.place_id ?? null,
          cid: data.cid ?? null,
          primary_category: data.primary_category ?? null,
          service_area_mode: data.service_area_mode ?? "storefront",
          scan_center_lat: scanCenterLat,
          scan_center_lng: scanCenterLng,
          scan_center_label: scanCenterLabel ?? publicAddress,
          is_tracked: isTracked,
          tracking_source: "manual",
        })
        .select("*")
        .single();
      businessRow = retry.data;
      createError = retry.error;
    }

    if (createError || !businessRow) {
      return NextResponse.json(
        { error: createError?.message ?? "Create failed" },
        { status: 500 }
      );
    }
    const createdBusiness = businessRow;

    const geomLat = createdBusiness.scan_center_lat ?? createdBusiness.lat;
    const geomLng = createdBusiness.scan_center_lng ?? createdBusiness.lng;
    if (geomLat && geomLng) {
      await setBusinessGeom(createdBusiness.id, geomLng, geomLat);
    }

    let campaignId: string | null = null;
    const { data: campaign, error: campaignError } = await supabase
      .from("maps_campaigns")
      .insert({
        business_id: createdBusiness.id,
        name: "Primary keywords",
        description: isTracked ? "Default client campaign" : "Prospect audit keywords",
      })
      .select("id")
      .maybeSingle();
    if (!campaignError && campaign?.id) {
      campaignId = campaign.id;
    }

    if (data.keyword) {
      const fromAddress = parseUsAddressCityState(scanCenterLabel ?? publicAddress);
      const keywordInsert: Record<string, unknown> = {
        business_id: createdBusiness.id,
        keyword: data.keyword.trim(),
        is_primary: true,
        city: data.city ?? fromAddress.city,
        state: data.state ?? fromAddress.state,
        country: data.country ?? "US",
      };
      if (campaignId) {
        keywordInsert.campaign_id = campaignId;
        keywordInsert.active = true;
        keywordInsert.sort_order = 0;
      }
      const { error: keywordError } = await supabase
        .from("business_keywords")
        .insert(keywordInsert);
      if (keywordError) {
        return NextResponse.json(
          { error: `Business created but primary keyword failed: ${keywordError.message}` },
          { status: 500 }
        );
      }
    }

    trackProductEvent(isTracked ? "client_created" : "prospect_created", {
      organizationId: auth.organizationId,
      businessId: createdBusiness.id,
    });

    return NextResponse.json({ business: createdBusiness });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    return httpErrorFromException(err, "Create failed");
  }
}
