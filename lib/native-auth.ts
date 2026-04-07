"use client";

import { isNativePlatform } from "@/lib/platform";
import { getSupabaseBrowserClient } from "@/lib/supabase-auth-client";

/** Generate a random raw nonce string */
function generateRawNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hash a string and return hex-encoded digest */
async function sha256Hash(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Array.from(new Uint8Array(hashBuffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * On native Capacitor, use the social-login plugin to get a native
 * idToken, then exchange it with Supabase.
 * Returns true if handled natively, false if web flow should proceed.
 */
export async function nativeSignIn(
  provider: "google" | "apple",
  callbackUrl: string,
): Promise<boolean> {
  if (!isNativePlatform()) return false;

  const { SocialLogin } = await import("@capgo/capacitor-social-login");

  if (provider === "google") {
    await SocialLogin.initialize({
      google: {
        webClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
        iOSClientId: process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
        mode: "online",
      },
    });
  } else {
    await SocialLogin.initialize({ apple: {} });
  }

  // For Apple Sign-In, we need a nonce to prevent replay attacks.
  // Apple expects the SHA-256 hash of the nonce in ASAuthorizationAppleIDRequest.nonce,
  // while Supabase expects the raw (unhashed) nonce in signInWithIdToken().
  const rawNonce = provider === "apple" ? generateRawNonce() : undefined;
  const hashedNonce = rawNonce ? await sha256Hash(rawNonce) : undefined;

  const result = await SocialLogin.login({
    provider,
    options: {
      scopes: ["email", provider === "google" ? "profile" : "name"],
      // Pass the SHA-256 hashed nonce to the plugin, which sets it on
      // ASAuthorizationAppleIDRequest.nonce — Apple embeds this in the JWT.
      ...(hashedNonce ? { nonce: hashedNonce } : {}),
    },
  });

  let idToken: string | undefined;
  if (provider === "google") {
    const googleResult = result.result as { idToken?: string };
    idToken = googleResult?.idToken;
  } else {
    // @capgo/capacitor-social-login returns 'idToken' for Apple (not 'identityToken')
    const appleResult = result.result as { idToken?: string; identityToken?: string };
    idToken = appleResult?.idToken ?? appleResult?.identityToken;
  }

  if (!idToken) {
    throw new Error(`No idToken returned from native ${provider} sign-in`);
  }

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider,
    token: idToken,
    // Pass the raw nonce (unhashed) — Supabase will SHA-256 hash it
    // internally and compare against the hashed nonce Apple embedded in the JWT
    ...(rawNonce ? { nonce: rawNonce } : {}),
  });

  if (error) {
    throw new Error(`Supabase signInWithIdToken failed: ${error.message}`);
  }

  window.location.href = callbackUrl;
  return true;
}
