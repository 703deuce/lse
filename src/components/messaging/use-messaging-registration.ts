"use client";

import { useCallback, useEffect, useState } from "react";
import type { MessagingProgressStep, MessagingRegistration, MessagingRegistrationEvent } from "@/lib/messaging/types";
import { buildProgressSteps, nextSetupHref } from "@/lib/messaging/status";

export function useMessagingRegistration(
  businessId: string,
  initial?: {
    registration: MessagingRegistration;
    events?: MessagingRegistrationEvent[];
  }
) {
  const [registration, setRegistration] = useState<MessagingRegistration | null>(
    initial?.registration ?? null
  );
  const [events, setEvents] = useState<MessagingRegistrationEvent[]>(initial?.events ?? []);
  const [progress, setProgress] = useState<MessagingProgressStep[]>(
    initial?.registration ? buildProgressSteps(initial.registration, businessId) : []
  );
  const [nextHref, setNextHref] = useState(
    initial?.registration ? nextSetupHref(initial.registration, businessId) : `/businesses/${businessId}/reputation/messaging/business`
  );
  const [loading, setLoading] = useState(!initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPayload = useCallback(
    (json: {
      registration: MessagingRegistration;
      events?: MessagingRegistrationEvent[];
      progress?: MessagingProgressStep[];
      nextHref?: string;
    }) => {
      setRegistration(json.registration);
      if (json.events) setEvents(json.events);
      setProgress(json.progress ?? buildProgressSteps(json.registration, businessId));
      setNextHref(json.nextHref ?? nextSetupHref(json.registration, businessId));
    },
    [businessId]
  );

  const reload = useCallback(async () => {
    if (initial) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/messaging/registration?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      applyPayload(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [applyPayload, businessId, initial]);

  useEffect(() => {
    if (initial) return;
    void reload();
  }, [initial, reload]);

  const runAction = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      setSaving(true);
      setError(null);
      try {
        if (initial) {
          // Preview mode: mutate local state through API when possible; otherwise no-op local.
          const res = await fetch("/api/messaging/registration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessId, action, ...body }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Action failed");
          applyPayload(json);
          return json.registration as MessagingRegistration;
        }
        const res = await fetch("/api/messaging/registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId, action, ...body }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Action failed");
        applyPayload(json);
        return json.registration as MessagingRegistration;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [applyPayload, businessId, initial]
  );

  return {
    registration,
    events,
    progress,
    nextHref,
    loading,
    saving,
    error,
    setError,
    reload,
    runAction,
    setRegistration,
  };
}
