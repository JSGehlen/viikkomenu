import { z } from "zod";
import { dietIssues, plateReady, proteinsInMeal } from "./checks";
import { applySpan, includesSlot } from "./span";
import { loadRecipeVariant, recipeBatchSize, selectSide } from "./recipeBody";
import { RECIPE_EXAMPLES, recipeExamplesForPrefs, type RecipeExample } from "./recipeExamples";
import type { CarbId, DayId, FoodPrefs, Ingredient, Meal, RawMenu, Treat } from "./types";

const DAY = ["ma", "ti", "ke", "to", "pe"];

const PICKER_PROMPT = `Valitset meal prep -viikon. Palauta vain lyhyt suunnitelma. Älä kirjoita ainesosia äläkä valmistusohjeita. Otsikot täsmälleen annetusta listasta. Kaksi lounassatsia ja kaksi päivällissatsia. days on indeksit 0=ma, 1=ti, 2=ke, 3=to, 4=pe, ja yhdessä ne peittävät 0–4 tasan kerran. Kahdella päivällisellä on eri side.`;

export const WEEK_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "lunches", "dinners", "saturdayNote", "saturdayTitles", "sundayLunch", "sundayDinner"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    lunches: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: { $ref: "#/$defs/batch" },
    },
    dinners: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: { $ref: "#/$defs/dinner" },
    },
    saturdayNote: { type: "string" },
    saturdayTitles: { type: "array", minItems: 2, maxItems: 2, items: { type: "string" } },
    sundayLunch: { type: "string" },
    sundayDinner: { type: "string" },
  },
  $defs: {
    batch: {
      type: "object",
      additionalProperties: false,
      required: ["title", "days"],
      properties: {
        title: { type: "string" },
        days: { type: "array", minItems: 1, maxItems: 5, items: { type: "integer" } },
      },
    },
    dinner: {
      type: "object",
      additionalProperties: false,
      required: ["title", "side", "days"],
      properties: {
        title: { type: "string" },
        side: { type: "string", enum: ["rice", "pasta", "potato", "noodles"] },
        days: { type: "array", minItems: 1, maxItems: 5, items: { type: "integer" } },
      },
    },
  },
} as const;

const batchSchema = z.object({
  title: z.string().min(1),
  days: z.array(z.number().int()).min(1).max(5),
});

export const weekPlanSchema = z.object({
  title: z.string().min(1),
  summary: z.string(),
  lunches: z.array(batchSchema).min(1).max(2),
  dinners: z.array(batchSchema.extend({ side: z.enum(["rice", "pasta", "potato", "noodles"]) })).min(1).max(2),
  saturdayNote: z.string(),
  saturdayTitles: z.array(z.string()).min(2).max(2),
  sundayLunch: z.string(),
  sundayDinner: z.string(),
});

export type WeekPlanPick = z.infer<typeof weekPlanSchema>;

function ing(name: string, category: Ingredient["category"], grams = 0, pieces = 0, detail = ""): Ingredient {
  return { name, category, grams, pieces, ml: 0, detail };
}

function meal(partial: Omit<Meal, "prep"> & { prep?: string }): Meal {
  return { prep: "", ...partial };
}

