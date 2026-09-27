import { WEEKDAY_SLOTS, type CarbId, type FoodPrefs, type Ingredient, type Meal, type RawMenu } from "./types";

const CARB = /riis|pasta|nuudel|makaron|perun|tortilla|spaghet|penne|fusill/i;
const NUT = /pähkin|pahkin|cashew|manteli|maapähkinävoi|maapahkinavoi/i;
const FAT = /oliivi|avokado|cashew|pähkin|pahkin|kerma|creme|crème|juusto|feta|öljy|oljy|majonees|pesto/i;

function find(meal: Meal, pattern: RegExp): Ingredient | undefined {
  return meal.ingredients.find((item) => pattern.test(item.name));
}

function sideKind(name: string): CarbId | null {
  if (/riis/i.test(name)) return "rice";
  if (/nuudel/i.test(name)) return "noodles";
  if (/pasta|makaron|spaghet|penne|fusill/i.test(name)) return "pasta";
  if (/perun/i.test(name)) return "potato";
  return null;
}

function fatGrams(meal: Meal, pattern: RegExp): number {
  return meal.ingredients
    .filter((item) => pattern.test(item.name))
    .reduce((sum, item) => sum + item.grams, 0);
}

function proteinKind(meal: Meal): { mince: boolean; salmon: boolean; poultry: boolean } {
  const blob = meal.ingredients.map((item) => item.name).join(" ");
  return {
    mince: /jauheliha/i.test(blob),
    salmon: /\blohi/i.test(blob),
    poultry: /kana|kalkkuna/i.test(blob),
  };
}

function checkStructured(meals: Meal[], label: string, issues: string[]): void {
  if (meals.length !== 5) {
    issues.push(`${label}: tarvitaan tasan viisi ateriaa.`);
    return;
  }
  WEEKDAY_SLOTS.forEach((slot, index) => {
    if (meals[index]?.slot !== slot) {
      issues.push(`${label}: aterian ${index + 1} slotin pitää olla ${slot}.`);
    }
  });
}

function checkPorridge(meal: Meal, issues: string[]): void {
  const oats = find(meal, /kaura/i);
  const whey = find(meal, /hera|whey/i);
  const berries = find(meal, /mustik|mansik|marja|vadelma/i);
  if (!oats || oats.grams < 35 || oats.grams > 45) issues.push("Puuroaamiaisessa pitää olla 40 g kaurahiutaleita.");
  if (!whey || whey.grams < 28 || whey.grams > 32) issues.push("Puuroaamiaisessa pitää olla 30 g heraa.");
  if (!berries || berries.grams < 70 || berries.grams > 100) {
    issues.push("Puuroaamiaisessa pitää olla 70–100 g marjoja.");
  }
  const fats = [
    find(meal, /maapähkinävoi|maapahkinavoi/i),
    find(meal, /saksanpähkin|saksanpahkin/i),
    find(meal, /cashew/i),
  ].filter((item) => item && item.grams > 0);
  if (fats.length !== 1) issues.push("Puuroaamiaisessa on oltava täsmälleen yksi rasva.");
  if (meal.ingredients.some((item) => /banaani|omena|päärynä|appelsiini/i.test(item.name) && item.pieces > 0)) {
    issues.push("Puuroaamiaiseen ei lisätä erillistä hedelmää.");
  }
}

function checkSnack(meal: Meal, prefs: FoodPrefs, issues: string[]): void {
  if (meal.ingredients.some((item) => NUT.test(item.name) && (item.grams > 0 || item.pieces > 0))) {
    issues.push("Välipalalle ei lisätä pähkinöitä.");
  }
  if (prefs.snack === "skyr") {
    const skyr = find(meal, /skyr/i);
    const banana = find(meal, /banaani/i);
    if (!skyr || (skyr.pieces < 1 && (skyr.grams < 150 || skyr.grams > 190))) {
      issues.push("Välipala on yksi Ísey Skyr Persikka.");
    }
    if (!banana || banana.pieces < 1) issues.push("Skyr-välipalaan kuuluu yksi banaani.");
  }
  if (prefs.snack === "quark") {
    const quark = find(meal, /rahka/i);
    const banana = find(meal, /banaani/i);
    if (!quark || quark.grams < 180 || quark.grams > 230) issues.push("Välipala on noin 200 g proteiinirahkaa.");
    if (!banana || banana.pieces < 1) issues.push("Rahka-välipalaan kuuluu yksi banaani.");
  }
}

