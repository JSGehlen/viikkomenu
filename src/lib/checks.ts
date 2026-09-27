import { WEEKDAY_SLOTS, type FoodPrefs, type Ingredient, type Meal, type RawMenu } from "./types";

const CARB = /riis|pasta|nuudel|makaron|perun|tortilla|spaghet|penne|fusill/i;
const NUT = /pähkin|pahkin|cashew|manteli|maapähkinävoi|maapahkinavoi/i;
const FAT = /oliivi|avokado|cashew|pähkin|pahkin|kerma|creme|crème|juusto|feta|öljy|oljy|majonees|pesto/i;

function find(meal: Meal, pattern: RegExp): Ingredient | undefined {
  return meal.ingredients.find((item) => pattern.test(item.name));
}

function hasCarb(meal: Meal): boolean {
  return meal.ingredients.some((item) => CARB.test(item.name) && (item.grams >= 20 || item.pieces > 0));
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

function checkMain(meal: Meal, label: string, issues: string[]): void {
  if (hasCarb(meal)) issues.push(`${label} sisältää hiilihydraattilisukkeen, vaikka sitä ei kuulu tähän ateriaan.`);
  const kind = proteinKind(meal);
  if ((kind.mince || kind.salmon) && !kind.poultry) {
    const oil = fatGrams(meal, /oliivi|öljy|oljy/i);
    const nuts = fatGrams(meal, /cashew|pähkin|pahkin/i);
    const avocado = fatGrams(meal, /avokado/i);
    if (oil >= 10 || nuts >= 20 || avocado >= 50) {
      issues.push(`${label}: jauhelihan tai lohen kanssa ei lisätä erillistä rasva-annosta.`);
    }
  }
  if (kind.poultry && !kind.mince && !kind.salmon && fatGrams(meal, FAT) < 10) {
    issues.push(`${label}: kanalle tai kalkkunalle tarvitaan yksi rasvalähde, tai kastikkeen rasva pitää kirjata ainesosaksi.`);
  }
}

export function saturdayKcal(raw: RawMenu, prefs: FoodPrefs): number {
  const meals = raw.saturdayMeals.reduce((sum, meal) => sum + meal.kcal, 0);
  const treats = raw.saturdayTreats.reduce((sum, treat) => sum + treat.kcal, 0);
  return meals + treats + (prefs.includeMilk ? 200 : 0);
}

export function dietIssues(raw: RawMenu, prefs: FoodPrefs): string[] {
  const issues: string[] = [];
  checkStructured(raw.weekday, "Arki", issues);
  checkStructured(raw.sunday, "Sunnuntai", issues);

  const breakfast = raw.weekday[0];
  const lunch = raw.weekday[1];
  const snack = raw.weekday[2];
  const dinner = raw.weekday[3];
  const evening = raw.weekday[4];
  if (breakfast && prefs.breakfast === "porridge") checkPorridge(breakfast, issues);
  if (snack) checkSnack(snack, prefs, issues);
  if (evening && prefs.evening === "cottage") checkEvening(evening, issues);
  if (lunch) checkMain(lunch, "Arkilounas", issues);
  if (dinner && !hasCarb(dinner)) issues.push("Arkipäivälliseltä puuttuu hiilihydraattilisuke.");
  if (dinner) {
    const kind = proteinKind(dinner);
    if ((kind.mince || kind.salmon) && !kind.poultry) {
      const oil = fatGrams(dinner, /oliivi|öljy|oljy/i);
      const nuts = fatGrams(dinner, /cashew|pähkin|pahkin/i);
      const avocado = fatGrams(dinner, /avokado/i);
      if (oil >= 10 || nuts >= 20 || avocado >= 50) {
        issues.push("Arkipäivällinen: jauhelihan tai lohen kanssa ei lisätä erillistä rasva-annosta.");
      }
    }
    if (kind.poultry && !kind.mince && !kind.salmon && fatGrams(dinner, FAT) < 10) {
      issues.push("Arkipäivällinen: kanalle tai kalkkunalle tarvitaan yksi rasvalähde, tai kastikkeen rasva pitää kirjata ainesosaksi.");
    }
  }

  const sundayLunch = raw.sunday[1];
  const sundayDinner = raw.sunday[3];
  const sundayBreakfast = raw.sunday[0];
  const sundaySnack = raw.sunday[2];
  const sundayEvening = raw.sunday[4];
  if (sundayBreakfast && prefs.breakfast === "porridge") checkPorridge(sundayBreakfast, issues);
  if (sundaySnack) checkSnack(sundaySnack, prefs, issues);
  if (sundayEvening && prefs.evening === "cottage") checkEvening(sundayEvening, issues);
  if (sundayLunch) checkMain(sundayLunch, "Sunnuntain lounas", issues);
  if (sundayDinner) checkMain(sundayDinner, "Sunnuntain päivällinen", issues);

  const saturday = saturdayKcal(raw, prefs);
  if (saturday < 2200 || saturday > 2500) {
    issues.push(`Lauantain arvio on ${saturday} kcal. Tavoite on 2200–2500 kcal ruokineen, juomineen ja herkkuineen.`);
  }

  raw.saturdayMeals.forEach((meal) => {
    if (meal.slot !== "jousto") issues.push("Lauantain aterioiden slot on jousto.");
  });

  return issues;
}
