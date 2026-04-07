"use client";

import { useEffect, useState } from "react";

import { fromNavigatorLanguage, t } from "@/lib/i18n";
import { isNativePlatform } from "@/lib/platform";
import type { UiLanguage } from "@/lib/ui-language";

export function InAppBrowserWarning() {
  const [show, setShow] = useState(false);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("nl");

  useEffect(() => {
    setUiLanguage(fromNavigatorLanguage(navigator.language));

    if (isNativePlatform()) {
      setShow(false);
      return;
    }

    const ua = navigator.userAgent.toLowerCase();
    const isInApp =
      ua.includes("instagram") ||
      ua.includes("fbav") ||
      ua.includes("fban") ||
      ua.includes("messenger") ||
      ua.includes("line/") ||
      ua.includes("wv");

    setShow(isInApp);
  }, []);

  if (!show) return null;

  return (
    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-900">
      <p className="font-semibold">{t(uiLanguage, { nl: "Open in Chrome/Safari om in te loggen", en: "Open in Chrome/Safari for login", fr: "Ouvrez dans Chrome/Safari pour vous connecter", de: "Zum Anmelden in Chrome/Safari öffnen", es: "Ábrelo en Chrome/Safari para iniciar sesión" })}</p>
      <p className="mt-1">
        {t(uiLanguage, {
          nl: "Je gebruikt een in-app browser (Instagram/Facebook/Messenger). Google login kan hier mislukken. Open deze pagina in de browser van je toestel en probeer opnieuw.",
          en: "You are using an in-app browser (Instagram/Facebook/Messenger). Google sign-in may fail here. Open this page in your device browser and try again.",
          fr: "Vous utilisez un navigateur intégré (Instagram/Facebook/Messenger). La connexion Google peut échouer ici. Ouvrez cette page dans le navigateur de votre appareil et réessayez.",
          de: "Du verwendest einen In-App-Browser (Instagram/Facebook/Messenger). Die Google-Anmeldung kann hier fehlschlagen. Öffne diese Seite im Browser deines Geräts und versuche es erneut.",
          es: "Estás usando un navegador integrado (Instagram/Facebook/Messenger). El inicio de sesión con Google puede fallar aquí. Abre esta página en el navegador de tu dispositivo e inténtalo de nuevo.",
        })}
      </p>
    </div>
  );
}
