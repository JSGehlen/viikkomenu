"use client";

import { cx } from "@/lib/format";
import type { ModelId, Settings } from "@/lib/types";
import { useState } from "react";

const MODELS: Array<{ id: ModelId; label: string; hint: string }> = [
  { id: "gpt-6-luna", label: "Luna", hint: "Nopein ja edullisin" },
  { id: "gpt-6-sol", label: "Sol", hint: "Suositus, seuraa ruokarajoja tarkemmin" },
  { id: "gpt-6-astra", label: "Astra", hint: "Tarkin ja kallein" },
];

export function SettingsView({
  settings,
  serverKey,
  banner,
  onChange,
  onClearPlans,
  onSignOut,
}: {
  settings: Settings;
  serverKey: boolean;
  banner: string | null;
  onChange: (settings: Settings) => void;
  onClearPlans: () => void;
  onSignOut: () => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
      <h1 className="font-display text-3xl tracking-tight">Asetukset</h1>
      <p className="mt-2 text-sm leading-5 text-muted">
        Ruokatoiveet, viikot ja ostoslistan rastit tallentuvat tilillesi.
      </p>

      {banner ? <p className="mt-4 rounded-2xl bg-butter px-4 py-3 text-sm leading-5">{banner}</p> : null}

      <p className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm leading-5 ring-1 ring-line">
        {serverKey
          ? "OpenAI-avain luetaan palvelimen .env.local-tiedostosta."
          : "Lisää OPENAI_API_KEY tiedostoon .env.local ja käynnistä sovellus uudelleen."}
      </p>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">Malli</legend>
        <div className="mt-2 space-y-2">
          {MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              aria-pressed={settings.model === model.id}
              onClick={() => onChange({ ...settings, model: model.id })}
              className={cx(
                "block w-full rounded-2xl px-4 py-3 text-left ring-1",
                settings.model === model.id ? "bg-ink text-white ring-ink" : "bg-white ring-line",
              )}
            >
              <span className="block font-medium">{model.label}</span>
              <span className={cx("block text-sm", settings.model === model.id ? "text-white/75" : "text-muted")}>{model.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-8">
        {confirmClear ? (
          <div className="flex gap-2">
            <button type="button" onClick={onClearPlans} className="rounded-2xl bg-clay px-4 py-3 text-sm font-semibold text-white">
              Poista tallennetut viikot
            </button>
            <button type="button" onClick={() => setConfirmClear(false)} className="rounded-2xl px-4 py-3 text-sm font-semibold">
              Peru
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmClear(true)} className="text-sm font-medium text-muted">
            Tyhjennä tallennetut viikot
          </button>
        )}
      </div>
      <button type="button" onClick={onSignOut} className="mt-8 text-sm font-semibold text-sage">
        Kirjaudu ulos
      </button>
    </div>
  );
}
