"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { btnPrimary, fieldLabelClass, inputClass } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter the email for your account.");
      return;
    }

    setLoading(true);
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <p
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-relaxed text-emerald-900"
        role="status"
      >
        If an account exists for <strong>{email.trim().toLowerCase()}</strong>, we sent a reset
        link. Check your inbox and spam folder.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
      <div>
        <label htmlFor="forgot-email" className={fieldLabelClass}>
          Work email
        </label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={cn(inputClass, "mt-1.5 h-11")}
          placeholder="you@agency.com"
          disabled={loading}
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={loading} className={cn(btnPrimary, "h-11 w-full rounded-xl")}>
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
