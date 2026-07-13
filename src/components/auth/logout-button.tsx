"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

const devBypass =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function logout() {
    if (devBypass) {
      router.push("/sign-in");
      router.refresh();
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className={className ?? "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"}
    >
      <LogOut className="h-3.5 w-3.5" />
      {devBypass ? "Exit dev mode" : "Log out"}
    </button>
  );
}
