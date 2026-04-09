"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase-auth-client";
import type { UiLanguage } from "@/lib/ui-language";

type Mode = "signin" | "signup";

const PUBLIC_APP_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://colorbestie.app";

function resolveAuthOrigin() {
  const origin = window.location.origin;
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  return isLocalhost ? PUBLIC_APP_ORIGIN : origin;
}

export function SupabaseEmailAuth({ callbackUrl, uiLanguage }: { callbackUrl: string; uiLanguage: UiLanguage }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const resetMessage = () => setMessage(null);

  const handleSignIn = async () => {
    resetMessage();
    setIsBusy(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.href = callbackUrl;
  };

  const handleSignUp = async () => {
    resetMessage();
    setIsBusy(true);

    const authOrigin = resolveAuthOrigin();
    let nextPath = "/app";

    try {
      const parsed = new URL(callbackUrl, authOrigin);
      const candidate = `${parsed.pathname || ""}${parsed.search || ""}`;
      if (candidate.startsWith("/")) nextPath = candidate;
    } catch {
      // Fallback stays /app
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${authOrigin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    setIsBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(t(uiLanguage, {
      nl: "Account aangemaakt. Check je e-mail om te bevestigen.",
      en: "Account created. Check your email to confirm.",
      fr: "Compte créé. Vérifie ton e-mail pour confirmer.",
      de: "Konto erstellt. Prüfe deine E-Mails zur Bestätigung.",
      es: "Cuenta creada. Revisa tu correo para confirmar.",
    }));
  };

  const handleReset = async () => {
    if (!email) {
      setMessage(t(uiLanguage, {
        nl: "Vul eerst je e-mailadres in.",
        en: "Enter your email address first.",
        fr: "Entre d'abord ton adresse e-mail.",
        de: "Gib zuerst deine E-Mail-Adresse ein.",
        es: "Introduce primero tu correo electrónico.",
      }));
      return;
    }

    resetMessage();
    setIsBusy(true);

    const authOrigin = resolveAuthOrigin();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${authOrigin}/auth/callback?next=/reset-password`,
    });

    setIsBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(t(uiLanguage, {
      nl: "Als er een account bestaat voor dit e-mailadres, ontvang je zo een resetmail.",
      en: "If an account exists for this email address, you'll receive a reset email shortly.",
      fr: "Si un compte existe pour cette adresse e-mail, tu recevras bientôt un e-mail de réinitialisation.",
      de: "Wenn für diese E-Mail-Adresse ein Konto existiert, erhältst du in Kürze eine E-Mail zum Zurücksetzen.",
      es: "Si existe una cuenta para este correo electrónico, recibirás pronto un correo para restablecer tu contraseña.",
    }));
  };

  return (
    <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-left">
      <p className="text-sm font-semibold text-[var(--text)]">{t(uiLanguage, {
        nl: "E-mail en wachtwoord",
        en: "Email and password",
        fr: "E-mail et mot de passe",
        de: "E-Mail und Passwort",
        es: "Correo y contraseña",
      })}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{t(uiLanguage, {
        nl: "Log in of maak een account aan met je e-mailadres.",
        en: "Log in or create an account with your email address.",
        fr: "Connecte-toi ou crée un compte avec ton adresse e-mail.",
        de: "Melde dich an oder erstelle ein Konto mit deiner E-Mail-Adresse.",
        es: "Inicia sesión o crea una cuenta con tu correo electrónico.",
      })}</p>

      <div className="mt-3 space-y-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t(uiLanguage, {
            nl: "jij@email.com",
            en: "you@email.com",
            fr: "toi@email.com",
            de: "du@email.com",
            es: "tu@email.com",
          })}
          className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t(uiLanguage, {
            nl: "Wachtwoord",
            en: "Password",
            fr: "Mot de passe",
            de: "Passwort",
            es: "Contraseña",
          })}
          className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] outline-none"
        />
      </div>

      <Button
        type="button"
        className="mt-3 w-full"
        disabled={isBusy || !email || !password}
        onClick={mode === "signin" ? handleSignIn : handleSignUp}
      >
        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin"
          ? t(uiLanguage, {
              nl: "Log in met e-mail",
              en: "Log in with email",
              fr: "Se connecter avec e-mail",
              de: "Mit E-Mail einloggen",
              es: "Entrar con correo",
            })
          : t(uiLanguage, {
              nl: "Maak account",
              en: "Create account",
              fr: "Créer un compte",
              de: "Konto erstellen",
              es: "Crear cuenta",
            })}
      </Button>

      {mode === "signin" ? (
        <button
          type="button"
          onClick={() => {
            resetMessage();
            setMode("signup");
          }}
          disabled={isBusy}
          className="mt-3 block w-full text-center text-xs text-[var(--muted)] underline underline-offset-2"
        >
          {t(uiLanguage, {
            nl: "Account aanmaken",
            en: "Create account",
            fr: "Créer un compte",
            de: "Konto erstellen",
            es: "Crear cuenta",
          })}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            resetMessage();
            setMode("signin");
          }}
          disabled={isBusy}
          className="mt-3 block w-full text-center text-xs text-[var(--muted)] underline underline-offset-2"
        >
          {t(uiLanguage, {
            nl: "Ik heb al een account",
            en: "I already have an account",
            fr: "J'ai déjà un compte",
            de: "Ich habe bereits ein Konto",
            es: "Ya tengo una cuenta",
          })}
        </button>
      )}

      <button
        type="button"
        onClick={handleReset}
        disabled={isBusy}
        className="mt-2 block w-full text-center text-xs text-[var(--muted)] underline underline-offset-2"
      >
        {t(uiLanguage, {
          nl: "Wachtwoord vergeten?",
          en: "Forgot password?",
          fr: "Mot de passe oublié ?",
          de: "Passwort vergessen?",
          es: "¿Olvidaste tu contraseña?",
        })}
      </button>

      {message ? <p className="mt-2 text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
