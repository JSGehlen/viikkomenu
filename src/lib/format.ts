import { CATEGORY_LABEL } from "./prefs";
import type { Ingredient, ShoppingItem } from "./types";

type ListedMeal = {
  servings?: number;
  prep: string;
  blurb?: string;
  ingredients: Ingredient[];
  pot?: Ingredient[];
};

const numberFormat = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 2 });

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatAmount(item: {
  grams: number;
  pieces: number;
  ml: number;
}): string {
  const parts: string[] = [];
  if (item.grams > 0) {
    parts.push(item.grams >= 1000 ? `${numberFormat.format(item.grams / 1000)} kg` : `${Math.round(item.grams)} g`);
  }
  if (item.ml > 0) {
    parts.push(item.ml >= 1000 ? `${numberFormat.format(item.ml / 1000)} l` : `${Math.round(item.ml)} ml`);
  }
  if (item.pieces > 0) {
    const pieces = Number.isInteger(item.pieces) ? String(item.pieces) : numberFormat.format(item.pieces);
    parts.push(`${pieces} kpl`);
  }
  return parts.join(" + ") || "tarpeen mukaan";
}

export function buyHint(item: Pick<ShoppingItem, "name" | "grams">): string | null {
  const name = item.name.toLocaleLowerCase("fi");
  if (name.includes("jauheliha") && item.grams > 0) {
    const packs = Math.ceil(item.grams / 400);
    return `${packs} × 400 g pakkaus`;
  }
  if (
    item.grams > 0 &&
    item.grams <= 50 &&
    /mauste|jauhe|pippuri|oregano|basilika|kumina|timjami|curry|suola/.test(name)
  ) {
    return "yksi purkki riittää, jos sitä ei jo ole kaapissa";
  }
  return null;
}

export function ingredientAmount(item: Ingredient): string {
  return formatAmount(item);
}

function isOilName(name: string): boolean {
  return /rypsi|oliiviöljy|oliivioljy|(?:^|[^a-zäöå])(öljy|öljyä|oljy|oljyä)(?:$|[^a-zäöå])/i.test(name);
}

function collapseDuplicateOil(items: Ingredient[]): Ingredient[] {
  const oils = items.filter((item) => isOilName(item.name));
  if (oils.length < 2) return items;
  const first = oils[0];
  const sameAmount = oils.every((item) => item.grams === first.grams && item.ml === first.ml && item.pieces === first.pieces);
  if (!sameAmount) return items;
  const kept = oils.find((item) => /^öljy/i.test(item.name)) ?? first;
  let used = false;
  return items.flatMap((item) => {
    if (!isOilName(item.name)) return [item];
    if (used) return [];
    used = true;
    return [kept];
  });
}

export function batchPortions(meal: ListedMeal): number {
  if ((meal.servings ?? 0) >= 2) return meal.servings ?? 0;
  const written = meal.prep.match(/Satsi (\d+)/);
  return written ? Number(written[1]) : 0;
}

export function isBatchCook(meal: ListedMeal): boolean {
  if (batchPortions(meal) < 2) return false;
  if (/aiemmin tehtyä|valmiista satsista|Edellisen sunnuntain/i.test(`${meal.prep} ${meal.blurb ?? ""}`)) return false;
  return /Satsi \d/.test(meal.prep);
}

function scaledAmount(value: number, portions: number): number {
  if (!value) return 0;
  const scaled = Math.round(value * portions * 10) / 10;
  const nearest = Math.round(scaled);
  return Math.abs(scaled - nearest) < 0.05 ? nearest : scaled;
}

function scaledPieces(value: number, portions: number): number {
  if (!value) return 0;
  const scaled = Math.round(value * portions * 100) / 100;
  const nearest = Math.round(scaled);
  return Math.abs(scaled - nearest) <= 0.25 ? nearest : scaled;
}

function amountOf(item: Ingredient): number {
  return item.grams + item.ml + item.pieces;
}

function scaleIngredient(item: Ingredient, portions: number): Ingredient {
  return {
    ...item,
    grams: scaledAmount(item.grams, portions),
    ml: scaledAmount(item.ml, portions),
    pieces: scaledPieces(item.pieces, portions),
  };
}

function withPotAmounts(scaled: Ingredient[], pot: Ingredient[]): Ingredient[] {
  return scaled.map((item) => {
    const fromPot = pot.find((next) => next.name === item.name && amountOf(next) > 0);
    if (!fromPot) return item;
    const listed = amountOf(item);
    const written = amountOf(fromPot);
    if (listed <= 0 || written + 0.05 < listed * 0.95) return item;
    return { ...item, grams: fromPot.grams, ml: fromPot.ml, pieces: fromPot.pieces, detail: fromPot.detail || item.detail };
  });
}

function visibleIngredient(item: Ingredient): boolean {
  if (amountOf(item) > 0) return true;
  if (/mukaan|tuotetyyp|käy |tarkenn|pohjalta/i.test(item.name)) return false;
  return item.name.split(/\s+/).length < 4;
}

/** Cook day lists the whole pot. Later days of the same pot stay one plate. */
export function listedIngredients(meal: ListedMeal): Ingredient[] {
  if (!isBatchCook(meal)) return collapseDuplicateOil(meal.ingredients).filter(visibleIngredient);
  const portions = batchPortions(meal);
  const scaled = meal.ingredients.map((item) => scaleIngredient(item, portions));
  const items = meal.pot?.length ? withPotAmounts(scaled, meal.pot) : scaled;
  return collapseDuplicateOil(items).filter(visibleIngredient);
}

export function usesLabel(uses: string[]): string {
  if (uses.length <= 2) return uses.join(" · ");
  return `${uses.slice(0, 2).join(" · ")} · +${uses.length - 2}`;
}

export function recipeText(meal: {
  title: string;
  blurb: string;
  ingredients: Ingredient[];
  steps: string[];
  prep: string;
  servings?: number;
}): string {
  const ingredients = listedIngredients(meal);
  const heading = isBatchCook(meal) ? `Ainekset, koko satsi (${batchPortions(meal)} annosta)` : "Ainekset, 1 annos / henkilö";
  const lines = [
    meal.title,
    meal.blurb,
    "",
    heading,
    ...ingredients.map((item) => {
      const detail = item.detail ? ` (${item.detail})` : "";
      return `- ${formatAmount(item)} ${item.name}${detail}`;
    }),
    "",
    "Valmistus",
    ...meal.steps.map((step, index) => `${index + 1}. ${step}`),
  ];
  if (meal.prep) {
    lines.push("", meal.prep);
  }
  return lines.filter((line) => line !== undefined).join("\n");
}

export function shoppingText(title: string, items: ShoppingItem[], onlyOpen: Set<string> | null): string {
  const visible = onlyOpen ? items.filter((item) => !onlyOpen.has(item.id)) : items;
  const lines = [title, ""];
  let category = "";
  for (const item of visible) {
    if (item.category !== category) {
      category = item.category;
      lines.push(CATEGORY_LABEL[item.category] ?? item.category);
    }
    const extra = [item.detail, buyHint(item)].filter(Boolean).join(". ");
    lines.push(`- ${item.name}: ${formatAmount(item)}${extra ? ` (${extra})` : ""}`);
  }
  return lines.join("\n");
}
