"use client";

type CapacitorLike = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function getCapacitor(): CapacitorLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as Record<string, unknown>).Capacitor as CapacitorLike | undefined;
}

export function isNativePlatform(): boolean {
  const cap = getCapacitor();
  return cap?.isNativePlatform?.() === true;
}

export function getNativePlatform(): string | null {
  const cap = getCapacitor();
  if (!cap?.isNativePlatform?.()) return null;
  return cap.getPlatform?.() ?? null;
}

export function isNativeIOS(): boolean {
  return getNativePlatform() === "ios";
}

export function isNativeAndroid(): boolean {
  return getNativePlatform() === "android";
}

/** Apple's subscription management deep link */
export const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";
