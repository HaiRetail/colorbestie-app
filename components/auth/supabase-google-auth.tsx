"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase-auth-client";
import type { UiLanguage } from "@/lib/ui-language";

const PUBLIC_APP_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://colorbestie.app";

function resolveAuthOrigin() {
  const origin = window.location.origin;
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  return isLocalhost ? PUBLIC_APP_ORIGIN : origin;
}

export function SupabaseGoogleAuthButton({
  callbackUrl,
  uiLanguage,
}: {
  callbackUrl: string;
  uiLanguage: UiLanguage;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [isBusy, setIsBusy] = useState(false);

  const handleGoogle = async () => {
    setIsBusy(true);

    const authOrigin = resolveAuthOrigin();
    let nextPath = "/app";

    try {
      const parsed = new URL(callbackUrl, authOrigin);
      const candidate = `${parsed.pathname || ""}${parsed.search || ""}`;
      if (candidate.startsWith("/")) nextPath = candidate;
    } catch {
      // keep fallback
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${authOrigin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        queryParams: {
          prompt: "select_account",
          access_type: "offline",
        },
      },
    });

    if (error) {
      console.error("[supabase-google-auth] failed:", error);
      alert(
        t(uiLanguage, {
          nl: "Google inloggen mislukt. Probeer opnieuw.",
          en: "Google sign-in failed. Please try again.",
          fr: "La connexion Google a échoué. Réessaie.",
          de: "Google-Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
          es: "Error al iniciar sesión con Google. Inténtalo de nuevo.",
        }),
      );
      setIsBusy(false);
    }
  };

  return (
    <Button
      type="button"
      size="lg"
      className="w-full gap-2 bg-black text-white hover:bg-black/90"
      disabled={isBusy}
      onClick={() => void handleGoogle()}
    >
      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image src="/icons/google-g.svg" alt="Google" width={18} height={18} />}
      {isBusy
        ? t(uiLanguage, {
            nl: "Laden...",
            en: "Loading...",
            fr: "Chargement...",
            de: "Lädt...",
            es: "Cargando...",
          })
        : t(uiLanguage, {
            nl: "Ga verder met Google",
            en: "Continue with Google",
            fr: "Continuer avec Google",
            de: "Mit Google fortfahren",
            es: "Continuar con Google",
          })}
    </Button>
  );
}
