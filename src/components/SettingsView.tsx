"use client";

import type { Settings } from "@/lib/types";
import { useState } from "react";

export function SettingsView({
  banner,
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
        Viikko kootaan omista resepteistä, eikä se kuluta krediittejä. Luo-näkymän Keksi yksi uusi satsi keksii yhden ruoan halvimmalla mallilla.
      </p>

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
