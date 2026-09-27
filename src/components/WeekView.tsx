"use client";

import { WeekOverview, columnOf, mealsFor, treatLabel, type MainColumn } from "@/components/WeekOverview";
import { cookWarnings } from "@/lib/checks";
import { batchPortions, cx, ingredientAmount, isBatchCook, listedIngredients, recipeText } from "@/lib/format";
import {
  DAY_ORDER,
  SLOT_LABEL,
  formatDayDate,
  formatWeekRange,
} from "@/lib/prefs";
import { dayInSpan } from "@/lib/span";
import type { DayId, Meal, Treat, WeekPlan } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

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
  const milk = plan.prefs.includeMilk ? 200 : 0;
  return food + milk;
}

function recipeExcerpt(blurb: string): boolean {
  const amounts = blurb.match(/\d+\s*g\b/gi);
  return blurb.includes("…") || /^\d+\s+annos/i.test(blurb) || (amounts?.length ?? 0) >= 2;
}

function shopNote(meal: Meal, household: number): string | null {
  if (isBatchCook(meal)) return "Ostoslista sisältää tämän satsin kerran.";
  if (/aiemmin tehtyä|valmiista satsista|Edellisen sunnuntain/i.test(`${meal.prep} ${meal.blurb}`)) {
    return "Tämä annos on jo ostoslistassa satsin mukana.";
  }
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
  onEditWeek,
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
  onEditWeek: () => void;
  onExample: () => void;
  onOpenShop: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [view, setView] = useState<"overview" | "day">("overview");
  const [opened, setOpened] = useState<MainColumn | null>(null);
  const dayTotal = plan ? dayKcal(plan, day) : 0;

  async function copyRecipe(meal: Meal) {
    await navigator.clipboard.writeText(recipeText(meal));
    setCopied(meal.title);
    window.setTimeout(() => setCopied(null), 1800);
  }

  function openDay(next: DayId) {
    onDay(next);
    setOpened(null);
    setView("day");
  }

  function openMeal(next: DayId, slot: MainColumn) {
    onDay(next);
    setOpened(slot);
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
        {plan && view !== "overview" ? (
          <div className="pb-3">
            <button type="button" onClick={() => setView("overview")} className="mb-2 text-sm font-semibold text-sage">
              ← Viikko
            </button>
            {view === "day" ? (
              <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Viikonpäivät">
                {DAY_ORDER.filter((item) => dayInSpan(item.id, plan.prefs)).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={day === item.id}
                    onClick={() => openDay(item.id)}
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
            ) : null}
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
            {view === "day" ? (
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">{formatDayDate(plan.weekOf, day)}</p>
                  <h1 className="font-display text-3xl leading-tight tracking-tight">
                    {DAY_ORDER.find((item) => item.id === day)?.name}
                  </h1>
                </div>
                <p className={cx("shrink-0 text-lg font-semibold tabular-nums", day === "sat" && (dayTotal < 2200 || dayTotal > 2500) && "text-clay")}>
                  ~{dayTotal} kcal
                </p>
              </div>
            ) : (
              <h1 className="font-display text-3xl leading-tight tracking-tight">{formatWeekRange(plan.weekOf)}</h1>
            )}
          </div>

          {plan.sample ? (
            <p className="rounded-2xl bg-butter px-4 py-3 text-sm leading-5">
              Tämä on esimerkki. Oma viikko kootaan omista resepteistä.
            </p>
          ) : null}

          {cookWarnings(plan.warnings).length > 0 ? (
            <div className="rounded-2xl bg-[#fde7dc] px-4 py-3 text-sm leading-5">
              <p className="font-semibold">Tarkista nämä</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {cookWarnings(plan.warnings).map((warning, index) => (
                  <li key={`${index}-${warning}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {view === "overview" ? (
            <>
              {error ? <p className="rounded-2xl bg-[#fde7dc] px-4 py-3 text-sm leading-5">{error}</p> : null}
              <WeekOverview plan={plan} locks={locks} fresh={fresh} onOpenDay={openDay} onOpenMeal={openMeal} onToggleLock={onToggleLock} />
              {Object.keys(fresh).length > 0 ? (
                <p className="text-xs leading-4 text-sage">Vihreällä merkityt ruoat vaihtuivat juuri.</p>
              ) : null}
              {plan.sample ? null : (
                <button
                  type="button"
                  onClick={onEditWeek}
                  className="w-full rounded-2xl bg-white px-4 py-3.5 font-semibold ring-1 ring-line"
                >
                  Muokkaa viikkoa
                </button>
              )}
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
                  <h2 className="text-sm font-semibold text-muted">Muut viikot</h2>
                  <div className="mt-2 space-y-2">
                    {plans
                      .filter((item) => item.id !== plan.id)
                      .sort((a, b) => a.weekOf.localeCompare(b.weekOf) || a.createdAt.localeCompare(b.createdAt))
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelect(item.id)}
                          className="block w-full rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-line"
                        >
                          <span className="block font-medium">{formatWeekRange(item.weekOf)}</span>
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
              fresh={fresh}
              copied={copied}
              opened={opened}
              onCopy={copyRecipe}
              onShop={onOpenShop}
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
  fresh,
  copied,
  opened,
  onCopy,
  onShop,
}: {
  plan: WeekPlan;
  day: DayId;
  fresh: Record<string, true>;
  copied: string | null;
  opened: MainColumn | null;
  onCopy: (meal: Meal) => void;
  onShop: () => void;
}) {
  const meals = mealsFor(plan, day);

  return (
    <div className="space-y-3">
      {meals.map((meal) => {
        const column = columnOf(plan, day, meal);
        return (
          <MealCard
            key={`${day}-${meal.slot}-${meal.title}`}
            meal={meal}
            fresh={column ? Boolean(fresh[`${day}:${column}`]) : false}
            copied={copied === meal.title}
            household={plan.prefs.householdSize}
            startOpen={column !== null && column === opened}
            onCopy={() => onCopy(meal)}
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
  fresh,
  copied,
  household,
  startOpen,
  onCopy,
}: {
  meal: Meal;
  fresh: boolean;
  copied: boolean;
  household: number;
  startOpen: boolean;
  onCopy: () => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (startOpen) card.current?.scrollIntoView({ block: "start" });
  }, [startOpen]);
  const ingredients = listedIngredients(meal);
  const batch = isBatchCook(meal);
  const note = shopNote(meal, household);
  return (
    <article ref={card} className={cx("scroll-mt-28 overflow-hidden rounded-[1.5rem] ring-1", fresh ? "bg-[#f3faf6] ring-sage/40" : "bg-white ring-line")}>
      <div className="px-4 py-3">
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="w-full text-left">
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
      </div>
      {open ? (
        <div className="space-y-4 border-t border-line px-4 py-4">
          {meal.blurb && !recipeExcerpt(meal.blurb) ? <p className="text-sm leading-5 text-muted">{meal.blurb}</p> : null}
          {meal.proteinG || meal.carbsG || meal.fatG ? (
            <p className="text-xs text-muted">
              {meal.proteinG} g proteiinia · {meal.carbsG} g hiilihydraattia · {meal.fatG} g rasvaa · 1 annos / henkilö
            </p>
          ) : null}
          <div>
            <h4 className="text-sm font-semibold">Ainekset</h4>
            {batch ? <p className="mt-1 text-xs text-muted">Koko satsi, {batchPortions(meal)} annosta</p> : null}
            <ul className="mt-2 divide-y divide-line">
              {ingredients.map((item, index) => (
                <li key={`${index}-${item.name}-${item.grams}-${item.ml}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span>
                    {item.name}
                    {item.detail ? <span className="text-muted"> · {item.detail}</span> : null}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{ingredientAmount(item)}</span>
                </li>
              ))}
            </ul>
            {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
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
