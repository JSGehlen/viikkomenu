import assert from "node:assert/strict";
import { dietIssues, proteinsInMeal, saturdayKcal, cookWarnings } from "./checks";
import { DEFAULT_FOOD_PREFS, sameFoodPrefs } from "./prefs";
import { RECIPE_EXAMPLE_COUNT, RECIPE_EXAMPLES, buildRecipeLibraryPrompt, recipeExamplesForPrefs } from "./recipeExamples";
import { buildUserPrompt } from "./rules";
import { buildSamplePlan, sampleRaw } from "./sample";
import { isBatchCook, listedIngredients } from "./format";
import { loadRecipeVariant, recipeBatchSize, recipeYield } from "./recipeBody";
import { isWater, shoppingName } from "./shoppingName";
import { batchLockDays, mealsFor } from "../components/WeekOverview";
import { carryForward, sundayLeftovers, weekdayLeftovers } from "./carry";
import { inventBatches, inventionRequest, saturdayChoice, saturdayMatches } from "./invent";
import { applySpan, includesSlot } from "./span";
import type { Meal } from "./types";
import { ensureCookDays, expandWeekPlan, fillUnlocked, pickWeek, placeInvented, type WeekPlanPick } from "./weekPlan";

const issues = dietIssues(sampleRaw, DEFAULT_FOOD_PREFS);
assert.deepEqual(issues, [], issues.join("\n"));
assert.equal(saturdayKcal(sampleRaw, DEFAULT_FOOD_PREFS), 2460);
assert.deepEqual(
  cookWarnings([
    "Sunnuntain lounas: reseptissä pitää olla vähintään neljä valmistusvaihetta.",
    "Torstai päivällinen: kanalle tai kalkkunalle tarvitaan yksi rasvalähde, tai kastikkeen rasva pitää kirjata ainesosaksi.",
    "Sunnuntain lounaalla ei ole riisiä, pastaa, nuudelia eikä perunaa.",
  ]),
  ["Sunnuntain lounaalla ei ole riisiä, pastaa, nuudelia eikä perunaa."],
);
assert.equal(sameFoodPrefs(DEFAULT_FOOD_PREFS, { ...DEFAULT_FOOD_PREFS, proteins: ["chicken", "beef"] }), true);
assert.equal(sameFoodPrefs(DEFAULT_FOOD_PREFS, { ...DEFAULT_FOOD_PREFS, saturday: "Pizza" }), false);

assert.ok(RECIPE_EXAMPLE_COUNT >= 30, String(RECIPE_EXAMPLE_COUNT));
assert.ok(recipeExamplesForPrefs(DEFAULT_FOOD_PREFS).length >= 10);
const library = buildRecipeLibraryPrompt(DEFAULT_FOOD_PREFS);
assert.match(library, /Reseptikirjasto/);
assert.match(library, /Keksi lisäksi OMIA aterioita/);
assert.match(buildUserPrompt(DEFAULT_FOOD_PREFS, []), /Kanawokki|Uunilohi|Tacosalaatti/);
assert.match(buildUserPrompt({ ...DEFAULT_FOOD_PREFS, preferences: "Suomalaista kotiruokaa" }, []), /Suomalaista kotiruokaa/);

const pick: WeekPlanPick = {
  title: "Satsiviikko",
  summary: "Kaksi lounasta ja kaksi päivällistä.",
  lunches: [
    { title: "Kanavuoka", days: [0, 1, 2] },
    { title: "Kanawokki", days: [3, 4] },
  ],
  dinners: [
    { title: "Tacosalaatti", side: "rice", days: [0, 1, 2] },
    { title: "Jauheliha-peruna vuoka", side: "potato", days: [3, 4] },
  ],
  saturdayNote: "Arvio.",
  saturdayTitles: ["Jauhelihatortillat", "Uunilohi"],
  sundayLunch: "Kanasalaatti",
  sundayDinner: "Uunilohi",
};
const expandedIssues = dietIssues(expandWeekPlan(pick, DEFAULT_FOOD_PREFS), DEFAULT_FOOD_PREFS);
assert.deepEqual(expandedIssues, [], expandedIssues.join("\n"));

