"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  ContentCard,
  btnPrimary,
  btnSecondary,
  fieldLabelClass,
  inputClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type Member = {
  userId: string;
  role: string;
  email: string | null;
  createdAt: string;
};

export function TeamInviteCard() {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"assistant" | "member" | "admin" | "readonly">(
    "assistant"
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/members");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load team");
      setMembers((json.members ?? []) as Member[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Invite failed");
      if (json.pending) {
        setMessage(
          "Invite recorded. They’ll appear once they sign in with that email."
        );
      } else {
        setMessage(`Added as ${json.role}.`);
      }
      setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ContentCard>
      <h2 className="text-sm font-semibold text-zinc-900">Team seats</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Owners and admins manage billing. Assistants can run scans and build reports
        but cannot invite members or change ownership.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <label className={fieldLabelClass}>Email</label>
          <input
            type="email"
            className={cn(inputClass, "mt-1")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="assistant@example.com"
          />
        </div>
        <div>
          <label className={fieldLabelClass}>Role</label>
          <select
            className={cn(inputClass, "mt-1")}
            value={role}
            onChange={(e) =>
              setRole(e.target.value as typeof role)
            }
          >
            <option value="assistant">Assistant</option>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="readonly">Read-only</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={() => void invite()}
            className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Invite
          </button>
        </div>
      </div>

      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-zinc-700">Members</p>
          <button
            type="button"
            onClick={() => void load()}
            className={cn(btnSecondary, "h-7 px-2 text-[11px]")}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </p>
        ) : members.length === 0 ? (
          <p className="text-xs text-zinc-500">No members listed yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between px-3 py-2 text-xs"
              >
                <span className="text-zinc-800">{m.email ?? m.userId}</span>
                <span className="capitalize text-zinc-500">{m.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ContentCard>
  );
}
