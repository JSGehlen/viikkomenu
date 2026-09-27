import { CARB_IDS, type CarbId, type DayId, type FoodPrefs, type Settings } from "./types";

export const DEFAULT_FOOD_PREFS: FoodPrefs = {
  householdSize: 1,
  includeMilk: true,
  batchCooking: true,
  breakfast: "porridge",
  snack: "skyr",
  evening: "cottage",
  proteins: ["beef", "chicken"],
  carbs: ["rice", "pasta", "potato", "noodles"],
  saturday: "",
  preferences: "",
  avoid: "",
  notes: "",
  avoidRepeat: true,
  inventOne: false,
  inventDays: [],
  startDay: "mon",
  startSlot: "aamiainen",
};

export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_FOOD_PREFS,
  model: "gpt-6-sol",
};

export const DAY_ORDER: Array<{ id: DayId; short: string; name: string }> = [
  { id: "mon", short: "Ma", name: "Maanantai" },
  { id: "tue", short: "Ti", name: "Tiistai" },
  { id: "wed", short: "Ke", name: "Keskiviikko" },
  { id: "thu", short: "To", name: "Torstai" },
  { id: "fri", short: "Pe", name: "Perjantai" },
  { id: "sat", short: "La", name: "Lauantai" },
  { id: "sun", short: "Su", name: "Sunnuntai" },
];

export const SLOT_LABEL: Record<string, string> = {
  aamiainen: "Aamiainen",
  lounas: "Lounas",
  valipala: "Välipala",
  paivallinen: "Päivällinen",
  iltapala: "Iltapala",
  jousto: "Joustopäivä",
};

export const CATEGORY_LABEL: Record<string, string> = {
  meat: "Liha ja kala",
  dairy: "Maitotuotteet",
  produce: "Kasvikset",
  fruit: "Hedelmät ja marjat",
  dry: "Kuivakaappi",
  frozen: "Pakaste",
  bakery: "Leipä",
  treats: "Herkut",
  other: "Muuta",
};

export const CATEGORY_ORDER = [
  "produce",
  "fruit",
  "meat",
  "dairy",
  "bakery",
  "dry",
  "frozen",
  "treats",
  "other",
];

export function normalizeCarbs(value: unknown): CarbId[] {
  const picked = Array.isArray(value) ? value.filter((item): item is CarbId => CARB_IDS.includes(item)) : [];
  return picked.length >= 2 ? picked : [...CARB_IDS];
}

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addWeek(weekOf: string): string {
  const date = new Date(`${weekOf}T12:00:00`);
  date.setDate(date.getDate() + 7);
  return isoDate(date);
}

export function comingMonday(now = new Date()): string {
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  if (day === 0) date.setDate(date.getDate() + 1);
  else if (day === 6) date.setDate(date.getDate() + 2);
  else date.setDate(date.getDate() - (day - 1));
  return isoDate(date);
}

const dayFormat = new Intl.DateTimeFormat("fi-FI", { day: "numeric", month: "numeric" });

export function formatWeekRange(weekOf: string): string {
  const start = new Date(`${weekOf}T12:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${dayFormat.format(start)}–${dayFormat.format(end)}`;
}

export function formatDayDate(weekOf: string, day: DayId): string {
  const offset: Record<DayId, number> = {
    mon: 0,
    tue: 1,
    wed: 2,
    thu: 3,
    fri: 4,
    sat: 5,
    sun: 6,
  };
  const date = new Date(`${weekOf}T12:00:00`);
  date.setDate(date.getDate() + offset[day]);
  return dayFormat.format(date);
}

export function todayId(now = new Date()): DayId {
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[now.getDay()];
}

export function sameFoodPrefs(a: FoodPrefs, b: FoodPrefs): boolean {
  return JSON.stringify(foodPrefsKey(a)) === JSON.stringify(foodPrefsKey(b));
}

export function keepMealOnEdit(before: FoodPrefs, after: FoodPrefs, day: DayId): boolean {
  const previous = foodPrefsKey(before);
  const next = foodPrefsKey(after);
  if (previous.householdSize !== next.householdSize || previous.avoid !== next.avoid) return false;
  if (JSON.stringify(previous.proteins) !== JSON.stringify(next.proteins)) return false;
  if (JSON.stringify(previous.carbs) !== JSON.stringify(next.carbs)) return false;
  if (day === "sat") return previous.saturday === next.saturday;
  const replaced = new Set<DayId>([
    ...previous.inventDays.filter((id) => !next.inventDays.includes(id)),
    ...next.inventDays.filter((id) => !previous.inventDays.includes(id)),
  ]);
  if (previous.notes !== next.notes || previous.preferences !== next.preferences) {
    for (const id of next.inventDays) replaced.add(id);
  }
  return !replaced.has(day);
}

function foodPrefsKey(prefs: FoodPrefs) {
  return {
    ...prefs,
    saturday: prefs.saturday.trim(),
    preferences: prefs.preferences.trim(),
    avoid: prefs.avoid.trim(),
    notes: prefs.notes.trim(),
    proteins: [...prefs.proteins].sort(),
    carbs: [...prefs.carbs].sort(),
    inventDays: [...prefs.inventDays].sort(),
  };
}

export function foodPrefsFromSettings(settings: Settings): FoodPrefs {
  const {
    householdSize,
    includeMilk,
    batchCooking,
    breakfast,
    snack,
    evening,
    proteins,
    carbs,
    saturday,
    preferences,
    avoid,
    notes,
    avoidRepeat,
    inventOne,
    inventDays,
    startDay,
    startSlot,
  } = settings;
  return {
    householdSize,
    includeMilk,
    batchCooking,
    breakfast,
    snack,
    evening,
    proteins,
    carbs: normalizeCarbs(carbs),
    saturday,
    preferences: typeof preferences === "string" ? preferences : "",
    avoid,
    notes,
    avoidRepeat,
    inventOne,
    inventDays: normalizeInventDays(inventDays),
    startDay: isDay(startDay) ? startDay : "mon",
    startSlot: isStartSlot(startSlot) ? startSlot : "aamiainen",
  };
}

const START_SLOTS = ["aamiainen", "lounas", "valipala", "paivallinen", "iltapala"] as const;

function isDay(value: unknown): value is DayId {
  return value === "mon" || value === "tue" || value === "wed" || value === "thu" || value === "fri" || value === "sat" || value === "sun";
}

function isStartSlot(value: unknown): value is FoodPrefs["startSlot"] {
  return START_SLOTS.some((slot) => slot === value);
}

export function normalizeInventDays(value: unknown): DayId[] {
  if (!Array.isArray(value)) return [];
  const days = value.filter((item): item is DayId => isDay(item) && item !== "sat");
  return [...new Set(days)];
}
