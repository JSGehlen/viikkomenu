"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export function AuthView() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const supabase = createClient();
      if (mode === "sign-up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Vahvista tili sähköpostissa olevasta linkistä, ja kirjaudu sitten.");
          setMode("sign-in");
        }
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
    } catch (caught) {
      setError(authMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="px-4 pt-16">
      <p className="font-display text-3xl tracking-tight">Viikkomenu</p>
      <h1 className="mt-6 font-display text-3xl tracking-tight">
        {mode === "sign-in" ? "Kirjaudu tilillesi." : "Luo tili."}
      </h1>
      <p className="mt-2 text-sm leading-5 text-muted">
        Viikot, ruokatoiveet ja ostoslistan rastit tallentuvat tilillesi.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block">
          <span className="text-sm font-semibold">Sähköposti</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-base ring-1 ring-line outline-none focus:ring-2 focus:ring-sage"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Salasana</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-base ring-1 ring-line outline-none focus:ring-2 focus:ring-sage"
          />
        </label>
        {error ? <p className="rounded-2xl bg-butter px-4 py-3 text-sm leading-5">{error}</p> : null}
        {notice ? <p className="rounded-2xl bg-butter px-4 py-3 text-sm leading-5">{notice}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-2xl bg-sage px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Odota…" : mode === "sign-in" ? "Kirjaudu" : "Luo tili"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
          setError(null);
          setNotice(null);
        }}
        className="mt-4 text-sm font-semibold text-sage"
      >
        {mode === "sign-in" ? "Ei tiliä? Luo tili" : "Onko tili jo olemassa? Kirjaudu"}
      </button>
    </div>
  );
}

function authMessage(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : "";
  if (/invalid login credentials/i.test(message)) return "Sähköposti tai salasana ei täsmää.";
  if (/already registered/i.test(message)) return "Tili on jo olemassa. Kirjaudu sisään.";
  if (/email not confirmed/i.test(message)) return "Vahvista sähköposti ensin.";
  if (/password/i.test(message) && /6|least/i.test(message)) return "Salasanassa pitää olla vähintään 6 merkkiä.";
  return "Kirjautuminen epäonnistui. Yritä uudelleen.";
}
