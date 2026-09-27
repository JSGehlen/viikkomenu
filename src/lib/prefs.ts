import type { DayId, FoodPrefs, Settings } from "./types";

export const DEFAULT_FOOD_PREFS: FoodPrefs = {
  householdSize: 1,
  includeMilk: true,
  batchCooking: true,
  slowCook: false,
  breakfast: "porridge",
  snack: "skyr",
  evening: "cottage",
  proteins: ["beef", "chicken"],
  carb: "rice",
  saturday: "",
  avoid: "",
  notes: "",
  avoidRepeat: true,
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

const PROTEIN_WORD: Record<FoodPrefs["proteins"][number], string> = {
  beef: "jauheliha",
  chicken: "kana",
  turkey: "kalkkuna",
  salmon: "lohi",
};

const CARB_WORD: Record<FoodPrefs["carb"], string> = {
  rice: "riisi",
  pasta: "pasta",
  potato: "peruna",
  noodles: "nuudeli",
  vary: "vaihtuva lisuke",
};

export function prefsLine(prefs: FoodPrefs): string {
  const people = prefs.householdSize === 2 ? "Kahdelle" : "Yhdelle";
  const breakfast = prefs.breakfast === "porridge" ? "kaurapuuro" : "vaihtuva aamu";
  const proteins = prefs.proteins.map((id) => PROTEIN_WORD[id]).join(" ja ");
  return `${people} · ${breakfast} · ${proteins} · ${CARB_WORD[prefs.carb]}`;
}

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

export function foodPrefsFromSettings(settings: Settings): FoodPrefs {
  const {
    householdSize,
    includeMilk,
    batchCooking,
    slowCook,
    breakfast,
    snack,
    evening,
    proteins,
    carb,
    saturday,
    avoid,
    notes,
    avoidRepeat,
  } = settings;
  return {
    householdSize,
    includeMilk,
    batchCooking,
    slowCook,
    breakfast,
    snack,
    evening,
    proteins,
    carb,
    saturday,
    avoid,
    notes,
    avoidRepeat,
  };
}
