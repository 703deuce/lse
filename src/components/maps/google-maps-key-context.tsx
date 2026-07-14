"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const GoogleMapsKeyContext = createContext<string | null>(null);

export function GoogleMapsKeyProvider({
  apiKey,
  children,
}: {
  apiKey: string | null | undefined;
  children: ReactNode;
}) {
  const [resolvedKey, setResolvedKey] = useState<string | null>(apiKey?.trim() || null);

  useEffect(() => {
    if (apiKey?.trim()) {
      setResolvedKey(apiKey.trim());
      return;
    }

    let cancelled = false;
    void fetch("/api/maps/config")
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { apiKey?: string };
        return data.apiKey?.trim() || null;
      })
      .then((key) => {
        if (!cancelled && key) setResolvedKey(key);
      })
      .catch(() => {
        /* keep null — maps show configure-key empty state */
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return (
    <GoogleMapsKeyContext.Provider value={resolvedKey}>{children}</GoogleMapsKeyContext.Provider>
  );
}

export function useGoogleMapsApiKey(): string | null {
  return useContext(GoogleMapsKeyContext);
}
