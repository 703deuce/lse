"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const IDLE_MS = 60 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click"] as const;

// TEMPORARY: match auth bypass — idle logout disabled while login walls are off.
const devBypass =
  process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true" ||
  process.env.NODE_ENV === "development";

export function SessionIdleTimeout() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (devBypass) return;

    async function onIdle() {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "global" });
      router.push("/sign-in");
      router.refresh();
    }

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void onIdle();
      }, IDLE_MS);
    }

    resetTimer();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") resetTimer();
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [router]);

  return null;
}
