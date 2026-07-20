import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserOrganization } from "@/lib/auth/onboarding";
import { isSoftHomePath, resolvePostLoginPath } from "@/lib/auth/home-path";
import { safeNextPathOrNull } from "@/lib/auth/safe-next";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { next?: string } = {};
  try {
    body = (await request.json()) as { next?: string };
  } catch {
    body = {};
  }

  const organizationId = await ensureUserOrganization(user);
  const requestedNext = safeNextPathOrNull(body.next ?? null);
  let next =
    requestedNext && !isSoftHomePath(requestedNext) ? requestedNext : null;

  if (!next) {
    next = await resolvePostLoginPath(organizationId);
  }

  return NextResponse.json({ next: next ?? "/workspace" });
}
