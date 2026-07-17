"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ShieldCheck } from "lucide-react";
import { ModuleHeader, ModulePage } from "@/components/ui/design-system";

type MfaFactor = {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
};

export function SecuritySettingsClient() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [enroll, setEnroll] = useState<{
    factorId: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");

  const loadFactors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      const all = [...(data?.totp ?? []), ...(data?.phone ?? [])] as MfaFactor[];
      setFactors(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MFA factors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (enrollErr) throw enrollErr;
      if (!data?.id || !data.totp?.qr_code || !data.totp?.secret) {
        throw new Error("Enrollment did not return TOTP details");
      }
      setEnroll({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setMessage("Scan the QR code with your authenticator app, then enter the 6-digit code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    if (!enroll || verifyCode.trim().length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: enroll.factorId,
      });
      if (challengeErr) throw challengeErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.id,
        code: verifyCode.trim(),
      });
      if (verifyErr) throw verifyErr;
      setEnroll(null);
      setVerifyCode("");
      setMessage("Two-factor authentication is enabled.");
      await loadFactors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(factorId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollErr) throw unenrollErr;
      setMessage("Authenticator removed.");
      await loadFactors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove factor");
    } finally {
      setBusy(false);
    }
  }

  const verifiedFactors = factors.filter((f) => f.status === "verified");

  return (
    <ModulePage>
      <ModuleHeader
        title="Security"
        subtitle="Protect your account with two-factor authentication (TOTP)."
      />

      <div className="mt-6 max-w-xl space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-zinc-900">Multi-factor authentication</p>
            <p className="mt-1 text-sm text-zinc-600">
              Required for sensitive actions and platform admin access in production. Use an app
              like Google Authenticator, 1Password, or Authy.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading factors…
          </div>
        ) : null}

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        {message ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
        ) : null}

        {verifiedFactors.length > 0 ? (
          <ul className="space-y-2">
            {verifiedFactors.map((factor) => (
              <li
                key={factor.id}
                className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 text-sm"
              >
                <span>{factor.friendly_name ?? factor.factor_type}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeFactor(factor.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          !enroll && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void startEnroll()}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Enable authenticator app
            </button>
          )
        )}

        {enroll ? (
          <div className="space-y-3 border-t border-zinc-100 pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enroll.qr} alt="TOTP QR code" className="h-40 w-40 rounded border" />
            <p className="text-xs text-zinc-500 break-all">Manual secret: {enroll.secret}</p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmEnroll()}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Verify & enable
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEnroll(null);
                  setVerifyCode("");
                }}
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </ModulePage>
  );
}