function checkEvening(meal: Meal, issues: string[]): void {
  const cheese = find(meal, /raejuusto/i);
  if (!cheese || cheese.grams < 190 || cheese.grams > 220) {
    issues.push("Iltapalassa pitää olla 200 g rasvatonta raejuustoa.");
  }
  const cashew = find(meal, /cashew/i);
  const walnut = find(meal, /saksanpähkin|saksanpahkin/i);
  const nutCount = [cashew, walnut].filter((item) => item && item.grams > 0).length;
  if (nutCount !== 1) issues.push("Iltapalassa on oltava joko cashewpähkinät tai saksanpähkinät, ei molempia.");
  if (cashew && cashew.grams > 0 && (cashew.grams < 18 || cashew.grams > 22)) {
    issues.push("Cashewpähkinöitä iltapalalla on 20 g.");
  }
  if (walnut && walnut.grams > 0 && (walnut.grams < 14 || walnut.grams > 20)) {
    issues.push("Saksanpähkinöitä iltapalalla on 15–17 g.");
  }
}

function carbItems(meal: Meal): Ingredient[] {
  return meal.ingredients.filter((item) => CARB.test(item.name) && (item.grams >= 20 || item.pieces > 0));
}

function needsRecipe(meal: Meal): boolean {
  return meal.slot === "lounas" || meal.slot === "paivallinen" || (meal.slot === "jousto" && meal.kcal >= 500);
}

function checkRecipe(meal: Meal, label: string, issues: string[]): void {
  if (needsRecipe(meal) && meal.steps.length < 4) {
    issues.push(`${label}: reseptissä pitää olla vähintään neljä valmistusvaihetta.`);
  }
}

function spansDays(meals: Meal[]): boolean {
  const counts = new Map<string, number>();
  for (const meal of meals) {
    const key = meal.title.toLocaleLowerCase("fi");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].some((count) => count >= 2);
}

function checkBatchRecipe(meals: Meal[], label: string, issues: string[]): void {
  const groups = new Map<string, number>();
  for (const meal of meals) {
    const key = meal.title.toLocaleLowerCase("fi");
    groups.set(key, Math.max(groups.get(key) ?? 0, meal.steps.length));
  }
  for (const [title, steps] of groups) {
    if (steps < 4) issues.push(`${label} ${title}: satsin reseptissä pitää olla vähintään neljä valmistusvaihetta.`);
  }
}

function checkDinner(meal: Meal, label: string, issues: string[]): void {
  const carbs = carbItems(meal);
  if (carbs.length !== 1) {
    issues.push(`${label}: tasan yksi lisuke, riisi, pasta, nuudeli tai peruna.`);
  } else {
    const kind = sideKind(carbs[0].name);
    if (!kind) issues.push(`${label}: lisuke on riisi, pasta, nuudeli tai peruna.`);
    if (kind === "potato" && (carbs[0].grams < 250 || carbs[0].grams > 320)) {
      issues.push(`${label}: peruna on 250–300 g raakana.`);
    }
    if (kind && kind !== "potato" && (carbs[0].grams < 65 || carbs[0].grams > 75)) {
      issues.push(`${label}: riisi, pasta ja nuudeli ovat 70 g kuivana.`);
    }
  }
  const kind = proteinKind(meal);
  if ((kind.mince || kind.salmon) && !kind.poultry) {
    const oil = fatGrams(meal, /oliivi|öljy|oljy/i);
    const nuts = fatGrams(meal, /cashew|pähkin|pahkin/i);
    const avocado = fatGrams(meal, /avokado/i);
    if (oil >= 10 || nuts >= 20 || avocado >= 50) {
      issues.push(`${label}: jauhelihan tai lohen kanssa ei lisätä erillistä rasva-annosta.`);
    }
  }
  if (kind.poultry && !kind.mince && !kind.salmon && !recordedFat(meal)) {
    issues.push(`${label}: kanalle tai kalkkunalle tarvitaan yksi rasvalähde, tai kastikkeen rasva pitää kirjata ainesosaksi.`);
  }
}

function recordedFat(meal: Meal): boolean {
  return meal.ingredients.some((item) => FAT.test(item.name) || /kastike/i.test(item.name));
}

function checkMain(meal: Meal, label: string, issues: string[]): void {
  const kind = proteinKind(meal);
  if ((kind.mince || kind.salmon) && !kind.poultry) {
    const oil = fatGrams(meal, /oliivi|öljy|oljy/i);
    const nuts = fatGrams(meal, /cashew|pähkin|pahkin/i);
    const avocado = fatGrams(meal, /avokado/i);
    if (oil >= 10 || nuts >= 20 || avocado >= 50) {
      issues.push(`${label}: jauhelihan tai lohen kanssa ei lisätä erillistä rasva-annosta.`);
    }
  }
  if (kind.poultry && !kind.mince && !kind.salmon && !recordedFat(meal)) {
    issues.push(`${label}: kanalle tai kalkkunalle tarvitaan yksi rasvalähde, tai kastikkeen rasva pitää kirjata ainesosaksi.`);
  }
}

