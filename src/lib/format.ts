import { CATEGORY_LABEL } from "./prefs";
import type { Ingredient, ShoppingItem } from "./types";

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
}): string {
  const lines = [
    meal.title,
    meal.blurb,
    "",
    "Ainekset, 1 annos / henkilö",
    ...meal.ingredients.map((item) => {
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
