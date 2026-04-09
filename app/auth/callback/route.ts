import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { getSupabaseServerAuthClient } from "@/lib/supabase-auth-server";

function resolveBaseUrl(fallbackOrigin: string, hdrs: Headers) {
  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "";

  if (appUrl) return appUrl;

  const forwardedHost = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const forwardedProto = hdrs.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  return fallbackOrigin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const defaultNext = type === "recovery" ? "/reset-password" : "/app";
  const nextParam = url.searchParams.get("next") ?? defaultNext;
  const next = nextParam.startsWith("/") ? nextParam : defaultNext;

  const supabase = await getSupabaseServerAuthClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type) {
    await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  }

  const hdrs = await headers();
  const baseUrl = resolveBaseUrl(url.origin, hdrs);
  return NextResponse.redirect(new URL(next, baseUrl));
}
