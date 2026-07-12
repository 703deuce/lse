/** DataForSEO Google Maps Live — scan device/profile presets */

export const MAPS_LIVE_ENDPOINT = "serp/google/maps/live/advanced";
/** @deprecated Use LOCAL_FALCON_PARITY.locationZoom — kept for imports */
export const MAPS_LOCATION_ZOOM = 17;
export const MAPS_LANGUAGE = "en";

export type ScanDeviceProfile = {
  id: string;
  label: string;
  device: "desktop" | "mobile";
  os: "android" | "ios" | "windows" | "macos";
  browser: "chrome" | "firefox";
  description?: string;
};

/** Local Falcon parity default — mobile-first Maps search */
export const DEFAULT_SCAN_PROFILE: ScanDeviceProfile = {
  id: "mobile-android-chrome",
  label: "Mobile · Android · Chrome",
  device: "mobile",
  os: "android",
  browser: "chrome",
  description: "Typical Google Maps mobile search (recommended for Local Falcon parity)",
};

/** Run same 5×5 grid with each profile and compare to Local Falcon */
export const PARITY_TEST_PROFILES: ScanDeviceProfile[] = [
  {
    id: "mobile-android",
    label: "Mobile Android Chrome",
    device: "mobile",
    os: "android",
    browser: "chrome",
    description: "Primary mobile Maps experience",
  },
  {
    id: "mobile-ios",
    label: "Mobile iPhone",
    device: "mobile",
    os: "ios",
    browser: "chrome",
    description: "iOS mobile Maps",
  },
  {
    id: "desktop-chrome",
    label: "Desktop Chrome",
    device: "desktop",
    os: "windows",
    browser: "chrome",
    description: "Desktop Windows Chrome",
  },
  {
    id: "desktop-firefox",
    label: "Desktop Firefox",
    device: "desktop",
    os: "windows",
    browser: "firefox",
    description: "Desktop Windows Firefox",
  },
];

export const OS_OPTIONS_BY_DEVICE: Record<
  ScanDeviceProfile["device"],
  Array<{ value: ScanDeviceProfile["os"]; label: string }>
> = {
  mobile: [
    { value: "android", label: "Android" },
    { value: "ios", label: "iOS (iPhone)" },
  ],
  desktop: [
    { value: "windows", label: "Windows" },
    { value: "macos", label: "macOS" },
  ],
};

export const BROWSER_OPTIONS = [
  { value: "chrome" as const, label: "Chrome" },
  { value: "firefox" as const, label: "Firefox" },
];

export function profileFromBatch(batch: {
  device?: string | null;
  os?: string | null;
  browser?: string | null;
}): ScanDeviceProfile {
  const device = batch.device === "mobile" ? "mobile" : "desktop";
  const os = (["android", "ios", "windows", "macos"].includes(batch.os ?? "")
    ? batch.os
    : device === "mobile"
      ? "android"
      : "windows") as ScanDeviceProfile["os"];
  const browser = batch.browser === "firefox" ? "firefox" : "chrome";
  return {
    id: `${device}-${os}-${browser}`,
    label: `${device} · ${os} · ${browser}`,
    device,
    os,
    browser,
  };
}
