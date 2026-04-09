"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase-auth-client";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      setMessage("Vul beide wachtwoordvelden in.");
      return;
    }

    if (password.length < 8) {
      setMessage("Gebruik minimaal 8 tekens voor je nieuwe wachtwoord.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("De wachtwoorden komen niet overeen.");
      return;
    }

    setMessage(null);
    setIsBusy(true);

    const { error } = await supabase.auth.updateUser({ password });

    setIsBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setDone(true);
    setMessage("Je wachtwoord is aangepast. Je kunt nu opnieuw inloggen.");

    await supabase.auth.signOut().catch(() => null);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-hero items-center px-6 py-16 md:px-10">
      <section className="card-soft mx-auto w-full max-w-xl p-8 text-center md:p-12">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Nieuw wachtwoord instellen</h1>
        <p className="mt-4 text-[var(--muted)]">
          Kies een nieuw wachtwoord voor je account.
        </p>

        <div className="mt-6 space-y-3 text-left">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nieuw wachtwoord"
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] outline-none"
            disabled={isBusy || done}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Herhaal nieuw wachtwoord"
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] outline-none"
            disabled={isBusy || done}
          />
        </div>

        <Button
          type="button"
          className="mt-4 w-full"
          onClick={handleSubmit}
          disabled={isBusy || done}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Wachtwoord opslaan"}
        </Button>

        {done ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            Naar login
          </Button>
        ) : null}

        {message ? <p className="mt-3 text-sm text-[var(--muted)]">{message}</p> : null}
      </section>
    </main>
  );
}
