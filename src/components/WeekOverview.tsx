"use client";

import { cx } from "@/lib/format";
import { DAY_ORDER, SLOT_LABEL, formatDayDate } from "@/lib/prefs";
import type { DayId, DinnerSide, Meal, WeekPlan } from "@/lib/types";

const WEEKDAY_INDEX: Partial<Record<DayId, number>> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4 };

function withDinnerSide(meal: Meal, side: DinnerSide): Meal {
  return {
    ...meal,
    title: `${meal.title} ja ${side.name.toLocaleLowerCase("fi")}`,
    kcal: meal.kcal + side.kcal,
    carbsG: meal.carbsG + side.carbsG,
    ingredients: [
      ...meal.ingredients,
      { name: side.name, category: side.category, grams: side.grams, pieces: 0, ml: 0, detail: side.detail },
    ],
    steps: [...meal.steps, side.step],
  };
}

export function mealsFor(plan: WeekPlan, day: DayId): Meal[] {
  if (day === "sat") return plan.saturdayMeals;
  if (day === "sun") return plan.sunday;
  const index = WEEKDAY_INDEX[day] ?? 0;
  const modern = plan.weekdays?.[index]?.meals;
  if (modern) return modern;
  const legacy = plan.weekday ?? [];
  const side = plan.dinnerSides?.[index];
  if (!side) return legacy;
  return legacy.map((meal) => (meal.slot === "paivallinen" ? withDinnerSide(meal, side) : meal));
}

export function weekdayIndexOf(day: DayId): number | undefined {
  return WEEKDAY_INDEX[day];
}

const WEEKDAYS: DayId[] = ["mon", "tue", "wed", "thu", "fri"];

export function batchLockDays(plan: WeekPlan, day: DayId, slot: MainColumn): DayId[] {
  if (day === "sat" || day === "sun") return [day];
  const current = mealsFor(plan, day).find((meal) => meal.slot === slot);
  if (!current) return [day];
  const days = WEEKDAYS.filter((id) => mealsFor(plan, id).some((meal) => meal.slot === slot && meal.title === current.title));
  return days.length ? days : [day];
}

function isReheat(meal: Meal): boolean {
  const first = meal.steps[0] ?? "";
  if (/^Lämmitä/i.test(first) && meal.steps.length <= 4) return true;
  const hint = `${meal.prep} ${meal.blurb}`;
  return /aiemmin tehtyä|valmiista satsista/i.test(hint);
}

function lunchAndDinner(meals: Meal[], day: DayId): { lunch?: Meal; dinner?: Meal } {
  const lunch = meals.find((meal) => meal.slot === "lounas");
  const dinner = meals.find((meal) => meal.slot === "paivallinen");
  if (lunch || dinner) return { lunch, dinner };
  if (day === "sat") {
    const mains = meals.filter((meal) => meal.slot === "jousto" && !/puuro/i.test(meal.title));
    return { lunch: mains[0], dinner: mains[1] };
  }
  return {};
}

export function treatLabel(treat: { name: string; grams: number; pieces: number; ml: number; kcal: number; detail: string }): string {
  if (treat.pieces > 0 || treat.grams > 0 || treat.ml > 0) return treat.name;
  const range = treat.detail.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (range) return `${range[1]}–${range[2]} kcal jäljellä`;
  return `noin ${treat.kcal} kcal jäljellä`;
}

function MealCell({ meal }: { meal?: Meal }) {
  if (!meal) {
    return <span className="text-muted">—</span>;
  }
  const reheat = isReheat(meal);
  return (
    <span className="inline">
      <span className="font-medium text-ink">{meal.title}</span>
      {reheat ? <span className="ml-1 text-[10px] font-medium text-muted">· lämmitys</span> : null}
    </span>
  );
}

export type MainColumn = "lounas" | "paivallinen";

export function columnOf(plan: WeekPlan, day: DayId, meal: Meal): MainColumn | null {
  const { lunch, dinner } = lunchAndDinner(mealsFor(plan, day), day);
  if (lunch && lunch.title === meal.title && lunch.slot === meal.slot && lunch.kcal === meal.kcal) return "lounas";
  if (dinner && dinner.title === meal.title && dinner.slot === meal.slot && dinner.kcal === meal.kcal) return "paivallinen";
  return null;
}