export function saturdayKcal(raw: RawMenu, prefs: FoodPrefs): number {
  const meals = raw.saturdayMeals.reduce((sum, meal) => sum + meal.kcal, 0);
  const treats = raw.saturdayTreats.reduce((sum, treat) => sum + treat.kcal, 0);
  return meals + treats + (prefs.includeMilk ? 200 : 0);
}

const WEEKDAY_NAMES = ["Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai"];

export function dietIssues(raw: RawMenu, prefs: FoodPrefs): string[] {
  const issues: string[] = [];
  if (raw.weekdays.length !== 5) issues.push("Viikossa pitää olla viisi eri arkipäivää.");
  raw.weekdays.forEach((day, index) => {
    const name = WEEKDAY_NAMES[index] ?? `Päivä ${index + 1}`;
    checkStructured(day.meals, name, issues);
    const [breakfast, lunch, snack, dinner, evening] = day.meals;
    if (breakfast && prefs.breakfast === "porridge") checkPorridge(breakfast, issues);
    if (snack) checkSnack(snack, prefs, issues);
    if (evening && prefs.evening === "cottage") checkEvening(evening, issues);
    if (lunch) checkMain(lunch, `${name} lounas`, issues);
    if (dinner) checkDinner(dinner, `${name} päivällinen`, issues);
  });

  const lunches = raw.weekdays.map((day) => day.meals[1]).filter((meal): meal is Meal => Boolean(meal));
  const dinners = raw.weekdays.map((day) => day.meals[3]).filter((meal): meal is Meal => Boolean(meal));
  checkBatchRecipe(lunches, "Lounas", issues);
  checkBatchRecipe(dinners, "Päivällinen", issues);
  if (prefs.batchCooking) {
    if (!spansDays(lunches)) issues.push("Lounas tehdään satsina ja syödään useana arkipäivänä.");
    if (!spansDays(dinners)) issues.push("Päivällinen tehdään satsina ja syödään useana arkipäivänä.");
  }
  const used = new Set<CarbId>();
  for (const day of raw.weekdays) {
    const dinner = day.meals[3];
    const carb = dinner ? carbItems(dinner)[0] : undefined;
    const kind = carb ? sideKind(carb.name) : null;
    if (kind) used.add(kind);
  }
  if (used.size < 2) issues.push("Arkipäivän lisuketta ei saa rajoittaa vain yhteen.");
  for (const kind of used) {
    if (!prefs.carbs.includes(kind)) issues.push("Arkipäivän lisuke ei ole valittujen joukossa.");
  }

  checkStructured(raw.sunday, "Sunnuntai", issues);

  const sundayLunch = raw.sunday[1];
  const sundayDinner = raw.sunday[3];
  const sundayBreakfast = raw.sunday[0];
  const sundaySnack = raw.sunday[2];
  const sundayEvening = raw.sunday[4];
  if (sundayBreakfast && prefs.breakfast === "porridge") checkPorridge(sundayBreakfast, issues);
  if (sundaySnack) checkSnack(sundaySnack, prefs, issues);
  if (sundayEvening && prefs.evening === "cottage") checkEvening(sundayEvening, issues);
  if (sundayLunch) {
    checkMain(sundayLunch, "Sunnuntain lounas", issues);
    checkRecipe(sundayLunch, "Sunnuntain lounas", issues);
  }
  if (sundayDinner) {
    checkMain(sundayDinner, "Sunnuntain päivällinen", issues);
    checkRecipe(sundayDinner, "Sunnuntain päivällinen", issues);
  }

  const saturday = saturdayKcal(raw, prefs);
  if (saturday < 2200 || saturday > 2500) {
    issues.push(`Lauantain arvio on ${saturday} kcal. Tavoite on 2200–2500 kcal ruokineen, juomineen ja herkkuineen.`);
  }

  raw.saturdayMeals.forEach((meal) => {
    if (meal.slot !== "jousto" && meal.slot !== "aamiainen" && meal.slot !== "valipala" && meal.slot !== "iltapala") {
      issues.push("Lauantain ruoka on joustopäivän ateria, aamiainen, välipala tai iltapala.");
    }
    if (meal.slot === "aamiainen" && prefs.breakfast === "porridge") checkPorridge(meal, issues);
    if (meal.slot === "valipala") checkSnack(meal, prefs, issues);
    if (meal.slot === "iltapala" && prefs.evening === "cottage") checkEvening(meal, issues);
    checkRecipe(meal, meal.title, issues);
  });

  return issues;
}
