"use client";

import { WeekOverview, columnOf, mealsFor, treatLabel, weekdayIndexOf, type MainColumn } from "@/components/WeekOverview";
import { cx, ingredientAmount, recipeText } from "@/lib/format";
import {
  DAY_ORDER,
  SLOT_LABEL,
  formatDayDate,
  formatWeekRange,
  prefsLine,
} from "@/lib/prefs";
import { dayInSpan } from "@/lib/span";
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

function dayKcal(plan: WeekPlan, day: DayId) {
  const meals = mealsFor(plan, day);
  const treats = day === "sat" ? plan.saturdayTreats : [];
  const food = meals.reduce((sum, meal) => sum + meal.kcal, 0) + treats.reduce((sum, treat) => sum + treat.kcal, 0);
  const protein = meals.reduce((sum, meal) => sum + meal.proteinG, 0);
  const milk = plan.prefs.includeMilk ? 200 : 0;
  const milkProtein = plan.prefs.includeMilk ? 20 : 0;
  return { kcal: food + milk, protein: protein + milkProtein };
}

function shopTimes(household: number): string {
  return household === 2 ? "Tämän päivän annos ostoslistassa kahdelle." : "Tämän päivän annos ostoslistassa.";
}

export function WeekView({
  plan,
  plans,
  day,
  locks,
  fresh,
  generating,
  error,
  onDay,
  onGenerate,
  onFill,
  onNext,
  onToggleLock,
  onExample,
  onOpenShop,
  onSelect,
  onDelete,
}: {
  plan: WeekPlan | null;
  plans: WeekPlan[];
  day: DayId;
  locks: Record<string, true>;
  fresh: Record<string, true>;
  generating: boolean;
  error: string | null;
  onDay: (day: DayId) => void;
  onGenerate: () => void;
  onFill: () => void;
  onNext: () => void;
  onToggleLock: (day: DayId, slot: MainColumn) => void;
  onExample: () => void;
  onOpenShop: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [view, setView] = useState<"overview" | "day">("overview");

  async function copyRecipe(meal: Meal) {
    await navigator.clipboard.writeText(recipeText(meal));
    setCopied(meal.title);
    window.setTimeout(() => setCopied(null), 1800);
  }

  function openDay(next: DayId) {
    onDay(next);
    setView("day");
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
        {plan && view === "day" ? (
          <div className="pb-3">
            <button
              type="button"
              onClick={() => setView("overview")}
              className="mb-2 text-sm font-semibold text-sage"
            >
              ← Viikko
            </button>
            <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Viikonpäivät">
              {DAY_ORDER.filter((item) => dayInSpan(item.id, plan.prefs)).map((item) => (
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
              <li>Lounas ja päivällinen tehdään satsina ja syödään useana päivänä.</li>
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
        <div className="space-y-3 px-4 py-4">
          <div>
            <p className="text-sm text-muted">{formatWeekRange(plan.weekOf)}</p>
            <h1 className="font-display text-3xl leading-tight tracking-tight">{plan.title}</h1>
            <p className="mt-1 text-sm leading-5 text-muted">{plan.summary}</p>
            <p className="mt-2 text-sm text-muted">{prefsLine(plan.prefs)}</p>
          </div>

          {plan.sample ? (
            <p className="rounded-2xl bg-butter px-4 py-3 text-sm leading-5">
              Tämä on esimerkki. Oma viikko kootaan omista resepteistä.
            </p>
          ) : null}

          {plan.warnings.length > 0 ? (
            <div className="rounded-2xl bg-[#fde7dc] px-4 py-3 text-sm leading-5">
              <p className="font-semibold">Tarkista nämä</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {plan.warnings.map((warning, index) => (
                  <li key={`${index}-${warning}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {view === "overview" ? (
            <>
              {error ? <p className="rounded-2xl bg-[#fde7dc] px-4 py-3 text-sm leading-5">{error}</p> : null}
              <WeekOverview plan={plan} locks={locks} fresh={fresh} onOpenDay={openDay} onToggleLock={onToggleLock} />
              {Object.keys(fresh).length > 0 ? (
                <p className="text-xs leading-4 text-sage">Vihreällä merkityt ruoat vaihtuivat juuri.</p>
              ) : null}
              <p className="text-xs leading-4 text-muted">Lukitse ruoat, jotka haluat pitää. Muut pääruoat voi luoda uudelleen.</p>
              {Object.keys(locks).length > 0 ? (
                <button
                  type="button"
                  onClick={generating ? undefined : onFill}
                  disabled={generating}
                  className="w-full rounded-2xl bg-sage px-4 py-3.5 font-semibold text-white disabled:opacity-70"
                >
                  {generating ? "Luodaan loput…" : "Luo lukitsemattomat"}
                </button>
              ) : null}
              <button type="button" onClick={onOpenShop} className="w-full rounded-2xl bg-ink px-4 py-3.5 font-semibold text-white">
                Avaa ostoslista
              </button>
              {plan.sample ? null : (
                <button
                  type="button"
                  onClick={generating ? undefined : onNext}
                  disabled={generating}
                  className="w-full rounded-2xl bg-white px-4 py-3.5 font-semibold ring-1 ring-line disabled:opacity-70"
                >
                  {generating ? "Luodaan seuraavaa viikkoa…" : "Seuraava viikko"}
                </button>
              )}
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
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(plan.id);
                        setConfirmDelete(false);
                      }}
                      className="flex-1 rounded-2xl bg-clay px-4 py-3 text-sm font-semibold text-white"
                    >
                      Poista tämä viikko
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-2xl px-4 py-3 text-sm font-semibold">
                      Peru
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-medium text-muted">
                    Poista tämä viikko
                  </button>
                )}
              </div>
            </>
          ) : (
            <WeekBody
              plan={plan}
              day={day}
              locks={locks}
              fresh={fresh}
              copied={copied}
              onCopy={copyRecipe}
              onShop={onOpenShop}
              onToggleLock={onToggleLock}
            />
          )}
        </div>
      )}
    </div>
  );
}

function WeekBody({
  plan,
  day,
  locks,
  fresh,
  copied,
  onCopy,
  onShop,
  onToggleLock,
}: {
  plan: WeekPlan;
  day: DayId;
  locks: Record<string, true>;
  fresh: Record<string, true>;
  copied: string | null;
  onCopy: (meal: Meal) => void;
  onShop: () => void;
  onToggleLock: (day: DayId, slot: MainColumn) => void;
}) {
  const info = DAY_ORDER.find((item) => item.id === day)!;
  const meals = mealsFor(plan, day);
  const totals = dayKcal(plan, day);
  const saturdayInRange = totals.kcal >= 2200 && totals.kcal <= 2500;
  const weekdayIndex = weekdayIndexOf(day);
  const prep =
    day === "sat"
      ? plan.saturdayNote
      : day === "sun"
        ? plan.sundayPrep
        : (plan.weekdays?.[weekdayIndex ?? 0]?.prep ?? plan.weekdayPrep);
  const [dayOpen, setDayOpen] = useState(false);

  return (
    <div className="space-y-3">
      <section className="rounded-[1.5rem] bg-white px-4 py-4 ring-1 ring-line">
        <button type="button" aria-expanded={dayOpen} onClick={() => setDayOpen((value) => !value)} className="w-full text-left">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl tracking-tight">{info.name}</h2>
              <p className="text-sm text-muted">
                {day === "sat"
                  ? "Joustopäivä, tavoite 2200–2500 kcal"
                  : day === "sun"
                    ? "Päivällinen ilman erillistä lisuketta"
                    : "Satsin annos tai uusi satsi"}
              </p>
            </div>
            <p className={cx("text-right", day === "sat" && !saturdayInRange && "text-clay")}>
              <span className="block text-lg font-semibold tabular-nums">~{totals.kcal} kcal</span>
              <span className="block text-xs text-muted">~{totals.protein} g proteiinia</span>
            </p>
          </div>
        </button>
        {dayOpen ? (
          <>
            <p className="mt-2 text-xs leading-4 text-muted">
              Arvio{plan.prefs.includeMilk ? ", mukana noin 6 dl rasvatonta maitoa" : ""}. Ei pakkauksen tarkka laskelma.
            </p>
            {prep ? <p className="mt-3 rounded-2xl bg-shell px-3 py-3 text-sm leading-5">{prep}</p> : null}
          </>
        ) : null}
      </section>

      {meals.map((meal) => {
        const column = columnOf(plan, day, meal);
        return (
          <MealCard
            key={`${day}-${meal.slot}-${meal.title}`}
            meal={meal}
            column={column}
            locked={column ? Boolean(locks[`${day}:${column}`]) : false}
            fresh={column ? Boolean(fresh[`${day}:${column}`]) : false}
            copied={copied === meal.title}
            household={plan.prefs.householdSize}
            onCopy={() => onCopy(meal)}
            onToggleLock={() => {
              if (column) onToggleLock(day, column);
            }}
          />
        );
      })}

      {day === "sat" && plan.saturdayTreats.length > 0 ? (
        <TreatCard treats={plan.saturdayTreats} />
      ) : null}

      <button type="button" onClick={onShop} className="w-full rounded-2xl bg-ink px-4 py-3.5 font-semibold text-white">
        Avaa ostoslista
      </button>
    </div>
  );
}

function MealCard({
  meal,
  column,
  locked,
  fresh,
  copied,
  household,
  onCopy,
  onToggleLock,
}: {
  meal: Meal;
  column: MainColumn | null;
  locked: boolean;
  fresh: boolean;
  copied: boolean;
  household: number;
  onCopy: () => void;
  onToggleLock: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className={cx("overflow-hidden rounded-[1.5rem] ring-1", fresh ? "bg-[#f3faf6] ring-sage/40" : "bg-white ring-line")}>
      <div className="flex items-start gap-2 px-4 py-3">
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="min-w-0 flex-1 text-left">
          <span className="inline-flex items-center gap-1.5">
            <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", SLOT_TONE[meal.slot])}>
              {SLOT_LABEL[meal.slot]}
            </span>
            {fresh ? <span className="rounded-full bg-sage px-2 py-1 text-[10px] font-semibold text-white">Uusi</span> : null}
          </span>
          <span className="mt-2 flex items-baseline justify-between gap-3">
            <span className="font-display text-lg leading-tight tracking-tight">{meal.title}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{meal.kcal} kcal</span>
          </span>
        </button>
        {column ? (
          <button
            type="button"
            aria-pressed={locked}
            onClick={onToggleLock}
            className={cx(
              "mt-0.5 shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
              locked ? "bg-ink text-white" : "bg-shell text-ink ring-1 ring-line",
            )}
          >
            {locked ? "Lukittu" : "Lukitse"}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-4 border-t border-line px-4 py-4">
          {meal.blurb ? <p className="text-sm leading-5 text-muted">{meal.blurb}</p> : null}
          <p className="text-xs text-muted">
            {meal.proteinG} g proteiinia · {meal.carbsG} g hiilihydraattia · {meal.fatG} g rasvaa · 1 annos / henkilö
          </p>
          <div>
            <h4 className="text-sm font-semibold">Ainekset</h4>
            <ul className="mt-2 divide-y divide-line">
              {meal.ingredients.map((item, index) => (
                <li key={`${index}-${item.name}-${item.grams}-${item.ml}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span>
                    {item.name}
                    {item.detail ? <span className="text-muted"> · {item.detail}</span> : null}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{ingredientAmount(item)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">{shopTimes(household)}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Resepti</h4>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-5">
              {meal.steps.map((step, index) => (
                <li key={`${index}-${step}`}>{step}</li>
              ))}
            </ol>
          </div>
          {meal.prep ? <p className="rounded-2xl bg-[#e3f2e8] px-3 py-3 text-sm leading-5">{meal.prep}</p> : null}
          <button type="button" onClick={onCopy} className="text-sm font-semibold text-sage">
            {copied ? "Resepti kopioitu" : "Kopioi resepti"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function TreatCard({ treats }: { treats: Treat[] }) {
  const budget = treats.filter((treat) => treat.grams <= 0 && treat.pieces <= 0 && treat.ml <= 0);
  const products = treats.filter((treat) => treat.grams > 0 || treat.pieces > 0 || treat.ml > 0);
  return (
    <section className="rounded-[1.5rem] bg-white px-4 py-4 ring-1 ring-line">
      <h3 className="font-display text-xl tracking-tight">Herkut</h3>
      {budget.map((treat) => (
        <div key={treat.detail} className="mt-2">
          <p className="text-sm font-medium">{treatLabel(treat)}</p>
          <p className="mt-1 text-sm leading-5 text-muted">
            Aamiainen, välipala, iltapala ja päivän ruoka on jo laskettu. Esimerkiksi Remix, Minttu Crisp, Takis tai sipsit. Tarkista pakkaus.
          </p>
        </div>
      ))}
      {products.length > 0 ? (
        <ul className="mt-2 divide-y divide-line">
          {products.map((treat) => (
            <li key={treat.name} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span>
                {treat.name}
                {treat.detail ? <span className="text-muted"> · {treat.detail}</span> : null}
              </span>
              <span className="shrink-0 tabular-nums">{treat.kcal} kcal</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
