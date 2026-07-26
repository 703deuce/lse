"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const IDLE_MS = 60 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click"] as const;

// TEMPORARY: match auth bypass — idle logout disabled while login walls are off
// unless a real Supabase session is present.
const bypassFlag =
  process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true" ||
  process.env.NODE_ENV === "development";

export function SessionIdleTimeout() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      // No real session + bypass: skip idle logout (Dev User mode).
      if (!user && bypassFlag) return;
      // No session and no bypass: nothing to idle-logout.
      if (!user) return;

      async function onIdle() {
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
      const onVisibility = () => {
        if (document.visibilityState === "visible") resetTimer();
      };
      document.addEventListener("visibilitychange", onVisibility);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        for (const event of ACTIVITY_EVENTS) {
          window.removeEventListener(event, resetTimer);
        }
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }

    let cleanup: (() => void) | undefined;
    void setup().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [router]);

  return null;
}
