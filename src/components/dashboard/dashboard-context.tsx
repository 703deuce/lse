"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type DashboardUIContextValue = {
  compareActive: boolean;
  setCompareActive: (active: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
};

const DashboardUIContext = createContext<DashboardUIContextValue | null>(null);

export function DashboardUIProvider({ children }: { children: React.ReactNode }) {
  const [compareActive, setCompareActive] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const value = useMemo(
    () => ({ compareActive, setCompareActive, mobileNavOpen, setMobileNavOpen }),
    [compareActive, mobileNavOpen]
  );
  return <DashboardUIContext.Provider value={value}>{children}</DashboardUIContext.Provider>;
}

export function useDashboardUI() {
  const ctx = useContext(DashboardUIContext);
  if (!ctx) throw new Error("useDashboardUI must be used within DashboardUIProvider");
  return ctx;
}

/** Sync compare-overlay open state with the shared sidebar nav highlight. */
export function useCompareActive(active: boolean) {
  const { setCompareActive } = useDashboardUI();
  useEffect(() => {
    setCompareActive(active);
    return () => setCompareActive(false);
  }, [active, setCompareActive]);
}
