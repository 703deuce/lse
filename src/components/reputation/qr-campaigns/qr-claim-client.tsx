"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { rep } from "@/components/reputation/rep-ui";

type Biz = { id: string; name: string };

export function QrClaimClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [token, setToken] = useState("");
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = search.get("claim") ?? search.get("token") ?? "";
    const fromStorage =
      typeof window !== "undefined" ? localStorage.getItem("lse_qr_claim_token") ?? "" : "";
    setToken(fromQuery || fromStorage);
    void fetch("/api/businesses")
      .then((r) => r.json())
      .then((j) => {
        const list = (j.businesses ?? j ?? []) as Biz[];
        setBusinesses(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list[0]?.id) setBusinessId(list[0].id);
      })
      .catch(() => setBusinesses([]));
  }, [search]);

  async function claim() {
    if (!token || !businessId) {
      setError("Select a business and make sure your claim token is present.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/public/qr/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimToken: token, businessId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Claim failed");
      localStorage.removeItem("lse_qr_claim_token");
      router.push(json.nextHref || `/businesses/${businessId}/reputation/qr-campaigns`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-[#E6EAF0] bg-white p-6">
      <p className="text-sm text-[#667085]">
        After you create a free QR poster, we save a secure claim token so your tracked link and any
        early scans stay with you after signup.
      </p>
      {!token ? (
        <p className="text-sm text-[#B42318]">
          No claim token found. Generate a QR on the public tool, then create an account from that
          page.
        </p>
      ) : (
        <p className="rounded-lg bg-[#ECFDF3] px-3 py-2 text-sm text-[#027A48]">
          Claim token ready — choose which business should own this QR campaign.
        </p>
      )}
      <label className="block text-sm font-medium text-[#344054]">
        Business
        <select
          className={rep.input + " mt-1"}
          value={businessId}
          onChange={(e) => setBusinessId(e.target.value)}
        >
          {businesses.length === 0 ? <option value="">No businesses found</option> : null}
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
      <button
        type="button"
        disabled={saving || !token || !businessId}
        className={rep.btnPrimary + " disabled:opacity-50"}
        onClick={() => void claim()}
      >
        {saving ? "Saving…" : "Claim QR campaign"}
      </button>
    </div>
  );
}
