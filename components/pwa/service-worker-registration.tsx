"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          installingWorker?.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new Event("selah-ember-update-ready"));
            }
          });
        });
      } catch {
        // PWA registration should never block the web app.
      }
    };

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
