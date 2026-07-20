"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { btnPrimary, fieldLabelClass, inputClass } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import { safeNextPath } from "@/lib/auth/safe-next";

type Mode = "signin" | "signup";

function authErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Email or password is incorrect.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (lower.includes("password")) {
    return message;
  }
  if (lower.includes("rate") || lower.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return message || "Something went wrong. Please try again.";
}

async function finishLogin(nextRaw: string | null) {
  const res = await fetch("/api/auth/complete-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ next: nextRaw }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Could not finish sign-in.");
  }
  const data = (await res.json()) as { next?: string };
  return safeNextPath(data.next ?? null);
}

export function EmailAuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    if (mode === "signup") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const nextRaw = params.get("next");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim() || undefined,
            },
            emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(
              safeNextPath(nextRaw)
            )}`,
          },
        });

        if (signUpError) {
          setError(authErrorMessage(signUpError.message));
          return;
        }

        if (!data.session) {
          setInfo(
            "Account created. Check your email to confirm your address, then sign in."
          );
          return;
        }

        const next = await finishLogin(nextRaw);
        router.push(next);
        router.refresh();
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setError(authErrorMessage(signInError.message));
        return;
      }

      const next = await finishLogin(nextRaw);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
      {mode === "signup" ? (
        <div>
          <label htmlFor="auth-full-name" className={fieldLabelClass}>
            Full name
          </label>
          <input
            id="auth-full-name"
            name="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={cn(inputClass, "mt-1.5 h-11")}
            placeholder="Jordan Lee"
            disabled={loading}
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="auth-email" className={fieldLabelClass}>
          Work email
        </label>
        <input
          id="auth-email"
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

      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="auth-password" className={fieldLabelClass}>
            Password
          </label>
          {mode === "signin" ? (
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-[#137752] hover:underline"
            >
              Forgot password?
            </Link>
          ) : null}
        </div>
        <div className="relative mt-1.5">
          <input
            id="auth-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(inputClass, "h-11 pr-16")}
            placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
            disabled={loading}
            minLength={mode === "signup" ? 8 : undefined}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {mode === "signup" ? (
        <div>
          <label htmlFor="auth-confirm-password" className={fieldLabelClass}>
            Confirm password
          </label>
          <input
            id="auth-confirm-password"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={cn(inputClass, "mt-1.5 h-11")}
            placeholder="Repeat password"
            disabled={loading}
            minLength={8}
          />
        </div>
      ) : null}

      {error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {info ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          role="status"
        >
          {info}
        </p>
      ) : null}

      <button type="submit" disabled={loading} className={cn(btnPrimary, "h-11 w-full rounded-xl")}>
        {loading
          ? mode === "signup"
            ? "Creating account…"
            : "Signing in…"
          : mode === "signup"
            ? "Create account"
            : "Sign in"}
      </button>
    </form>
  );
}
