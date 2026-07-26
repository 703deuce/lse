"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Search } from "lucide-react";
import { rep } from "@/components/reputation/rep-ui";
import { canPurchaseMessagingNumber } from "@/lib/messaging/status";
import type { AvailablePhoneNumber, MessagingProgressStep, MessagingRegistration } from "@/lib/messaging/types";
import {
  Field,
  MessagingAlertBanner,
  MessagingPageShell,
  SectionCard,
} from "./messaging-ui";

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
  const [postalCode, setPostalCode] = useState("");
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
      if (postalCode.trim()) params.set("postalCode", postalCode.trim());
      if (contains.trim()) params.set("contains", contains.trim());
      const res = await fetch(`/api/messaging/numbers?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      setNumbers(json.numbers ?? []);
    } catch (err) {
      setNumbers([]);
      setSearchError(err instanceof Error ? err.message : "Could not search Twilio numbers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const selectedRow = numbers.find((row) => row.phoneNumber === selected) ?? null;
  const canPurchase = canPurchaseMessagingNumber(registration) && !registration.phoneNumberE164;
  const alreadyPurchased = Boolean(registration.phoneNumberE164);
  const monthly = selectedRow?.monthlyCost ?? 1.15;

  return (
    <MessagingPageShell
      title="Choose phone number"
      subtitle="Buy a local number anytime. Texting unlocks after A2P registration is approved."
      steps={progress}
      currentId="choose_number"
      registration={registration}
    >
      {alreadyPurchased ? (
        <MessagingAlertBanner tone="success" title="Your phone number has been purchased">
          {registration.phoneNumberFriendly ?? registration.phoneNumberE164} is yours
          {registration.phoneNumberMonthlyCost
            ? ` ($${registration.phoneNumberMonthlyCost.toFixed(2)}/month)`
            : ""}
          . It will automatically become available for texting after your A2P registration is
          approved.
        </MessagingAlertBanner>
      ) : (
        <MessagingAlertBanner tone="info" title="Purchase anytime">
          You can buy a number before Brand or Campaign approval. Monthly rental starts when you
          purchase. Outbound SMS stays off until the campaign is verified.
        </MessagingAlertBanner>
      )}

      <SectionCard title="Search numbers" icon={Search}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Area code">
            <input
              className={rep.input}
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value)}
              placeholder="571"
            />
          </Field>
          <Field label="City">
            <input
              className={rep.input}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Woodbridge"
            />
          </Field>
          <Field label="ZIP code">
            <input
              className={rep.input}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="22191"
            />
          </Field>
          <Field label="Vanity digits" hint="Optional — match digits in the number">
            <input
              className={rep.input}
              value={contains}
              onChange={(e) => setContains(e.target.value)}
              placeholder="0108"
            />
          </Field>
          <div className="flex items-end">
            <button type="button" className={rep.btnSecondary + " w-full"} onClick={() => void search()}>
              <Search className="h-4 w-4" />
              Search
            </button>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <SectionCard title="Available numbers" icon={Phone}>
          {loading ? (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded-lg bg-[#F2F4F7]" />
              <div className="h-10 animate-pulse rounded-lg bg-[#F2F4F7]" />
              <div className="h-10 animate-pulse rounded-lg bg-[#F2F4F7]" />
            </div>
          ) : null}
          {searchError ? <p className="text-sm text-[#B42318]">{searchError}</p> : null}
          {!loading ? (
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
                  {numbers.map((row) => {
                    const isSelected = selected === row.phoneNumber;
                    return (
                      <tr
                        key={row.phoneNumber}
                        className={
                          isSelected
                            ? "bg-[#ECFDF3]"
                            : "bg-white transition hover:bg-[#F9FAFB]"
                        }
                      >
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
                          <button
                            type="button"
                            disabled={alreadyPurchased}
                            className={isSelected ? rep.btnPrimary : rep.btnSecondary}
                            onClick={() => setSelected(row.phoneNumber)}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {numbers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-[#667085]">
                        No numbers matched. Try another area code, city, ZIP, or vanity digits.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Selection" icon={Phone}>
          {alreadyPurchased ? (
            <div className="space-y-2 text-sm text-[#344054]">
              <p className="text-lg font-bold text-[#101828]">
                {registration.phoneNumberFriendly ?? registration.phoneNumberE164}
              </p>
              <p>Purchased — monthly rental is active.</p>
              <p>Texting unlocks after A2P approval.</p>
            </div>
          ) : selectedRow ? (
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
            <p className="text-sm text-[#667085]">Select a number to purchase.</p>
          )}
          <button
            type="button"
            disabled={!selected || saving || !canPurchase || alreadyPurchased}
            className={rep.btnPrimary + " mt-4 w-full disabled:opacity-50"}
            onClick={() =>
              void onPurchase(selected!).then(() =>
                router.push(`/businesses/${businessId}/reputation/messaging`)
              )
            }
          >
            {saving
              ? "Purchasing..."
              : alreadyPurchased
                ? "Number purchased"
                : `Purchase Number — $${monthly.toFixed(2)}/month`}
          </button>
        </SectionCard>
      </div>

      {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
    </MessagingPageShell>
  );
}
