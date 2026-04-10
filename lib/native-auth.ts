"use client";

import { isNativeIOS, isNativePlatform } from "@/lib/platform";
import { getSupabaseBrowserClient } from "@/lib/supabase-auth-client";

function createNonce(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = atob(normalized);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * On native (iOS/Android), use the Capacitor social-login plugin to get a native
 * idToken (no browser redirect), then exchange it with Supabase.
 * Returns true if handled natively, false if web flow should proceed.
 */
export async function nativeSignIn(
  provider: "google" | "apple",
  callbackUrl: string,
): Promise<boolean> {
  if (!isNativePlatform()) return false;

  const { SocialLogin } = await import("@capgo/capacitor-social-login");

  if (provider === "google") {
    const expectedProjectPrefix = "509573695189-";

    // Hard pin the shared Google WEB client id to the Colorbestie GCP project.
    // On Android, the Capgo plugin reads `webClientId` as the Google client id.
    // Do not hardcode a single Android OAuth client here, because debug/release
    // builds use different certificate fingerprints and therefore different
    // Android OAuth clients in Google Cloud.
    const googleWebClientId =
      "509573695189-68759k455hgsigqn7733476ajbcdd72c.apps.googleusercontent.com";

    const googleConfig: Record<string, string> = {
      webClientId: googleWebClientId,
      mode: "online",
    };

    if (isNativeIOS()) {
      const envIosClientId = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
      if (envIosClientId && envIosClientId.startsWith(expectedProjectPrefix)) {
        googleConfig.iOSClientId = envIosClientId;
      }
    }

    await SocialLogin.initialize({ google: googleConfig as never });
  } else {
    await SocialLogin.initialize({ apple: {} });
  }

  const nonce = provider === "apple" ? createNonce() : undefined;
  const hashedNonce = nonce ? await sha256Hex(nonce) : undefined;

  const result = await SocialLogin.login({
    provider,
    options: {
      scopes: ["email", provider === "google" ? "profile" : "name"],
      ...(hashedNonce ? { nonce: hashedNonce } : {}),
    } as never,
  });

  let idToken: string | undefined;
  let accessToken: string | undefined;

  if (provider === "google") {
    const googleResult = result.result as {
      idToken?: string | null;
      accessToken?: { token?: string | null } | string | null;
    };

    idToken = googleResult?.idToken ?? undefined;
    accessToken =
      typeof googleResult?.accessToken === "string"
        ? googleResult.accessToken
        : googleResult?.accessToken?.token ?? undefined;
  } else {
    const appleResult = result.result as {
      idToken?: string | null;
      identityToken?: string | null;
      accessToken?: { token?: string | null } | string | null;
    };

    idToken = appleResult?.idToken ?? appleResult?.identityToken ?? undefined;
    accessToken =
      typeof appleResult?.accessToken === "string"
        ? appleResult.accessToken
        : appleResult?.accessToken?.token ?? undefined;
  }

  if (!idToken) {
    throw new Error(`No idToken returned from native ${provider} sign-in`);
  }

  const tokenClaims = decodeJwtPayload(idToken);

  const signInPayload: {
    provider: "google" | "apple";
    token: string;
    nonce?: string;
    access_token?: string;
  } = {
    provider,
    token: idToken,
  };

  if (provider === "apple" && nonce) {
    signInPayload.nonce = nonce;
  } else if (typeof tokenClaims?.nonce === "string" && tokenClaims.nonce.length > 0) {
    signInPayload.nonce = tokenClaims.nonce;
  }
  if (tokenClaims?.at_hash && accessToken) {
    signInPayload.access_token = accessToken;
  }

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithIdToken(signInPayload);

  if (error) {
    const details = [error.message, (error as { status?: number }).status]
      .filter(Boolean)
      .join(" | ");
    throw new Error(`Supabase signInWithIdToken failed: ${details}`);
  }

  window.location.href = callbackUrl;
  return true;
}
