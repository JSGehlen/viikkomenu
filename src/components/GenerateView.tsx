"use client";

import { Chip, Field, TextArea, Toggle } from "@/components/controls";
import type { FoodPrefs } from "@/lib/types";

const PROTEINS: Array<{ id: FoodPrefs["proteins"][number]; label: string }> = [
  { id: "beef", label: "Jauheliha" },
  { id: "chicken", label: "Kana" },
  { id: "turkey", label: "Kalkkuna" },
  { id: "salmon", label: "Lohi" },
];

export function GenerateView({
  prefs,
  generating,
  error,
  onChange,
  onBack,
  onSubmit,
  onCancel,
}: {
  prefs: FoodPrefs;
  generating: boolean;
  error: string | null;
  onChange: (prefs: FoodPrefs) => void;
  onBack: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  function toggleProtein(id: FoodPrefs["proteins"][number]) {
    const selected = prefs.proteins.includes(id);
    const next = selected ? prefs.proteins.filter((item) => item !== id) : [...prefs.proteins, id];
    if (next.length === 0) return;
    onChange({ ...prefs, proteins: next });
  }

  return (
    <div>
      <header className="sticky top-0 z-20 flex items-center justify-between bg-shell/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <button type="button" onClick={generating ? onCancel : onBack} className="text-sm font-semibold text-sage">
          {generating ? "Keskeytä" : "Takaisin"}
        </button>
        <p className="font-display text-xl">Uusi viikko</p>
        <span className="w-16" />
      </header>

      <form
        className="space-y-6 px-4 pb-36"
        onSubmit={(event) => {
          event.preventDefault();
          if (!generating) onSubmit();
        }}
      >
        <div className="rounded-[1.5rem] bg-white px-4 py-4 text-sm leading-5 ring-1 ring-line">
          Ma–pe tulee sama lista. Lauantai pysyy 2200–2500 kcal:ssa. Sunnuntain päivälliseltä jätetään lisuke pois.
        </div>

        <Field label="Kenelle" hint="Reseptit näytetään yhdelle. Ostoslista kerrotaan henkilömäärällä.">
          <Chip selected={prefs.householdSize === 1} onClick={() => onChange({ ...prefs, householdSize: 1 })}>
            Vain minä
          </Chip>
          <Chip selected={prefs.householdSize === 2} onClick={() => onChange({ ...prefs, householdSize: 2 })}>
            Minä ja puoliso
          </Chip>
        </Field>

        <Field label="Aamiainen">
          <Chip selected={prefs.breakfast === "porridge"} onClick={() => onChange({ ...prefs, breakfast: "porridge" })}>
            Kaurapuuro
          </Chip>
          <Chip selected={prefs.breakfast === "vary"} onClick={() => onChange({ ...prefs, breakfast: "vary" })}>
            Vaihtele
          </Chip>
        </Field>

        <Field label="Välipala" hint="Pähkinöitä ei lisätä välipalalle.">
          <Chip selected={prefs.snack === "skyr"} onClick={() => onChange({ ...prefs, snack: "skyr" })}>
            Skyr ja banaani
          </Chip>
          <Chip selected={prefs.snack === "quark"} onClick={() => onChange({ ...prefs, snack: "quark" })}>
            Rahka ja banaani
          </Chip>
          <Chip selected={prefs.snack === "vary"} onClick={() => onChange({ ...prefs, snack: "vary" })}>
            Vaihtele
          </Chip>
        </Field>

        <Field label="Iltapala">
          <Chip selected={prefs.evening === "cottage"} onClick={() => onChange({ ...prefs, evening: "cottage" })}>
            Raejuusto
          </Chip>
          <Chip selected={prefs.evening === "vary"} onClick={() => onChange({ ...prefs, evening: "vary" })}>
            Vaihtele
          </Chip>
        </Field>

        <Field label="Lounas ja päivällinen" hint="Arkena lista on sama, joten viikolle valitaan yksi tai kaksi proteiinia.">
          {PROTEINS.map((item) => (
            <Chip key={item.id} selected={prefs.proteins.includes(item.id)} onClick={() => toggleProtein(item.id)}>
              {item.label}
            </Chip>
          ))}
        </Field>

        <Field label="Arkipäivällisen lisuke">
          {(
            [
              ["rice", "Riisi"],
              ["pasta", "Pasta"],
              ["potato", "Peruna"],
              ["noodles", "Nuudeli"],
              ["vary", "Vaihtele"],
            ] as const
          ).map(([id, label]) => (
            <Chip key={id} selected={prefs.carb === id} onClick={() => onChange({ ...prefs, carb: id })}>
              {label}
            </Chip>
          ))}
        </Field>

        <div className="space-y-2">
          <Toggle
            checked={prefs.batchCooking}
            onChange={(batchCooking) => onChange({ ...prefs, batchCooking })}
            label="Tee arki samasta pohjasta"
            hint="Lounas ja päivällinen samasta satsista. Lisuke vain päivälliseen."
          />
          <Toggle
            checked={prefs.slowCook}
            onChange={(slowCook) => onChange({ ...prefs, slowCook })}
            label="Padat ja uuni"
            hint="Isot satsit, jotka voi jakaa annoksiin."
          />
          <Toggle
            checked={prefs.includeMilk}
            onChange={(includeMilk) => onChange({ ...prefs, includeMilk })}
            label="6 dl rasvatonta maitoa päivässä"
            hint="Lisätään ostoslistaan eikä resepteihin."
          />
          <Toggle
            checked={prefs.avoidRepeat}
            onChange={(avoidRepeat) => onChange({ ...prefs, avoidRepeat })}
            label="Vältä edellisen viikon pääruokia"
          />
        </div>

        <TextArea
          label="Lauantai"
          value={prefs.saturday}
          onChange={(saturday) => onChange({ ...prefs, saturday })}
          placeholder="Esim. tortillat kotona, tai pizza ja herkut"
        />
        <TextArea
          label="Vältä"
          value={prefs.avoid}
          onChange={(avoid) => onChange({ ...prefs, avoid })}
          placeholder="Esim. sienet, oliivit, korianteri"
        />
        <TextArea
          label="Muuta"
          value={prefs.notes}
          onChange={(notes) => onChange({ ...prefs, notes })}
          placeholder="Esim. käytä pakastimessa oleva kana ensin"
        />

        {error ? <p className="rounded-2xl bg-[#fde7dc] px-4 py-3 text-sm leading-5">{error}</p> : null}
      </form>

      <div className="no-print fixed bottom-0 left-1/2 z-30 w-full max-w-lg -translate-x-1/2 border-t border-line bg-shell/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <button
          type="button"
          onClick={generating ? undefined : onSubmit}
          disabled={generating}
          className="w-full rounded-2xl bg-sage px-4 py-3.5 font-semibold text-white disabled:opacity-70"
        >
          {generating ? "Luodaan viikkoa…" : "Luo viikkomenu"}
        </button>
        {generating ? (
          <p className="pt-2 text-center text-xs text-muted">Tämä kestää yleensä alle minuutin. Älä sulje sivua.</p>
        ) : null}
      </div>
    </div>
  );
}
