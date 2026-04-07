import { signIn } from "@/auth";
import Image from "next/image";
import { headers } from "next/headers";
import { InAppBrowserWarning } from "@/components/auth/inapp-browser-warning";
import { NativeLoginButtons } from "@/components/auth/native-login-buttons";
import { HideOnNativeIOS } from "@/components/auth/hide-on-native-ios";
import { SupabaseEmailAuth } from "@/components/auth/supabase-email-auth";
import { Button } from "@/components/ui/button";
import { resolveUiLanguage } from "@/lib/ui-language";
import { t } from "@/lib/i18n";

type Props = {
  searchParams?: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
  const proto = hdrs.get("x-forwarded-proto") || "https";
  const origin = host ? `${proto}://${host}` : "";
  const rawCallback = params?.callbackUrl || "/paywall";
  const callbackPath = rawCallback.startsWith("/") ? rawCallback : "/paywall";
  const callbackUrl = `${origin}${callbackPath}`;
  const acceptLanguage = hdrs.get("accept-language") || "";
  const uiLanguage = resolveUiLanguage(acceptLanguage.split(",")[0]);
  const hasApple = Boolean((process.env.AUTH_APPLE_ID ?? process.env.APPLE_CLIENT_ID ?? "").trim() && (process.env.AUTH_APPLE_SECRET ?? process.env.APPLE_CLIENT_SECRET ?? "").trim());

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-hero items-center px-6 pt-[max(4rem,calc(env(safe-area-inset-top)+2rem))] pb-16 md:px-10">
      <section className="card-soft mx-auto w-full max-w-xl p-8 text-center md:p-12">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t(uiLanguage, { nl: "Log in bij ColorBestie", en: "Sign in to ColorBestie", fr: "Connectez-vous à ColorBestie", de: "Bei ColorBestie anmelden", es: "Inicia sesión en ColorBestie" })}</h1>
        <p className="mt-4 text-[var(--muted)]">{t(uiLanguage, { nl: "Log in met Google, Apple of e-mail om te beginnen met genereren.", en: "Log in with Google, Apple or email to start generating.", fr: "Connecte-toi avec Google, Apple ou e-mail pour commencer à générer.", de: "Melde dich mit Google, Apple oder E-Mail an, um zu starten.", es: "Inicia sesión con Google, Apple o correo para empezar a generar." })}</p>
        <InAppBrowserWarning />

        {/* Native iOS: uses Capacitor social-login plugin (stays in-app, no Safari) */}
        <NativeLoginButtons callbackUrl={callbackUrl} uiLanguage={uiLanguage} hasApple={hasApple} />

        {/* Web: server-action forms (hidden on native iOS) */}
        <HideOnNativeIOS>
          <div className="mt-8 space-y-3">
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: callbackUrl });
              }}
            >
              <Button type="submit" size="lg" className="w-full gap-2 bg-black text-white hover:bg-black/90">
                <Image src="/icons/google-g.svg" alt="Google" width={18} height={18} />
                {t(uiLanguage, { nl: "Ga verder met Google", en: "Continue with Google", fr: "Continuer avec Google", de: "Mit Google fortfahren", es: "Continuar con Google" })}
              </Button>
            </form>

            {hasApple ? (
              <form
                action={async () => {
                  "use server";
                  await signIn("apple", { redirectTo: callbackUrl });
                }}
              >
                <Button type="submit" size="lg" className="w-full gap-2 bg-black text-white hover:bg-black/90">
                  <Image src="/icons/apple-logo.svg" alt="Apple" width={18} height={18} />
                  {t(uiLanguage, { nl: "Ga verder met Apple", en: "Continue with Apple", fr: "Continuer avec Apple", de: "Mit Apple fortfahren", es: "Continuar con Apple" })}
                </Button>
              </form>
            ) : null}
          </div>
        </HideOnNativeIOS>

        <HideOnNativeIOS>
          <SupabaseEmailAuth callbackUrl={callbackUrl} uiLanguage={uiLanguage} />
        </HideOnNativeIOS>

      </section>
    </main>
  );
}
