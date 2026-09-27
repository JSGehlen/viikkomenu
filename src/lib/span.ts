import type { DayId, FoodPrefs, RawMenu } from "./types";

const DAY_INDEX: Record<DayId, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
const WEEKDAYS: DayId[] = ["mon", "tue", "wed", "thu", "fri"];

const SLOT_RANK: Record<string, number> = {
  aamiainen: 0,
  lounas: 1,
  valipala: 2,
  jousto: 3,
  paivallinen: 3,
  iltapala: 4,
};

export function includesSlot(day: DayId, slot: string, prefs: FoodPrefs): boolean {
  const startDay = DAY_INDEX[prefs.startDay] === undefined ? "mon" : prefs.startDay;
  const startSlot = SLOT_RANK[prefs.startSlot] === undefined ? "aamiainen" : prefs.startSlot;
  return DAY_INDEX[day] * 10 + (SLOT_RANK[slot] ?? 0) >= DAY_INDEX[startDay] * 10 + SLOT_RANK[startSlot];
}

export function dayInSpan(day: DayId, prefs: FoodPrefs): boolean {
  const slots = day === "sat" ? ["aamiainen", "valipala", "jousto", "iltapala"] : ["aamiainen", "lounas", "valipala", "paivallinen", "iltapala"];
  return slots.some((slot) => includesSlot(day, slot, prefs));
}

export function includedDayCount(prefs: FoodPrefs): number {
  return (Object.keys(DAY_INDEX) as DayId[]).filter((day) => dayInSpan(day, prefs)).length;
}

export function applySpan(raw: RawMenu, prefs: FoodPrefs): RawMenu {
  if (prefs.startDay === "mon" && prefs.startSlot === "aamiainen") return raw;
  return {
    ...raw,
    weekdays: raw.weekdays.map((day, index) => ({
      ...day,
      meals: day.meals.filter((meal) => includesSlot(WEEKDAYS[index] ?? "mon", meal.slot, prefs)),
    })),
    saturdayMeals: raw.saturdayMeals.filter((meal) => includesSlot("sat", meal.slot, prefs)),
    saturdayTreats: includesSlot("sat", "jousto", prefs) ? raw.saturdayTreats : [],
    saturdayNote: dayInSpan("sat", prefs) ? raw.saturdayNote : "",
    sunday: raw.sunday.filter((meal) => includesSlot("sun", meal.slot, prefs)),
  };
}
