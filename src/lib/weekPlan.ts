import { z } from "zod";
import { dietIssues } from "./checks";
import { hasDishCarb, loadRecipeVariant, selectSide } from "./recipeBody";
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

function coverDays<T extends { title: string; days: number[] }>(batches: T[], fallbackTitle: string): T[] {
  const assigned: Array<string | null> = [null, null, null, null, null];
  for (const batch of batches.slice(0, 2)) {
    for (const day of batch.days) {
      if (day >= 0 && day <= 4 && assigned[day] === null) assigned[day] = batch.title;
    }
  }
  for (let day = 0; day < 5; day += 1) {
    if (!assigned[day]) assigned[day] = batches[0]?.title || fallbackTitle;
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
  if (covered.length >= 2 || prefs.carbs.length < 2) return distinctSides(covered, prefs);
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
  for (const day of days) into[day] = day === cook ? meals[0] : reheated(meals[0]);
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
    `Lauantain ruoat: ${saturday.join(", ") || "Tortillat, Uunilohi"}.`,
    prefs.avoid.trim() ? `Vältä: ${prefs.avoid.trim()}` : "",
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
  const lunches = freshFirst(source.filter((item) => item.lunchOk));
  const lunchA = lunches[0] ?? RECIPE_EXAMPLES.find((item) => item.lunchOk) ?? RECIPE_EXAMPLES[0];
  const lunchB = lunches.find((item) => item.title !== lunchA.title) ?? lunchA;
  const dinnerPool = freshFirst(source.filter((item) => item.dinnerOk && item.title !== lunchA.title && item.title !== lunchB.title));
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
  const sundayLunch = lunches.find((item) => item.title !== lunchA.title && item.title !== lunchB.title) ?? lunchB;
  const sundayDinner = dinners.find((item) => item.title !== dinnerA.title && item.title !== dinnerB.title) ?? dinnerB;

  return {
    title: `${lunchA.title} ja ${dinnerA.title}`,
    summary: "Kaksi lounassatsia ja kaksi päivällissatsia omista resepteistä.",
    lunches: [
      { title: lunchA.title, days: [0, 1, 2] },
      { title: lunchB.title, days: [3, 4] },
    ],
    dinners: [
      { title: dinnerA.title, side: sideA, days: [0, 1, 2] },
      { title: dinnerB.title, side: sideB, days: [3, 4] },
    ],
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
  if (/pasta|makaron|spaghet|penne|fusill/i.test(name)) return "pasta";
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
      ? { name: "Peruna", category: "produce" as const, grams: 300, detail: "raakana" }
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

function held(meal: Meal, slot: Meal["slot"]): Meal {
  return { ...meal, slot };
}

function buildFilled(prefs: FoodPrefs, kept: KeptMeal[], previousTitles: string[], offset: number): RawMenu {
  const avoid = new Set([...previousTitles, ...kept.map((item) => item.meal.title)].map((title) => norm(title)));
  const lunchGroups = freeGroups(kept, "lounas");
  const dinnerGroups = freeGroups(kept, "paivallinen");
  const lunches = takeExamples(withSteps(examplesFor(prefs, "lunch"), false), avoid, lunchGroups.length, offset);
  const dinners = takeExamples(withSteps(examplesFor(prefs, "dinner"), true), avoid, dinnerGroups.length, offset + 3);
  const lunchMeals: Array<Meal | null> = [null, null, null, null, null];
  const dinnerMeals: Array<Meal | null> = [null, null, null, null, null];

  lunchGroups.forEach((days, index) => {
    const example = lunches[index] ?? RECIPE_EXAMPLES.find((item) => item.lunchOk) ?? RECIPE_EXAMPLES[0];
    place([cookedMeal(example, prefs, "lounas")], days, lunchMeals);
    avoid.add(norm(example.title));
  });
  const usedSides = new Set<CarbId>();
  for (const id of WEEKDAY_IDS) {
    const locked = keptMeal(kept, id, "paivallinen");
    const kind = locked ? carbKind(locked) : null;
    if (kind) usedSides.add(kind);
  }
  dinnerGroups.forEach((days, index) => {
    const pool = dinners.length ? dinners : withSteps(examplesFor(prefs, "dinner"), true);
    const wanted = prefs.carbs.find((carb) => !usedSides.has(carb)) ?? prefs.carbs[0] ?? "rice";
    const example =
      pool.find((item) => {
        if (avoid.has(norm(item.title))) return false;
        const kind = carbKind(cookedMeal(item, prefs, "paivallinen", wanted));
        return usedSides.size >= 2 || kind === wanted || kind === null || !usedSides.has(kind);
      }) ??
      pool.find((item) => !avoid.has(norm(item.title))) ??
      pool[index] ??
      pool[0] ??
      RECIPE_EXAMPLES[0];
    let cooked = cookedMeal(example, prefs, "paivallinen", wanted);
    const actual = carbKind(cooked);
    if (!actual || (usedSides.has(actual) && usedSides.size < 2)) cooked = withChosenSide(cooked, wanted);
    const kind = carbKind(cooked);
    if (kind) usedSides.add(kind);
    avoid.add(norm(example.title));
    place([cooked], days, dinnerMeals);
  });

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
      : saturdayMeal(weekend[0]?.title || "Tortillat", prefs);
  const saturdayExtra = saturdayLunch && saturdayDinner ? held(saturdayDinner, "jousto") : undefined;
  const saturday = saturdayFlex(saturdayMain, prefs, saturdayExtra);

  const sundayPool = takeExamples(examplesFor(prefs, "lunch"), avoid, 1, offset + 7);
  const sundayDinnerPool = takeExamples(examplesFor(prefs, "dinner"), avoid, 1, offset + 9);
  const sundayLunchKept = keptMeal(kept, "sun", "lounas");
  const sundayDinnerKept = keptMeal(kept, "sun", "paivallinen");
  const sundayLunchExample = sundayPool[0] ?? RECIPE_EXAMPLES[0];
  const sundayDinnerExample = sundayDinnerPool[0] ?? sundayLunchExample;

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
      sundayLunchKept ? held(sundayLunchKept, "lounas") : cookedMeal(sundayLunchExample, prefs, "lounas"),
      between,
      sundayDinnerKept ? held(sundayDinnerKept, "paivallinen") : sundayDinnerMeal(sundayDinnerExample, prefs),
      night,
    ],
  };
}

export function fillUnlocked(prefs: FoodPrefs, kept: KeptMeal[], previousTitles: string[] = []): RawMenu {
  if (!kept.length) return expandWeekPlan(pickWeek(prefs, previousTitles), prefs);
  let best = buildFilled(prefs, kept, previousTitles, 0);
  let bestIssues = dietIssues(best, prefs).length;
  for (let extra = 1; extra < 12 && bestIssues > 0; extra += 1) {
    const candidate = buildFilled(prefs, kept, previousTitles, extra);
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
  for (let extra = 0; extra < 12; extra += 1) {
    const pick = pickAt(prefs, previousTitles, base + extra);
    if (dietIssues(expandWeekPlan(pick, prefs), prefs).length === 0) return pick;
  }
  return pickAt(prefs, previousTitles, base);
}

function sundayDinnerMeal(example: RecipeExample, prefs: FoodPrefs): Meal {
  const lunch = loadRecipeVariant(example.title, false);
  const inherent = hasDishCarb(lunch?.ingredients ?? []);
  const cooked = cookedMeal(example, prefs, inherent ? "paivallinen" : "lounas", inherent ? example.dinnerSides[0] : undefined);
  return { ...cooked, slot: "paivallinen", title: example.title, blurb: cooked.blurb || "Sunnuntain päivällinen." };
}

export function placeInvented(
  pick: WeekPlanPick,
  meal: Meal,
  slot: "lounas" | "paivallinen" | "jousto",
  side: CarbId,
): WeekPlanPick {
  if (slot === "lounas") {
    return {
      ...pick,
      summary: `${meal.title} on keksitty lounassatsi. Muut ruoat ovat omista resepteistä.`,
      lunches: [pick.lunches[0] ?? { title: meal.title, days: [0, 1, 2] }, { title: meal.title, days: [3, 4] }],
    };
  }
  if (slot === "jousto") {
    return {
      ...pick,
      summary: `${meal.title} on lauantain ruoka. Päivä on 2200–2500 kcal herkkuineen, ei erillinen lounas ja päivällinen.`,
      saturdayTitles: [meal.title, pick.saturdayTitles.find((title) => title !== meal.title) || "Uunilohi"],
    };
  }
  return {
    ...pick,
    summary: `${meal.title} on keksitty päivällissatsi. Muut ruoat ovat omista resepteistä.`,
    dinners: [
      pick.dinners[0] ?? { title: meal.title, side, days: [0, 1, 2] },
      { title: meal.title, side, days: [3, 4] },
    ],
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
    place([cookedMeal(example, prefs, "lounas")], batch.days, lunchMeals);
  }
  for (const batch of dinners) {
    const ready = known.get(batch.title);
    if (ready) {
      place([{ ...ready, slot: "paivallinen" }], batch.days, dinnerMeals);
      continue;
    }
    const example = exampleByTitle(batch.title, prefs);
    if (!example) continue;
    place([cookedMeal(example, prefs, "paivallinen", batch.side)], batch.days, dinnerMeals);
  }

  const fallbackLunch = cookedMeal(exampleByTitle("Italianpata", prefs) ?? RECIPE_EXAMPLES[0], prefs, "lounas");
  const fallbackDinner = cookedMeal(exampleByTitle("Kanawokki", prefs) ?? RECIPE_EXAMPLES[0], prefs, "paivallinen", prefs.carbs[0] ?? "rice");
  const breakfast = prefs.breakfast === "porridge" ? porridge("aamiainen") : porridge("aamiainen");
  const between = snack(prefs);
  const night = evening(prefs);

  const weekdays = [0, 1, 2, 3, 4].map((day) => ({
    prep: `Satsi päivälle ${DAY[day]}. Lisuke vain päivällisannokseen.`,
    meals: [breakfast, lunchMeals[day] ?? fallbackLunch, between, dinnerMeals[day] ?? fallbackDinner, night],
  }));

  const sundayLunchExample = exampleByTitle(pick.sundayLunch, prefs) ?? exampleByTitle(lunches[0]?.title ?? "", prefs) ?? RECIPE_EXAMPLES[0];
  const sundayDinnerExample = exampleByTitle(pick.sundayDinner, prefs) ?? sundayLunchExample;

  return {
    title: pick.title,
    summary: pick.summary || "Arkiruoat on tehty satsina ja jaettu usealle päivälle.",
    weekdays,
    ...(() => {
      const invented = [...known.values()].find((meal) => meal.slot === "jousto");
      const main = invented ?? saturdayMeal(pick.saturdayTitles[0] || "Tortillat", prefs);
      const flex = saturdayFlex(main, prefs);
      return { saturdayNote: flex.note, saturdayMeals: flex.meals, saturdayTreats: flex.treats };
    })(),
    sundayPrep: "Sunnuntain päivällisellä ei ole erillistä lisuketta.",
    sunday: [
      breakfast,
      cookedMeal(sundayLunchExample, prefs, "lounas"),
      between,
      sundayDinnerMeal(sundayDinnerExample, prefs),
      night,
    ],
  };
}
