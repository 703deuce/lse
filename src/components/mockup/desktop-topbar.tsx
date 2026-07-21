"use client";

import { useEffect, useState } from "react";
import { Bell, Link2 } from "lucide-react";
import { WorkspaceSearch } from "@/components/dashboard/workspace-search";
import { createClient } from "@/lib/supabase/client";

export function DesktopTopBar() {
  const [name, setName] = useState("User");
  const [plan, setPlan] = useState("Trial Plan");

  useEffect(() => {
    const devBypass =
      process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true" ||
      process.env.NODE_ENV === "development";
    if (devBypass) {
      setName("Dev User");
      setPlan("Trial Plan");
      return;
    }
    try {
      const supabase = createClient();
      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        setName(
          (user.user_metadata?.full_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined) ??
            user.email?.split("@")[0] ??
            "User"
        );
      });
    } catch {
      /* ignore */
    }
  }, []);

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 hidden border-b border-[#E6EAF0] bg-white/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/90 lg:block">
      <div className="flex items-center gap-4">
        <div className="mx-auto w-full max-w-xl flex-1">
          <WorkspaceSearch />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F2F4F7]"
            aria-label="Quick links"
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F2F4F7]"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2.5 pl-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#137752] text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-[#101828]">{name}</p>
              <p className="truncate text-[11px] text-[#667085]">{plan}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
