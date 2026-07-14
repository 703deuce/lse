declare global {
  interface Window {
    google?: typeof google;
    __gmapsInitPromise?: Promise<typeof google>;
  }
}

/**
 * Load the Maps JavaScript API once (client-side).
 * Uses Coolify `MAPS` / other resolved keys via the caller.
 */
export function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (!apiKey) {
    return Promise.reject(new Error("Missing Google Maps API key"));
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (window.__gmapsInitPromise) {
    return window.__gmapsInitPromise;
  }

  window.__gmapsInitPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-gmaps-loader]");
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.google?.maps) resolve(window.google);
        else reject(new Error("Google Maps failed to initialize"));
      });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")));
      return;
    }

    const script = document.createElement("script");
    script.dataset.gmapsLoader = "1";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=geometry`;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps failed to initialize"));
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });

  return window.__gmapsInitPromise;
}
