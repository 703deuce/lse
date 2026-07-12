"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogoutButton } from "@/components/auth/logout-button";

export function SidebarUserMenu() {
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const display =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email?.split("@")[0] ??
        "User";
      setName(display);
      setEmail(user.email ?? null);
    });
  }, []);

  const initials = (name ?? "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2.5 rounded-lg px-3 py-1.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-700">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-zinc-900">{name ?? "Loading…"}</p>
          <p className="truncate text-[10px] text-zinc-500">{email ?? "Signed in"}</p>
        </div>
      </div>
      <LogoutButton />
    </div>
  );
}
