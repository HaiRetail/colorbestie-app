"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isNativeIOS } from "@/lib/platform";

/** Hides its children only on native iOS, where we rely on the native social-login plugin. */
export function HideOnNativeIOS({ children }: { children: ReactNode }) {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    setHide(isNativeIOS());
  }, []);

  if (hide) return null;
  return <>{children}</>;
}