function LockButton({ locked, onClick }: { locked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={locked}
      aria-label={locked ? "Poista lukitus" : "Lukitse tämä ruoka"}
      onClick={onClick}
      className={cx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        locked ? "bg-ink text-white" : "text-muted",
      )}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="6" y="11" width="12" height="8" rx="1.5" />
        <path d={locked ? "M8 11V8a4 4 0 0 1 8 0v3" : "M8 11V8a4 4 0 0 1 7.5-1"} strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function WeekOverview({
  plan,
  locks,
  onOpenDay,
  onToggleLock,
}: {
  plan: WeekPlan;
  locks: Record<string, true>;
  onOpenDay: (day: DayId) => void;
  onToggleLock: (day: DayId, slot: MainColumn) => void;
}) {
  return (
    <section aria-label="Viikon lounaat ja päivälliset">
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        <div
          className="grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 border-b border-line bg-shell/60 px-3 py-1.5 text-[11px] font-semibold text-muted"
          aria-hidden
        >
          <span />
          <span>{SLOT_LABEL.lounas}</span>
          <span>{SLOT_LABEL.paivallinen}</span>
        </div>
        <ul>
          {DAY_ORDER.map((item, index) => {
            const meals = mealsFor(plan, item.id);
            const { lunch, dinner } = lunchAndDinner(meals, item.id);
            if (item.id === "sat") {
              const mains = meals.filter((meal) => meal.slot === "jousto" && !/puuro/i.test(meal.title));
              return (
                <li
                  key={item.id}
                  className={cx(
                    "grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-2 px-3 py-2 text-[13px] leading-snug",
                    index < DAY_ORDER.length - 1 && "border-b border-line",
                  )}
                >
                  <button type="button" onClick={() => onOpenDay(item.id)} className="pt-px text-left">
                    <span className="block text-sm font-semibold leading-none">{item.short}</span>
                    <span className="mt-0.5 block text-[10px] leading-none text-muted">{formatDayDate(plan.weekOf, item.id)}</span>
                  </button>
                  <span className="flex min-w-0 items-start gap-1">
                    <button type="button" onClick={() => onOpenDay(item.id)} className="min-w-0 flex-1 text-left">
                      <span className="font-medium text-ink">{mains.map((meal) => meal.title).join(" · ") || "—"}</span>
                      {plan.saturdayTreats.length ? (
                        <span className="mt-0.5 block text-[10px] leading-snug text-muted">
                          Herkut {plan.saturdayTreats.map((item) => treatLabel(item)).join(", ")}
                        </span>
                      ) : null}
                    </button>
                    {mains[0] ? (
                      <LockButton locked={Boolean(locks[`${item.id}:lounas`])} onClick={() => onToggleLock(item.id, "lounas")} />
                    ) : null}
                  </span>
                </li>
              );
            }
            return (
              <li
                key={item.id}
                className={cx(
                  "grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-2 px-3 py-2 text-[13px] leading-snug",
                  index < DAY_ORDER.length - 1 && "border-b border-line",
                )}
              >
                <button type="button" onClick={() => onOpenDay(item.id)} className="pt-px text-left">
                  <span className="block text-sm font-semibold leading-none">{item.short}</span>
                  <span className="mt-0.5 block text-[10px] leading-none text-muted">{formatDayDate(plan.weekOf, item.id)}</span>
                </button>
                <span className="flex min-w-0 items-start gap-1">
                  <button type="button" onClick={() => onOpenDay(item.id)} className="min-w-0 flex-1 text-left">
                    <MealCell meal={lunch} />
                  </button>
                  {lunch ? (
                    <LockButton locked={Boolean(locks[`${item.id}:lounas`])} onClick={() => onToggleLock(item.id, "lounas")} />
                  ) : null}
                </span>
                <span className="flex min-w-0 items-start gap-1">
                  <button type="button" onClick={() => onOpenDay(item.id)} className="min-w-0 flex-1 text-left">
                    <MealCell meal={dinner} />
                  </button>
                  {dinner ? (
                    <LockButton locked={Boolean(locks[`${item.id}:paivallinen`])} onClick={() => onToggleLock(item.id, "paivallinen")} />
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