const plan = buildSamplePlan();
const find = (name: string) => plan.shopping.find((item) => item.name === name);

assert.equal(find("Jauheliha 5–10 %")?.grams, 1050);
assert.equal(find("Paprika")?.category, "produce");
assert.equal(find("Paprikajauhe")?.category, "dry");
assert.ok((find("Paprikajauhe")?.grams ?? 0) > 0);
assert.equal(shoppingName("Paprikaa"), "Paprika");
assert.equal(shoppingName("Punaista paprikaa"), "Paprika");
assert.equal(shoppingName("paprikajauhetta"), "Paprikajauhe");
assert.equal(shoppingName("savupaprikaa"), "Savupaprikajauhe");
assert.equal(shoppingName("suolaa"), "Suola");
assert.equal(shoppingName("vettä"), "Vesi");
assert.equal(isWater("Vettä"), true);
assert.equal(isWater("Kiehuvaa vettä"), true);
assert.equal(isWater("Rasvaton maito"), false);
assert.equal(find("Vesi"), undefined);
assert.equal(find("Vettä"), undefined);
assert.equal(find("Jasmiiniriisi")?.grams, 210);
assert.equal(find("Pasta")?.grams, 140);
assert.equal(find("Nuudeli"), undefined);
assert.equal(find("Peruna")?.grams, 250);
assert.equal(find("Kaurahiutale")?.grams, 280);
assert.equal(find("Banaani")?.pieces, 12);
assert.equal(find("Rasvaton maito")?.ml, 4200);
assert.equal(find("Ísey Skyr Persikka")?.pieces, 6);
assert.equal(find("Kanafilee")?.grams, 900);
assert.equal(find("Oliiviöljy")?.grams, 90);
assert.equal(find("Jasmiiniriisi")?.uses.includes("Su · Päivällinen"), false);

const makaroni = loadRecipeVariant("Makaronilaatikko", true);
assert.ok(makaroni);
assert.ok(makaroni.ingredients.some((item) => item.name === "Makaroni" && item.grams >= 65 && item.grams <= 75));
assert.ok(makaroni.ingredients.some((item) => item.name === "Kananmuna" && item.pieces > 0));
assert.ok(makaroni.ingredients.some((item) => item.name === "Valkuainen" && item.pieces > 0));
assert.ok(makaroni.ingredients.some((item) => /maito/i.test(item.name) && item.ml > 0));
assert.equal(makaroni.ingredients.some((item) => /paprika|kesäkurpitsa/i.test(item.name)), false);
assert.ok(makaroni.steps.some((step) => /175/.test(step)));
assert.equal(makaroni.steps.some((step) => step.includes("###")), false);

const salaatti = loadRecipeVariant("Kanafilee ja kasvikset", false);
assert.ok(salaatti);
assert.ok(salaatti.ingredients.some((item) => /juusto|feta/i.test(item.name)));
assert.equal(salaatti.ingredients.some((item) => /cashew/i.test(item.name)), false);
assert.equal(salaatti.ingredients.some((item) => item.name === "Kesäkurpitsa"), false);
assert.equal(salaatti.steps.some((step) => /Kuumenna pannu keskilämmölle/.test(step)), false);

const wok = loadRecipeVariant("Kanawokki", true);
assert.ok(wok?.ingredients.some((item) => item.name === "Kana"));
assert.ok(wok?.ingredients.some((item) => /cashew/i.test(item.name)));
assert.ok(wok?.ingredients.some((item) => /riis|pasta|nuudel/i.test(item.name)));
assert.ok(wok?.steps.some((step) => /cashew|cashewpähkin/i.test(step)));

