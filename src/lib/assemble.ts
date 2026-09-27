import { CATEGORY_ORDER, SLOT_LABEL, comingMonday } from "./prefs";
import { includedDayCount } from "./span";
import type { Category, FoodPrefs, Ingredient, Meal, RawMenu, ShoppingItem, Treat, WeekPlan } from "./types";

const DAY_SCOPE = {
  saturday: "La",
  sunday: "Su",
} as const;

const WEEKDAY_LABELS = ["Ma", "Ti", "Ke", "To", "Pe"];

function useLabel(scope: keyof typeof DAY_SCOPE, meal: Meal): string {
  return `${DAY_SCOPE[scope]} · ${SLOT_LABEL[meal.slot] ?? "Ateria"}`;
}

function slug(value: string): string {
  return value
    .toLocaleLowerCase("fi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type Bucket = {
  name: string;
  category: Category;
  grams: number;
  pieces: number;
  ml: number;
  detail: string;
  uses: string[];
};

function addIngredient(
  map: Map<string, Bucket>,
  item: Ingredient,
  times: number,
  use: string,
) {
  if (times <= 0) return;
  const key = item.name.trim().toLocaleLowerCase("fi").replace(/\s+/g, " ");
  if (!key) return;
  const current = map.get(key) ?? {
    name: item.name.trim(),
    category: item.category,
    grams: 0,
    pieces: 0,
    ml: 0,
    detail: "",
    uses: [],
  };
  current.grams += item.grams * times;
  current.pieces += item.pieces * times;
  current.ml += item.ml * times;
  if (!current.detail && item.detail) current.detail = item.detail;
  if (!current.uses.includes(use)) current.uses.push(use);
  map.set(key, current);
}

function addTreat(map: Map<string, Bucket>, treat: Treat, times: number) {
  if (treat.grams <= 0 && treat.pieces <= 0 && treat.ml <= 0) return;
  addIngredient(
    map,
    {
      name: treat.name,
      category: "treats",
      grams: treat.grams,
      pieces: treat.pieces,
      ml: treat.ml,
      detail: treat.detail,
    },
    times,
    "La · Herkut",
  );
}

export function buildShopping(raw: RawMenu, prefs: FoodPrefs): ShoppingItem[] {
  const map = new Map<string, Bucket>();
  const people = prefs.householdSize;
  const seenBatch = new Set<string>();
  const shopMeal = (meal: Meal, use: string) => {
    if (meal.prep.includes("Edellisen sunnuntain satsista.")) return;
    const key = `${meal.slot}:${meal.title.trim().toLocaleLowerCase("fi")}`;
    if (seenBatch.has(key)) return;
    let times: number = people;
    if (meal.servings && meal.servings >= 2) {
      seenBatch.add(key);
      times = meal.servings;
    }
    for (const item of meal.ingredients) addIngredient(map, item, times, use);
  };
  raw.weekdays.forEach((day, index) => {
    for (const meal of day.meals) shopMeal(meal, `${WEEKDAY_LABELS[index]} · ${SLOT_LABEL[meal.slot] ?? "Ateria"}`);
  });
  for (const meal of raw.saturdayMeals) shopMeal(meal, useLabel("saturday", meal));
  for (const treat of raw.saturdayTreats) addTreat(map, treat, people);
  for (const meal of raw.sunday) shopMeal(meal, useLabel("sunday", meal));
  if (prefs.includeMilk) {
    addIngredient(
      map,
      {
        name: "Rasvaton maito",
        category: "dairy",
        grams: 0,
        pieces: 0,
        ml: 600,
        detail: "noin 6 dl päivässä",
      },
      includedDayCount(prefs) * people,
      "Joka päivä",
    );
  }

  const items = [...map.values()]
    .map((item) => ({
      ...item,
      grams: Math.round(item.grams),
      pieces: Math.round(item.pieces * 10) / 10,
      ml: Math.round(item.ml),
    }))
    .filter((item) => item.grams > 0 || item.pieces > 0 || item.ml > 0);

  items.sort((a, b) => {
    const category = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (category !== 0) return category;
    return a.name.localeCompare(b.name, "fi");
  });

  const seen = new Set<string>();
  return items.map((item) => {
    let id = slug(item.name) || "tuote";
    if (seen.has(id)) id = `${id}-${item.category}`;
    let n = 2;
    while (seen.has(id)) {
      id = `${slug(item.name)}-${n}`;
      n += 1;
    }
    seen.add(id);
    return { ...item, id };
  });
}

export function assemblePlan(
  raw: RawMenu,
  prefs: FoodPrefs,
  extra?: { sample?: boolean; warnings?: string[]; weekOf?: string },
): WeekPlan {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    weekOf: extra?.weekOf ?? comingMonday(),
    sample: extra?.sample ?? false,
    title: raw.title,
    summary: raw.summary,
    saturdayNote: raw.saturdayNote,
    sundayPrep: raw.sundayPrep,
    weekdays: raw.weekdays,
    saturdayMeals: raw.saturdayMeals,
    saturdayTreats: raw.saturdayTreats,
    sunday: raw.sunday,
    shopping: buildShopping(raw, prefs),
    prefs,
    warnings: extra?.warnings ?? [],
  };
}
