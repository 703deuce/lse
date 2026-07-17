import { createBrowserClient } from "@supabase/ssr";
import { mergeCookieOptions } from "@/lib/supabase/cookie-options";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: mergeCookieOptions(),
    }
  );
}

/** @deprecated Use createClient() — kept for existing imports */
export function createBrowserClientLegacy() {
  return createClient();
}