const samplePlan = buildSamplePlan();
assert.deepEqual(batchLockDays(samplePlan, "tue", "lounas"), ["mon", "tue", "wed"]);
assert.deepEqual(batchLockDays(samplePlan, "sat", "lounas"), ["sat"]);
const mondayLunch = mealsFor(samplePlan, "mon").find((meal) => meal.slot === "lounas");
const continuedSunday = {
  ...samplePlan,
  sunday: samplePlan.sunday.map((meal) => (meal.slot === "lounas" && mondayLunch ? { ...meal, title: mondayLunch.title } : meal)),
};
assert.deepEqual(batchLockDays(continuedSunday, "tue", "lounas"), ["mon", "tue", "wed", "sun"]);
assert.deepEqual(batchLockDays(continuedSunday, "sun", "lounas"), ["mon", "tue", "wed", "sun"]);
assert.deepEqual(batchLockDays(continuedSunday, "sun", "paivallinen"), ["sun"]);

const localPick = pickWeek(DEFAULT_FOOD_PREFS, []);
const localIssues = dietIssues(expandWeekPlan(localPick, DEFAULT_FOOD_PREFS), DEFAULT_FOOD_PREFS);
assert.deepEqual(localIssues, [], localIssues.join("\n"));
const generated = expandWeekPlan(pickWeek(DEFAULT_FOOD_PREFS), DEFAULT_FOOD_PREFS);
const generatedProteins = new Set(
  generated.weekdays.flatMap((day) =>
    day.meals.filter((meal) => meal.slot === "lounas" || meal.slot === "paivallinen").flatMap((meal) => proteinsInMeal(meal)),
  ),
);
assert.ok(generatedProteins.has("beef") && generatedProteins.has("chicken"), [...generatedProteins].join(","));
const chickenOnly = expandWeekPlan(
  {
    ...pick,
    lunches: [
      { title: "Kanavuoka", days: [0, 1, 2] },
      { title: "Kanawokki", days: [3, 4] },
    ],
    dinners: [
      { title: "Kana uunissa", side: "rice", days: [0, 1, 2] },
      { title: "Kana Scezhuan", side: "pasta", days: [3, 4] },
    ],
  },
  DEFAULT_FOOD_PREFS,
);
assert.ok(dietIssues(chickenOnly, DEFAULT_FOOD_PREFS).some((issue) => /vain proteiinia/.test(issue)));
const again = pickWeek(DEFAULT_FOOD_PREFS, [localPick.lunches[0].title, localPick.dinners[0].title]);
assert.notEqual(again.lunches[0].title, localPick.lunches[0].title);
assert.equal(inventionRequest(DEFAULT_FOOD_PREFS), null);
assert.equal(saturdayChoice(DEFAULT_FOOD_PREFS), null);
assert.equal(saturdayMatches("Tonnikalapizza", "Pizza"), true);
assert.equal(saturdayMatches("Kokoliha grillissä", "Pizza"), false);
const saturdayFile = saturdayChoice({ ...DEFAULT_FOOD_PREFS, saturday: "tortillat kotona" });
assert.equal(saturdayFile?.kind, "invent");
const saturdayPizza = saturdayChoice({ ...DEFAULT_FOOD_PREFS, saturday: "Pizza" });
assert.equal(saturdayPizza?.kind, "invent");
assert.equal(saturdayPizza?.kind === "invent" ? saturdayPizza.request.slot : "", "jousto");
assert.match(saturdayPizza?.kind === "invent" ? saturdayPizza.request.brief : "", /Pizza/);
assert.equal(inventionRequest({ ...DEFAULT_FOOD_PREFS, inventOne: true, notes: "sitruunainen uunikala" }), null);
const asked = { brief: "sitruunainen uunikala", slot: "paivallinen" as const, side: "pasta" as const };
const invented: Meal = {
  slot: "paivallinen",
  title: "Sitruunainen uunikala",
  blurb: "Keksitty satsi.",
  ingredients: [{ name: "Lohi", category: "meat", grams: 150, pieces: 0, ml: 0, detail: "" }],
  steps: ["Lämmitä uuni 200 asteeseen.", "Mausta lohi.", "Paista 12 minuuttia.", "Tarjoile."],
  kcal: 560,
  proteinG: 35,
  carbsG: 50,
  fatG: 18,
  prep: "",
};
const placed = placeInvented(localPick, invented, "paivallinen", asked?.side ?? "pasta");
const withNew = expandWeekPlan(placed, DEFAULT_FOOD_PREFS, new Map([[invented.title, invented]]));
assert.equal(withNew.weekdays[3].meals.find((meal) => meal.slot === "paivallinen")?.title, invented.title);
assert.equal(withNew.weekdays[0].meals.find((meal) => meal.slot === "paivallinen")?.title, localPick.dinners[0].title);

