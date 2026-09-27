"use client";

import { cx, ingredientAmount, recipeText } from "@/lib/format";
import {
  DAY_ORDER,
  SLOT_LABEL,
  formatDayDate,
  formatWeekRange,
  prefsLine,
} from "@/lib/prefs";
import type { DayId, Meal, Treat, WeekPlan } from "@/lib/types";
import { useState } from "react";

const SLOT_TONE: Record<string, string> = {
  aamiainen: "bg-[#f8efd4] text-[#6a5420]",
  lounas: "bg-[#e3f2e8] text-[#1d5c3d]",
  valipala: "bg-[#fde7dc] text-[#8a3e22]",
  paivallinen: "bg-[#e4edf8] text-[#23456e]",
  iltapala: "bg-[#eee6f6] text-[#54386e]",
  jousto: "bg-[#f6ead8] text-[#6d4b2a]",
};

function mealsFor(plan: WeekPlan, day: DayId): Meal[] {
  if (day === "sat") return plan.saturdayMeals;
  if (day === "sun") return plan.sunday;
  return plan.weekday;
}

function dayKcal(plan: WeekPlan, day: DayId) {
  const meals = mealsFor(plan, day);
  const treats = day === "sat" ? plan.saturdayTreats : [];
  const food = meals.reduce((sum, meal) => sum + meal.kcal, 0) + treats.reduce((sum, treat) => sum + treat.kcal, 0);
  const protein = meals.reduce((sum, meal) => sum + meal.proteinG, 0);
  const milk = plan.prefs.includeMilk ? 200 : 0;
  const milkProtein = plan.prefs.includeMilk ? 20 : 0;
  return { kcal: food + milk, protein: protein + milkProtein };
}

function shopTimes(day: DayId, household: number): string {
  if (day === "mon" || day === "tue" || day === "wed" || day === "thu" || day === "fri") {
    return household === 2 ? "Ostoslistassa tämä toistuu ma–pe ja kahdelle." : "Ostoslistassa tämä toistuu ma–pe.";
  }
  return household === 2 ? "Ostoslistassa kahdelle." : "Ostoslistassa yhdelle.";
}

