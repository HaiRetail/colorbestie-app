"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isNativePlatform } from "@/lib/platform";

/** Hides its children when running inside the native Capacitor shell. */
export function HideOnNativeIOS({ children }: { children: ReactNode }) {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    setHide(isNativePlatform());
  }, []);

  if (hide) return null;
  return <>{children}</>;
}