const source = expandWeekPlan(localPick, DEFAULT_FOOD_PREFS);
const kept = (["mon", "tue", "wed"] as const).flatMap((day, index) => [
  { day, slot: "lounas" as const, meal: source.weekdays[index].meals[1] },
  { day, slot: "paivallinen" as const, meal: source.weekdays[index].meals[3] },
]);
const filled = fillUnlocked(DEFAULT_FOOD_PREFS, kept, []);
assert.equal(filled.weekdays[0].meals[1].title, source.weekdays[0].meals[1].title);
assert.equal(filled.weekdays[1].meals[1].steps.join("\n"), source.weekdays[1].meals[1].steps.join("\n"));
assert.equal(filled.weekdays[2].meals[3].title, source.weekdays[2].meals[3].title);
assert.equal(filled.weekdays[3].meals[1].title, filled.weekdays[4].meals[1].title);
assert.notEqual(filled.weekdays[3].meals[1].title, source.weekdays[0].meals[1].title);
assert.notEqual(filled.weekdays[3].meals[3].title, source.weekdays[0].meals[3].title);
const filledIssues = dietIssues(filled, DEFAULT_FOOD_PREFS);
assert.deepEqual(filledIssues, [], filledIssues.join("\n"));
const saturdayRaw = expandWeekPlan(localPick, DEFAULT_FOOD_PREFS);
assert.equal(saturdayRaw.saturdayMeals.filter((meal) => meal.slot === "jousto").length, 1);
assert.ok(saturdayRaw.saturdayMeals.some((meal) => meal.slot === "aamiainen"));
assert.ok(saturdayRaw.saturdayMeals.some((meal) => meal.slot === "valipala"));
assert.ok(saturdayRaw.saturdayMeals.some((meal) => meal.slot === "iltapala"));
const standing = saturdayRaw.saturdayMeals.filter((meal) => meal.slot !== "jousto").reduce((sum, meal) => sum + meal.kcal, 0);
assert.ok(standing >= 900);
assert.ok((saturdayRaw.saturdayTreats[0]?.kcal ?? 0) < 2200 - standing);
const saturdayTotal = saturdayKcal(saturdayRaw, DEFAULT_FOOD_PREFS);
assert.ok(saturdayTotal >= 2200 && saturdayTotal <= 2500, String(saturdayTotal));
const pizzaMeal: Meal = {
  slot: "jousto",
  title: "Pizza",
  blurb: "Lauantain toive: Pizza.",
  ingredients: [{ name: "Vehnäjauho", category: "dry", grams: 80, pieces: 0, ml: 0, detail: "" }],
  steps: ["Tee taikina.", "Nosta tunti.", "Paista 220 asteessa 12 minuuttia.", "Tarjoile."],
  kcal: 900,
  proteinG: 35,
  carbsG: 90,
  fatG: 28,
  prep: "",
};
const pizzaWeek = expandWeekPlan(placeInvented(localPick, pizzaMeal, "jousto", "pasta"), DEFAULT_FOOD_PREFS, new Map([[pizzaMeal.title, pizzaMeal]]));
assert.deepEqual(
  pizzaWeek.saturdayMeals.filter((meal) => meal.slot === "jousto").map((meal) => meal.title),
  ["Pizza"],
);
const pizzaStanding = pizzaWeek.saturdayMeals.filter((meal) => meal.slot !== "jousto").reduce((sum, meal) => sum + meal.kcal, 0);
assert.ok((pizzaWeek.saturdayTreats[0]?.kcal ?? 0) < 2200 - pizzaStanding);
const pizzaTotal = saturdayKcal(pizzaWeek, DEFAULT_FOOD_PREFS);
assert.ok(pizzaTotal >= 2200 && pizzaTotal <= 2500, String(pizzaTotal));

