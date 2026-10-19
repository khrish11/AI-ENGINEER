"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const localDevelopment =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (
      "serviceWorker" in navigator &&
      (window.location.protocol === "https:" || localDevelopment)
    ) {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    }
  }, []);
  return null;
}
