export const CATEGORIES = [
  "meat",
  "dairy",
  "produce",
  "fruit",
  "dry",
  "frozen",
  "bakery",
  "treats",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const SLOTS = [
  "aamiainen",
  "lounas",
  "valipala",
  "paivallinen",
  "iltapala",
  "jousto",
] as const;

export type Slot = (typeof SLOTS)[number];

export const WEEKDAY_SLOTS = [
  "aamiainen",
  "lounas",
  "valipala",
  "paivallinen",
  "iltapala",
] as const;

export type DayId = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type Ingredient = {
  name: string;
  category: Category;
  grams: number;
  pieces: number;
  ml: number;
  detail: string;
};

export type Meal = {
  slot: Slot;
  title: string;
  blurb: string;
  ingredients: Ingredient[];
  steps: string[];
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  prep: string;
};

export type Treat = {
  name: string;
  grams: number;
  pieces: number;
  ml: number;
  kcal: number;
  detail: string;
};

export const CARB_IDS = ["rice", "pasta", "potato", "noodles"] as const;

export type CarbId = (typeof CARB_IDS)[number];

export type DinnerSide = {
  name: string;
  category: Category;
  grams: number;
  detail: string;
  kcal: number;
  carbsG: number;
  step: string;
};

export type DayMenu = {
  prep: string;
  meals: Meal[];
};

export type RawMenu = {
  title: string;
  summary: string;
  weekdays: DayMenu[];
  saturdayNote: string;
  saturdayMeals: Meal[];
  saturdayTreats: Treat[];
  sundayPrep: string;
  sunday: Meal[];
};

export type ShoppingItem = {
  id: string;
  name: string;
  category: Category;
  grams: number;
  pieces: number;
  ml: number;
  detail: string;
  uses: string[];
};

export type FoodPrefs = {
  householdSize: 1 | 2;
  includeMilk: boolean;
  batchCooking: boolean;
  slowCook: boolean;
  breakfast: "porridge" | "vary";
  snack: "skyr" | "quark" | "vary";
  evening: "cottage" | "vary";
  proteins: Array<"beef" | "chicken" | "turkey" | "salmon">;
  carbs: CarbId[];
  saturday: string;
  avoid: string;
  notes: string;
  avoidRepeat: boolean;
  inventOne: boolean;
};

export type ModelId = "gpt-6-sol" | "gpt-6-luna" | "gpt-6-astra";

export type Settings = FoodPrefs & {
  model: ModelId;
};

export type WeekPlan = {
  id: string;
  createdAt: string;
  weekOf: string;
  sample: boolean;
  title: string;
  summary: string;
  weekdayPrep?: string;
  saturdayNote: string;
  sundayPrep: string;
  weekdays?: DayMenu[];
  weekday?: Meal[];
  dinnerSides?: DinnerSide[];
  saturdayMeals: Meal[];
  saturdayTreats: Treat[];
  sunday: Meal[];
  shopping: ShoppingItem[];
  prefs: FoodPrefs;
  warnings: string[];
};

export type Persisted = {
  settings: Settings;
  plans: WeekPlan[];
  activeId: string | null;
  checks: Record<string, string[]>;
};