assert.equal(recipeYield("Kanavuoka", false), 6);
assert.equal(recipeYield("Szechuan-kana", false), 6);
const coupleWeek = expandWeekPlan(pickWeek({ ...DEFAULT_FOOD_PREFS, householdSize: 2 }), { ...DEFAULT_FOOD_PREFS, householdSize: 2 });
const coupleLunches = coupleWeek.weekdays.map((day) => day.meals.find((meal) => meal.slot === "lounas")?.title ?? "");
const coupleRepeated = coupleLunches.filter((title) => title === coupleLunches[0]).length;
assert.ok(coupleRepeated >= 2, coupleLunches.join(", "));
assert.equal(recipeYield("Jauheliha-perunavuoka", true), 8);
assert.equal(recipeBatchSize("Jauheliha-perunavuoka", true), 8);
const batchSunday = expandWeekPlan({ ...pick, sundayLunch: "Kanafilee ja kasvikset", sundayDinner: "Jauheliha-perunavuoka" }, DEFAULT_FOOD_PREFS);
const sundayCasserole = batchSunday.sunday.find((meal) => meal.slot === "paivallinen");
assert.notEqual(sundayCasserole?.title, "Jauheliha-peruna vuoka");
assert.equal(
  sundayCasserole?.ingredients.some((item) => /riis|pasta|nuudel|makaron|perun/i.test(item.name)),
  false,
);
assert.equal(batchSunday.weekdays.some((day) => day.meals.some((meal) => meal.slot === "paivallinen" && meal.title === "Jauheliha-peruna vuoka")), true);
const wokSunday = expandWeekPlan(
  {
    ...pick,
    lunches: [{ title: "Kanavuoka", days: [0, 1, 2, 3, 4] }],
    dinners: [
      { title: "Kanawokki", side: "rice", days: [0] },
      { title: "Kana Scezhuan", side: "noodles", days: [1, 2, 3, 4] },
    ],
  },
  DEFAULT_FOOD_PREFS,
);
const sundayWok = wokSunday.sunday.find((meal) => meal.slot === "paivallinen");
assert.equal(sundayWok?.title, "Kanawokki");
assert.equal(
  sundayWok?.ingredients.some((item) => /riis|pasta|nuudel|makaron|perun/i.test(item.name)),
  false,
);
assert.match(
  wokSunday.weekdays[0]?.meals.find((meal) => meal.slot === "paivallinen")?.ingredients.map((item) => item.name).join(" ") ?? "",
  /riis|pasta|nuudel/i,
);
const wokMains = wokSunday.weekdays.flatMap((day, index) => {
  const id = (["mon", "tue", "wed", "thu", "fri"] as const)[index] ?? "mon";
  return day.meals
    .filter((meal) => meal.slot === "lounas" || meal.slot === "paivallinen")
    .map((meal) => ({ day: id, slot: meal.slot as "lounas" | "paivallinen", meal }));
});
const wokCarry = carryForward(wokSunday.sunday, wokMains, 1);
const mondayWok = wokCarry.find((item) => item.day === "mon" && item.slot === "paivallinen");
assert.equal(mondayWok?.meal.title, "Kanawokki");
assert.match(mondayWok?.meal.ingredients.map((item) => item.name).join(" ") ?? "", /riis|pasta|nuudel/i);
const wokIssues = dietIssues(wokSunday, { ...DEFAULT_FOOD_PREFS, proteins: ["chicken"] });
assert.deepEqual(wokIssues, [], wokIssues.join("\n"));
assert.match(batchSunday.weekdays[3]?.meals.find((meal) => meal.slot === "paivallinen")?.prep ?? "", /ensi viikolla/);
assert.equal(batchSunday.sunday.find((meal) => meal.slot === "lounas")?.servings, undefined);
assert.equal(recipeYield("Makaronilaatikko", true), 8);
assert.equal(recipeYield("Kanafilee ja kasvikset", false), 1);
assert.deepEqual(
  inventBatches(["mon", "tue", "thu"]).map((batch) => batch.days.join("")),
  ["montue", "montue", "thu", "thu"],
);
assert.equal(inventBatches(["sun"])[1]?.plain, true);

