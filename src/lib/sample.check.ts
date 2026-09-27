import assert from "node:assert/strict";
import { dietIssues, saturdayKcal } from "./checks";
import { DEFAULT_FOOD_PREFS } from "./prefs";
import { RECIPE_EXAMPLE_COUNT, buildRecipeLibraryPrompt, recipeExamplesForPrefs } from "./recipeExamples";
import { buildUserPrompt } from "./rules";
import { buildSamplePlan, sampleRaw } from "./sample";
import { loadRecipeVariant } from "./recipeBody";
import { batchLockDays } from "../components/WeekOverview";
import { inventionRequest, saturdayChoice } from "./invent";
import type { Meal } from "./types";
import { expandWeekPlan, fillUnlocked, pickWeek, placeInvented, type WeekPlanPick } from "./weekPlan";

const issues = dietIssues(sampleRaw, DEFAULT_FOOD_PREFS);
assert.deepEqual(issues, [], issues.join("\n"));
assert.equal(saturdayKcal(sampleRaw, DEFAULT_FOOD_PREFS), 2460);

assert.equal(RECIPE_EXAMPLE_COUNT, 26);
assert.ok(recipeExamplesForPrefs(DEFAULT_FOOD_PREFS).length >= 10);
const library = buildRecipeLibraryPrompt(DEFAULT_FOOD_PREFS);
assert.match(library, /Reseptikirjasto/);
assert.match(library, /Keksi lisäksi OMIA aterioita/);
assert.match(buildUserPrompt(DEFAULT_FOOD_PREFS, []), /Kanawokki|Uunilohi|Tacosalaatti/);

const pick: WeekPlanPick = {
  title: "Satsiviikko",
  summary: "Kaksi lounasta ja kaksi päivällistä.",
  lunches: [
    { title: "Italianpata", days: [0, 1, 2] },
    { title: "Kanasalaatti", days: [3, 4] },
  ],
  dinners: [
    { title: "Kanawokki", side: "rice", days: [0, 1, 2] },
    { title: "Jauheliha-perunavuoka", side: "potato", days: [3, 4] },
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

assert.equal(find("Atria Kevyt Nauta-Possu Jauheliha 9,5 %")?.grams, 1050);
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
assert.equal(makaroni.kcal, 590);
assert.ok(makaroni.ingredients.some((item) => item.name === "Makaroni" && item.grams >= 65 && item.grams <= 75));
assert.ok(makaroni.ingredients.some((item) => item.name === "Kananmuna" && item.pieces > 0));
assert.ok(makaroni.ingredients.some((item) => item.name === "Valkuainen" && item.pieces > 0));
assert.ok(makaroni.ingredients.some((item) => /maito/i.test(item.name) && item.ml > 0));
assert.equal(makaroni.ingredients.some((item) => /paprika|kesäkurpitsa/i.test(item.name)), false);
assert.ok(makaroni.steps.some((step) => /175/.test(step)));
assert.equal(makaroni.steps.some((step) => step.includes("###")), false);

const salaatti = loadRecipeVariant("Kanasalaatti", false);
assert.ok(salaatti);
assert.ok(salaatti.ingredients.some((item) => item.name === "Juusto"));
assert.ok(salaatti.ingredients.some((item) => /cashew/i.test(item.name)));
assert.equal(salaatti.ingredients.some((item) => item.name === "Kesäkurpitsa"), false);
assert.equal(salaatti.steps.some((step) => /Kuumenna pannu keskilämmölle/.test(step)), false);

const wok = loadRecipeVariant("Kanawokki", true);
assert.ok(wok?.ingredients.some((item) => item.name === "Paprika"));
assert.ok(wok?.ingredients.some((item) => item.name === "Kesäkurpitsa"));
assert.ok(wok?.ingredients.some((item) => item.name === "Sipuli"));
assert.ok(wok?.steps.some((step) => /cashew|cashewpähkin/i.test(step)));

const samplePlan = buildSamplePlan();
assert.deepEqual(batchLockDays(samplePlan, "tue", "lounas"), ["mon", "tue", "wed"]);
assert.deepEqual(batchLockDays(samplePlan, "sat", "lounas"), ["sat"]);

const localPick = pickWeek(DEFAULT_FOOD_PREFS, []);
const localIssues = dietIssues(expandWeekPlan(localPick, DEFAULT_FOOD_PREFS), DEFAULT_FOOD_PREFS);
assert.deepEqual(localIssues, [], localIssues.join("\n"));
const again = pickWeek(DEFAULT_FOOD_PREFS, [localPick.lunches[0].title, localPick.dinners[0].title]);
assert.notEqual(again.lunches[0].title, localPick.lunches[0].title);
assert.equal(inventionRequest(DEFAULT_FOOD_PREFS), null);
assert.equal(saturdayChoice(DEFAULT_FOOD_PREFS), null);
const saturdayFile = saturdayChoice({ ...DEFAULT_FOOD_PREFS, saturday: "tortillat kotona" });
assert.equal(saturdayFile?.kind, "library");
assert.equal(saturdayFile?.kind === "library" ? saturdayFile.title : "", "Tortillat");
const saturdayPizza = saturdayChoice({ ...DEFAULT_FOOD_PREFS, saturday: "Pizza" });
assert.equal(saturdayPizza?.kind, "invent");
assert.equal(saturdayPizza?.kind === "invent" ? saturdayPizza.request.slot : "", "jousto");
assert.match(saturdayPizza?.kind === "invent" ? saturdayPizza.request.brief : "", /Pizza/);
const asked = inventionRequest({ ...DEFAULT_FOOD_PREFS, inventOne: true, notes: "sitruunainen uunikala" });
assert.equal(asked?.slot, "paivallinen");
assert.match(asked?.brief ?? "", /sitruunainen/);
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

console.log("sample checks ok", plan.shopping.length, "shopping rows");
