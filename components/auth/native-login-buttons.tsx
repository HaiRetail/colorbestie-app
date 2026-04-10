"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isNativeIOS } from "@/lib/platform";
import { nativeSignIn } from "@/lib/native-auth";
import { t } from "@/lib/i18n";
import type { UiLanguage } from "@/lib/ui-language";

type Props = {
  callbackUrl: string;
  uiLanguage: UiLanguage;
  hasApple: boolean;
};

/**
 * On native Capacitor: intercept OAuth and use native sign-in.
 * On web: renders nothing, the server-action forms handle it.
 */
export function NativeLoginButtons({
  callbackUrl,
  uiLanguage,
  hasApple,
}: Props) {
  const [isIOS, setIsIOS] = useState(false);
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);

  useEffect(() => {
    setIsIOS(isNativeIOS());
  }, []);

  // Android falls back to the regular web OAuth flow because the native
  // SocialLogin bridge has been unreliable in release builds.
  if (!isIOS) return null;

  const handleNativeSignIn = async (provider: "google" | "apple") => {
    try {
      setLoading(provider);
      await nativeSignIn(provider, callbackUrl);
    } catch (err) {
      console.error(`[native-login] ${provider} failed:`, err);
      toast(
        t(uiLanguage, {
          nl: "Inloggen mislukt. Probeer opnieuw.",
          en: "Sign-in failed. Please try again.",
          fr: "Connexion échouée. Veuillez réessayer.",
          de: "Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
          es: "Inicio de sesión fallido. Inténtalo de nuevo.",
        }),
      );
      setLoading(null);
    }
  };

  return (
    <div className="mt-8 space-y-3">
      <Button
        type="button"
        size="lg"
        className="w-full gap-2 bg-black text-white hover:bg-black/90"
        disabled={loading !== null}
        onClick={() => void handleNativeSignIn("google")}
      >
        <Image
          src="/icons/google-g.svg"
          alt="Google"
          width={18}
          height={18}
        />
        {loading === "google"
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

      {isIOS && hasApple ? (
        <Button
          type="button"
          size="lg"
          className="w-full gap-2 bg-black text-white hover:bg-black/90"
          disabled={loading !== null}
          onClick={() => void handleNativeSignIn("apple")}
        >
          <Image
            src="/icons/apple-logo.svg"
            alt="Apple"
            width={18}
            height={18}
          />
          {loading === "apple"
            ? t(uiLanguage, {
                nl: "Laden...",
                en: "Loading...",
                fr: "Chargement...",
                de: "Lädt...",
                es: "Cargando...",
              })
            : t(uiLanguage, {
                nl: "Ga verder met Apple",
                en: "Continue with Apple",
                fr: "Continuer avec Apple",
                de: "Mit Apple fortfahren",
                es: "Continuar con Apple",
              })}
        </Button>
      ) : null}
    </div>
  );
}