const shortWeekPrefs = { ...DEFAULT_FOOD_PREFS, startDay: "tue" as const, startSlot: "paivallinen" as const };
assert.equal(includesSlot("mon", "iltapala", shortWeekPrefs), false);
assert.equal(includesSlot("tue", "lounas", shortWeekPrefs), false);
assert.equal(includesSlot("tue", "paivallinen", shortWeekPrefs), true);
const shortWeek = ensureCookDays(applySpan(expandWeekPlan(pickWeek(shortWeekPrefs), shortWeekPrefs), shortWeekPrefs), shortWeekPrefs);
assert.equal(shortWeek.weekdays[0]?.meals.length, 0);
assert.equal(shortWeek.weekdays[1]?.meals.some((meal) => meal.slot === "lounas"), false);
assert.equal(shortWeek.weekdays[1]?.meals.some((meal) => meal.slot === "paivallinen"), true);
const shortIssues = dietIssues(shortWeek, shortWeekPrefs);
assert.deepEqual(shortIssues, [], shortIssues.join("\n"));

const casserole: Meal = {
  slot: "paivallinen",
  title: "Jauheliha-perunavuoka",
  blurb: "Sunnuntain vuoka.",
  ingredients: [
    { name: "Jauheliha", category: "meat", grams: 150, pieces: 0, ml: 0, detail: "" },
    { name: "Peruna", category: "produce", grams: 250, pieces: 0, ml: 0, detail: "raakana" },
  ],
  steps: ["Ruskista jauheliha.", "Kasaa vuoka.", "Paista 225 asteessa 75 minuuttia.", "Jaa annoksiin."],
  kcal: 580,
  proteinG: 35,
  carbsG: 58,
  fatG: 18,
  prep: "",
};
const carried = sundayLeftovers([casserole], 1);
assert.equal(carried.filter((item) => item.slot === "paivallinen").length, 5);
assert.equal(carried.filter((item) => item.slot === "lounas").length, 2);
assert.match(carried[0]?.meal.prep ?? "", /Edellisen sunnuntain/);
assert.equal(carried[0]?.meal.steps.length, 4);
const continued = fillUnlocked(DEFAULT_FOOD_PREFS, carried, []);
assert.equal(continued.weekdays[0]?.meals.find((meal) => meal.slot === "paivallinen")?.title, "Jauheliha-perunavuoka");
assert.match(continued.weekdays[4]?.meals.find((meal) => meal.slot === "paivallinen")?.prep ?? "", /Edellisen sunnuntain/);
const kanavuoka: Meal = { ...casserole, slot: "lounas", title: "Kanavuoka" };
const leftoverLunches = weekdayLeftovers(
  [
    { day: "thu", slot: "lounas", meal: kanavuoka },
    { day: "fri", slot: "lounas", meal: { ...kanavuoka, steps: ["Lämmitä.", "Tarkista.", "Tarjoile."] } },
  ],
  1,
);
assert.equal(leftoverLunches.length, 4);
assert.equal(leftoverLunches[0]?.day, "mon");
assert.equal(leftoverLunches.every((item) => item.meal.title === "Kanavuoka"), true);

const couplePrefs = { ...DEFAULT_FOOD_PREFS, householdSize: 2 as const, startDay: "mon" as const, startSlot: "paivallinen" as const };
const longLunch = "Lihapullat tomaattikastikkeessa";
const otherLunches = recipeExamplesForPrefs(couplePrefs)
  .filter((item) => item.lunchOk && item.title !== longLunch)
  .map((item) => item.title);