function norm(value: string): string {
  return value
    .toLocaleLowerCase("fi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function exampleByTitle(title: string, prefs: FoodPrefs): RecipeExample | undefined {
  const key = norm(title);
  const pool = recipeExamplesForPrefs(prefs);
  return pool.find((item) => norm(item.title) === key) ?? RECIPE_EXAMPLES.find((item) => norm(item.title) === key);
}

function cookedMeal(example: RecipeExample, _prefs: FoodPrefs, slot: "lounas" | "paivallinen", side?: CarbId): Meal {
  const dinner = slot === "paivallinen";
  const variant = loadRecipeVariant(example.title, dinner);
  const ingredients = selectSide(variant?.ingredients ?? [], dinner ? side : undefined);
  return meal({
    slot,
    title: example.title,
    blurb: variant?.blurb || example.note,
    kcal: variant?.kcal || (dinner ? 560 : 360),
    proteinG: variant?.proteinG || 0,
    carbsG: variant?.carbsG || 0,
    fatG: variant?.fatG || 0,
    ingredients,
    pot: variant?.pot?.length ? variant.pot : undefined,
    steps: variant?.steps.length ? variant.steps : ["Reseptitiedostoa ei löytynyt tälle ruoalle."],
  });
}

function reheated(source: Meal): Meal {
  return {
    ...source,
    blurb: "Annos valmiista satsista.",
    steps: ["Lämmitä yksi annos keskilämmöllä noin 4 minuuttia.", "Tarkista että ruoka on kuumaa keskeltä.", "Tarjoile."],
    prep: "Tämä päivä syö aiemmin tehtyä satsia.",
  };
}

function porridge(slot: Meal["slot"]): Meal {
  return meal({
    slot,
    title: "Mustikka-kaurapuuro",
    blurb: "Nykyinen aamupala: kaura, hera, marjat ja yksi rasva.",
    kcal: 420,
    proteinG: 32,
    carbsG: 42,
    fatG: 14,
    ingredients: [
      ing("Kaurahiutale", "dry", 40, 0, "kuivapaino"),
      ing("Hera", "dairy", 30),
      ing("Mustikka", "frozen", 80),
      ing("Maapähkinävoi", "dry", 20),
    ],
    steps: [
      "Kiehauta vesi ja sekoita joukkoon kaurahiutaleet. Keitä pari minuuttia.",
      "Nosta levyltä ja sekoita hera joukkoon.",
      "Lisää mustikat ja maapähkinävoi.",
    ],
  });
}

function snack(prefs: FoodPrefs): Meal {
  if (prefs.snack === "quark") {
    return meal({
      slot: "valipala",
      title: "Proteiinirahka ja banaani",
      blurb: "Välipala ilman pähkinöitä.",
      kcal: 250,
      proteinG: 22,
      carbsG: 28,
      fatG: 2,
      ingredients: [ing("Proteiinirahka", "dairy", 200), ing("Banaani", "fruit", 0, 1)],
      steps: ["Laita rahka kulhoon ja syö banaanin kanssa."],
    });
  }
  return meal({
    slot: "valipala",
    title: "Persikkaskyr ja banaani",
    blurb: "Välipala ilman pähkinöitä.",
    kcal: 230,
    proteinG: 18,
    carbsG: 28,
    fatG: 1,
    ingredients: [ing("Ísey Skyr Persikka", "dairy", 0, 1, "170 g purkki"), ing("Banaani", "fruit", 0, 1)],
    steps: ["Avaa skyr ja syö banaanin kanssa."],
  });
}

function evening(prefs: FoodPrefs): Meal {
  if (prefs.evening === "vary") {
    return meal({
      slot: "iltapala",
      title: "Rahka ja banaani",
      blurb: "Iltapala vaihtelee ateriarungon sisällä.",
      kcal: 280,
      proteinG: 24,
      carbsG: 30,
      fatG: 4,
      ingredients: [ing("Proteiinirahka", "dairy", 200), ing("Banaani", "fruit", 0, 1), ing("Oliiviöljy", "dry", 10)],
      steps: ["Sekoita rahka, banaani ja öljy."],
    });
  }
  return meal({
    slot: "iltapala",
    title: "Raejuusto, banaani ja cashew",
    blurb: "Nykyinen iltapala: 200 g raejuustoa, hedelmä ja yksi pähkinä.",
    kcal: 340,
    proteinG: 28,
    carbsG: 32,
    fatG: 12,
    ingredients: [ing("Rasvaton raejuusto", "dairy", 200), ing("Banaani", "fruit", 0, 1), ing("Cashewpähkinä", "dry", 20)],
    steps: ["Laita raejuusto kulhoon ja lisää banaani sekä cashewpähkinät."],
  });
}

function sizedBatches(
  examples: RecipeExample[],
  days: number[],
  prefs: FoodPrefs,
  dinner: boolean,
): Array<{ title: string; days: number[] }> {
  const batches: Array<{ title: string; days: number[] }> = [];
  let rest = [...days];
  const used = new Set<string>();
  while (rest.length) {
    const run = consecutive(rest)[0]?.length ?? rest.length;
    const example = examples.find((item) => !used.has(item.title));
    if (!example) break;
    used.add(example.title);
    const stated = portionDays(example.title, dinner, prefs.householdSize);
    const span = stated ?? (run >= 5 ? 3 : run >= 4 ? 2 : run);
    const chunk = consumeDays(rest, span);
    if (!chunk.days.length) break;
    rest = chunk.rest;
    batches.push({ title: example.title, days: chunk.days });
  }
  return batches;
}

function coverDays<T extends { title: string; days: number[] }>(batches: T[], fallbackTitle: string): T[] {
  const assigned: Array<string | null> = [null, null, null, null, null];
  for (const batch of batches) {
    for (const day of batch.days) {
      if (day >= 0 && day <= 4 && assigned[day] === null) assigned[day] = batch.title;
    }
  }
  const order: string[] = [];
  for (const title of assigned) {
    if (title && !order.includes(title)) order.push(title);
  }
  return order.map((title) => {
    const source = batches.find((batch) => batch.title === title) ?? batches[0];
    return { ...(source as T), title, days: assigned.flatMap((name, index) => (name === title ? [index] : [])) };
  });
}

function withTwoDinners(
  dinners: WeekPlanPick["dinners"],
  prefs: FoodPrefs,
): WeekPlanPick["dinners"] {
  const covered = coverDays(dinners, dinners[0]?.title ?? "Italianpata");
  const capacity = portionDays(covered[0]?.title ?? "", true, prefs.householdSize) ?? 0;
  if (covered.length >= 2 || prefs.carbs.length < 2 || capacity >= (covered[0]?.days.length ?? 0)) {
    return distinctSides(covered, prefs);
  }
  const days = covered[0]?.days ?? [0, 1, 2, 3, 4];
  const cut = Math.max(2, days.length - 2);
  const firstDays = days.slice(0, cut);
  const secondDays = days.slice(cut);
  const usedTitle = norm(covered[0]?.title ?? "");
  const other =
    recipeExamplesForPrefs(prefs).find((item) => item.dinnerOk && norm(item.title) !== usedTitle) ??
    recipeExamplesForPrefs(prefs).find((item) => item.dinnerOk);
  const secondSide = prefs.carbs.find((carb) => carb !== covered[0]?.side) ?? prefs.carbs[0] ?? "pasta";
  return distinctSides(
    [
      { title: covered[0]?.title ?? "Italianpata", side: covered[0]?.side ?? prefs.carbs[0] ?? "rice", days: firstDays },
      { title: other?.title ?? covered[0]?.title ?? "Kanawokki", side: secondSide, days: secondDays },
    ],
    prefs,
  );
}

function distinctSides(dinners: WeekPlanPick["dinners"], prefs: FoodPrefs): WeekPlanPick["dinners"] {
  const used = new Set<CarbId>();
  return dinners.map((dinner) => {
    let side = prefs.carbs.includes(dinner.side) ? dinner.side : prefs.carbs[0] ?? "rice";
    if (used.has(side)) side = prefs.carbs.find((carb) => !used.has(carb)) ?? side;
    used.add(side);
    return { ...dinner, side };
  });
}

function place(meals: Meal[], days: number[], into: Array<Meal | null>): void {
  const cook = Math.min(...days);
  const source = meals[0];
  const cookMeal =
    source.servings && source.servings >= 2
      ? { ...source, prep: `Satsi ${source.servings} annosta. Tällä viikolla ${days.length} päivänä.` }
      : source;
  for (const day of days) into[day] = day === cook ? cookMeal : reheated(cookMeal);
}

function portionDays(title: string, dinner: boolean, household: 1 | 2): number | null {
  const yieldN = recipeBatchSize(title, dinner);
  if (!yieldN) return null;
  if (yieldN < 2) return 1;
  return Math.max(1, Math.floor(yieldN / household));
}

function batchNote(size: number, shown: number, span: number): string {
  const later = Math.max(0, span - shown);
  const shownText = shown === 1 ? "1 päivä" : `${shown} päivää`;
  const laterText = later === 1 ? "1 päivä" : `${later} päivää`;
  if (later > 0) return `Satsi ${size} annosta. ${shownText} tällä viikolla, ${laterText} ensi viikolla.`;
  return `Satsi ${size} annosta. Tällä viikolla ${shown} päivänä.`;
}

function refreshBatchNotes(
  meals: Array<Meal | null>,
  dinner: boolean,
  household: 1 | 2,
  continuedTitle: string | null,
): void {
  const groups = new Map<string, number[]>();
  meals.forEach((meal, index) => {
    if (!meal || meal.prep.includes("Edellisen sunnuntain satsista.")) return;
    groups.set(meal.title, [...(groups.get(meal.title) ?? []), index]);
  });
  for (const [title, indexes] of groups) {
    const size = recipeBatchSize(title, dinner);
    const span = portionDays(title, dinner, household);
    if (!size || !span || size < 2) continue;
    const cook = Math.min(...indexes);
    const meal = meals[cook];
    if (!meal?.servings || meal.servings < 2) continue;
    const shown = indexes.length + (continuedTitle === title ? 1 : 0);
    meals[cook] = { ...meal, servings: size, prep: batchNote(size, shown, span) };
  }
}

function continueSamePot(
  meals: Array<Meal | null>,
  blocked: boolean,
  prefs: FoodPrefs,
  dinner: boolean,
  exceptTitle = "",
): Meal | null {
  if (blocked) return null;
  const slot = dinner ? "paivallinen" : "lounas";
  if (!includesSlot("sun", slot, prefs)) return null;
  const seen = new Map<string, { meal: Meal; days: number }>();
  for (const meal of meals) {
    if (!meal || meal.prep.includes("Edellisen sunnuntain satsista.")) continue;
    const row = seen.get(meal.title);
    if (row) row.days += 1;
    else seen.set(meal.title, { meal, days: 1 });
  }
  const ranked = [...seen.values()]
    .map(({ meal, days }) => ({ meal, spare: (portionDays(meal.title, dinner, prefs.householdSize) ?? 0) - days }))
    .filter((item) => item.spare > 0 && norm(item.meal.title) !== norm(exceptTitle))
    .sort((a, b) => b.spare - a.spare);
  for (const { meal } of ranked) {
    const plate = sundayServing(meal, slot);
    if (plate) return plate;
  }
  return null;
}

const SUNDAY_CARB = /riis|pasta|nuudel|makaron|perun|tortilla|spaget|penne|fusill/i;

function sundayCarb(ingredients: { name: string; grams: number; pieces: number }[]): boolean {
  return ingredients.some((item) => SUNDAY_CARB.test(item.name) && (item.grams >= 20 || item.pieces > 0));
}

function servesOnSunday(title: string): boolean {
  const lunch = loadRecipeVariant(title, false);
  return Boolean(lunch && lunch.steps.length >= 4 && !sundayCarb(lunch.ingredients));
}

function sundayServing(meal: Meal, slot: "lounas" | "paivallinen"): Meal | null {
  const lunch = loadRecipeVariant(meal.title, false);
  if (!lunch || lunch.steps.length < 4 || sundayCarb(lunch.ingredients)) return null;
  return {
    ...meal,
    slot,
    ingredients: lunch.ingredients,
    steps: lunch.steps,
    kcal: lunch.kcal || meal.kcal,
    proteinG: lunch.proteinG || meal.proteinG,
    carbsG: lunch.carbsG,
    fatG: lunch.fatG || meal.fatG,
    blurb: slot === "paivallinen" ? "Annos samasta satsista, ilman lisuketta." : "Annos samasta satsista.",
    prep: "Tämä päivä syö aiemmin tehtyä satsia.",
    servings: undefined,
  };
}

function plainSundayExample(prefs: FoodPrefs, titles: string[], except = ""): RecipeExample {
  const pool = recipeExamplesForPrefs(prefs);
  const ok = (title: string) => servesOnSunday(title) && norm(title) !== norm(except);
  for (const title of titles) {
    const found = pool.find((item) => norm(item.title) === norm(title) && ok(item.title));
    if (found) return found;
  }
  return pool.find((item) => item.lunchOk && ok(item.title)) ?? pool.find((item) => ok(item.title)) ?? pool[0] ?? RECIPE_EXAMPLES[0];
}

function openDayIndexes(prefs: FoodPrefs, slot: "lounas" | "paivallinen"): number[] {
  return [0, 1, 2, 3, 4].filter((index) => includesSlot(WEEKDAY_IDS[index] ?? "mon", slot, prefs));
}

function consumeDays(rest: number[], span: number): { days: number[]; rest: number[] } {
  const days = rest.slice(0, Math.max(1, Math.min(span, rest.length)));
  const taken = new Set(days);
  return { days, rest: rest.filter((day) => !taken.has(day)) };
}

function saturdayFlex(main: Meal, prefs: FoodPrefs, extra?: Meal): { meals: Meal[]; treats: Treat[]; note: string } {
  const mains = [main, extra].filter((meal): meal is Meal => Boolean(meal)).map((meal) => ({ ...meal, slot: "jousto" as const }));
  const meals = [
    { ...porridge("aamiainen"), blurb: "Lauantain aamiainen lasketaan päivän kaloreihin." },
    snack(prefs),
    ...mains,
    evening(prefs),
  ];
  const food = meals.reduce((sum, meal) => sum + meal.kcal, 0);
  const drinks = prefs.includeMilk ? 200 : 0;
  const low = Math.max(0, 2200 - food - drinks);
  const high = Math.max(low, 2500 - food - drinks);
  const kcal = Math.round((low + high) / 2);
  const treats: Treat[] =
    kcal > 0
      ? [
          {
            name: "Herkut",
            grams: 0,
            pieces: 0,
            ml: 0,
            kcal,
            detail: `${low}–${high} kcal jäljellä`,
          },
        ]
      : [];
  const names = mains.map((meal) => meal.title).join(" ja ");
  return {
    meals,
    treats,
    note: `Lauantai on joustopäivä: tavallinen aamiainen, välipala ja iltapala, päivän ruoka ${names}, ja herkut vain jäljelle jäävään osuuteen. Yhteensä 2200–2500 kcal.`,
  };
}

function saturdayMeal(title: string, prefs: FoodPrefs): Meal {
  const example = exampleByTitle(title, prefs);
  if (!example) {
    return meal({
      slot: "jousto",
      title,
      blurb: "Lauantain vapaa ruoka.",
      kcal: 600,
      proteinG: 40,
      carbsG: 55,
      fatG: 24,
      ingredients: [],
      steps: [
        "Tälle lauantain ruoalle ei löytynyt reseptitiedostoa.",
        "Valitse ruoka reseptikansiosta, niin ainekset ja ohje tulevat sieltä.",
        "Laske annos lauantain kaloreihin.",
        "Tarkista pakkauksen ravintosisältö, jos vaihdat ruoan.",
      ],
    });
  }
  const cooked = cookedMeal(example, prefs, example.dinnerOk ? "paivallinen" : "lounas", example.dinnerSides[0]);
  return { ...cooked, slot: "jousto", blurb: cooked.blurb || "Lauantain ruoka reseptin mukaan." };
}

export function buildPickerPrompt(prefs: FoodPrefs): string {
  const items = recipeExamplesForPrefs(prefs);
  const lunches = items.filter((item) => item.lunchOk).map((item) => item.title);
  const dinners = items.filter((item) => item.dinnerOk).map((item) => item.title);
  const saturday = items.filter((item) => item.saturdayFit).map((item) => item.title);
  return [
    PICKER_PROMPT,
    `Sallitut lisukkeet: ${prefs.carbs.join(", ")}.`,
    `Lounaat: ${lunches.join(", ") || "Italianpata"}.`,
    `Päivälliset: ${dinners.join(", ") || "Kanawokki"}.`,
    `Lauantain ruoat: ${saturday.join(", ") || "Tonnikalawrap, Uunilohi"}.`,
    prefs.preferences.trim() ? `Mieltymykset: ${prefs.preferences.trim()}.` : "",
    prefs.avoid.trim() ? `Inhokit: ${prefs.avoid.trim()}` : "",
    prefs.notes.trim() ? `Lisäohje: ${prefs.notes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function blocked(item: RecipeExample, avoid: string): boolean {
  const words = avoid
    .split(/[,;\n]/)
    .map((part) => norm(part))
    .filter((part) => part.length > 2);
  if (!words.length) return false;
  const blob = norm(`${item.title} ${item.note}`);
  return words.some((word) => blob.includes(word));
}

function primaryProtein(example: RecipeExample): FoodPrefs["proteins"][number] | null {
  const title = example.title.toLocaleLowerCase("fi");
  if (/jauheliha|pihvi|nauta/.test(title)) return "beef";
  if (/(^|[^a-zäöå])(kana|broileri)/.test(title)) return "chicken";
  if (/kalkkuna|nakki/.test(title)) return "turkey";
  if (/lohi|tonnikala/.test(title)) return "salmon";
  return example.proteins.find((id) => id) ?? null;
}

function spreadByProtein(
  examples: RecipeExample[],
  selected: FoodPrefs["proteins"],
  covered: ReadonlySet<FoodPrefs["proteins"][number]>,
  dinner: boolean,
): RecipeExample[] {
  if (selected.length < 2) return examples;
  const front: RecipeExample[] = [];
  const taken = new Set<string>();
  const have = new Set(covered);
  for (const protein of selected) {
    if (have.has(protein)) continue;
    const matches = (item: RecipeExample) => !taken.has(item.title) && primaryProtein(item) === protein;
    const found = examples.find((item) => matches(item) && (recipeBatchSize(item.title, dinner) ?? 1) >= 2) ?? examples.find(matches);
    if (!found) continue;
    front.push(found);
    taken.add(found.title);
    have.add(protein);
  }
  if (!front.length) return examples;
  return [...front, ...examples.filter((item) => !taken.has(item.title))];
}

function coveredProteins(meals: Array<Meal | null | undefined>, prefs: FoodPrefs): Set<FoodPrefs["proteins"][number]> {
  const covered = new Set<FoodPrefs["proteins"][number]>();
  for (const meal of meals) {
    if (!meal) continue;
    for (const id of proteinsInMeal(meal)) {
      if (prefs.proteins.includes(id)) covered.add(id);
    }
  }
  return covered;
}

function rotate<T>(items: T[], offset: number): T[] {
  if (!items.length) return items;
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

function pickAt(prefs: FoodPrefs, previousTitles: string[], offset: number): WeekPlanPick {
  const previous = new Set(previousTitles.map((title) => norm(title)));
  const allowed = recipeExamplesForPrefs(prefs).filter((item) => !blocked(item, prefs.avoid));
  const source = allowed.length ? allowed : recipeExamplesForPrefs(prefs);
  const freshFirst = (items: RecipeExample[]) => {
    const fresh = items.filter((item) => !previous.has(norm(item.title)));
    const used = items.filter((item) => previous.has(norm(item.title)));
    return rotate([...fresh, ...used], offset);
  };
  const lunches = spreadByProtein(freshFirst(source.filter((item) => item.lunchOk)), prefs.proteins, new Set(), false);
  const lunchA = lunches[0] ?? RECIPE_EXAMPLES.find((item) => item.lunchOk) ?? RECIPE_EXAMPLES[0];
  const lunchB = lunches.find((item) => item.title !== lunchA.title) ?? lunchA;
  const lunchBatches = sizedBatches(lunches, openDayIndexes(prefs, "lounas"), prefs, false);
  const lunchCovered = new Set<FoodPrefs["proteins"][number]>();
  for (const batch of lunchBatches) {
    const example = lunches.find((item) => item.title === batch.title);
    const id = example ? primaryProtein(example) : null;
    if (id && prefs.proteins.includes(id)) lunchCovered.add(id);
  }
  const dinnerPool = spreadByProtein(
    freshFirst(source.filter((item) => item.dinnerOk && item.title !== lunchA.title && item.title !== lunchB.title)),
    prefs.proteins,
    lunchCovered,
    true,
  );
  const dinners = dinnerPool.length ? dinnerPool : freshFirst(source.filter((item) => item.dinnerOk));
  const dinnerA = dinners[0] ?? lunchA;
  const sideA = prefs.carbs.find((carb) => dinnerA.dinnerSides.includes(carb)) ?? prefs.carbs[0] ?? "rice";
  const dinnerB =
    dinners.find((item) => item.title !== dinnerA.title && item.dinnerSides.some((side) => side !== sideA && prefs.carbs.includes(side))) ??
    dinners.find((item) => item.title !== dinnerA.title) ??
    dinnerA;
  const sideB =
    prefs.carbs.find((carb) => carb !== sideA && dinnerB.dinnerSides.includes(carb)) ??
    prefs.carbs.find((carb) => carb !== sideA) ??
    sideA;
  const weekend = freshFirst(source.filter((item) => item.saturdayFit));
  const saturdayA = weekend[0] ?? dinnerA;
  const saturdayB = weekend.find((item) => item.title !== saturdayA.title) ?? dinnerB;
  const dinnerBatches = sizedBatches(dinners, openDayIndexes(prefs, "paivallinen"), prefs, true);
  const sundayLunch =
    lunches.find((item) => servesOnSunday(item.title) && !lunchBatches.some((batch) => batch.title === item.title)) ??
    lunches.find((item) => servesOnSunday(item.title)) ??
    lunchB;
  const sundayDinner =
    dinners.find((item) => servesOnSunday(item.title) && item.title !== sundayLunch.title && !dinnerBatches.some((batch) => batch.title === item.title)) ??
    lunches.find((item) => servesOnSunday(item.title) && item.title !== sundayLunch.title) ??
    sundayLunch;

  return {
    title: `${lunchBatches[0]?.title ?? lunchA.title} ja ${dinnerBatches[0]?.title ?? dinnerA.title}`,
    summary: "Satsien pituus tulee reseptin annosmäärästä.",
    lunches: lunchBatches.length ? lunchBatches : [{ title: lunchA.title, days: openDayIndexes(prefs, "lounas") }],
    dinners: (dinnerBatches.length ? dinnerBatches : [{ title: dinnerA.title, days: openDayIndexes(prefs, "paivallinen") }]).map((batch, index) => ({
      ...batch,
      side: index === 0 ? sideA : sideB,
    })),
    saturdayNote: prefs.saturday.trim() || "Lauantai on vapaa päivä. Kalorit lasketaan resepteistä ja herkuista.",
    saturdayTitles: [saturdayA.title, saturdayB.title],
    sundayLunch: sundayLunch.title,
    sundayDinner: sundayDinner.title,
  };
}

const WEEKDAY_IDS: DayId[] = ["mon", "tue", "wed", "thu", "fri"];

export type KeptMeal = {
  day: DayId;
  slot: "lounas" | "paivallinen";
  meal: Meal;
};

function keptMeal(kept: KeptMeal[], day: DayId, slot: "lounas" | "paivallinen"): Meal | undefined {
  return kept.find((item) => item.day === day && item.slot === slot)?.meal;
}

function consecutive(days: number[]): number[][] {
  const groups: number[][] = [];
  for (const day of days) {
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1] === day - 1) last.push(day);
    else groups.push([day]);
  }
  return groups;
}

function freeGroups(kept: KeptMeal[], slot: "lounas" | "paivallinen"): number[][] {
  const free = WEEKDAY_IDS.flatMap((id, index) => (keptMeal(kept, id, slot) ? [] : [index]));
  const groups: number[][] = [];
  for (const run of consecutive(free)) {
    if (run.length >= 4) {
      const cut = run.length === 5 ? 3 : 2;
      groups.push(run.slice(0, cut), run.slice(cut));
    } else if (run.length) {
      groups.push(run);
    }
  }
  return groups;
}

function examplesFor(prefs: FoodPrefs, kind: "lunch" | "dinner" | "weekend"): RecipeExample[] {
  const allowed = recipeExamplesForPrefs(prefs).filter((item) => !blocked(item, prefs.avoid));
  const source = allowed.length ? allowed : recipeExamplesForPrefs(prefs);
  if (kind === "lunch") return source.filter((item) => item.lunchOk);
  if (kind === "dinner") return source.filter((item) => item.dinnerOk);
  return source.filter((item) => item.saturdayFit);
}

function takeExamples(items: RecipeExample[], avoid: Set<string>, count: number, offset: number): RecipeExample[] {
  const fresh = items.filter((item) => !avoid.has(norm(item.title)));
  const ordered = rotate(fresh.length ? fresh : items, offset);
  const picked: RecipeExample[] = [];
  for (const item of ordered) {
    if (picked.length >= count) break;
    if (picked.some((chosen) => chosen.title === item.title)) continue;
    picked.push(item);
  }
  while (picked.length < count && ordered[0]) picked.push(ordered[picked.length % ordered.length]);
  return picked;
}

function tortillaCarb(meal: Meal): boolean {
  return meal.ingredients.some((item) => /tortilla/i.test(item.name) && (item.grams >= 40 || item.pieces > 0));
}

function carbKind(meal: Meal): CarbId | null {
  for (const item of meal.ingredients) {
    const kind = carbName(item.name);
    if (kind) return kind;
  }
  return null;
}

function carbName(name: string): CarbId | null {
  if (/riis/i.test(name)) return "rice";
  if (/nuudel/i.test(name)) return "noodles";
  if (/pasta|makaron|spaget|penne|fusill/i.test(name)) return "pasta";
  if (/perun/i.test(name)) return "potato";
  return null;
}

function withSteps(items: RecipeExample[], dinner: boolean): RecipeExample[] {
  const ready = items.filter((item) => (loadRecipeVariant(item.title, dinner)?.steps.length ?? 0) >= 4);
  return ready.length ? ready : items;
}

function withChosenSide(meal: Meal, side: CarbId): Meal {
  if (carbKind(meal) === side) return meal;
  const sideItem =
    side === "potato"
      ? { name: "Peruna", category: "produce" as const, grams: 250, detail: "raakana" }
      : side === "noodles"
        ? { name: "Nuudeli", category: "dry" as const, grams: 70, detail: "kuivana" }
        : side === "pasta"
          ? { name: "Pasta", category: "dry" as const, grams: 70, detail: "kuivana" }
          : { name: "Riisi", category: "dry" as const, grams: 70, detail: "kuivana" };
  return {
    ...meal,
    ingredients: [
      ...meal.ingredients.filter((item) => !carbName(item.name)),
      { name: sideItem.name, category: sideItem.category, grams: sideItem.grams, pieces: 0, ml: 0, detail: sideItem.detail },
    ],
  };
}

function withBatch(meal: Meal, dinner: boolean): Meal {
  const yieldN = recipeBatchSize(meal.title, dinner);
  if (!yieldN || yieldN < 2) return meal;
  const note = `Satsi ${yieldN} annosta. Ylimääräiset jatkuvat seuraavalle viikolle.`;
  return { ...meal, servings: yieldN, prep: meal.prep ? `${meal.prep} ${note}` : note };
}

function held(meal: Meal, slot: Meal["slot"]): Meal {
  return { ...meal, slot };
}

function buildFilled(
  prefs: FoodPrefs,
  kept: KeptMeal[],
  previousTitles: string[],
  offset: number,
  saturdayPick?: { meal?: Meal; title?: string },
): RawMenu {
  const avoid = new Set([...previousTitles, ...kept.map((item) => item.meal.title)].map((title) => norm(title)));
  const lunchMeals: Array<Meal | null> = [null, null, null, null, null];
  const dinnerMeals: Array<Meal | null> = [null, null, null, null, null];
  const lunchPool = rotate(withSteps(examplesFor(prefs, "lunch"), false), offset);
  let lunchDays = openDayIndexes(prefs, "lounas").filter((index) => !keptMeal(kept, WEEKDAY_IDS[index] ?? "mon", "lounas"));
  const lockedMeals = kept.filter((item) => item.slot === "lounas" || item.slot === "paivallinen").map((item) => item.meal);
  while (lunchDays.length) {
    const batches = sizedBatches(
      spreadByProtein(
        lunchPool.filter((item) => !avoid.has(norm(item.title))),
        prefs.proteins,
        coveredProteins([...lunchMeals, ...lockedMeals], prefs),
        false,
      ),
      lunchDays,
      prefs,
      false,
    );
    const batch = batches[0];
    const example = (batch && exampleByTitle(batch.title, prefs)) || RECIPE_EXAMPLES.find((item) => item.lunchOk) || RECIPE_EXAMPLES[0];
    const days = batch?.days.length ? batch.days : lunchDays.slice(0, 1);
    const cooked = cookedMeal(example, prefs, "lounas");
    if (!plateReady(cooked, "lounas")) {
      avoid.add(norm(example.title));
      if (!batch?.days.length || lunchPool.every((item) => avoid.has(norm(item.title)))) break;
      continue;
    }
    const yieldN = recipeBatchSize(example.title, false);
    place([yieldN && yieldN >= 2 ? { ...cooked, servings: yieldN } : cooked], days, lunchMeals);
    avoid.add(norm(example.title));
    const taken = new Set(days);
    lunchDays = lunchDays.filter((day) => !taken.has(day));
    if (!batch?.days.length) break;
  }
  const usedSides = new Set<CarbId>();
  for (const id of WEEKDAY_IDS) {
    const locked = keptMeal(kept, id, "paivallinen");
    const kind = locked ? carbKind(locked) : null;
    if (kind) usedSides.add(kind);
  }
  const dinnerPool = rotate(withSteps(examplesFor(prefs, "dinner"), true), offset + 3);
  let dinnerDays = openDayIndexes(prefs, "paivallinen").filter((index) => !keptMeal(kept, WEEKDAY_IDS[index] ?? "mon", "paivallinen"));
  while (dinnerDays.length) {
    const available = spreadByProtein(
      dinnerPool.filter((item) => !avoid.has(norm(item.title))),
      prefs.proteins,
      coveredProteins([...lunchMeals, ...dinnerMeals, ...lockedMeals], prefs),
      true,
    );
    const batches = sizedBatches(available.length ? available : dinnerPool, dinnerDays, prefs, true);
    const batch = batches[0];
    const wanted = prefs.carbs.find((carb) => !usedSides.has(carb)) ?? prefs.carbs[0] ?? "rice";
    const example =
      (batch &&
        (available.find((item) => item.title === batch.title) ??
          dinnerPool.find((item) => item.title === batch.title))) ||
      RECIPE_EXAMPLES[0];
    const days = batch?.days.length ? batch.days : dinnerDays.slice(0, 1);
    let cooked = cookedMeal(example, prefs, "paivallinen", wanted);
    const actual = carbKind(cooked);
    if (!tortillaCarb(cooked) && (!actual || (usedSides.has(actual) && usedSides.size < 2))) cooked = withChosenSide(cooked, wanted);
    if (!plateReady(cooked, "paivallinen")) {
      avoid.add(norm(example.title));
      if (!batch?.days.length || dinnerPool.every((item) => avoid.has(norm(item.title)))) break;
      continue;
    }
    const kind = carbKind(cooked);
    if (kind) usedSides.add(kind);
    const yieldN = recipeBatchSize(example.title, true);
    place([yieldN && yieldN >= 2 ? { ...cooked, servings: yieldN } : cooked], days, dinnerMeals);
    avoid.add(norm(example.title));
    const taken = new Set(days);
    dinnerDays = dinnerDays.filter((day) => !taken.has(day));
    if (!batch?.days.length) break;
  }

  const sundayLunchKept = keptMeal(kept, "sun", "lounas");
  const sundayDinnerKept = keptMeal(kept, "sun", "paivallinen");
  const continuedLunch = continueSamePot(lunchMeals, Boolean(sundayLunchKept), prefs, false);
  const continuedDinner = continueSamePot(dinnerMeals, Boolean(sundayDinnerKept), prefs, true, continuedLunch?.title ?? "");
  refreshBatchNotes(lunchMeals, false, prefs.householdSize, continuedLunch?.title ?? null);
  refreshBatchNotes(dinnerMeals, true, prefs.householdSize, continuedDinner?.title ?? null);

  for (let day = 0; day < 5; day += 1) {
    const lunch = keptMeal(kept, WEEKDAY_IDS[day], "lounas");
    const dinner = keptMeal(kept, WEEKDAY_IDS[day], "paivallinen");
    if (lunch) lunchMeals[day] = held(lunch, "lounas");
    if (dinner) dinnerMeals[day] = held(dinner, "paivallinen");
  }

  const fallbackLunch = cookedMeal(exampleByTitle("Italianpata", prefs) ?? RECIPE_EXAMPLES[0], prefs, "lounas");
  const fallbackDinner = cookedMeal(exampleByTitle("Kanawokki", prefs) ?? RECIPE_EXAMPLES[0], prefs, "paivallinen", prefs.carbs[0] ?? "rice");
  const breakfast = porridge("aamiainen");
  const between = snack(prefs);
  const night = evening(prefs);
  const weekdays = [0, 1, 2, 3, 4].map((day) => ({
    prep: `Satsi päivälle ${DAY[day]}. Lisuke vain päivällisannokseen.`,
    meals: [breakfast, lunchMeals[day] ?? fallbackLunch, between, dinnerMeals[day] ?? fallbackDinner, night],
  }));

  const weekend = takeExamples(examplesFor(prefs, "weekend"), avoid, 1, offset + 5);
  const saturdayLunch = keptMeal(kept, "sat", "lounas");
  const saturdayDinner = keptMeal(kept, "sat", "paivallinen");
  const saturdayMain = saturdayLunch
    ? held(saturdayLunch, "jousto")
    : saturdayDinner
      ? held(saturdayDinner, "jousto")
      : saturdayPick?.meal
        ? held(saturdayPick.meal, "jousto")
        : saturdayMeal(saturdayPick?.title || weekend[0]?.title || "Tonnikalawrap", prefs);
  const saturdayExtra = saturdayLunch && saturdayDinner ? held(saturdayDinner, "jousto") : undefined;
  const saturday = saturdayFlex(saturdayMain, prefs, saturdayExtra);

  const sundayPool = takeExamples(examplesFor(prefs, "lunch"), avoid, 4, offset + 7);
  const sundayDinnerPool = takeExamples(examplesFor(prefs, "dinner"), avoid, 4, offset + 9);
  const sundayLunchExample = plainSundayExample(prefs, sundayPool.map((item) => item.title));
  const sundayDinnerExample = plainSundayExample(
    prefs,
    [...sundayDinnerPool, ...sundayPool].map((item) => item.title),
    continuedLunch?.title ?? "",
  );

  return {
    title: `${weekdays[0].meals[1]?.title ?? "Viikko"} ja ${weekdays[0].meals[3]?.title ?? "päivällinen"}`,
    summary: "Lukitut ruoat pysyivät. Muut pääruoat vaihdettiin omista resepteistä.",
    weekdays,
    saturdayNote: saturday.note,
    saturdayMeals: saturday.meals,
    saturdayTreats: saturday.treats,
    sundayPrep: "Sunnuntain päivällisellä ei ole erillistä lisuketta.",
    sunday: [
      breakfast,
      sundayLunchKept
        ? held(sundayLunchKept, "lounas")
        : (continuedLunch ?? withBatch(cookedMeal(sundayLunchExample, prefs, "lounas"), false)),
      between,
      sundayDinnerKept
        ? held(sundayDinnerKept, "paivallinen")
        : (continuedDinner ?? withBatch(sundayDinnerMeal(sundayDinnerExample, prefs), true)),
      night,
    ],
  };
}

export function ensureCookDays(raw: RawMenu, prefs: FoodPrefs): RawMenu {
  const weekdays = raw.weekdays.map((day) => ({ ...day, meals: [...day.meals] }));
  for (const slot of ["lounas", "paivallinen"] as const) {
    const groups = new Map<string, number[]>();
    weekdays.forEach((day, index) => {
      const meal = day.meals.find((item) => item.slot === slot);
      if (!meal || /Edellisen sunnuntain satsista/.test(meal.prep)) return;
      const key = meal.title.toLocaleLowerCase("fi");
      groups.set(key, [...(groups.get(key) ?? []), index]);
    });
    for (const indexes of groups.values()) {
      const longest = Math.max(...indexes.map((index) => weekdays[index]?.meals.find((item) => item.slot === slot)?.steps.length ?? 0));
      if (longest >= 4) continue;
      const index = indexes[0];
      const current = weekdays[index]?.meals.find((item) => item.slot === slot);
      const example = current ? exampleByTitle(current.title, prefs) : undefined;
      if (!current || !example || !weekdays[index]) continue;
      const side = slot === "paivallinen" ? (carbKind(current) ?? prefs.carbs[0]) : undefined;
      const cooked = cookedMeal(example, prefs, slot, side);
      weekdays[index] = {
        ...weekdays[index],
        meals: weekdays[index].meals.map((item) => (item.slot === slot ? { ...cooked, slot } : item)),
      };
    }
  }
  return { ...raw, weekdays };
}

export function overlayDays(
  raw: RawMenu,
  batches: Array<{ days: DayId[]; slot: "lounas" | "paivallinen"; meal: Meal }>,
  blocked: Set<string>,
): RawMenu {
  const weekdays = raw.weekdays.map((day) => ({ ...day, meals: [...day.meals] }));
  let sunday = [...raw.sunday];
  for (const batch of batches) {
    let first = true;
    for (const day of batch.days) {
      if (blocked.has(`${day}:${batch.slot}`)) continue;
      const meal = first
        ? { ...batch.meal, slot: batch.slot, prep: batch.meal.prep || "Keksitty satsi." }
        : reheated({ ...batch.meal, slot: batch.slot });
      first = false;
      if (day === "sun") {
        const next = sunday.map((item) => (item.slot === batch.slot ? meal : item));
        sunday = next.some((item) => item.slot === batch.slot) ? next : [...next, meal];
        continue;
      }
      const index = WEEKDAY_IDS.indexOf(day);
      if (index < 0 || !weekdays[index]) continue;
      const meals = weekdays[index].meals.map((item) => (item.slot === batch.slot ? meal : item));
      weekdays[index] = { ...weekdays[index], meals: meals.some((item) => item.slot === batch.slot) ? meals : [...meals, meal] };
    }
  }
  return { ...raw, weekdays, sunday };
}

function readyWeek(raw: RawMenu, prefs: FoodPrefs): RawMenu {
  return ensureCookDays(applySpan(raw, prefs), prefs);
}

export function fillUnlocked(
  prefs: FoodPrefs,
  kept: KeptMeal[],
  previousTitles: string[] = [],
  saturdayPick?: { meal?: Meal; title?: string },
): RawMenu {
  if (!kept.length) return readyWeek(expandWeekPlan(pickWeek(prefs, previousTitles), prefs), prefs);
  let best = readyWeek(buildFilled(prefs, kept, previousTitles, 0, saturdayPick), prefs);
  let bestIssues = dietIssues(best, prefs).length;
  for (let extra = 1; extra < 12 && bestIssues > 0; extra += 1) {
    const candidate = readyWeek(buildFilled(prefs, kept, previousTitles, extra, saturdayPick), prefs);
    const count = dietIssues(candidate, prefs).length;
    if (count < bestIssues) {
      best = candidate;
      bestIssues = count;
    }
    if (count === 0) return candidate;
  }
  return best;
}

export function pickWeek(prefs: FoodPrefs, previousTitles: string[] = []): WeekPlanPick {
  const base = previousTitles.length;
  for (let extra = 0; extra < 24; extra += 1) {
    const pick = pickAt(prefs, previousTitles, base + extra);
    if (dietIssues(readyWeek(expandWeekPlan(pick, prefs), prefs), prefs).length === 0) return pick;
  }
  return pickAt(prefs, previousTitles, base);
}

function sundayDinnerMeal(example: RecipeExample, prefs: FoodPrefs): Meal {
  const cooked = cookedMeal(example, prefs, "lounas");
  return { ...cooked, slot: "paivallinen", title: example.title, blurb: cooked.blurb || "Sunnuntain päivällinen." };
}

export function placeInvented(
  pick: WeekPlanPick,
  meal: Meal,
  slot: "lounas" | "paivallinen" | "jousto",
  side: CarbId,
): WeekPlanPick {
  if (slot === "lounas") {
    const first = pick.lunches[0] ?? { title: meal.title, days: [0, 1, 2] };
    const keptDays = first.days.filter((day) => day !== 3 && day !== 4);
    return {
      ...pick,
      summary: `${meal.title} on keksitty lounassatsi. Muut ruoat ovat omista resepteistä.`,
      lunches: [...(keptDays.length ? [{ ...first, days: keptDays }] : []), { title: meal.title, days: [3, 4] }],
    };
  }
  if (slot === "jousto") {
    return {
      ...pick,
      saturdayTitles: [meal.title, pick.saturdayTitles.find((title) => title !== meal.title) || "Uunilohi"],
    };
  }
  const firstDinner = pick.dinners[0] ?? { title: meal.title, side, days: [0, 1, 2] };
  const keptDays = firstDinner.days.filter((day) => day !== 3 && day !== 4);
  return {
    ...pick,
    summary: `${meal.title} on keksitty päivällissatsi. Muut ruoat ovat omista resepteistä.`,
    dinners: [...(keptDays.length ? [{ ...firstDinner, days: keptDays }] : []), { title: meal.title, side, days: [3, 4] }],
  };
}

export function expandWeekPlan(pick: WeekPlanPick, prefs: FoodPrefs, known: ReadonlyMap<string, Meal> = new Map()): RawMenu {
  const lunches = coverDays(pick.lunches, "Italianpata");
  const dinners = withTwoDinners(pick.dinners, prefs);
  const lunchMeals: Array<Meal | null> = [null, null, null, null, null];
  const dinnerMeals: Array<Meal | null> = [null, null, null, null, null];

  for (const batch of lunches) {
    const ready = known.get(batch.title);
    if (ready) {
      place([{ ...ready, slot: "lounas" }], batch.days, lunchMeals);
      continue;
    }
    const example = exampleByTitle(batch.title, prefs);
    if (!example) continue;
    const cooked = cookedMeal(example, prefs, "lounas");
    const yieldN = recipeBatchSize(example.title, false);
    place([yieldN && yieldN >= 2 ? { ...cooked, servings: yieldN } : cooked], batch.days, lunchMeals);
  }
  for (const batch of dinners) {
    const ready = known.get(batch.title);
    if (ready) {
      place([{ ...ready, slot: "paivallinen" }], batch.days, dinnerMeals);
      continue;
    }
    const example = exampleByTitle(batch.title, prefs);
    if (!example) continue;
    const cooked = cookedMeal(example, prefs, "paivallinen", batch.side);
    const yieldN = recipeBatchSize(example.title, true);
    place([yieldN && yieldN >= 2 ? { ...cooked, servings: yieldN } : cooked], batch.days, dinnerMeals);
  }

  const continuedLunch = continueSamePot(lunchMeals, false, prefs, false);
  const continuedDinner = continueSamePot(dinnerMeals, false, prefs, true, continuedLunch?.title ?? "");
  refreshBatchNotes(lunchMeals, false, prefs.householdSize, continuedLunch?.title ?? null);
  refreshBatchNotes(dinnerMeals, true, prefs.householdSize, continuedDinner?.title ?? null);

  const fallbackLunch = cookedMeal(exampleByTitle("Italianpata", prefs) ?? RECIPE_EXAMPLES[0], prefs, "lounas");
  const fallbackDinner = cookedMeal(exampleByTitle("Kanawokki", prefs) ?? RECIPE_EXAMPLES[0], prefs, "paivallinen", prefs.carbs[0] ?? "rice");
  const breakfast = prefs.breakfast === "porridge" ? porridge("aamiainen") : porridge("aamiainen");
  const between = snack(prefs);
  const night = evening(prefs);

  const weekdays = [0, 1, 2, 3, 4].map((day) => ({
    prep: `Satsi päivälle ${DAY[day]}. Lisuke vain päivällisannokseen.`,
    meals: [breakfast, lunchMeals[day] ?? fallbackLunch, between, dinnerMeals[day] ?? fallbackDinner, night],
  }));

  const sundayLunchExample = plainSundayExample(prefs, [pick.sundayLunch, lunches[0]?.title ?? ""]);
  const sundayDinnerExample = plainSundayExample(prefs, [pick.sundayDinner, pick.sundayLunch], continuedLunch?.title ?? "");

  return {
    title: pick.title,
    summary: pick.summary || "Arkiruoat on tehty satsina ja jaettu usealle päivälle.",
    weekdays,
    ...(() => {
      const invented = [...known.values()].find((meal) => meal.slot === "jousto");
      const main = invented ?? saturdayMeal(pick.saturdayTitles[0] || "Tonnikalawrap", prefs);
      const flex = saturdayFlex(main, prefs);
      return { saturdayNote: flex.note, saturdayMeals: flex.meals, saturdayTreats: flex.treats };
    })(),
    sundayPrep: "Sunnuntain päivällisellä ei ole erillistä lisuketta.",
    sunday: [
      breakfast,
      continuedLunch ?? withBatch(cookedMeal(sundayLunchExample, prefs, "lounas"), false),
      between,
      continuedDinner ?? withBatch(sundayDinnerMeal(sundayDinnerExample, prefs), true),
      night,
    ],
  };
}
