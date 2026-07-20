"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogoutButton } from "@/components/auth/logout-button";

export function SidebarUserMenu() {
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const devBypass =
      process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true" ||
      process.env.NODE_ENV === "development";

    if (devBypass) {
      setName("Dev User");
      setEmail("dev@localhost");
      return;
    }

    try {
      const supabase = createClient();
      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        const display =
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          user.email?.split("@")[0] ??
          "User";
        setName(display);
        setEmail(user.email ?? null);
      });
    } catch {
      setName("Signed in");
      setEmail(null);
    }
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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-semibold text-emerald-300">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-slate-200">{name ?? "Loading…"}</p>
          <p className="truncate text-[10px] text-slate-400">{email ?? "Signed in"}</p>
        </div>
      </div>
      <LogoutButton className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white" />
    </div>
  );
}