const hole = fillUnlocked(
  couplePrefs,
  [
    { day: "tue", slot: "lounas", meal: { ...kanavuoka, ingredients: kanavuoka.ingredients.filter((item) => !/perun/i.test(item.name)) } },
    { day: "wed", slot: "lounas", meal: { ...kanavuoka, ingredients: kanavuoka.ingredients.filter((item) => !/perun/i.test(item.name)), steps: ["Lämmitä.", "Tarkista.", "Tarjoile."] } },
  ],
  otherLunches,
);
const thursday = hole.weekdays[3]?.meals.find((meal) => meal.slot === "lounas");
const friday = hole.weekdays[4]?.meals.find((meal) => meal.slot === "lounas");
const sundayLunch = hole.sunday.find((meal) => meal.slot === "lounas");
assert.equal(thursday?.title, longLunch);
assert.equal(friday?.title, longLunch);
assert.equal(sundayLunch?.title, longLunch);
assert.equal(hole.weekdays[1]?.meals.find((meal) => meal.slot === "lounas")?.title, "Kanavuoka");
assert.equal(hole.weekdays[0]?.meals.some((meal) => meal.slot === "lounas"), false);
assert.match(thursday?.prep ?? "", /3 päivää tällä viikolla, 1 päivä ensi viikolla/);
const nextLunches = carryForward(
  hole.sunday,
  (["mon", "tue", "wed", "thu", "fri"] as const).flatMap((day) => {
    const meal = hole.weekdays[["mon", "tue", "wed", "thu", "fri"].indexOf(day)]?.meals.find((item) => item.slot === "lounas");
    return meal ? [{ day, slot: "lounas" as const, meal }] : [];
  }),
  2,
);
assert.equal(nextLunches.filter((item) => item.meal.title === longLunch).length, 1);

for (const example of RECIPE_EXAMPLES) {
  for (const dinner of [false, true]) {
    const variant = loadRecipeVariant(example.title, dinner);
    const size = recipeBatchSize(example.title, dinner);
    if (!variant || !size || size < 2) continue;
    const cook = { servings: size, prep: `Satsi ${size} annosta. Tällä viikolla 2 päivänä.`, ingredients: variant.ingredients };
    assert.equal(isBatchCook(cook), true, example.title);
    const shown = listedIngredients(cook);
    for (const item of variant.ingredients) {
      if (!item.grams) continue;
      const row = shown.find((next) => next.name === item.name);
      if (!row) continue;
      assert.ok(Math.abs(row.grams - item.grams * size) < 1, `${example.title} ${item.name} ${row.grams} vs ${item.grams * size}`);
    }
    const later = listedIngredients({ ...cook, prep: "Tämä päivä syö aiemmin tehtyä satsia.", blurb: "Annos valmiista satsista." });
    const plate = variant.ingredients.find((item) => item.grams > 0);
    const laterRow = plate ? later.find((item) => item.name === plate.name) : undefined;
    if (plate && laterRow) assert.equal(laterRow.grams, plate.grams, `${example.title} leftover`);
  }
}

const scez = loadRecipeVariant("Kana Scezhuan", false);
assert.ok(scez);
const scezCook = listedIngredients({
  servings: 6,
  prep: "Satsi 6 annosta. Tällä viikolla 3 päivänä.",
  ingredients: [
    ...scez.ingredients,
    { name: "Rypsi", category: "produce", grams: scez.ingredients.find((item) => item.name === "Öljy")?.grams ?? 9, pieces: 0, ml: 0, detail: "raaka" },
  ],
});
assert.equal(scezCook.find((item) => item.name === "Kana")?.grams, (scez.ingredients.find((item) => item.name === "Kana")?.grams ?? 0) * 6);
assert.equal(scezCook.filter((item) => /öljy|rypsi/i.test(item.name)).length, 1);

console.log("sample checks ok", plan.shopping.length, "shopping rows");
