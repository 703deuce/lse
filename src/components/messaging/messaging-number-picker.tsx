"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { rep } from "@/components/reputation/rep-ui";
import { MOCK_PHONE_NUMBERS, mockSearchNumbers } from "@/lib/messaging/mock-adapter";
import type { AvailablePhoneNumber, MessagingProgressStep, MessagingRegistration } from "@/lib/messaging/types";
import { Field, MessagingPageShell, SectionCard } from "./messaging-ui";

export function MessagingNumberPicker({
  businessId,
  registration,
  progress,
  onPurchase,
  saving,
  error,
}: {
  businessId: string;
  registration: MessagingRegistration;
  progress: MessagingProgressStep[];
  onPurchase: (phoneNumber: string) => Promise<void>;
  saving: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const [areaCode, setAreaCode] = useState("571");
  const [city, setCity] = useState("");
  const [contains, setContains] = useState("");
  const [numbers, setNumbers] = useState<AvailablePhoneNumber[]>([]);
  const [selected, setSelected] = useState<string | null>(registration.phoneNumberE164);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ businessId });
      if (areaCode.trim()) params.set("areaCode", areaCode.trim());
      if (city.trim()) params.set("city", city.trim());
      if (contains.trim()) params.set("contains", contains.trim());
      const res = await fetch(`/api/messaging/numbers?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      setNumbers(json.numbers ?? []);
    } catch {
      // Preview / offline fallback uses the mock catalog so the UI stays usable.
      setNumbers(
        mockSearchNumbers({
          areaCode: areaCode.trim() || undefined,
          city: city.trim() || undefined,
          contains: contains.trim() || undefined,
        })
      );
      if (!MOCK_PHONE_NUMBERS.length) {
        setSearchError("No mock numbers available");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const selectedRow = numbers.find((row) => row.phoneNumber === selected) ?? null;
  const campaignApproved = registration.campaignReviewStatus === "approved";

  return (
    <MessagingPageShell
      title="Choose phone number"
      subtitle="Search available numbers. You can reserve before campaign approval; outbound texting stays disabled until ready."
      steps={progress}
      currentId="choose_number"
    >
      {!campaignApproved ? (
        <div className="rounded-xl border border-[#B7E4CC] bg-[#ECFDF3] px-4 py-3 text-sm text-[#027A48]">
          Your number can be reserved now, but outbound texting will remain disabled until registration is approved.
        </div>
      ) : null}

      <SectionCard title="Search numbers">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Area code">
            <input className={rep.input} value={areaCode} onChange={(e) => setAreaCode(e.target.value)} />
          </Field>
          <Field label="City or region">
            <input className={rep.input} value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Contains digits">
            <input className={rep.input} value={contains} onChange={(e) => setContains(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <button type="button" className={rep.btnSecondary} onClick={() => void search()}>
              Search
            </button>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <SectionCard title="Available numbers">
          {loading ? <p className="text-sm text-[#667085]">Searching...</p> : null}
          {searchError ? <p className="text-sm text-[#B42318]">{searchError}</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Phone number</th>
                  <th className="px-3 py-2 font-semibold">Location</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Capabilities</th>
                  <th className="px-3 py-2 font-semibold">Monthly</th>
                  <th className="px-3 py-2 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F6]">
                {numbers.map((row) => (
                  <tr key={row.phoneNumber} className="bg-white">
                    <td className="px-3 py-3 font-semibold text-[#101828]">{row.friendlyName}</td>
                    <td className="px-3 py-3 text-[#667085]">
                      {row.locality}, {row.region}
                    </td>
                    <td className="px-3 py-3 capitalize text-[#667085]">{row.type.replace("_", " ")}</td>
                    <td className="px-3 py-3 text-[#667085]">
                      {[row.capabilities.sms && "SMS", row.capabilities.mms && "MMS", row.capabilities.voice && "Voice"]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[#344054]">${row.monthlyCost.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right">
                      <button type="button" className={rep.btnSecondary} onClick={() => setSelected(row.phoneNumber)}>
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && numbers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-[#667085]">
                      No numbers matched. Try another area code or city.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Selection">
          {selectedRow ? (
            <div className="space-y-2 text-sm text-[#344054]">
              <p className="text-lg font-bold text-[#101828]">{selectedRow.friendlyName}</p>
              <p>
                {selectedRow.locality}, {selectedRow.region}
              </p>
              <p>${selectedRow.monthlyCost.toFixed(2)} / month</p>
              <p>
                {[selectedRow.capabilities.sms && "SMS", selectedRow.capabilities.mms && "MMS"]
                  .filter(Boolean)
                  .join(" + ")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#667085]">Select a number to reserve or purchase.</p>
          )}
          <button
            type="button"
            disabled={!selected || saving}
            className={rep.btnPrimary + " mt-4 w-full disabled:opacity-50"}
            onClick={() =>
              void onPurchase(selected!).then(() =>
                router.push(`/businesses/${businessId}/reputation/messaging`)
              )
            }
          >
            {saving
              ? "Saving..."
              : campaignApproved
                ? "Purchase and assign number"
                : "Reserve this number"}
          </button>
        </SectionCard>
      </div>

      {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
    </MessagingPageShell>
  );
}
