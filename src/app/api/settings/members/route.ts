import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/client";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { requireRecentAuth } from "@/lib/auth/reauth";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";

const inviteSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(["admin", "member", "assistant", "readonly"]).default("assistant"),
});

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "member", "assistant", "readonly"]),
});

export async function GET() {
  try {
    const auth = await requireOrganizationPermission("member.invite");
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("user_id, role, created_at")
      .eq("organization_id", auth.organizationId)
      .order("created_at", { ascending: true });
    if (error) {
      return NextResponse.json({ error: "Request could not be completed" }, { status: 500 });
    }

    const members = [];
    for (const row of data ?? []) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", row.user_id)
        .maybeSingle();
      members.push({
        userId: row.user_id,
        role: row.role,
        email: profile?.email ?? null,
        createdAt: row.created_at,
      });
    }
    return NextResponse.json({ members });
  } catch (err) {
    return httpErrorFromException(err);
  }
}

/**
 * Invite / attach a member by email (user must already have a profile from sign-in).
 * Full email-invite magic links remain a product feature; this enforces role gates now.
 */
export async function POST(request: Request) {
  try {
    await requireRecentAuth();
    const auth = await requireOrganizationPermission("member.invite");
    const parsed = inviteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const email = parsed.data.email.trim().toLowerCase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();
    if (!profile?.id) {
      return NextResponse.json(
        {
          error:
            "That email has not signed up yet. Ask them to create an account first, then invite again.",
        },
        { status: 404 }
      );
    }

    const { data: existing } = await supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", auth.organizationId)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        {
          error:
            existing.role === "owner"
              ? "That user is already the workspace owner."
              : "That user is already a member. Change their role from the member list instead.",
        },
        { status: 409 }
      );
    }

    const { error } = await supabase.from("organization_members").insert({
      organization_id: auth.organizationId,
      user_id: profile.id,
      role: parsed.data.role,
    });
    if (error) {
      return NextResponse.json({ error: "Request could not be completed" }, { status: 500 });
    }

    const meta = requestAuditMeta(request);
    await writeSecurityAuditEvent({
      action: "member.role_change",
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      resourceType: "organization_member",
      resourceId: profile.id,
      meta: { role: parsed.data.role, email },
      ...meta,
    });

    return NextResponse.json({ ok: true, userId: profile.id, role: parsed.data.role });
  } catch (err) {
    return httpErrorFromException(err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireRecentAuth();
    const auth = await requireOrganizationPermission("member.manage");
    const parsed = roleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (parsed.data.userId === auth.userId) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", auth.organizationId)
      .eq("user_id", parsed.data.userId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (existing.role === "owner") {
      return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
    }

    const { error } = await supabase
      .from("organization_members")
      .update({ role: parsed.data.role })
      .eq("organization_id", auth.organizationId)
      .eq("user_id", parsed.data.userId);
    if (error) {
      return NextResponse.json({ error: "Request could not be completed" }, { status: 500 });
    }

    const meta = requestAuditMeta(request);
    await writeSecurityAuditEvent({
      action: "member.role_change",
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      resourceType: "organization_member",
      resourceId: parsed.data.userId,
      meta: { role: parsed.data.role },
      ...meta,
    });

    try {
      await supabase.auth.admin.signOut(parsed.data.userId, "global");
    } catch {
      /* admin API may be unavailable in some environments */
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return httpErrorFromException(err);
  }
}
