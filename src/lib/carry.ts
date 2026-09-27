import { recipeBatchSize } from "./recipeBody";
import type { DayId, Meal } from "./types";
import type { KeptMeal } from "./weekPlan";

export const CARRY_MARK = "Edellisen sunnuntain satsista.";

const WEEKDAYS: DayId[] = ["mon", "tue", "wed", "thu", "fri"];

function carried(meal: Meal, slot: "lounas" | "paivallinen", first: boolean): Meal {
  if (first) {
    return {
      ...meal,
      slot,
      blurb: "Jatkoa sunnuntain satsista.",
      prep: CARRY_MARK,
    };
  }
  return {
    ...meal,
    slot,
    blurb: "Annos sunnuntain satsista.",
    steps: ["Lämmitä yksi annos keskilämmöllä noin 4 minuuttia.", "Tarkista että ruoka on kuumaa keskeltä.", "Tarjoile."],
    prep: CARRY_MARK,
  };
}

export function weekdayLeftovers(meals: KeptMeal[], household: 1 | 2): KeptMeal[] {
  const groups = new Map<string, KeptMeal[]>();
  for (const item of meals) {
    if (item.meal.prep.includes(CARRY_MARK)) continue;
    const key = `${item.slot}:${item.meal.title}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const planned: KeptMeal[] = [];
  for (const group of groups.values()) {
    const slot = group[0]?.slot;
    const source = group[0]?.meal;
    if (!slot || !source) continue;
    const size = recipeBatchSize(source.title, slot === "paivallinen") ?? 0;
    if (size < 2) continue;
    const sourceMeal = group.reduce((best, item) => {
      const bestCook = !/aiemmin tehtyä/.test(best.meal.prep);
      const itemCook = !/aiemmin tehtyä/.test(item.meal.prep);
      if (itemCook !== bestCook) return itemCook ? item : best;
      return item.meal.steps.length > best.meal.steps.length ? item : best;
    }).meal;
    let extra = Math.floor(size / household) - group.length;
    for (const day of WEEKDAYS) {
      if (extra <= 0) break;
      if (planned.some((item) => item.day === day && item.slot === slot)) continue;
      const first = !planned.some((item) => item.slot === slot && item.meal.title === sourceMeal.title);
      planned.push({ day, slot, meal: carried(sourceMeal, slot, first) });
      extra -= 1;
    }
  }
  return planned;
}

export function sundayLeftovers(sunday: Meal[], household: 1 | 2): KeptMeal[] {
  const mains = sunday.filter((meal) => meal.slot === "lounas" || meal.slot === "paivallinen");
  const planned: KeptMeal[] = [];
  const taken = new Set<string>();
  for (const title of [...new Set(mains.map((meal) => meal.title))]) {
    const group = mains.filter((meal) => meal.title === title);
    const dinner = group.find((meal) => meal.slot === "paivallinen");
    const lunch = group.find((meal) => meal.slot === "lounas");
    const size = Math.max(recipeBatchSize(title, true) ?? 0, recipeBatchSize(title, false) ?? 0);
    if (size < 2) continue;
    let extra = Math.floor(size / household) - group.length;
    const slots: Array<"lounas" | "paivallinen"> = [];
    if (lunch) slots.push("lounas");
    if (dinner) slots.push("paivallinen");
    if (!slots.length || extra <= 0) continue;
    const sourceFor = (slot: "lounas" | "paivallinen") => (slot === "paivallinen" ? dinner : lunch) ?? dinner ?? lunch;
    const place = (day: DayId, slot: "lounas" | "paivallinen") => {
      if (extra <= 0 || taken.has(`${day}:${slot}`)) return;
      const source = sourceFor(slot);
      if (!source) return;
      const first = !planned.some((item) => item.slot === slot && item.meal.title === title);
      planned.push({ day, slot, meal: carried(source, slot, first) });
      taken.add(`${day}:${slot}`);
      extra -= 1;
    };
    for (const day of WEEKDAYS) {
      for (const slot of slots) place(day, slot);
    }
    if (slots.length === 1 && slots[0] === "paivallinen") {
      for (const day of WEEKDAYS) place(day, "lounas");
    }
  }
  return planned;
}

export function carryForward(sunday: Meal[], mains: KeptMeal[], household: 1 | 2): KeptMeal[] {
  const keys = new Set(
    mains.filter((item) => !item.meal.prep.includes(CARRY_MARK)).map((item) => `${item.slot}:${item.meal.title}`),
  );
  const joined = [...mains];
  const only: Meal[] = [];
  for (const meal of sunday) {
    if (meal.slot !== "lounas" && meal.slot !== "paivallinen") continue;
    if (meal.prep.includes(CARRY_MARK)) continue;
    if (keys.has(`${meal.slot}:${meal.title}`)) joined.push({ day: "sun", slot: meal.slot, meal });
    else only.push(meal);
  }
  const fromWeek = weekdayLeftovers(joined, household);
  const taken = new Set(fromWeek.map((item) => `${item.day}:${item.slot}`));
  const fromSunday = sundayLeftovers(only, household).filter((item) => !taken.has(`${item.day}:${item.slot}`));
  return [...fromWeek, ...fromSunday];
}
