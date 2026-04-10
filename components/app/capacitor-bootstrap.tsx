"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Ensures the Capacitor web bridge is initialized early on remote-loaded pages.
 * Without this, native plugin callbacks can race before `window.Capacitor.triggerEvent`
 * exists, which breaks Android social login handoff.
 */
export function CapacitorBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as Window & { Capacitor?: typeof Capacitor };
    if (!w.Capacitor) {
      w.Capacitor = Capacitor;
    }
  }, []);

  return null;
}