export function WeekView({
  plan,
  plans,
  day,
  onDay,
  onGenerate,
  onExample,
  onOpenShop,
  onSelect,
  onDelete,
}: {
  plan: WeekPlan | null;
  plans: WeekPlan[];
  day: DayId;
  onDay: (day: DayId) => void;
  onGenerate: () => void;
  onExample: () => void;
  onOpenShop: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function copyRecipe(meal: Meal) {
    await navigator.clipboard.writeText(recipeText(meal));
    setCopied(meal.title);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div>
      <div className="sticky top-0 z-20 border-b border-line/80 bg-shell/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between gap-3 pb-3">
          <p className="font-display text-2xl tracking-tight">Viikkomenu</p>
          {plan ? (
            <button type="button" onClick={onGenerate} className="rounded-full bg-sage px-3.5 py-2 text-sm font-semibold text-white">
              Uusi viikko
            </button>
          ) : null}
        </div>
        {plan ? (
          <div className="flex gap-2 overflow-x-auto pb-3" role="tablist" aria-label="Viikonpäivät">
            {DAY_ORDER.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={day === item.id}
                onClick={() => onDay(item.id)}
                className={cx(
                  "min-w-12 rounded-2xl px-3 py-2 text-center",
                  day === item.id ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line",
                )}
              >
                <span className="block text-sm font-semibold">{item.short}</span>
                <span className={cx("block text-[11px]", day === item.id ? "text-white/75" : "text-muted")}>
                  {formatDayDate(plan.weekOf, item.id)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="pb-3" />
        )}
      </div>

      {!plan ? (
        <section className="px-4 py-6">
          <div className="rounded-[1.75rem] bg-white px-5 py-6 ring-1 ring-line">
            <p className="text-sm font-medium text-sage">80/20-viikko</p>
            <h1 className="mt-2 font-display text-[2rem] leading-none tracking-tight">Ruokalista ja ostoslista samalla kertaa.</h1>
            <ul className="mt-5 space-y-3 text-sm leading-5 text-muted">
              <li>Ma–pe sama viisi ateriaa, riisi tai muu lisuke vain päivällisellä.</li>
              <li>Lauantai on joustopäivä, 2200–2500 kcal herkkuineen.</li>
              <li>Sunnuntain päivälliseltä jää lisuke pois.</li>
            </ul>
            <button type="button" onClick={onGenerate} className="mt-6 w-full rounded-2xl bg-sage px-4 py-3.5 font-semibold text-white">
              Luo viikkomenu
            </button>
            <button type="button" onClick={onExample} className="mt-2 w-full rounded-2xl bg-shell px-4 py-3.5 font-semibold ring-1 ring-line">
              Näytä esimerkkiviikko
            </button>
          </div>
        </section>
      ) : (
        <WeekBody
          plan={plan}
          plans={plans}
          day={day}
          open={open}
          copied={copied}
          confirmDelete={confirmDelete}
          onOpen={(key) => setOpen((current) => (current === key ? null : key))}
          onCopy={copyRecipe}
          onShop={onOpenShop}
          onSelect={onSelect}
          onAskDelete={() => setConfirmDelete(true)}
          onCancelDelete={() => setConfirmDelete(false)}
          onDelete={() => {
            onDelete(plan.id);
            setConfirmDelete(false);
          }}
        />
      )}
    </div>
  );
}

function WeekBody({
  plan,
  plans,
  day,
  open,
  copied,
  confirmDelete,
  onOpen,
  onCopy,
  onShop,
  onSelect,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  plan: WeekPlan;
  plans: WeekPlan[];
  day: DayId;
  open: string | null;
  copied: string | null;
  confirmDelete: boolean;
  onOpen: (key: string) => void;
  onCopy: (meal: Meal) => void;
  onShop: () => void;
  onSelect: (id: string) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const info = DAY_ORDER.find((item) => item.id === day)!;
  const meals = mealsFor(plan, day);
  const totals = dayKcal(plan, day);
  const saturdayInRange = totals.kcal >= 2200 && totals.kcal <= 2500;
  const prep = day === "sat" ? plan.saturdayNote : day === "sun" ? plan.sundayPrep : plan.weekdayPrep;

  return (
    <div className="space-y-3 px-4 py-4">
      <div>
        <p className="text-sm text-muted">{formatWeekRange(plan.weekOf)}</p>
        <h1 className="font-display text-3xl leading-tight tracking-tight">{plan.title}</h1>
        <p className="mt-1 text-sm leading-5 text-muted">{plan.summary}</p>
        <p className="mt-2 text-sm text-muted">{prefsLine(plan.prefs)}</p>
      </div>

      {plan.sample ? (
        <p className="rounded-2xl bg-butter px-4 py-3 text-sm leading-5">
          Tämä on esimerkki. Oma viikko syntyy, kun luot sen OpenAI:lla.
        </p>
      ) : null}

      {plan.warnings.length > 0 ? (
        <div className="rounded-2xl bg-[#fde7dc] px-4 py-3 text-sm leading-5">
          <p className="font-semibold">Tarkista nämä</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="rounded-[1.5rem] bg-white px-4 py-4 ring-1 ring-line">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl tracking-tight">{info.name}</h2>
            <p className="text-sm text-muted">
              {day === "sat"
                ? "Joustopäivä, tavoite 2200–2500 kcal"
                : day === "sun"
                  ? "Päivällinen ilman erillistä lisuketta"
                  : "Sama ruoka toistuu ma–pe"}
            </p>
          </div>
          <p className={cx("text-right", day === "sat" && !saturdayInRange && "text-clay")}>
            <span className="block text-lg font-semibold tabular-nums">~{totals.kcal} kcal</span>
            <span className="block text-xs text-muted">~{totals.protein} g proteiinia</span>
          </p>
        </div>
        <p className="mt-2 text-xs leading-4 text-muted">
          Arvio{plan.prefs.includeMilk ? ", mukana noin 6 dl rasvatonta maitoa" : ""}. Ei pakkauksen tarkka laskelma.
        </p>
        {prep ? <p className="mt-3 rounded-2xl bg-shell px-3 py-3 text-sm leading-5">{prep}</p> : null}
      </section>

      {meals.map((meal) => {
        const key = `${day}-${meal.slot}-${meal.title}`;
        const expanded = open === key;
        return (
          <article key={key} className="overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-line">
            <button type="button" onClick={() => onOpen(key)} aria-expanded={expanded} className="w-full px-4 py-4 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", SLOT_TONE[meal.slot])}>
                    {SLOT_LABEL[meal.slot]}
                  </span>
                  <h3 className="mt-2 font-display text-xl leading-tight tracking-tight">{meal.title}</h3>
                </div>
                <p className="shrink-0 text-right text-sm">
                  <span className="block font-semibold tabular-nums">{meal.kcal} kcal</span>
                  <span className="text-muted">{meal.proteinG} g prot</span>
                </p>
              </div>
              {!expanded ? <p className="mt-2 text-sm leading-5 text-muted">{meal.blurb}</p> : null}
            </button>
            {expanded ? (
              <div className="space-y-4 border-t border-line px-4 py-4">
                <p className="text-sm leading-5">{meal.blurb}</p>
                <p className="text-xs text-muted">
                  {meal.carbsG} g hiilihydraattia · {meal.fatG} g rasvaa · 1 annos / henkilö
                </p>
                <div>
                  <h4 className="text-sm font-semibold">Ainekset</h4>
                  <ul className="mt-2 divide-y divide-line">
                    {meal.ingredients.map((item) => (
                      <li key={`${item.name}-${item.grams}-${item.pieces}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                        <span>
                          {item.name}
                          {item.detail ? <span className="text-muted"> · {item.detail}</span> : null}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">{ingredientAmount(item)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted">{shopTimes(day, plan.prefs.householdSize)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Valmistus</h4>
                  <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-5">
                    {meal.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
                {meal.prep ? <p className="rounded-2xl bg-[#e3f2e8] px-3 py-3 text-sm leading-5">{meal.prep}</p> : null}
                <button type="button" onClick={() => onCopy(meal)} className="text-sm font-semibold text-sage">
                  {copied === meal.title ? "Resepti kopioitu" : "Kopioi resepti"}
                </button>
              </div>
            ) : null}
          </article>
        );
      })}

      {day === "sat" && plan.saturdayTreats.length > 0 ? (
        <TreatCard treats={plan.saturdayTreats} />
      ) : null}

      <button type="button" onClick={onShop} className="w-full rounded-2xl bg-ink px-4 py-3.5 font-semibold text-white">
        Avaa ostoslista
      </button>

      {plans.length > 1 ? (
        <section className="pt-2">
          <h2 className="text-sm font-semibold text-muted">Aiemmat viikot</h2>
          <div className="mt-2 space-y-2">
            {plans
              .filter((item) => item.id !== plan.id)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="block w-full rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-line"
                >
                  <span className="block font-medium">{item.title}</span>
                  <span className="text-sm text-muted">{formatWeekRange(item.weekOf)}</span>
                </button>
              ))}
          </div>
        </section>
      ) : null}

      <div className="pt-2">
        {confirmDelete ? (
          <div className="flex gap-2">
            <button type="button" onClick={onDelete} className="flex-1 rounded-2xl bg-clay px-4 py-3 text-sm font-semibold text-white">
              Poista tämä viikko
            </button>
            <button type="button" onClick={onCancelDelete} className="rounded-2xl px-4 py-3 text-sm font-semibold">
              Peru
            </button>
          </div>
        ) : (
          <button type="button" onClick={onAskDelete} className="text-sm font-medium text-muted">
            Poista tämä viikko
          </button>
        )}
      </div>
    </div>
  );
}

function TreatCard({ treats }: { treats: Treat[] }) {
  return (
    <section className="rounded-[1.5rem] bg-white px-4 py-4 ring-1 ring-line">
      <h3 className="font-display text-xl tracking-tight">Herkut</h3>
      <ul className="mt-2 divide-y divide-line">
        {treats.map((treat) => (
          <li key={treat.name} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <span>
              {treat.name}
              {treat.detail ? <span className="text-muted"> · {treat.detail}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums">{treat.kcal} kcal</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
